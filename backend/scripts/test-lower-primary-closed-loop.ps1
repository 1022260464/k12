param(
    [Parameter(Mandatory = $true)]
    [string]$AccessToken,
    [string]$BaseUrl = "http://127.0.0.1:8080",
    [ValidateRange(1, 10)]
    [int]$Rounds = 3,
    [ValidateRange(30, 600)]
    [int]$RequestTimeoutSec = 180
)

$ErrorActionPreference = "Stop"
$headers = @{ Authorization = "Bearer $AccessToken" }

function Invoke-K12 {
    param([string]$Method, [string]$Path, $Body = $null, [switch]$Public)
    $arguments = @{
        Method = $Method
        Uri = "$BaseUrl$Path"
        ContentType = "application/json"
        TimeoutSec = $RequestTimeoutSec
    }
    if (-not $Public) { $arguments.Headers = $headers }
    if ($null -ne $Body) { $arguments.Body = ($Body | ConvertTo-Json -Depth 20 -Compress) }
    $response = Invoke-RestMethod @arguments
    if ($response.code -ne 200) { throw "$Method $Path failed: $($response.message)" }
    return $response.data
}

$books = Invoke-K12 -Method GET -Path "/api/v1/learning/picture-books/published" -Public
if (@($books).Count -lt 2) { throw "Expected at least two published picture books, got $(@($books).Count)." }

$results = @()
for ($round = 1; $round -le $Rounds; $round++) {
    $sessionId = "lower-primary-http-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$round"
    $run = Invoke-K12 -Method POST -Path "/api/v1/agents/lower-primary-tutor/runs" -Body @{
        inputText = "请给小学低年级学生讲解图像分类，并准备图片分类游戏。"
        sessionId = $sessionId
        executionMode = "SYNC"
        context = @{
            preferDeterministic = $true
            requirePracticeArtifact = $true
            topicCode = "machine_learning.image_classification"
            topic = "图像分类"
            preferredInteraction = @("互动绘本", "图片选择", "短句讲解")
            lessonMode = "guided-picture-book"
        }
    }
    if ($run.status -ne "SUCCEEDED") { throw "Round $round agent status is $($run.status)." }

    $quizArtifact = @($run.artifacts) | Where-Object { $_.mimeType -eq "application/vnd.k12.quiz.v1+json" } | Select-Object -First 1
    if (-not $quizArtifact -or -not $quizArtifact.payload.questions) { throw "Round $round returned no quiz artifact." }

    $answers = foreach ($question in $quizArtifact.payload.questions) {
        $optionId = if ($question.correctOptionId) { $question.correctOptionId }
            elseif ($question.id -like "*.cat-card") { "cat" }
            elseif ($question.id -like "*.dog-card") { "dog" }
            elseif ($question.id -like "*.blur-card") { "check" }
            else { throw "Unknown controlled question: $($question.id)" }
        @{ questionId = $question.id; optionId = $optionId }
    }

    $attempt = Invoke-K12 -Method POST -Path "/api/v1/assessments/practice-attempts" -Body @{
        runId = $run.runId
        hintCount = $round - 1
        durationMs = 30000 + ($round * 1000)
        answers = @($answers)
    }
    if ($attempt.score -ne $attempt.maxScore) { throw "Round $round was not scored as all correct." }

    $mastery = @(Invoke-K12 -Method GET -Path "/api/v1/assessments/practice-attempts/me/mastery")
    $catMastery = $mastery | Where-Object { $_.knowledgeCode -eq "machine_learning.image_classification" } | Select-Object -First 1
    if (-not $catMastery) { throw "Round $round did not update image-classification mastery." }

    $recommendations = @(Invoke-K12 -Method POST -Path "/api/v1/learning/courses/personalized" -Body @{
        mastery = @($mastery | ForEach-Object { @{ knowledgeCode = $_.knowledgeCode; masteryPercent = $_.masteryPercent } })
        limit = 4
    })
    if ($recommendations.Count -eq 0) { throw "Round $round returned no cross-course recommendation." }

    $results += [pscustomobject]@{
        Round = $round
        RunId = $run.runId
        Score = "$($attempt.score)/$($attempt.maxScore)"
        Mastery = "$($catMastery.masteryPercent)%"
        Badge = $attempt.badgeName
        NextCourse = $recommendations[0].course.title
    }
}

$results | Format-Table -AutoSize
Write-Host "PASS: $Rounds consecutive lower-primary HTTP closed-loop rounds completed." -ForegroundColor Green
