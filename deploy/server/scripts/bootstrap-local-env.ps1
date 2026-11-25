param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$serverRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $serverRoot "../..")
$targetPath = Join-Path $serverRoot ".env"
$runtimeEnvPath = Join-Path $repoRoot "ai-services/k12-agent-runtime/.env"

if ((Test-Path $targetPath) -and -not $Force) {
    throw "deploy/server/.env already exists. Use -Force only when you intend to replace it."
}

function New-RandomHex {
    return ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
}

function Read-EnvValue {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path $Path)) {
        return ""
    }

    $match = Get-Content -Path $Path -Encoding UTF8 |
        Where-Object { $_ -match "^$([regex]::Escape($Name))\s*=\s*(.*)$" } |
        Select-Object -First 1

    if (-not $match) {
        return ""
    }

    return ([regex]::Match($match, "^$([regex]::Escape($Name))\s*=\s*(.*)$")).Groups[1].Value.Trim()
}

$dashscopeApiKey = Read-EnvValue -Path $runtimeEnvPath -Name "K12_AGENT_LLM_API_KEY"
$internalApiKey = Read-EnvValue -Path $runtimeEnvPath -Name "K12_AGENT_INTERNAL_API_KEY"

if ([string]::IsNullOrWhiteSpace($internalApiKey)) {
    $internalApiKey = New-RandomHex
}

$lines = @(
    "COMPOSE_PROJECT_NAME=k12-local"
    "TZ=Asia/Shanghai"
    "PUBLIC_HOST=127.0.0.1"
    ""
    "USER_WEB_PORT=5173"
    "ADMIN_WEB_PORT=5174"
    "MINIO_API_PORT=9000"
    ""
    "MYSQL_ROOT_PASSWORD=$(New-RandomHex)"
    "MYSQL_APP_USER=k12"
    "MYSQL_APP_PASSWORD=$(New-RandomHex)"
    "K12_AUTH_DB_NAME=k12_auth"
    "K12_BUSINESS_DB_NAME=k12_business"
    ""
    "POSTGRES_DB=k12_rag"
    "POSTGRES_USER=k12rag"
    "POSTGRES_PASSWORD=$(New-RandomHex)"
    "POSTGRES_PORT=5432"
    ""
    "REDIS_PASSWORD=$(New-RandomHex)"
    ""
    "RABBITMQ_DEFAULT_USER=k12"
    "RABBITMQ_DEFAULT_PASS=$(New-RandomHex)"
    "RABBITMQ_DEFAULT_VHOST=k12"
    ""
    "MINIO_ROOT_USER=k12minio"
    "MINIO_ROOT_PASSWORD=$(New-RandomHex)"
    "MINIO_BUCKET=k12-agent-artifacts"
    "MINIO_AVATAR_BUCKET=k12-user-avatars"
    "MINIO_PUBLIC_ENDPOINT=http://127.0.0.1:9000"
    ""
    "NEO4J_PASSWORD=$(New-RandomHex)"
    "NEO4J_DATABASE=neo4j"
    ""
    "K12_JWT_ISSUER=k12-platform"
    "K12_JWT_SECRET=$(New-RandomHex)"
    "K12_JWT_ACCESS_TOKEN_TTL=30m"
    "K12_AGENT_INTERNAL_API_KEY=$internalApiKey"
    ""
    "NACOS_DISCOVERY_ENABLED=false"
    "NACOS_CONFIG_ENABLED=false"
    "NACOS_SERVER_ADDR=nacos:8848"
    "NACOS_NAMESPACE=public"
    "NACOS_GROUP=DEFAULT_GROUP"
    ""
    "DASHSCOPE_API_KEY=$dashscopeApiKey"
    "K12_AGENT_LLM_PROVIDER=dashscope"
    "K12_AGENT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1"
    "K12_AGENT_LLM_MODEL=qwen-plus"
    "K12_AGENT_TTS_ENABLED=true"
    "K12_AGENT_TTS_MODEL=cosyvoice-v3-flash"
    "K12_AGENT_TTS_VOICE=longanyang"
    "K12_AGENT_RAG_ENABLED=true"
    "K12_AGENT_EMBEDDING_PROVIDER=dashscope"
    "K12_AGENT_EMBEDDING_MODEL=text-embedding-v4"
    "K12_AGENT_RERANKER_PROVIDER=dashscope"
    "K12_AGENT_RERANKER_MODEL=qwen3-rerank"
    ""
    "K12_AGENT_TRACE_STORAGE_BACKEND=jsonl"
    "K12_AGENT_TRACE_RETENTION_DAYS=30"
    ""
    "K12_AGENT_SANDBOX_ENABLED=false"
    "K12_AGENT_SANDBOX_PROVIDER=tencent_agsx"
    "K12_AGENT_SANDBOX_TEMPLATE=k12-python-analysis-v1"
    "E2B_DOMAIN="
    "E2B_API_KEY="
    ""
    "JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=20.0 -Dfile.encoding=UTF-8"
    "K12_AGENT_CODE_DAILY_LIMIT=5"
    "K12_AGENT_RAG_DATABASE_MAX_POOL_SIZE=5"
)

[System.IO.File]::WriteAllLines($targetPath, $lines, [System.Text.UTF8Encoding]::new($false))

$mode = if ([string]::IsNullOrWhiteSpace($dashscopeApiKey)) {
    "DASHSCOPE_API_KEY is empty; AI calls will not work until it is filled."
} else {
    "DASHSCOPE_API_KEY was copied from the existing Python Runtime .env."
}

Write-Host "Created $targetPath"
Write-Host $mode
Write-Host "Secrets were generated locally and were not printed."
