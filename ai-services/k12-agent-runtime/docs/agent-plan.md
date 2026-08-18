# K12 项目 Agent 规划

## 1. 目标与边界

本规划将 Agent 定义为：围绕一个明确教学任务，接收标准输入、调用受控能力，并输出统一结果的执行单元。

它不负责用户登录、权限校验、课程和题库的直接 CRUD，也不直接暴露给前端；这些职责由 Java
`k12-agent-service` 和网关承担。Python `k12-agent-runtime` 只负责 Agent 编排、模型调用、
检索、工具调用与产物生成。

```text
React
  -> Gateway
  -> Java Agent Service（认证、授权、任务记录、状态查询）
  -> Python Agent Runtime（选择并执行 Agent）
  -> 受控模型 / RAG / 课程工具 / 代码沙箱
```

## 2. 统一实现模型

每个 Agent 都实现 `AgentExecutor` 协议：

```python
class XxxAgent(AgentExecutor):
    @property
    def code(self) -> str: ...

    @property
    def description(self) -> str: ...

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult: ...
```

其中 `code` 是稳定且唯一的业务标识；`description` 用于管理端和 Agent 列表展示；`invoke()`
完成本 Agent 的流程，并始终返回 `AgentRunResult`。Agent 实现放在
`infrastructure/agents/`，注册在 `bootstrap/container.py`，不把具体模型 SDK、FastAPI 或
RabbitMQ 对象带入 `domain/`。

所有 Agent 只通过以下受控输入输出协作：

| 项目 | 约定 |
| --- | --- |
| 输入 | `AgentRunInput`：`run_id`、`agent_code`、`input_text`、`user_id`、`context` |
| 结果 | `AgentRunResult`：状态、文本、产物、元数据 |
| 小型产物 | 放入 `artifacts[].payload`，如表格或 Vega-Lite 图表 |
| 大型产物 | 上传对象存储，只在 `artifacts[].uri` 返回地址 |
| 长任务 | 通过 RabbitMQ 执行，Java 使用 `run_id` 记录、查询和幂等控制 |

## 3. Agent 分层与优先级

### P0：当前可演示、可验证的基础能力

| Agent code | 名称 | 输入重点 | 输出 | 现状 |
| --- | --- | --- | --- | --- |
| `study-plan` | 学习计划 Agent | 学科主题、年级、时长、薄弱点 | 分阶段计划、TABLE 产物 | 已实现规则示例 |
| `demo-chart` | 图表演示 Agent | 文本任务 | 文本、CHART 产物 | 已实现协议演示 |

P0 的目标是验证接口、注册、产物渲染与同步调用链，不依赖外部大模型。

### P1：首个教学闭环

| Agent code | 名称 | 核心任务 | 依赖能力 |
| --- | --- | --- | --- |
| `knowledge-tutor` | 知识讲解 Agent | 根据年级、教材章节和问题进行分层讲解，给出例题与追问 | 课程知识库、模型调用、内容安全 |
| `practice-coach` | 练习辅导 Agent | 根据题目、作答与错误类型给出提示，不直接泄露答案 | 题库、作答记录、模型调用 |
| `learning-diagnosis` | 学情诊断 Agent | 汇总正确率、耗时、错因，输出薄弱点与下一步建议 | 学习记录、题库知识点映射 |

P1 的验收标准是：学生可从“提问或练习”进入“解释/提示”，再得到“可执行学习建议”的完整闭环。

### P2：教师提效与复杂任务

| Agent code | 名称 | 核心任务 | 执行方式 |
| --- | --- | --- | --- |
| `lesson-design` | 教案设计 Agent | 按课程目标生成教学活动、分层任务和评价点 | 同步为主，生成 FILE/TABLE |
| `assignment-review` | 作业批改 Agent | 批量归类错误、生成评语和班级共性问题 | RabbitMQ 异步任务 |
| `code-tutor` | 编程辅导 Agent | 解释代码、给出调试建议、受控运行示例 | 代码审查工具 + AGSX 沙箱 |
| `learning-report` | 学习报告 Agent | 生成个人/班级周期报告和可视化 | RabbitMQ + 对象存储 |

P2 中涉及批量处理、文件输出或代码执行的 Agent 必须走异步任务；代码执行只能经 AGSX
沙箱，不能由 Runtime 进程直接执行用户代码。

## 4. 单个 Agent 的推荐工作流

```text
校验输入
  -> 读取受控上下文（年级、课程、权限范围）
  -> 检索课程/题库/学习记录
  -> 组装提示词或确定性规则
  -> 调用模型或工具
  -> 校验与过滤结果
  -> 生成 AgentRunResult 与 artifacts
```

实现时应遵守：

1. `input_text` 为空、上下文字段类型错误或外部工具失败时，返回可识别的失败结果，不吞异常。
2. 只查询当前用户或当前教师被授权的数据范围；Java 层完成鉴权，Runtime 仍应只接收最小必要上下文。
3. 模型输出不能直接作为可执行 HTML、JavaScript 或代码运行；结构化产物必须按 `kind` 和
   `mime_type` 白名单渲染。
4. `metadata` 只保留链路追踪、模型版本、耗时等必要信息，禁止返回密钥、完整提示词或敏感学生数据。

## 5. 管理配置与运行实现的关系

Java 中的 `TeachingAgent` / `agent_config` 是**管理配置**：名称、类型、描述、启用状态等，
用于权限和运营管理。Python 中的 `AgentExecutor` 实现是**运行逻辑**：决定接到
`agent_code` 后具体怎样执行。

两者建议通过稳定的 `agent_code` 对齐：

```text
agent_config.code = "study-plan"
        │
        └── Python registry.get("study-plan") -> StudyPlanAgent
```

若管理端配置存在但 Runtime 未注册对应 `agent_code`，任务应明确报“未部署该执行器”；若配置被
停用，Java 服务不应把任务转发到 Runtime。

## 6. 实施顺序

1. **完善 P0 契约**：补充 Agent 配置中的 `code`，使其与 Python 注册器稳定关联；增加成功、失败、
   Agent 不存在的接口测试。
2. **建设 P1 检索和模型端口**：在 `domain` 定义最小端口，在 `infrastructure` 实现模型、课程知识库和题库适配器。
3. **上线知识讲解与练习辅导**：先使用小范围课程数据灰度，记录质量反馈、拒答率和工具失败率。
4. **接入学情诊断**：以已有学习记录为输入，先输出建议，避免在早期自动修改学习计划或评分结果。
5. **建设 P2 异步能力**：完成任务状态、重试、死信队列、对象存储和产物下载授权后，再上线批改、报告和代码任务。

## 7. 质量与安全验收

每个新 Agent 至少应具备：

- 正常输入、非法输入、外部依赖失败三类单元测试；
- 固定 `agent_code`、清晰描述和注册测试；
- 不同年级、学科和薄弱点的结果质量样例；
- 运行耗时、模型/工具失败率、产物生成成功率的可观测指标；
- 未成年人数据最小化、提示注入防护、内容安全与人工兜底策略；
- 对涉及评分、批改和代码执行的功能，保留审计记录与人工复核入口。

## 8. 当前下一步

建议优先完成 `knowledge-tutor` 的端到端最小版本：限定一个学科和年级，接入课程知识库，输出
“概念解释 + 一道示例 + 一道追问”，并复用现有 `AgentRunResult` 和 `TEXT` / `TABLE` 产物协议。
这能在不引入异步批处理或沙箱风险的前提下，验证第一条真实教学 Agent 链路。
