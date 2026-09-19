# K12 AI 通识教学助手：数据结构与图示文字说明

> 供项目报告绘制表结构图、ER 图、DFD 图和 H 图时使用；本文**不是**建表 SQL，也不表示规划功能已经实现。依据当前仓库代码和 SQL 整理，后续实现变动时应同步修订。
>
> 标记：`现有`=仓库有对应实现或脚本；`规划`=仅列入产品范围，尚不能视为可用。是否已在实际数据库执行脚本，需另行核对。

## 一、项目边界

系统面向四个学段的 AI 通识教学。前端分 React 用户端和管理端；Gateway 为统一入口，Java 的 IAM、Learning、Agent、Assessment 处理权限和业务事务；Python FastAPI/Worker 负责 LangGraph、模型、RAG、工具和沙箱。长任务通过 RabbitMQ，文件在 MinIO，知识向量在 PostgreSQL/pgvector。**目标架构另规划 Neo4j 知识关系层**，统一维护知识点先修、关联、章节覆盖与资料/题目映射，服务于答疑导航、练习诊断和路径推荐；当前仓库尚无 Neo4j 驱动、图数据或业务调用，现状图不得画成已接入。Nacos 可用于配置/注册发现，但当前配置默认关闭；不要把它当成主业务数据库。

## 二、表结构文字说明

下列“关联用户”跨 `k12_auth` 和 `k12_business` 时是**逻辑引用**，不是跨库外键。每个库内的真实主外键以 SQL 脚本为准；常用审计时间、状态、逻辑删除字段不在每条重复展开。

### 1. MySQL `k12_auth`：身份与学习档案（现有）

- `sys_user`：主键 `id`；登录名、BCrypt 密码摘要、昵称和联系方式；状态、失败次数、锁定时间、`auth_version` 管账号安全。不要存明文密码。
- `sys_role`、`sys_permission`：各以 `id` 为主键，角色编码和权限编码各自唯一；权限编码用于接口授权。
- `sys_user_role`、`sys_role_permission`：联合主键分别为 `(user_id, role_id)` 和 `(role_id, permission_id)`，实现“用户多角色、角色多权限”。
- `sys_learning_profile`：`user_id` 既是主键也是 `sys_user.id` 外键；保存学段、年级、教材偏好与兴趣 JSON，为适龄教学提供输入。
- `sys_login_audit`、`sys_operation_audit`：分别记录登录结果和管理操作；操作对象由类型和 ID 表示，不参与课程主数据关联。

### 2. MySQL `k12_business`：课程与学习（现有）

- `learning_course`：课程主键 `id`，标题、学科、年级、教师用户 ID、简介和 `cover_object_key`；封面键指向 MinIO，不存临时签名 URL。
- `learning_course_chapter`：主键 `id`，外键 `course_id` 指课程；存章节标题、正文、排序。
- `learning_course_enrollment`：主键 `id`，`(course_id, user_id)` 唯一；课程是库内外键，`user_id` 逻辑指向 IAM 用户。
- `learning_chapter_progress`：主键 `id`，`(enrollment_id, chapter_id)` 唯一；记录学生已选课程中的章节进度。

### 3. MySQL `k12_business`：智能体与代码执行（现有）

- `agent_config`：主键 `id`，稳定 `code` 唯一；保存名称、类型、版本、状态和不含密钥的运行配置。
- `agent_run`：主键 `id`，公开 `run_id` 唯一；用 `agent_code`、`user_id`、`session_id` 关联智能体、用户和会话；保存输入、同步/异步模式、状态、输出、错误和耗时。`agent_code` 是逻辑关联，不是数据库外键。
- `agent_artifact`：主键 `id`，`artifact_id` 唯一，`run_id` 外键指向运行；小型结构化结果存 JSON，大型图像/文件只存对象 URI。
- `code_execution_quota`：联合主键 `(user_id, quota_date)`；记录每个用户每天已受理的代码运行次数。代码任务的生命周期归入现有运行/产物链，不额外虚构“代码执行主表”。

### 4. MySQL `k12_business`：作业、练习与学情（现有）

- `assessment_homework`：作业主键 `id`；关联课程 ID 与教师用户 ID，保存标题、描述、草稿/发布/关闭状态。课程和用户关联按服务边界做逻辑校验。
- `assessment_homework_recipient`：联合主键 `(homework_id, student_user_id)`，记录定向发放的学生；前者为作业外键，后者是 IAM 用户逻辑引用。
- `assessment_homework_question`、`assessment_question_option`：题目归属作业，选项归属题目；存题型、题干、分值、标准答案/解析和选项顺序。
- `assessment_homework_submission`：主键 `id`，`(homework_id, student_user_id)` 唯一；记录学生作答、状态、总分、教师反馈和乐观锁版本。
- `assessment_submission_answer`：`(submission_id, question_id)` 唯一；保存每题答案、自动分、人工分、最终分与批改状态。
- `assessment_homework_grade_history`：按提交 ID 与版本号保存批改快照，支持追溯，不覆盖历史。
- `assessment_ai_practice_attempt`：学生对 AI 形成性练习的尝试、题目/得分摘要和薄弱点；与教师作业成绩分开。
- `assessment_ai_knowledge_mastery`：联合主键 `(student_user_id, knowledge_code)`；累计练习次数、分数及最近练习时间，用于知识点掌握度。

### 5. PostgreSQL/pgvector `k12_rag`：知识检索（现有）

- `knowledge_document`：主键 `document_id`；存标题、正文、来源、学段、年级、教材、章节和 JSON 元数据。
- `knowledge_chunk`：主键 `chunk_id`，`document_id` 外键指向原文；`(document_id, chunk_index)` 唯一；存切片正文、1024 维向量、向量模型和继承的过滤字段。一个文档对应多个切片。
- 当前写入接口会直接替换文档与切片；`metadata.contentStatus` 不构成数据库审核门禁，检索也未按“已审核”过滤。因此审核工作流必须在正式资料开放前补齐，不能仅靠前端隐藏草稿。

### 6. 非关系型存储（现有适配器，启用状态取决于配置）

- MongoDB `agent_run_trace` 集合：按 `run_id` 保存可变结构的 Agent 执行轨迹、状态与脱敏上下文，设置过期清理；不承担最终业务状态或成绩。
- Redis：缓存可重建的 RAG 检索结果和学习排行榜；MySQL/PostgreSQL 才是相应数据的持久来源。
- MinIO：保存封面、教学文档、图片、音视频和 Agent 大产物；业务表仅保存对象键/URI。其“文件归属、可见性、审核”还需要完整业务元数据与鉴权流程（规划）。
- RabbitMQ：保存待消费消息，不作为报表或业务记录的永久数据库。

### 7. Neo4j 知识图谱（规划，非关系表）

Neo4j 不重复保存 pgvector 正文，也不保存学生账号、成绩或聊天记录。建议规划四个节点标签：`KnowledgePoint`（`code` 唯一、名称、学段、难度、概念摘要、审核状态）、`CourseChapterRef`（由 `course_id + chapter_id` 组成稳定业务键，引用 MySQL 章节）、`KnowledgeDocumentRef`（`document_id` 引用 pgvector 原文）、`PracticeQuestionRef`（`question_id` 引用经教师审核的业务题目）。规划五类关系：`(A:KnowledgePoint)-[:PREREQUISITE_OF]->(B:KnowledgePoint)` 表示学 A 是学 B 的前置；`RELATED_TO` 表示非先修的相邻概念；`(CourseChapterRef)-[:COVERS]->(KnowledgePoint)` 表示章节覆盖知识点；`(KnowledgeDocumentRef)-[:EXPLAINS]->(KnowledgePoint)` 表示经审核的资料讲解知识点；`(PracticeQuestionRef)-[:ASSESSES]->(KnowledgePoint)` 表示题目考查该知识点。题目内容和标准答案仍在 MySQL，不复制进图谱。关系需能记录审核来源和版本，防止随意生成错误先修链。

`KnowledgePoint.code` 应与 `assessment_ai_knowledge_mastery.knowledge_code` 使用同一稳定编码；现有练习编码可能来自动态主题，不能直接假设都已映射。图谱是**知识之间的关系索引**，主要有五类查询用途：①学生问一个概念时找到相关/前置概念，引导追问；②教师查看课程章节覆盖了哪些知识点、有无先修缺口；③按知识点找到已审核的讲解资料和练习主题；④结合 MySQL 掌握度解释学生在哪条依赖链上卡住；⑤在确认先修已掌握后推荐下一主题。Neo4j 返回编码和关系路径，事实正文仍由 pgvector 检索，成绩仍以 MySQL 为准。三库间由服务通过稳定 ID 关联，**不存在跨库物理外键**；课程/资料撤回后需同步解除图关系或使节点不可用于推荐。图谱管理、审核、同步与查询接口均待实现。

建图时应给知识点编码和章节/资料/题目引用键设置唯一约束；禁止 `PREREQUISITE_OF` 自环或循环依赖。`RELATED_TO` 可按无方向语义查询，但存储时使用一致方向，避免一对概念生成两条重复关系。初期仅从少量教师审核的 AI 通识主题开始，先验证图谱是否带来更准确的解释和资源导航，再扩大规模。现有 AI 临时生成的小测没有稳定题目 ID，不直接建 `PracticeQuestionRef`；现有作业发布也不等同于知识图谱审核，待正式题库或明确的审核题目接入后再映射。

建议由 Learning 服务负责知识点目录、章节映射和图谱写入，审核后才发布关系；Agent/Assessment 通过受控内部接口查询知识编码与关系，不让用户端直连 Neo4j。该服务归属只是目标设计，当前没有对应接口或数据同步任务。

## 三、ER 图文字说明

现状 ER 图按三个关系数据域分开画；目标方案额外画一张 Neo4j 概念图。跨域用虚线标注“逻辑关联”，不要画成物理外键：

1. **身份域**：`用户 M:N 角色`，由 `sys_user_role` 拆为两个一对多；`角色 M:N 权限`，由 `sys_role_permission` 拆分；`用户 1:0..1 学习档案`。登录/操作审计通过用户 ID 或用户名追踪，不反向决定角色。
2. **课程域**：`课程 1:N 章节`、`课程 1:N 选课`、`选课 1:N 章节进度`、`章节 1:N 章节进度`；`IAM 用户 1:N 选课` 为跨库逻辑关系。课程封面经对象键关联 MinIO。
3. **智能体域**：`智能体配置 1:N 运行`（按 `code` 逻辑关联）、`运行 1:N 产物`（按 `run_id` 真实外键）、`IAM 用户 1:N 运行`（跨库逻辑关联）。Mongo 轨迹与运行按 `run_id` 对应，不能当成强一致事务外键。
4. **作业域**：`课程 1:N 作业`（逻辑关联）、`作业 1:N 题目/接收人/提交`、`题目 1:N 选项`、`提交 1:N 逐题答案/批改历史`；逐题答案再关联题目。教师、学生 ID 对 IAM 用户均为跨库逻辑关联。
5. **知识域**：`知识文档 1:N 知识切片`；课程/章节与知识文档目前没有稳定的物理关联表，只能用学段、教材、章节元数据或检索结果建立**松耦合关联**，不要在现状 ER 图中画已存在的课程知识外键。
6. **形成性练习域**：`IAM 学生 1:N 练习尝试`，`IAM 学生 1:N 知识点掌握记录`；知识点编码与知识文档不是现成外键。知识点目录及课程映射若要强管理，属于后续建模（规划）。
7. **Neo4j 目标图谱**：知识点之间的 `PREREQUISITE_OF` 和 `RELATED_TO` 是图关系，不是 MySQL ER 外键。单独画“图数据库概念模型”，再用虚线把知识点编码、章节 ID、文档 ID、题目 ID 指向相应关系库实体；现状 ER 图不出现这些节点。

## 四、DFD 图文字说明

**上下文图（0 层）**：系统作为一个总处理过程。外部实体包括学生、教师/管理员、大模型服务、腾讯云代码沙箱。学生输入登录、问题、练习与代码，收到课程、回答、反馈和运行结果；教师输入课程/作业/资料，收到管理和审核结果。外部服务只接收最小必要数据并返回生成或执行结果。RabbitMQ、MySQL、pgvector、Redis、MongoDB、MinIO 是内部数据存储/基础设施，不画成学生或教师。

**1 层分解**：

1. `P1 身份与授权`：登录凭据 → IAM 校验 `D1 身份库` → JWT/权限；Gateway/各服务据此放行或拒绝。
2. `P2 课程学习`：教师维护课程章节 → `D2 业务库`；学生浏览、选课、学习 → 章节与进度 → 排行榜可读 Redis 缓存 `D5`。
3. `P3 智能教学`：学生问题 + 学段/章节上下文 → Agent Service 创建运行 `D2` → Python 检索 `D3 pgvector`、调用模型 → 文本/结构化产物 → `D2`、大文件 `D6 MinIO` → 用户端展示；可选轨迹写 `D4 MongoDB`。
4. `P4 作业与评价`：教师发布题目/接收人 → `D2`；学生提交 → 自动/人工批改 → 提交、历史和掌握度写 `D2` → 反馈学生。
5. `P5 长任务和代码实践`：受权代码请求 → 配额与运行记录写 `D2` → RabbitMQ 队列 `D7` → Python Worker → 云沙箱/显式本地保底 → 结果与产物回写 `D2/D6`。
6. `P6 资料治理（规划）`：教师上传 → 暂存 MinIO + 资料元数据 → 审核人通过/驳回 → 仅通过的正文切分入 `D3`；撤回时禁止继续检索。现有内部上传与索引接口**尚未**串成这个流程。
7. `P7 知识关系服务（规划）`：已审核知识点/章节/资料/题目映射 → `D8 Neo4j`；按概念查询相邻/先修主题、章节覆盖或资料/练习引用；必要时结合 `D2` 的学生掌握度做缺口诊断和下一主题推荐，并经 `D2/D3` 验证课程与资料可用性。图谱检索不替代 pgvector 的语义问答。

**2 层建议重点画 `P3`**：输入校验 → 获取最小学习上下文 → 意图/学段判断 → 知识召回与重排 → 生成适龄讲解/受控动画步骤/练习或编程指导 → 结果安全校验 → 落库与返回。异步时单独画队列和状态回执；不能把“前端直接访问数据库/模型密钥”画进数据流。

## 五、H 图（功能层次图）文字说明

根节点：**K12 AI 通识教学助手系统**。建议按用户目标分成六个一级功能，二级功能如下：

1. **账号与权限**：注册/登录、用户角色与权限、学习档案、登录/操作审计。
2. **课程学习**：课程与章节管理、选课、学习进度、教学资源推荐、排行榜。教师资料上传/审核/发布为规划功能。
3. **AI 教学**：适龄对话、知识库检索与引用、章节引导、结构化动画、互动练习、学习建议；规划 Neo4j 关联概念与先修导航；低龄绘本可作为审核后的预制资源，实时视频生成不在比赛范围。
4. **编程实践**：代码编辑、受控沙箱运行、结果/图表展示、每日配额、静态代码检查；云沙箱为主，本地保底为可选路径。
5. **作业评价与个性化**：教师布置/定向发放、学生提交、自动与人工批改、批改追溯、形成性练习、掌握度与后续推荐；规划用图谱解释知识依赖缺口。个性化效果须另行验收，不应仅凭字段存在就宣称闭环完成。
6. **平台管理与运维**：智能体配置、任务状态、审计、模型/缓存/对象存储配置、服务健康。Nacos 集中配置、完整资料治理、批量导入与审核台标为规划，不作为当前已上线功能。

画图时使用“用户端/管理端 → Gateway → Java 服务 → Python Runtime/外部能力”的模块顺序；H 图表达**功能分解**，不画数据表和网络通信，ER 图画实体关系，DFD 图画数据流，三者不要混用。

## 六、核对入口

现有实体以 `backend/sql/mysql/k12_auth_init.sql`、`backend/sql/mysql/k12_business_init.sql` 及同目录升级脚本、`ai-services/k12-agent-runtime/sql/001_init_pgvector.sql` 为准。系统范围以 `docs/project-scope-and-roadmap.md` 为准；具体 RAG 补充与未完成的审核流程见 `ai-services/k12-agent-runtime/docs/knowledge-base-completion-plan.md`。实际库结构可能因升级脚本未执行而落后，交付报告前需核对部署环境。

## 七、绘图通用规则（交给制图人员）

以下是可以直接落图的详细规格，上面的第二至五节是摘要。每张图右下角标注版本日期和“现状图/目标图”。**现状图只用实线画当前实体与流程；目标图新增的规划功能用虚线框和“规划”字样。**不要把尚未实现的资料审核、教材映射、会话管理表画成现有表。

- 表结构图的框头写 `数据库.表名`，第二行写用途；字段按“主键/唯一键 → 外键或逻辑引用 → 业务字段 → 状态/时间”排序。只挑报告需要的字段展示，完整类型与长度以 SQL 为准。
- ER 图实体之间写基数和参与度。例如 `用户(1) —— (0..N)选课`，不是只有一句“用户关联选课”。实线表示真实外键；虚线表示跨库引用、对象键或业务代码关联。Mongo、Redis、MinIO、RabbitMQ不是关系表，不要给它们编造数据库外键。
- DFD 图用外部实体 E、处理过程 P、持久数据存储 D、带名有向箭头。一个箭头应是名词性数据包，如“登录凭据”，而不是“登录”“调用服务”等动作。任何外部实体都只能经 P 访问 D。
- H 图只表达功能上下级，格式如 `3 智能教学 → 3.2 知识检索 → 3.2.1 学段过滤`；不画数据库箭头或网络协议。已实现与规划在叶子节点标注。

## 八、表结构图详细字段卡片

绘制三张关系型表结构分图：A 身份库、B 业务库、C RAG 库。时间字段统一采用现有 SQL 的 `created_time`、`updated_time` 等真实名称；图面空间不足时可折叠为“审计时间字段”，不能误写成所有表都有逻辑删除。

### A. `k12_auth`（身份与权限）

1. `sys_user`：PK `id`；UQ `username`、`email`、`phone`；展示 `password_hash`、`nickname`、`status`、`failed_login_count`、`locked_until`、`auth_version`、`last_login_time`、`deleted`。密码列必须写摘要，不写密码明文。
2. `sys_role`：PK `id`；UQ `role_code`；展示 `role_name`、`description`、`status`。
3. `sys_permission`：PK `id`；UQ `permission_code`；展示 `permission_name`、`resource_type`、`status`。
4. `sys_user_role`：复合 PK `(user_id, role_id)`，两个字段分别 FK 到用户、角色；展示 `created_time`。这是用户与角色的桥接表。
5. `sys_role_permission`：复合 PK `(role_id, permission_id)`，两个字段分别 FK 到角色、权限；这是角色与权限的桥接表。
6. `sys_learning_profile`：PK/FK `user_id → sys_user.id`；展示 `school_stage`、`grade`、`textbook`、`interests_json`。一个用户最多一份档案。
7. `sys_login_audit`：PK `id`；展示 `user_id`、`username`、`success`、`failure_reason`、`client_ip`、`created_time`。`user_id` 可空，登录失败时不一定能定位已有用户；**SQL 未设到用户表的外键**。
8. `sys_operation_audit`：PK `id`；展示 `operator_user_id`、`action`、`target_type`、`target_id`、`detail`、`created_time`。操作人与目标均按业务 ID 追溯，没有通用目标表外键。

### B. `k12_business`（课程、智能体、评价）

1. `learning_course`：PK `id`；`teacher_id` 逻辑引用 IAM 用户；展示 `title`、`subject`、`grade_level`、`description`、`cover_object_key`、`status`、`deleted`。
2. `learning_course_chapter`：PK `id`；FK `course_id → learning_course.id`；展示 `title`、`content`、`sort_order`、`deleted`。
3. `learning_course_enrollment`：PK `id`；FK `course_id → learning_course.id`，`user_id` 逻辑引用 IAM 用户；UQ `(course_id, user_id)`；展示 `status`、`enrolled_time`。
4. `learning_chapter_progress`：PK `id`；FK `enrollment_id → learning_course_enrollment.id`、`chapter_id → learning_course_chapter.id`；UQ `(enrollment_id, chapter_id)`；展示 `progress_percent`。选课与章节同属一门课程由业务校验，表上不是第三条外键。
5. `agent_config`：PK `id`；UQ `code`；展示 `name`、`type`、`description`、`version`、`config_json`、`status`、`deleted`；`config_json` 不能存 API 密钥。
6. `agent_run`：PK `id`；UQ `run_id`；`agent_code → agent_config.code`、`user_id → IAM 用户` 为逻辑关联；展示 `session_id`、`execution_mode`、`input_text`、`input_context`、`status`、`output_text`、`output_metadata`、`error_code`、`duration_ms`、`started_time`、`finished_time`。`session_id` 只是分组字段，当前没有独立会话主表。
7. `agent_artifact`：PK `id`；UQ `artifact_id`；FK `run_id → agent_run.run_id`；展示 `kind`、`title`、`mime_type`、`storage_uri`、`payload_json`、`size_bytes`、`checksum_sha256`。
8. `code_execution_quota`：复合 PK `(user_id, quota_date)`；`user_id` 逻辑引用 IAM 用户；展示 `used_count`、`updated_time`。限额按北京时间自然日计数。
9. `assessment_homework`：PK `id`；`course_id → learning_course.id`、`teacher_user_id → IAM 用户` 为逻辑关联，**未设外键**；展示 `title`、`description`、`status`、`deleted`。
10. `assessment_homework_recipient`：复合 PK `(homework_id, student_user_id)`；`homework_id` FK 到作业，`student_user_id` 逻辑引用 IAM 用户。
11. `assessment_homework_question`：PK `id`；FK `homework_id → assessment_homework.id`；展示 `question_type`、`stem`、`score`、`sort_order`、`correct_answers_json`、`reference_answer`、`analysis`、`deleted`。
12. `assessment_question_option`：PK `id`；FK `question_id → assessment_homework_question.id`；UQ `(question_id, option_key)`；展示 `content`、`sort_order`、`deleted`。
13. `assessment_homework_submission`：PK `id`；FK `homework_id → assessment_homework.id`；UQ `(homework_id, student_user_id)`；`student_user_id` 逻辑引用 IAM 用户；展示 `answer_content`、`status`、`score`、`feedback`、`graded_by`、`version`、`submitted_time`、`graded_time`。
14. `assessment_submission_answer`：PK `id`；FK `submission_id → assessment_homework_submission.id`、`question_id → assessment_homework_question.id`；UQ `(submission_id, question_id)`；展示 `answer_json`、`answer_text`、`auto_score`、`manual_score`、`final_score`、`grading_status`、`feedback`。
15. `assessment_homework_grade_history`：PK `id`；FK `submission_id → assessment_homework_submission.id`；UQ `(submission_id, version)`；展示 `score`、`feedback`、`graded_by`、`graded_time`，体现每次批改的不可覆盖快照。
16. `assessment_ai_practice_attempt`：PK `id`；UQ `(student_user_id, run_id)`；展示 `artifact_id`、`topic`、`knowledge_code`、`score`、`max_score`、`correct_count`、`total_questions`、`weak_point`、`answers_json`。`knowledge_code` 来自升级脚本，实际库需确认已升级。
17. `assessment_ai_knowledge_mastery`：复合 PK `(student_user_id, knowledge_code)`；展示 `topic`、`attempt_count`、`total_score`、`total_max_score`、`latest_score_percent`、`last_practiced_time`。该表也依赖升级脚本，不要未经核对就声明已部署。

### C. PostgreSQL `k12_rag`

1. `knowledge_document`：PK `document_id`；展示 `title`、`source_type`、`source_uri`、`content`、`stage_code`、`grade`、`textbook`、`chapter`、`metadata`、`updated_time`。
2. `knowledge_chunk`：PK `chunk_id`；FK `document_id → knowledge_document.document_id`；UQ `(document_id, chunk_index)`；展示 `content`、`embedding VECTOR(1024)`、`embedding_model`、`stage_code`、`grade`、`textbook`、`chapter`。HNSW 索引用于向量近邻检索，不是第三张实体表。

## 九、ER 图逐线规格

建议交付五张子图，加一张只有关键节点的总览。符号统一：左侧为父实体，`1 → 0..N` 表示一个父记录可有零至多个子记录；桥接表的一行必须属于一个父记录。下列每一条可直接照写到图上的连线标签。

**ER-A：身份权限**

- `sys_user.id (1) → (0..N) sys_user_role.user_id`：拥有角色，实线；`sys_role.id (1) → (0..N) sys_user_role.role_id`：授予用户，实线。
- `sys_role.id (1) → (0..N) sys_role_permission.role_id`：包含权限，实线；`sys_permission.id (1) → (0..N) sys_role_permission.permission_id`：被角色引用，实线。
- `sys_user.id (1) → (0..1) sys_learning_profile.user_id`：拥有学习档案，实线。
- `sys_user.id (1) ⇢ (0..N) sys_login_audit.user_id / sys_operation_audit.operator_user_id`：仅逻辑追踪，虚线；登录失败记录可能无用户 ID。

**ER-B：课程学习**

- `learning_course.id (1) → (0..N) learning_course_chapter.course_id`：包含章节，实线。
- `learning_course.id (1) → (0..N) learning_course_enrollment.course_id`：接受选课，实线。
- `learning_course_enrollment.id (1) → (0..N) learning_chapter_progress.enrollment_id`：产生进度，实线。
- `learning_course_chapter.id (1) → (0..N) learning_chapter_progress.chapter_id`：被进度引用，实线。
- `sys_user.id (1) ⇢ (0..N) learning_course.teacher_id / learning_course_enrollment.user_id`：授课/选课，跨库虚线；`cover_object_key ⇢ MinIO 对象`仅在系统架构图标注，不作为 ER 实体连线。

**ER-C：作业评价**

- `learning_course.id (1) ⇢ (0..N) assessment_homework.course_id`：课程设置作业，同库但无 FK，仍为虚线。
- `assessment_homework.id (1) → (0..N) assessment_homework_question.homework_id / assessment_homework_recipient.homework_id / assessment_homework_submission.homework_id`：出题、定向发放、收到提交，三条实线。
- `assessment_homework_question.id (1) → (0..N) assessment_question_option.question_id / assessment_submission_answer.question_id`：包含选项、被逐题答案引用，实线。
- `assessment_homework_submission.id (1) → (0..N) assessment_submission_answer.submission_id / assessment_homework_grade_history.submission_id`：包含逐题作答与批改历史，实线。
- `sys_user.id (1) ⇢ (0..N) assessment_homework.teacher_user_id / assessment_homework_recipient.student_user_id / assessment_homework_submission.student_user_id`：教师或学生归属，跨库虚线。

**ER-D：智能体与学情**

- `agent_config.code (1) ⇢ (0..N) agent_run.agent_code`：配置产生运行，虚线，代码未设 FK；`agent_run.run_id (1) → (0..N) agent_artifact.run_id`：运行产生多种产物，实线。
- `sys_user.id (1) ⇢ (0..N) agent_run.user_id / code_execution_quota.user_id / assessment_ai_practice_attempt.student_user_id / assessment_ai_knowledge_mastery.student_user_id`：归属同一用户，跨库虚线。
- `agent_run.run_id (1) ⇢ (0..N) assessment_ai_practice_attempt.run_id`：练习结果的运行来源是逻辑标识，没有 FK；`assessment_ai_practice_attempt.knowledge_code ⇢ assessment_ai_knowledge_mastery.knowledge_code`：同一学生的知识点聚合，逻辑关联而非 FK。
- Mongo `agent_run_trace.run_id` 与 `agent_run.run_id` 为观测数据的逻辑对应；不要塞进 MySQL ER 实体框。

**ER-E：RAG 知识**

- `knowledge_document.document_id (1) → (1..N) knowledge_chunk.document_id`：一篇已成功索引的文档被切成一个或多个片段，真实 FK；从纯 DDL 看数据库并不强制至少一个片段，故若画“库结构现状”应写 `0..N`，若画“入库业务规则”可写 `1..N`，并注明约束来源。
- `knowledge_document.stage_code/grade/textbook/chapter` 是检索过滤属性，不是到课程表的 FK。不要仅因字段同名就连到 `learning_course`。

**ER-F：Neo4j 图谱概念图（只用于目标方案，不是关系型 ER 表）**

- 画四个节点框：`KnowledgePoint` 标 `code [唯一]、name、stage_code、difficulty、review_status`；`CourseChapterRef` 标 `chapter_ref [唯一]、course_id、chapter_id`；`KnowledgeDocumentRef` 标 `document_id [唯一]`；`PracticeQuestionRef` 标 `question_id [唯一]`。`chapter_ref` 是计划中的组合业务键，不是现有 MySQL 字段。
- `KnowledgePoint A -[PREREQUISITE_OF]-> KnowledgePoint B`：A 是 B 的前置，知识点两端均可参与零到多条关系；箭头必须指向“后续知识点”。例如“循环结构 → 冒泡排序”（**仅示意，尚未建图**）。
- `KnowledgePoint A -[RELATED_TO]- KnowledgePoint B`：相关但不代表先修；多对多。图中可画双向语义，落库时只保留一条规范方向，避免成对重复边。
- `CourseChapterRef -[COVERS]-> KnowledgePoint`：一章覆盖多个知识点，一个知识点可被多个章节覆盖；多对多。箭头从章节引用节点指向知识点。
- `KnowledgeDocumentRef -[EXPLAINS]-> KnowledgePoint`：一篇审核通过的文档可解释多个知识点，一个知识点也可由多篇文档讲解；多对多。箭头从文档引用节点指向知识点。
- `PracticeQuestionRef -[ASSESSES]-> KnowledgePoint`：一题可以考查多个知识点，一个知识点也可由多题考查；多对多。仅对稳定、审核通过的业务题目建关系。
- 在图外用**虚线注释**：`KnowledgePoint.code ⇢ MySQL assessment_ai_knowledge_mastery.knowledge_code`、`CourseChapterRef.chapter_id ⇢ MySQL learning_course_chapter.id`、`KnowledgeDocumentRef.document_id ⇢ pgvector knowledge_document.document_id`、`PracticeQuestionRef.question_id ⇢ MySQL assessment_homework_question.id`。这些不是 Neo4j 可执行的跨库外键；同步失败、撤回和孤立节点需要应用层处理。
- 图右侧附“用途”文字：概念探索、章节覆盖检查、资料/题目定位、先修缺口解释、下一主题推荐；不要仅写“学习路径推荐”。学生掌握度和试题得分不画成图节点。

总览 ER 图只保留用户、课程、章节、选课、作业、提交、智能体运行、产物、知识文档/片段；细字段放子图，避免总图无法阅读。

## 十、DFD 逐箭头规格

### 1. 符号与编号

- 外部实体：`E1 学生`、`E2 教师/管理员`、`E3 大模型服务`、`E4 云代码沙箱`。若绘制本地保底路径，`E4` 可细分为 `E4a 腾讯云沙箱`、`E4b 本地 Piston`，并标注 Piston 只在显式保底时使用。
- 处理过程：`P1 身份与授权`、`P2 课程学习`、`P3 AI 智能教学`、`P4 作业与学情评价`、`P5 编程实践与长任务`、`P6 资料治理（规划）`。
- 数据存储：`D1 IAM MySQL`、`D2 业务 MySQL`、`D3 pgvector`、`D4 Mongo 轨迹`、`D5 Redis 缓存`、`D6 MinIO 对象`、`D7 RabbitMQ 任务队列`、`D8 Neo4j 知识关系图谱（规划）`。`D7` 是消息中转，不是主业务记录；可在图例中单独画队列形状。现状图省略 `D8`。

### 2. 0 层上下文图

中心只画一个 `P0 K12 AI 通识教学助手系统`，**不画内部 P1–P6，也不画 D1–D7**。箭头至少包括：

- `E1 → P0`：注册/登录资料、学段选择、课程操作、问题、练习答案、作业提交、代码；`P0 → E1`：认证结果、课程内容、适龄回答及引用、练习反馈、作业结果、代码运行结果。
- `E2 → P0`：课程与题目维护、作业发布与批改、用户/角色维护；`P0 → E2`：课程/作业状态、学生提交与学情、运行状态、审计记录。
- `P0 → E3`：脱敏后的最小教学问题和有限检索片段；`E3 → P0`：模型生成的文本或结构化候选结果。系统校验后才交学生。
- `P0 → E4`：受限代码、资源/时间配置；`E4 → P0`：标准输出、失败/超时状态、文件产物元数据。
- 目标图可补 `E2 → P0`“待审核资料、审核决定”及 `P0 → E2`“审核状态”；现状图不要画已完成的资料审核流。
- 目标图还可补 `E1 → P0`“概念探索/薄弱点查询”、`P0 → E1`“知识关联、先修解释与推荐依据”，以及 `P0 → E2`“章节知识覆盖报告”。这些由规划中的知识关系服务提供，现状图不画。

### 3. 1 层分解图的数据流

保持 0 层的外部输入/输出种类不变，在内部展开 P1–P6 与 D1–D7：

1. `E1/E2 → P1`“凭据/注册信息”；`P1 ↔ D1`“用户、角色、权限、档案、审计”；`P1 → E1/E2`“JWT/失败原因”；`P1 → P2/P3/P4/P5`“已校验身份、用户 ID、权限”。注意 JWT 验证发生在 Gateway 和业务安全链，DFD 中 P1 是概念处理，不表示每个请求都直连 IAM 数据库。
2. `E2 → P2`“课程、章节、封面对象键”；`P2 ↔ D2`“课程、选课、进度”；`E1 ↔ P2`“浏览/报名/进度与课程结果”；`P2 ↔ D5`“可重建排行榜缓存”；`P2 → P3`“当前章节和学习历史摘要”。封面访问需经授权服务签短链接，不画前端直读 D6 管理口。
3. `E1 → P3`“问题、会话 ID、学段偏好”；`P3 ← P1/P2/P4`“身份、课程上下文、近期练习/掌握度摘要”；`P3 ↔ D2`“运行状态和产物元数据”；`P3 ↔ D3`“查询向量与知识片段”；`P3 ↔ D5`“短时检索缓存”；`P3 → E3 → P3`“受控提示/模型候选”；`P3 → D4`“可选脱敏轨迹”；`P3 → D6`“大产物对象”；`P3 → E1`“适龄回答、引用状态、动画/练习数据”。
4. `E2 → P4`“作业题目、接收人、批改”；`E1 → P4`“作业答案/形成性练习答案”；`P4 ↔ D2`“作业、提交、批改历史、知识点掌握度”；`P4 → E1/E2`“得分与反馈/批改视图”；`P4 → P3`“受控学情摘要”。
5. `E1 → P5`“代码和语言/执行限制”；`P5 ↔ D2`“日配额、运行状态、产物元数据”；`P5 → D7 → P5`“异步任务/结果消息”；`P5 → E4 → P5`“隔离执行请求/结果”；`P5 → D6`“需存储的大文件”；`P5 → E1`“受控输出、运行状态和授权下载信息”。
6. `P6（规划）`单独用虚线边界：`E2 → P6`“待审资料/审核意见”；`P6 ↔ D6`“原始文件”；`P6 ↔ D2`“拟新增资料元数据与审核记录”；`P6 → D3`“仅审核通过的知识正文和向量”；`P6 → E2`“审核状态”。现有 D2 **没有**这些治理表，目标图需标注“拟新增”，不能引用一个并不存在的表名冒充现状。
7. `P7（规划）`用虚线边界：`E2/P6/P4 → P7`“已审核知识点、章节、资料及稳定题目映射”；`P7 ↔ D8`“关系写入/相邻与先修路径查询”；`P2/P3/P4 → P7`“章节、问答主题或薄弱点编码”；`P7 → P2/P3/P4`“覆盖知识点、关联资料/题目 ID、前置缺口或候选下一主题”。最终正文仍从 `D3` 取，题目与分数仍从 `D2` 取。

### 4. P3 的 2 层图（建议作为核心业务流程图）

将 `P3` 细分为 `P3.1 接收与校验`、`P3.2 获取学习上下文`、`P3.3 意图/学段判断`、`P3.4 RAG 召回重排`、`P3.5 模型生成`、`P3.6 安全校验与产物规范化`、`P3.7 落库和返回`。连线顺序：

`E1 问题/会话 → P3.1 合法输入 → P3.2 学段/章节/近期表现 → P3.3 教学策略 → P3.4 引用片段 → P3.5 文本/步骤/练习候选 → P3.6 已校验产物 → P3.7 运行记录与展示数据 → E1`。

旁路连接：`P3.4 ↔ D3` 检索片段，`P3.4 ↔ D5` 可重建缓存，`P3.5 ↔ E3` 模型调用，`P3.7 ↔ D2` 运行与产物，`P3.7 → D4` 脱敏轨迹，`P3.7 → D6` 大文件。检索无结果、模型不可用、生成结果不合规分别从 P3.4/P3.5/P3.6 进入受控降级输出；“检索过”与“实际用于回答”两种引用状态要区分。

目标图可在 `P3.3` 后新增虚线 `P3.3 → P7 → D8 Neo4j → P3.3`，取得关联概念、先修缺口和资料/练习的稳定编码；随后仍由 `P3.4 ↔ D3` 找可引用正文。现状图不画此分支。

## 十一、H 图可直接照排的节点清单

根节点 `0 K12 AI 通识教学助手`，第二层为以下六组；每组下列叶子是第三层。`[规划]` 表示目标图虚线叶子，不应算已完成。

1. `1 身份与权限`：`1.1 注册/登录/JWT`；`1.2 用户管理`；`1.3 角色与接口权限`；`1.4 学段/年级/教材偏好档案`；`1.5 登录与操作审计`。
2. `2 课程与资源`：`2.1 课程目录和章节`；`2.2 选课与章节进度`；`2.3 封面与教学媒体访问`；`2.4 学习排行榜`；`2.5 教师文件上传与资源归属[规划]`；`2.6 资料审核发布与撤回[规划]`。
3. `3 AI 教学助手`：`3.1 问题接收及适龄策略`；`3.2 知识召回、重排与真实引用`；`3.3 LangGraph 教学节点和模型生成`；`3.4 结构化动画步骤与安全渲染`；`3.5 课堂小测与即时反馈`；`3.6 按表现调整后续教学`；`3.7 完整知识体系与长期会话摘要[规划]`；`3.8 Neo4j 关联概念/先修/资料导航[规划]`。
4. `4 编程实践`：`4.1 代码编辑/提交`；`4.2 权限与日配额`；`4.3 同步/异步调度`；`4.4 腾讯云沙箱受控运行`；`4.5 本地 Piston 保底`；`4.6 结果、图表、文件下载`；`4.7 更广语言支持与静态检查完善[规划]`。
5. `5 作业、评价与学情`：`5.1 作业和题目维护`；`5.2 定向发放`；`5.3 学生提交`；`5.4 自动计分与教师复核`；`5.5 批改历史`；`5.6 形成性练习与知识点掌握度`；`5.7 跨课程个性化推荐与长期能力评估[规划]`；`5.8 知识依赖缺口诊断与下一主题解释[规划]`。
6. `6 平台管理`：`6.1 智能体配置与运行记录`；`6.2 系统审计与健康检查`；`6.3 MySQL/pgvector/MongoDB/Redis/MinIO/RabbitMQ 适配`；`6.4 Nacos 注册与配置真实验收[规划]`；`6.5 资料审核管理台[规划]`；`6.6 Neo4j 图谱构建、审核和同步[规划]`。基础设施节点只在 H 图作为“平台支撑能力”，不展开成数据库字段。

H 图与 ER/DFD 是三个视角：同一“作业批改”在 H 图是一项功能，在 DFD 是处理过程与数据流，在 ER 图是提交/答案/历史之间的实体关系。绘图成稿时保持名称一致，但不要把它们画成同一种符号。

## 十二、交付前自检

1. ER 图是否准确区分真实 FK、跨库逻辑引用、普通属性？是否漏了桥接表的联合主键？
2. DFD 0 层的外部输入/输出，在 1 层是否仍能找到对应流程？有无外部实体直连数据存储或 D7 队列被当成持久数据库？
3. H 图是否只含功能的上下级，未混入数据库关系或 HTTP/RabbitMQ 连线？
4. 资料审核、资源归属、正式教材映射、长期会话、Neo4j 接入和 Nacos 验收是否明确标为规划？
5. 图题是否写明“现状/目标”和依据的代码版本？若部署环境尚未执行升级脚本，报告应写“仓库已有表结构脚本”，不能写“线上已建表”。
