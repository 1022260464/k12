# Piston 本地部署与版本锁定

本文是 K12 团队在 Windows 开发机上部署 Piston 的统一操作手册，覆盖首次安装、版本
锁定、语言运行时安装、验证、Git 忽略、日常维护、升级、回滚和故障排查。

## 1. 方案说明

Piston 是独立代码执行服务，不是 Python 依赖，也不会被打包进 Agent Runtime：

```text
React
  -> Spring Cloud Gateway
  -> Java Agent Service
  -> Python Agent Runtime
  -> http://127.0.0.1:2000
  -> Piston Docker Container
  -> Isolate
  -> Python / Java / Rust
```

本地开发时，Piston 运行在 Docker Desktop 的 Linux 虚拟环境中。后续迁移服务器时，只需
修改 Agent Runtime 的 Piston 地址，上层业务接口不需要重写。

## 2. 团队统一结论

```text
部署位置：开发者本机Docker Desktop
API地址：http://127.0.0.1:2000
源码来源：Piston官方Git仓库或固定Commit ZIP
源码版本：versions.env中的PISTON_GIT_COMMIT
镜像版本：versions.env中的PISTON_IMAGE digest
Python版本：versions.env中的PISTON_PYTHON_PACKAGE
公网访问：禁止
```

当前已验证：

```text
Piston API：正常
Python：3.12.0
测试输出：hello k12 piston
退出码：0
```

## 3. 目录与 Git 管理

```text
k12/
├── deploy/
│   ├── piston/
│   │   ├── README.md             提交Git
│   │   ├── compose.yaml          提交Git
│   │   └── versions.env          提交Git，不含密码
│   └── piston-runtime/           不提交Git
│       ├── cli/node_modules/     不提交Git
│       └── data/piston/packages/ 不提交Git
└── ai-services/
    └── k12-agent-runtime/
```

根目录 `.gitignore` 必须包含：

```gitignore
/deploy/piston-runtime/
```

整个 `piston-runtime` 被忽略，因为它包含第三方源码、CLI 依赖、语言运行时和本地数据。
团队只提交 K12 自己维护的部署文件和版本锁定文件。

## 4. 版本锁定原理

### 4.1 Git Commit 锁

`master` 会不断移动，完整 Commit SHA 指向确定源码：

```dotenv
PISTON_GIT_COMMIT=de2b365ac759670a3a0d13ea208a0869a92c7e64
```

Git Clone 方式使用 `git switch --detach <commit>`。ZIP 方式直接把 Commit 写入 codeload
下载 URL，两种方式得到相同版本源码。

### 4.2 Docker 镜像锁

`latest` 标签会变化，镜像 digest 指向确定镜像内容：

```dotenv
PISTON_IMAGE=ghcr.io/engineer-man/piston@sha256:...
```

K12 Compose 必须读取 digest，不能直接使用 `latest`。

### 4.3 语言运行时锁

执行环境也必须固定：

```dotenv
PISTON_PYTHON_PACKAGE=python=3.12.0
```

如果只执行 `ppman install python`，未来可能安装不同版本，导致团队运行结果不一致。

## 5. 环境要求

需要安装：

- Git。
- Node.js。
- Docker Desktop。
- Docker Compose。
- Linux Containers。
- cgroup v2。

Piston 官方要求源码使用 LF 换行，并要求 cgroup v2。Piston 使用 Isolate，官方容器需要
`privileged` 权限，因此只能部署在可信开发机或独立执行节点。

## 6. 首次安装

以下命令全部在 Windows PowerShell 中执行。

### 6.1 检查 Docker

```powershell
git --version
node --version
docker version
docker compose version
```

`docker version` 必须同时显示 Client 和 Server。如果出现：

```text
failed to connect to the docker API
```

启动 Docker Desktop，等待 Engine running。

检查 Linux Containers：

```powershell
docker info --format '{{.OSType}}'
```

预期输出：

```text
linux
```

检查 cgroup v2：

```powershell
docker run --rm alpine sh -c "stat -fc %T /sys/fs/cgroup"
```

预期输出：

```text
cgroup2fs
```

### 6.2 读取锁定版本

```powershell
Set-Location D:\CodeWorkPlace\k12

$versionFile = '.\deploy\piston\versions.env'
$commitLine = Get-Content $versionFile | Select-String '^PISTON_GIT_COMMIT='
$pythonLine = Get-Content $versionFile | Select-String '^PISTON_PYTHON_PACKAGE='

$pistonCommit = $commitLine.Line.Split('=', 2)[1]
$pythonPackage = $pythonLine.Line.Split('=', 2)[1]

$pistonCommit
$pythonPackage
```

不要手工从网页选择其他版本。所有成员都使用 `versions.env` 中的值。

### 6.3 获取源码：路线 A，Git Clone

优先使用 Git Clone：

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy

git -c core.autocrlf=false clone `
  https://github.com/engineer-man/piston.git `
  piston-runtime

Set-Location .\piston-runtime
git fetch origin
git switch --detach $pistonCommit
```

验证：

```powershell
git rev-parse HEAD
git status --short
```

第一条必须输出 `$pistonCommit`，第二条应当没有输出。出现 `detached HEAD` 是预期状态，
表示源码固定在某个 Commit。

### 6.4 获取源码：路线 B，固定 Commit ZIP

如果 Git Clone 出现：

```text
Failed to connect to github.com port 443
```

但 `codeload.github.com` 可以访问，则使用 ZIP 路线。首次执行前，目标目录必须不存在或
为空，不能覆盖已有运行时目录。

```powershell
Set-Location D:\CodeWorkPlace\k12

$target = 'D:\CodeWorkPlace\k12\deploy\piston-runtime'
$archive = Join-Path $env:TEMP "piston-$pistonCommit.zip"

if (Test-Path $target) {
  $existing = Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1
  if ($existing) {
    throw "目标目录不为空，请先确认现有Piston数据：$target"
  }
} else {
  New-Item -ItemType Directory -Path $target | Out-Null
}

curl.exe -L --fail `
  -o $archive `
  "https://codeload.github.com/engineer-man/piston/zip/$pistonCommit"

if ($LASTEXITCODE -ne 0) {
  throw 'Piston ZIP下载失败'
}

tar.exe -xf $archive -C $target --strip-components=1

if ($LASTEXITCODE -ne 0) {
  throw 'Piston ZIP解压失败'
}
```

ZIP 目录没有 `.git`，这是正常现象。它仍然由下载 URL 中的完整 Commit 锁定。升级时重新
下载新 Commit ZIP，不执行 `git fetch`。

路线 A 和路线 B 只选择一种，不能都执行。

### 6.5 安装 CLI 依赖

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\piston-runtime\cli
npm ci
```

使用 `npm ci`，不要使用会更新锁文件的命令。CLI 只用于管理语言运行时，不是 Piston API
服务本身。

如果 npm 报告上游依赖漏洞，不要执行 `npm audit fix --force`。强制修复会改变第三方依赖
并破坏版本锁定，应在升级 Piston 候选版本时统一评估。

### 6.6 拉取并启动固定镜像

```powershell
Set-Location D:\CodeWorkPlace\k12

docker compose `
  --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml `
  pull

docker compose `
  --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml `
  up -d
```

检查状态：

```powershell
docker compose `
  --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml `
  ps

docker logs --tail 100 k12-piston-api
```

预期端口：

```text
127.0.0.1:2000->2000/tcp
```

### 6.7 安装锁定的 Python

新 Piston 没有任何语言运行时。使用 6.2 节读取的 `$pythonPackage` 安装固定版本：

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\piston-runtime

node cli/index.js `
  -u http://127.0.0.1:2000 `
  ppman install $pythonPackage
```

Windows bind mount 处理大量小文件较慢，Python 安装可能需要数分钟。不要因为 CLI 暂时
没有输出就关闭窗口，可以查看服务日志：

```powershell
docker logs -f k12-piston-api
```

看到以下日志表示安装完成：

```text
Installed python-3.12.0
```

Java 和 Rust 暂不默认安装。确定版本后，先把精确包名加入 `versions.env`，再让团队安装，
不能直接使用不带版本号的 `ppman install java` 或 `ppman install rust`。

## 7. 验证安装

### 7.1 查询运行时

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:2000/api/v2/runtimes' `
  -Method Get
```

返回结果必须包含：

```text
language = python
version  = 3.12.0
```

### 7.2 执行 Python

```powershell
$body = @{
  language = 'python'
  version = '3.12.0'
  files = @(
    @{
      name = 'main.py'
      content = "print('hello k12 piston')"
    }
  )
  stdin = ''
  run_timeout = 3000
  run_memory_limit = 268435456
} | ConvertTo-Json -Depth 5

$result = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:2000/api/v2/execute' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body

$result.run
```

预期：

```text
stdout = hello k12 piston
code   = 0
```

响应还会包含 `cpu_time`、`wall_time` 和 `memory`。

## 8. 检查 Git 忽略规则

### 8.1 应当被忽略

```powershell
Set-Location D:\CodeWorkPlace\k12

git check-ignore -v .\deploy\piston-runtime\readme.md
git check-ignore -v .\deploy\piston-runtime\cli\node_modules
git check-ignore -v `
  .\deploy\piston-runtime\data\piston\packages\python\3.12.0\metadata.json
```

三条命令都应指向：

```text
.gitignore:...:/deploy/piston-runtime/
```

### 8.2 不应当被忽略

以下文件必须出现在 Git 变更中：

```text
deploy/piston/README.md
deploy/piston/compose.yaml
deploy/piston/versions.env
```

检查：

```powershell
git status --short -- .gitignore .\deploy\piston
```

不能使用 `git add -f deploy/piston-runtime` 强制提交第三方源码和语言包。

## 9. 日常操作

### 9.1 启动

```powershell
Set-Location D:\CodeWorkPlace\k12
docker compose --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml up -d
```

### 9.2 停止

停止容器但保留容器和运行时：

```powershell
docker compose --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml stop
```

删除容器但保留语言运行时：

```powershell
docker compose --env-file .\deploy\piston\versions.env `
  -f .\deploy\piston\compose.yaml down
```

### 9.3 日志与状态

```powershell
docker ps --filter name=k12-piston-api
docker logs --tail 100 k12-piston-api
```

语言运行时保存在：

```text
deploy/piston-runtime/data/piston/packages/
```

执行 `down` 不会删除该目录。手工删除 `piston-runtime` 会删除所有已安装语言。

## 10. 团队复现流程

每位成员按以下顺序执行：

```text
1. 拉取K12仓库，获得相同versions.env。
2. 启动Docker Desktop并检查Linux Containers和cgroup v2。
3. 优先使用Git Clone获取Piston源码。
4. GitHub HTTPS超时时改用固定Commit ZIP。
5. Git路线切换到PISTON_GIT_COMMIT；ZIP路线无需git switch。
6. 执行npm ci安装CLI依赖。
7. 使用K12 Compose拉取固定digest镜像并启动。
8. 安装versions.env中锁定的Python运行时。
9. 查询/runtimes并执行测试代码。
10. 检查piston-runtime确实被Git忽略。
```

## 11. 升级与回滚

### 11.1 升级原则

- 不能直接让全员切换最新 `master`。
- 不能把 `PISTON_IMAGE` 改成 `latest` 后直接提交。
- 由一名成员验证候选版本。
- 源码 Commit、镜像 digest、语言运行时版本必须一起记录。

### 11.2 获取候选源码

Git 路线：

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\piston-runtime
git fetch origin
git log --oneline origin/master -10
git switch --detach <候选commit完整SHA>
```

ZIP 路线使用候选 Commit 替换 codeload URL 中的 SHA，解压到新的临时目录验证，不能直接
覆盖当前可用目录。

### 11.3 获取镜像 digest

```powershell
docker pull ghcr.io/engineer-man/piston:latest
docker image inspect ghcr.io/engineer-man/piston:latest `
  --format '{{index .RepoDigests 0}}'
```

### 11.4 验证清单

- Python 正常执行。
- Java、Rust 在启用后正常执行。
- 编译错误和运行错误状态正确。
- 无限循环能被超时终止。
- 超大输出被限制。
- 内存限制生效。
- 网络默认不可访问。
- Agent Runtime 适配器测试通过。

### 11.5 提交升级

验证通过后更新：

```text
deploy/piston/versions.env
```

提交 K12 Git。团队成员拉取更新后，再切换源码、拉取镜像并安装对应语言版本。

### 11.6 回滚

查看版本文件历史：

```powershell
git log --oneline -- deploy/piston/versions.env
git show <上一个K12提交>:deploy/piston/versions.env
```

恢复上一个锁定值后重新启动 Piston。不要使用 `git reset --hard` 回滚整个 K12 项目。

## 12. 常见问题

### 12.1 Docker API 无法连接

```text
failed to connect to the docker API
```

启动 Docker Desktop，并检查 Context：

```powershell
docker context show
docker context use desktop-linux
docker version
```

### 12.2 Git Clone 超时

```text
Failed to connect to github.com port 443
```

检查：

```powershell
Test-NetConnection github.com -Port 443
curl.exe -I --connect-timeout 15 https://github.com
curl.exe -I --connect-timeout 15 `
  "https://codeload.github.com/engineer-man/piston/zip/$pistonCommit"
```

如果 TCP 成功但 GitHub HTTPS 超时，不要关闭 SSL 校验。配置团队可信代理，或者使用本文
6.4 节的固定 Commit ZIP。

### 12.3 `/runtimes` 返回空数组

Piston API 已启动，但没有安装语言。执行 6.7 节的固定版本安装命令。

### 12.4 Python 安装长时间没有输出

Windows bind mount 解压大量小文件可能需要数分钟。检查：

```powershell
docker logs -f k12-piston-api
```

只要日志最终出现 `Installed python-3.12.0`，就表示安装成功。

### 12.5 端口 2000 被占用

```powershell
Get-NetTCPConnection -LocalPort 2000 -ErrorAction SilentlyContinue
docker ps --format '{{.Names}} {{.Ports}}'
```

不要随意修改团队统一端口。先停止占用端口的旧 Piston 容器或其他本地服务。

### 12.6 npm 报告依赖漏洞

当前固定上游锁文件在 `npm ci` 后可能报告依赖漏洞。不要执行
`npm audit fix --force`。记录结果，在升级 Piston 时验证新版本并更新锁定值。

### 12.7 出现 detached HEAD

这是 Git 版本锁定的正常状态，不是错误。不要在 `piston-runtime` 中编写 K12 业务代码。

## 13. 安全要求

- `2000` 端口只绑定 `127.0.0.1`。
- React 前端不能直接调用 Piston。
- Piston 不能直接暴露到公网。
- 只有内部 Agent Runtime 或 Sandbox Worker 可以访问 Piston。
- 用户不能指定任意镜像、系统命令和语言包安装请求。
- Agent Runtime 必须限制超时、内存、输出长度和源码长度。
- Piston 使用 `privileged` 权限，服务器阶段必须部署在独立 Linux 执行节点。
- 生产部署前必须检查上游安全更新并执行恶意代码测试。

## 14. 官方资源

- [Piston GitHub](https://github.com/engineer-man/piston)
- [Piston 官方文档](https://piston.readthedocs.io/)
- [Piston Releases](https://github.com/engineer-man/piston/releases)
- [Piston GHCR 镜像](https://github.com/engineer-man/piston/pkgs/container/piston)
- [Piston 官方 Compose](https://github.com/engineer-man/piston/blob/master/docker-compose.yaml)
