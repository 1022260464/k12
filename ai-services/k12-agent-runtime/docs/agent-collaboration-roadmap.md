# Python Agent 分批开发与协作路线

本文用于控制 `k12-agent-runtime` 的开发范围。每一批都必须形成一条可以运行、测试和回退的
完整链路，不同时接入模型、RAG、消息队列和沙箱。

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

状态：已完成确定性版本。

目标：完成赛题主智能体 `teaching-assistant` 的最小闭环。主题限定为人工智能通识内容，先使用
确定性规则验证学段适配和流程，不接外部大模型。

当前实现：

- 按小学低年级、小学高年级、初中、高中选择四套教学策略；
- 使用 LangGraph 编排上下文标准化、学段分支、互动生成和响应组装；
- 第一版只承诺“冒泡排序”主题的可靠教学内容；
- 返回版本化 `ANIMATION` 产物，包含播放、暂停、单步和重播所需的排序帧；
- 已覆盖小学高年级、高中、默认学段和真实内部 HTTP 调用；
- 尚未接入外部模型、RAG，也尚未实现 React 动画播放器。

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

目标：让业务 Agent 依赖抽象的 `ChatModel` 端口，而不是在节点中直接导入某个模型 SDK。

```text
domain/llm/ports.py                 # ChatModel 协议
application/prompts/                # 可版本化的提示词组装
infrastructure/llm/<provider>.py    # 厂商 SDK 适配器
bootstrap/container.py              # 根据配置选择实现
```

你需要参与模型选择和回答质量评审；API Key 只写本地 `.env`，不写进 JSON、测试或 Git。

## 第 4 批：AI 通识 RAG 检索闭环

目标：先定义检索端口，再接 PostgreSQL + pgvector。Agent 不直接拼 SQL，也不直接操作连接池。

验收包括：课程范围过滤、引用来源、无检索结果降级、提示注入样例和检索耗时记录。

你需要准备 5 到 10 段可公开的人工智能通识课程样例和对应问题，用于离线验证召回结果。初期
不需要更换专用向量数据库。

## 第 5 批：异步可靠性与可观测性

目标：完善 RabbitMQ 重连、幂等、超时、结构化日志、correlation id 和死信任务排查说明。

这一批会使用真实 Java Agent Service、RabbitMQ 和 Python Worker 联调，不修改教学输出逻辑。

## 第 6 批：核心多模态工具

目标：依次完成动画步骤、游戏题目和代码运行三类结构化工具。动画和游戏由前端白名单组件
渲染；代码运行接入腾讯云 Agent Sandbox，保持默认禁用，完成超时、输出上限、文件产物和
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
