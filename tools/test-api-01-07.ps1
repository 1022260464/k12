param(
    [string]$MySqlHome = 'C:/Program Files/MySQL/MySQL Server 8.0',
    [string]$MavenPath
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $repo 'backend'
$mysql = Join-Path $MySqlHome 'bin/mysql.exe'
$mysqld = Join-Path $MySqlHome 'bin/mysqld.exe'
$mysqladmin = Join-Path $MySqlHome 'bin/mysqladmin.exe'
foreach ($binary in @($mysql, $mysqld, $mysqladmin)) {
    if (!(Test-Path -LiteralPath $binary)) { throw "Missing MySQL binary: $binary" }
}
if (!$MavenPath) {
    $command = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($command) { $MavenPath = $command.Source }
    else {
        $MavenPath = Get-ChildItem (Join-Path $env:USERPROFILE '.m2/wrapper/dists') -Recurse -Filter mvn.cmd -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
}
if (!$MavenPath -or !(Test-Path -LiteralPath $MavenPath)) { throw 'Supply -MavenPath with a valid mvn.cmd path.' }
if (Get-NetTCPConnection -LocalPort 33079 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 33079 is occupied. No existing server will be used or stopped.'
}
$dataDir = Join-Path $PSScriptRoot ('.cache/mysql-01-07-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $dataDir | Out-Null
$server = $null
$pushed = $false
try {
    & $mysqld --no-defaults --initialize-insecure "--basedir=$MySqlHome" "--datadir=$dataDir" --console *> ($dataDir + '.initialize.log')
    if ($LASTEXITCODE -ne 0) { throw "MySQL initialization failed. See $dataDir" }
    $server = Start-Process -FilePath $mysqld -WindowStyle Hidden -PassThru -ArgumentList @(
        '--no-defaults', ('--datadir="{0}"' -f $dataDir),
        '--port=33079', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin'
    )
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($server.HasExited) { throw "Temporary MySQL exited. See $dataDir" }
        & $mysqladmin --protocol=TCP -h 127.0.0.1 -P 33079 -u root ping *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready) { throw 'Temporary MySQL did not become ready.' }
    foreach ($name in @('k12_auth_init.sql', 'k12_business_init.sql',
            'k12_homework_submission_upgrade.sql', 'k12_learning_profile_permission_upgrade.sql',
            'k12_homework_submission_upgrade.sql', 'k12_learning_profile_permission_upgrade.sql')) {
        $sqlPath = (Join-Path $backend "sql/mysql/$name").Replace('\', '/')
        & $mysql --protocol=TCP -h 127.0.0.1 -P 33079 -u root --default-character-set=utf8mb4 "--execute=source $sqlPath"
        if ($LASTEXITCODE -ne 0) { throw "SQL failed: $name" }
    }
    foreach ($database in @('k12_auth', 'k12_business')) {
        & $mysql --protocol=TCP -h 127.0.0.1 -P 33079 -u root "--database=$database" --execute="CREATE TABLE codex_verification_guard(id INT PRIMARY KEY, marker VARCHAR(32)); INSERT INTO codex_verification_guard VALUES(1,'isolated-01-07');"
        if ($LASTEXITCODE -ne 0) { throw "Cannot mark isolated database: $database" }
    }
    Push-Location $backend
    $pushed = $true
    & $MavenPath -B clean test '-Dk12.test.mysql=true'
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed. See module target/surefire-reports.' }
    Write-Host 'All backend tests passed, including isolated MySQL 01/07 workflows.'
} finally {
    if ($pushed) { Pop-Location }
    if ($server -and !$server.HasExited) {
        & $mysqladmin --protocol=TCP -h 127.0.0.1 -P 33079 -u root shutdown *> $null
        if (!$server.WaitForExit(10000)) { $server.Kill(); $server.WaitForExit() }
    }
    Write-Host "Verification database files retained at: $dataDir"
}
