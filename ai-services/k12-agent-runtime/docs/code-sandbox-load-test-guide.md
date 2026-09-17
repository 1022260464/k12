# 代码沙箱容量与压测手册

适用范围：`backend/k12-agent-service` 的公开代码执行入口、Python Runtime/Worker 的
`tencent_agsx` 与 `local_piston` 适配器。目标是让比赛演示和团队联调可控，**不把真实云沙箱
当成免费压测环境**。以下数值是本项目的保守起点，不代表腾讯云平台配额或性能保证。

## 1. 当前限制和推荐值

| 限制 | 代码允许范围 | 本地/比赛建议 | 生效位置 |
| --- | --- | --- | --- |
| `K12_AGENT_CODE_DAILY_LIMIT` | 1–50 次/用户/北京时间自然日 | 云演示默认 5；纯本地联调可显式设 20 | Java + MySQL，共享于所有 Java 实例 |
| `K12_AGENT_SANDBOX_MAX_CONCURRENCY` | 1–4 | 默认 2；云费用敏感时设 1 | 每个 Python 进程、每个适配器 |
| `K12_AGENT_SANDBOX_MAX_WAITERS` | 0–8 | 默认 4；不希望排队可设 0 | 每个 Python 进程、每个适配器 |
| `K12_AGENT_SANDBOX_QUEUE_WAIT_SECONDS` | 大于 0、最多 5 秒 | 默认 3 秒；交互页可设 1–3 秒 | 每个 Python 进程、每个适配器 |
| 学生单次代码执行时间 | 1–30 秒 | 默认 30 秒，简单题可以设 5–10 秒 | Java 请求校验；Runtime 再校验 |
| Java 调用 Runtime 的读取预算 | 当前配置 90 秒 | 保持大于云实例创建、排队、运行和回传的总预算 | Java Feign |

Java 日配额只有在执行建表脚本并设置 `K12_AGENT_CODE_QUOTA_ENABLED=true` 后才生效。
合法请求一旦受理便计一次；运行失败、超时或沙箱繁忙也不退还。重启 Agent Service 才会读取
改动后的环境变量。若当天已用次数大于新上限，重启后该用户会立即收到 429，次日自动恢复。

Python 并发上限**不是全局上限**。例如同时运行一个 HTTP Runtime 和一个 RabbitMQ Worker，
并且都允许云适配器并发 2，理论上已经可能同时创建 4 个云任务；多副本会继续放大。主备
适配器各有独立容量，发生降级时也可能产生本地 Piston 任务。云端预算告警、账号总配额和
部署副本数仍需另外控制；当前没有跨进程的总并发闸门。不要把“日配额 5 次/用户”误认为
“整个团队每天最多 5 次”。

## 2. 分层验证

### A. 离线容量压测（默认、零云费用）

在 PowerShell 中执行：

```powershell
cd D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
.\.venv\Scripts\python.exe -m pytest tests/test_sandbox_capacity_load.py tests/test_sandbox_adapters.py -q
.\.venv\Scripts\python.exe scripts/load_test_sandbox_capacity.py --requests 40 --clients 16 --work-ms 200 --wait-ms 100
```

第二条使用真实 `SandboxCapacity`，但用 `asyncio.sleep` 模拟沙箱工作。它**不会连接**
Tencent AGSX、Piston、Java、RabbitMQ 或数据库。默认 40 请求/16 客户端并发，执行名额
2、等待名额 4、等待最多 100ms。查看输出中的通过数、拒绝数、实际峰值执行并发、p50/p95
和 `result=PASS`。由于客户端调度与机器负载不同，通过/拒绝的精确数量不是固定值；必须满足
`通过 + 拒绝 = 请求`、峰值不超过配置值、压测结束后名额可再次获取。脚本单次最多 1000
请求、100 客户端并发，避免本机误操作产生无意义的任务洪泛。

可模拟更温和的负载：

```powershell
.\.venv\Scripts\python.exe scripts/load_test_sandbox_capacity.py --requests 20 --clients 4 --work-ms 100 --wait-ms 1000 --max-concurrency 2 --max-waiters 4
```

这一步只验证**进程内准入与释放**，不等于云实例创建、文件转存、数据库写入、RabbitMQ
消费或 Gateway 的端到端吞吐量。适配器假对象测试进一步验证忙时不调用供应商且不触发
主备重放。

### B. 本地 Piston 端到端小流量联调（需手动开启）

1. 先按 `deploy/piston/README.md` 启动本地 Piston。使用独立测试账号、空闲的 Java
   日配额；确认 Gateway、Agent Service 已启动。异步模式还需启动 RabbitMQ。
2. 在启动 Runtime 和 Worker 的**各自终端**设置
   `K12_AGENT_SANDBOX_PROVIDER=local_piston`、
   `K12_AGENT_SANDBOX_FALLBACK_PROVIDER` 为空白、
   `K12_AGENT_SANDBOX_ENABLED=true`，再重启两个 Python 进程。不要只在调用 Apifox
   的终端设置变量；先停掉旧进程，避免旧 Runtime 仍在使用腾讯云或占用 8090 端口。

   Windows PowerShell 示例（每个 Python 进程的终端都执行）：

   ```powershell
   $env:K12_AGENT_SANDBOX_ENABLED = "true"
   $env:K12_AGENT_SANDBOX_PROVIDER = "local_piston"
   $env:K12_AGENT_SANDBOX_FALLBACK_PROVIDER = " "
   ```

   最后一项用空格是为了覆盖 `.env` 中的备用供应商；Runtime 会 `strip()` 后视为不启用备用。
   这组设置只影响随后从该终端启动的进程，不会动态修改已经启动的 Runtime/Worker。
3. 用 Apifox 或 PowerShell 通过 Gateway 发 1 次 `SYNC` 和 1 次 `ASYNC`，再观察运行详情。
   若要观察排队与拒绝，最多用一个**独立测试用户**并行提交 5 次简短本地代码；不要在
   团队共享数据库上循环数百次。`SYNC` 返回终态；`ASYNC` 应从 `PENDING` 经 Worker
   收敛为终态。读 `code_execution_quota.used_count`，确认与受理次数一致。全部运行的
   `provider` 应为 `local_piston`，不能是 `tencent_agsx`。

最小请求示例（JWT 不要写入文档或命令历史，可在 Apifox 的 Bearer Auth 中配置）：

```http
POST http://127.0.0.1:8080/api/v1/agents/code-executions
Authorization: Bearer <测试账号的JWT>
Content-Type: application/json

{"code":"print('load-test-ok')","timeoutSeconds":5,"executionMode":"SYNC"}
```

只在本地测试账号上执行下列只读 SQL 检查用量；不要修改或清零生产配额行：

```sql
SELECT user_id, quota_date, used_count
FROM k12_business.code_execution_quota
WHERE user_id = <测试用户ID>
ORDER BY quota_date DESC
LIMIT 7;
```

### C. 腾讯云 AGSX 小样本验收（非压测）

只有团队确认可用预算、出站网络、云端配额和告警后，再显式把 Runtime/Worker 切回
`tencent_agsx`。仅做 1–3 个 `print` 或小图片任务，记录成功率、端到端耗时、实例销毁
状态及账单用量。不要用云端验证“40 并发”的离线脚本，也不要对真实云沙箱使用 Apifox
无限循环或自动重试。腾讯云文档说明计算资源按实例实际运行时长计费，且创建实例时检查
主账号/地域资源配额；见[官方计费说明](https://cloud.tencent.com/document/product/1814/133249)
与[配额说明](https://cloud.tencent.com/document/product/1814/123815)。收费和剩余配额
以团队控制台当前显示为准，不要只看本项目的限制参数。

## 3. 记录表与判定

每次验证至少记录：日期/环境、Git 版本、Runtime 与 Worker 副本数、主备供应商、
`MAX_CONCURRENCY/MAX_WAITERS/QUEUE_WAIT_SECONDS`、请求数/客户端并发、通过/拒绝/失败/
超时数、p50/p95 端到端延迟、峰值执行并发、Java 429 数量、RabbitMQ 队列积压、
Piston 容器 CPU/内存或云端实际账单。日志中不要记录 JWT、API Key、完整学生代码。

离线阶段的硬性验收是计数守恒、峰值不越界、突发请求被及时拒绝、压力消退后名额可复用；
真实阶段还需确认无重复执行、异步任务最终收敛、产物有权限隔离、云实例被销毁。p95 目标
应先取本机基线，再根据课堂交互体验和实际成本确定，**不能**把离线模拟延迟当作真实云延迟。
当出现大批 429、云账单异常、RabbitMQ 持续积压或沙箱实例未回收时，停止测试并排查，
不要提高并发上限掩盖问题。

## 4. 当前缺口

- 没有跨 Runtime/Worker/副本共享的全局云并发闸门，也没有按班级的实时并发份额。
- 没有自动化云费用熔断、账单回查或云端大并发压测；预算告警须在平台侧另行配置。
- 离线脚本不覆盖真实网络、MySQL、MinIO、RabbitMQ 和隔离安全性；这些要分批验收。
