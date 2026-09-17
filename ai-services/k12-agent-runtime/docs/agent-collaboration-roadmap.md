# Python Agent 分批开发与协作路线

本文用于控制 `k12-agent-runtime` 的开发范围。每一批都必须形成一条可以运行、测试和回退的
完整链路，不同时接入模型、RAG、消息队列和沙箱。

## 当前进度快照（2026-09-16）

| 能力 | 状态 | 当前结果 | 下一缺口 |
| --- | --- | --- | --- |
| 公共执行契约 | 已完成 | FastAPI和RabbitMQ复用统一Agent输入、结果、异常与产物协议 | 持续补契约回归 |
| 主教学Agent | 部分完成 | LangGraph、四学段适配、千问增强、确定性降级和冒泡排序动画 | 扩展AI通识主题与主动教学 |
| RAG | 已完成第二步 | 已完成模型上下文注入、版本化引用展示、无结果降级和10条离线检索评测 | 提示注入评测与正式课程质量集 |
| 个性化学习 | 部分完成 | Java聚合画像、学习、作业和形成性练习记录，并按用户、Agent、会话恢复最近成功轮次；Python参考近期练习调整讲解；Assessment提供近期主题表现和规则化建议 | 会话列表、摘要压缩、稳定知识点编码、长期掌握度和跨课程主动推荐 |
| 多模态工具 | 部分完成 | 动画、Vega-Lite、游戏化小测协议、服务端判分记录和MinIO对象能力 | 正式考试题库、真实文件产物和绘本推荐 |
| 代码沙箱 | 已完成后端与前端基础闭环 | 腾讯云AGSX为主、本地Piston按配置自动保底，Java同步/异步公开接口、运行记录、产物持久化、专用消息队列、Worker和前端代码实验页均已实现 | 主备真实联调、云端配额验证与恶意代码集 |
| 异步可靠性 | 部分完成 | Agent与代码任务均具备持久消息、RUNNING通知、终态幂等、超时扫描和共享死信拓扑 | Outbox、Worker去重、重试退避和死信重放工具 |

后续固定顺序：

1. 将RAG接入`teaching-assistant`，完成学段过滤、模型上下文注入和故障降级。状态：已完成。
2. 增加面向用户的引用来源、无结果提示和检索质量评测。状态：已完成。
3. 增加游戏化小测验结构化产物。状态：已完成基础闭环。
4. 接入Java侧学生画像、学习历史、作业表现和薄弱点。状态：已完成基础上下文链路。
5. 增加多轮会话、章节连续教学和中断恢复。状态：已完成基础会话连续性与页面刷新恢复。
6. 接入腾讯云代码沙箱及MinIO文件产物。状态：后端同步/异步基础闭环已完成，待前端和云端验收。

## 个性化上下文第一步

状态：已完成 Java 到 Python 的基础链路。

```text
学生 Bearer JWT
  -> Agent Service 从 JWT 读取 userId
  -> IAM 读取当前用户学段、年级、教材和兴趣
  -> Learning 读取当前用户最近 5 门课程总体进度
  -> Assessment 读取当前用户最近 5 条作业结果
  -> Java 删除答案和无关身份字段，低于 60 分的结果推导薄弱点
  -> teaching-assistant 标准化并限制字段数量、文本长度和成绩范围
  -> 千问只使用摘要调整讲解，响应只公开个性化状态和记录数量
```

IAM、Learning或Assessment超时、未创建画像时不会中断教学。Java保留当前请求中的可用上下文，并通过
`personalization.profileStatus`、`learningHistoryStatus`、`performanceStatus`标记`LOADED`、`MISSING`或
`UNAVAILABLE`。当前又增加了同一`sessionId`内的多轮上下文，但还没有实现跨会话长期记忆、
知识点掌握度更新和主动推荐。

## 多轮会话第一步

状态：已完成基础链路。

```text
React为当前登录用户在sessionStorage保存sessionId
  -> Java只查询当前JWT用户、同一Agent、同一sessionId的成功运行
  -> 最近6轮按时间正序写入conversationHistory
  -> Python把历史视为不可信对话材料，只用于语义连续性
  -> 新运行继续保存到agent_run
  -> 页面刷新后调用会话历史接口恢复最近20轮
```

服务端会覆盖请求中伪造的`conversation`和`conversationHistory`，并限制轮数与文本长度。历史接口
不会返回`inputContext`，避免把画像、薄弱点等内部聚合上下文重新暴露给浏览器。当前没有会话
列表、重命名、删除、长期摘要和LangGraph Checkpointer；“新建对话”只是切换新的`sessionId`。

## 第 1 批：公共执行契约

状态：已完成。

本批解决所有 Agent 都会遇到的问题：

- `RunAgentUseCase` 统一清理和校验 `agent_code`、`input_text`；
- Agent 内部异常转换为安全的执行异常，不向 HTTP 响应泄露 SDK、密钥或堆栈；
- 校验 Agent 返回的 `run_id`、`agent_code` 和产物 ID；
- 服务启动时拒绝重复或空白的 Agent code；
- HTTP 参数错误统一返回 `code/message/data`；
- RabbitMQ 拒绝纯空格任务，使其按既有死信策略处理；
- 覆盖正常执行、非法输入、执行异常、契约错误和重复注册测试。

验收命令：

```powershell
Set-Location D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\python.exe -m pytest -q
```

如果本机 `uv.exe` 正常，也可以继续使用：

```powershell
uv run ruff check .
uv run pytest -q
```

## 第 2 批：Teaching Assistant 最小 AI 通识教学闭环

状态：已完成确定性版本，并已接入千问增强与RAG上下文。

目标：完成赛题主智能体 `teaching-assistant` 的最小闭环。主题限定为人工智能通识内容，先使用
确定性规则验证学段适配和流程，不接外部大模型。

当前实现：

- 按小学低年级、小学高年级、初中、高中选择四套教学策略；
- 使用 LangGraph 编排上下文标准化、学段分支、互动生成和响应组装；
- 第一版只承诺“冒泡排序”主题的可靠教学内容；
- 返回版本化 `ANIMATION` 产物，包含播放、暂停、单步和重播所需的排序帧；
- 已覆盖小学高年级、高中、默认学段和真实内部 HTTP 调用；
- 已接入千问模型和RAG，任一外部依赖失败时自动回退确定性讲解；React动画播放器仍待实现。

执行路径：

```text
AgentRunInput
  -> validate_learning_context
  -> select_stage_strategy
  -> build_ai_literacy_explanation
  -> build_interaction
  -> build_follow_up_question_or_quiz
  -> AgentRunResult
```

本批由你参与的内容：

1. 打开 [`participation/teaching-assistant-case.json`](participation/teaching-assistant-case.json)。
2. 把示例改成你希望演示的学段、教材、AI 通识章节和学生问题。
3. 在 `expectedSections` 中写出你认为合格回答必须包含的部分。
4. 在 `forbiddenBehaviors` 中补充教师不希望 Agent 出现的行为。

这份 JSON 不包含代码，你修改后不会破坏服务。下一批代码会把它转换为验收测试，因此它代表
教学产品要求，而不是随手写的提示词。

验收标准：

- 注册器可以列出 `teaching-assistant`；
- HTTP 同步调用和 RabbitMQ 异步调用得到相同结构；
- 返回“分层解释、互动示例、理解检查、下一步建议”；
- 同一 AI 主题对小学和高中使用明显不同的语言、深度和练习；
- 缺少学段或章节时使用明确默认值，不产生异常；
- 至少覆盖正常、边界和禁止直接给答案三类测试。

## 第 3 批：模型端口与供应商适配器

状态：已完成千问OpenAI兼容适配器和结构化输出降级。

目标：让业务 Agent 依赖抽象的 `ChatModel` 端口，而不是在节点中直接导入某个模型 SDK。

```text
domain/llm/ports.py                 # ChatModel 协议
application/prompts/                # 可版本化的提示词组装
infrastructure/llm/<provider>.py    # 厂商 SDK 适配器
bootstrap/container.py              # 根据配置选择实现
```

你需要参与模型选择和回答质量评审；API Key 只写本地 `.env`，不写进 JSON、测试或 Git。

## 第 4 批：AI 通识 RAG 检索闭环

状态：第二步已完成，进入提示注入与正式课程质量验收阶段。

目标：先定义检索端口，再接 PostgreSQL + pgvector。Agent 不直接拼 SQL，也不直接操作连接池。

当前进度：领域端口、本地BGE模型、文档切分、pgvector事务入库、条件召回、Reranker精排、
内部API和教学Agent上下文注入已经完成。检索节点按学段以及显式年级、教材过滤，严格条件
无结果时退回同学段检索；RAG关闭或故障时不会中断教学。当前已提供版本化
`knowledgeGrounding`协议，React悬浮助教只展示真正参与回答的引用，并建立10条人工标注
问题的Hit@K、MRR、空结果和耗时评测。提示注入攻击样例与正式课程质量集仍未完成。

验收包括：课程范围过滤、引用来源、无检索结果降级、提示注入样例和检索耗时记录。

你需要准备 5 到 10 段可公开的人工智能通识课程样例和对应问题，用于离线验证召回结果。初期
不需要更换专用向量数据库。

## 第 5 批：异步可靠性与可观测性

目标：完善 RabbitMQ 重连、幂等、超时、结构化日志、correlation id 和死信任务排查说明。

这一批会使用真实 Java Agent Service、RabbitMQ 和 Python Worker 联调，不修改教学输出逻辑。

## 第 6 批：核心多模态工具

目标：依次完成动画步骤、游戏题目和代码运行三类结构化工具。动画和游戏由前端白名单组件
渲染。当前已完成`application/vnd.k12.quiz.v1+json`选择题协议、按学段出题和Assessment侧
形成性练习记录。新产物标记为`RECORDED_PRACTICE`，由服务端依据Agent持久化题目判分，
近期结果进入下轮教学上下文；旧轮次的`CLIENT_PRACTICE`产物仍可提交。由于答案会发送给
浏览器，这不是防作弊考试，不计入正式成绩。代码运行接入腾讯云 Agent Sandbox，保持默认禁用，完成超时、输出上限、文件产物和
MinIO 链路后再开放。Runtime 主进程仍禁止直接执行用户代码。

实时视频生成不在比赛阶段开发范围。教学视频由教师上传或从审核资源库推荐；低龄绘本先使用
预生成并审核的固定资源。

## 新 Agent 的固定开发步骤

1. 明确稳定且唯一的 `agent_code`。
2. 写一个产品样例和禁止行为。
3. 定义 Agent 自己的 State。
4. 把每个节点写成单一职责函数。
5. 组装并编译 LangGraph。
6. 实现 `AgentExecutor` 适配器。
7. 在 `bootstrap/container.py` 注册。
8. 补单元测试、HTTP 测试和消息契约测试。
9. 通过 `ruff` 和 `pytest` 后，再与 Java 服务联调。

不要从 Controller、RabbitMQ Worker 或具体模型 SDK 开始写新 Agent。它们都是外部适配层，
教学流程应先在 Agent State 和节点中形成可测试的业务闭环。
