# 图形化编程关卡管理端配置实施方案

> 目标：把 Blockly 关卡迁移为数据库配置，使管理端可以新建、修改、复制、排序、发布和下架关卡。当前内置 8 个关卡模板。
>
> 实施原则：教学内容可配置，执行逻辑只能选择后端白名单模板；禁止在数据库或管理端保存、执行 JavaScript。

## 1. 当前状态与问题

当前关卡信息分别写死在以下位置：

- `qianduan/user-app/src/data/blocklyMissions.js`：标题、故事、目标、提示、步骤、徽章、工具箱；
- `qianduan/user-app/src/features/blockly/blocklyRuntime.js`：Blockly 指令编译；
- `backend/k12-learning-service/.../VisualProgrammingEvaluator.java`：服务端评分；
- `backend/k12-learning-service/.../VisualProgrammingProjectService.java`：关卡编码白名单。

因此，现在修改标题需要发布前端，新增关卡还需要同时修改 Java。改造后，同一任务模板下的新关卡不再需要改代码；只有新增一种全新的积木能力或评分逻辑时才需要开发。

## 2. 最终能力边界

管理端第一版支持：

1. 新建关卡草稿；
2. 修改基础信息、教学内容和模板参数；
3. 从现有关卡复制；
4. 校验配置；
5. 发布、下架；
6. 调整展示顺序；
7. 查看已有学生进度数量；
8. 删除没有学习记录的草稿；
9. 查看学生端卡片预览。

第一版不实现：

- 管理员编写 JavaScript；
- 任意组合并发布未知积木；
- 可视化拖拽设计评分规则；
- 修改已有学习记录的历史评分结果；
- 在一个关卡中执行 Python、Java 或系统命令。

## 3. 数据模型

### 3.1 新增关卡定义表

新建脚本：

`backend/sql/mysql/k12_business_visual_programming_mission_upgrade.sql`

表名：`learning_visual_programming_mission`

```sql
USE k12_business;

CREATE TABLE IF NOT EXISTS learning_visual_programming_mission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mission_code VARCHAR(64) NOT NULL COMMENT '稳定业务编码，创建后不可修改',
    template_code VARCHAR(32) NOT NULL COMMENT '服务端白名单任务模板',
    title VARCHAR(80) NOT NULL,
    short_title VARCHAR(40) NOT NULL,
    stage_code VARCHAR(32) NOT NULL DEFAULT 'UPPER_PRIMARY',
    knowledge_code VARCHAR(128) NOT NULL,
    description VARCHAR(300) NOT NULL,
    story VARCHAR(600) NOT NULL,
    goal VARCHAR(400) NOT NULL,
    hint VARCHAR(600) NOT NULL,
    badge VARCHAR(40) NOT NULL,
    reflection VARCHAR(500) NOT NULL,
    steps_json JSON NOT NULL,
    concepts_json JSON NOT NULL,
    config_json JSON NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    content_version INT UNSIGNED NOT NULL DEFAULT 1,
    lock_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    updated_by BIGINT UNSIGNED NOT NULL,
    published_time DATETIME(3) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_visual_mission_code (mission_code),
    KEY idx_visual_mission_status_order (status, sort_order, id),
    KEY idx_visual_mission_stage (stage_code, status, sort_order),
    CONSTRAINT chk_visual_mission_status
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'OFFLINE')),
    CONSTRAINT chk_visual_mission_template
        CHECK (template_code IN (
            'DATA_LABELING',
            'PREDICTION_BRANCH',
            'LOOP_ROUTE',
            'CONFIDENCE_GATE',
            'AGENT_PATROL',
            'DATA_BALANCE',
            'QUIZ_GAME',
            'SEQUENCE_STORY'
        ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Blockly AI mission definition managed by administrators';
```

说明：

- `mission_code` 是学生进度表的关联键，创建后禁止修改；
- `template_code` 决定允许的积木、运行方式和评分策略；
- `config_json` 只保存结构化参数，不保存代码；
- `lock_version` 用于 MyBatis-Plus 乐观锁，避免两个管理员互相覆盖；
- `content_version` 每次有效修改加一，供前端缓存和问题排查；
- IAM 用户 ID 仍采用逻辑关联，不建立跨库外键。

### 3.2 现有进度表调整

`learning_visual_programming_project` 保留 `mission_code`，不需要迁移历史数据。建议增加查询索引：

```sql
ALTER TABLE learning_visual_programming_project
    ADD KEY idx_visual_project_mission_status (mission_code, status, updated_time);
```

执行前先使用 `SHOW INDEX` 检查，避免重复创建索引。升级脚本不要使用存储过程、`PREPARE` 或大段动态 SQL，兼容当前数据库软件的小数据包限制。

### 3.3 初始化 8 个关卡

把当前 8 个关卡作为种子数据插入：

| mission_code | template_code |
|---|---|
| `label-training-data` | `DATA_LABELING` |
| `predict-and-decide` | `PREDICTION_BRANCH` |
| `repeat-a-route` | `LOOP_ROUTE` |
| `confidence-gate` | `CONFIDENCE_GATE` |
| `campus-ai-patrol` | `AGENT_PATROL` |
| `balance-training-data` | `DATA_BALANCE` |
| `ai-knowledge-quiz` | `QUIZ_GAME` |
| `ai-sequence-story` | `SEQUENCE_STORY` |

使用多条小型 `INSERT IGNORE`，不要生成一个超长 INSERT。种子 `created_by`、`updated_by` 使用现有管理员 ID；如果环境无法保证管理员 ID，允许先使用 `0` 表示系统初始化。

## 4. 任务模板与配置 JSON

### 4.1 模板定义

后端定义枚举：

```java
public enum VisualMissionTemplateCode {
    DATA_LABELING,
    PREDICTION_BRANCH,
    LOOP_ROUTE,
    CONFIDENCE_GATE,
    AGENT_PATROL,
    DATA_BALANCE,
    QUIZ_GAME,
    SEQUENCE_STORY
}
```

每个模板固定：

- 允许出现的 Blockly block type；
- 默认工具箱分类；
- `config_json` 的字段结构和范围；
- 服务端评分方法；
- 浏览器运行时所需参数。

### 4.2 配置示例

#### DATA_LABELING

```json
{
  "expectedLabels": {
    "cat-1": "cat",
    "cat-2": "cat",
    "dog-1": "dog",
    "dog-2": "dog"
  },
  "requiredClasses": ["cat", "dog"],
  "requireTrain": true
}
```

#### PREDICTION_BRANCH

```json
{
  "imageId": "mystery-cat",
  "expectedCategory": "cat",
  "messageKeyword": "猫",
  "requireTrain": true
}
```

#### LOOP_ROUTE

```json
{
  "minRepeatTimes": 2,
  "maxRepeatTimes": 10,
  "minDistance": 8,
  "messageKeyword": "任务完成"
}
```

#### CONFIDENCE_GATE

```json
{
  "imageId": "mystery-cat",
  "predictionCategory": "cat",
  "simulatedConfidence": 92,
  "minimumThreshold": 80,
  "messageKeyword": "很有把握"
}
```

#### AGENT_PATROL

```json
{
  "imageId": "mystery-dog",
  "expectedCategory": "dog",
  "minRepeatTimes": 2,
  "maxRepeatTimes": 10,
  "minDistance": 8,
  "messageKeyword": "巡检完成"
}
```

新增三类模板的配置分别为：数据均衡的类别、最少样本和最大数量差；知识闯关的三题答案和
通关分数；顺序绘本的场景顺序、最短停留时间和结束关键词。完整默认值以数据库升级脚本及
`visualMissionTemplates.js` 为准。

### 4.3 参数安全范围

服务端必须校验：

- JSON 总长度不超过 20 KB；
- `steps` 固定 3 项，每项 2 至 40 字；
- `concepts` 1 至 6 项，每项 1 至 24 字；
- 文本不允许控制字符；
- 循环次数 1 至 10；
- 距离 1 至 100；
- 置信度和阈值 50 至 100；
- 图片 ID、类别、关键词使用明确长度和字符范围；
- 模板配置不能出现未声明字段，可在 Jackson DTO 上拒绝未知字段或手工白名单校验。

## 5. Java 后端分层

在 `k12-learning-service` 增加：

```text
model/
  VisualProgrammingMission.java

mapper/
  VisualProgrammingMissionMapper.java

dto/
  VisualProgrammingMissionCreateRequest.java
  VisualProgrammingMissionUpdateRequest.java
  VisualProgrammingMissionResponse.java
  VisualProgrammingMissionOrderRequest.java
  VisualProgrammingMissionDuplicateRequest.java
  VisualProgrammingMissionTemplateResponse.java

service/
  VisualProgrammingMissionService.java
  VisualProgrammingMissionValidator.java
  VisualProgrammingMissionTemplateRegistry.java

service/visualmission/
  VisualMissionTemplate.java
  DataLabelingMissionTemplate.java
  PredictionBranchMissionTemplate.java
  LoopRouteMissionTemplate.java
  ConfidenceGateMissionTemplate.java
  AgentPatrolMissionTemplate.java

web/
  VisualProgrammingMissionController.java
  VisualProgrammingMissionAdminController.java
```

### 5.1 模板接口

```java
public interface VisualMissionTemplate {
    VisualMissionTemplateCode code();

    Set<String> allowedBlockTypes();

    List<String> toolboxCategories();

    void validateConfig(JsonNode config);

    VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config);
}
```

`VisualProgrammingMissionTemplateRegistry` 在构造器中接收所有模板实现并按 `code` 建立只读 Map。未知模板直接拒绝，不能回退到宽松模式。

### 5.2 改造现有评分器

将 `VisualProgrammingEvaluator.evaluate(String missionCode, JsonNode workspace)` 改为：

1. 按 `missionCode` 查询已发布或管理员预览的关卡；
2. 读取 `templateCode`；
3. 从 Registry 获取模板；
4. 校验工作区只包含该模板允许的 block type；
5. 使用数据库 `config_json` 完成评分；
6. 返回三项检查和最多三颗星。

不要让模板实现直接执行前端生成的指令。服务端继续解析 Blockly JSON 结构。

### 5.3 改造进度服务

删除 `VisualProgrammingProjectService.MISSIONS` 静态 Set，改为查询关卡表：

- 保存进度时关卡必须存在；
- 普通学生只能保存 `PUBLISHED` 关卡；
- 已下架关卡的历史进度保留但不能继续提交；
- 返回进度时仍按 `missionCode` 合并；
- 数据库读取到损坏配置时返回明确 500 日志，但响应不泄露 JSON 内容。

## 6. REST API

### 6.1 学生端接口

```http
GET /api/v1/learning/visual-programming/missions/published
GET /api/v1/learning/visual-programming/missions/published/{missionCode}
```

返回按 `sortOrder, id` 排序的已发布关卡。响应包含：

```json
{
  "id": 1,
  "missionCode": "confidence-gate",
  "templateCode": "CONFIDENCE_GATE",
  "title": "有把握再回答",
  "shortTitle": "认识置信度",
  "stageCode": "UPPER_PRIMARY",
  "knowledgeCode": "ai.ml.confidence",
  "description": "...",
  "story": "...",
  "goal": "...",
  "hint": "...",
  "badge": "谨慎判断员",
  "reflection": "...",
  "steps": ["...", "...", "..."],
  "concepts": ["置信度", "阈值"],
  "toolboxCategories": ["events", "ai", "logic", "looks"],
  "runtimeConfig": {
    "imageId": "mystery-cat",
    "simulatedConfidence": 92,
    "minimumThreshold": 80
  },
  "sortOrder": 4,
  "contentVersion": 1
}
```

公开响应不能返回 `createdBy`、`updatedBy` 或管理备注。

### 6.2 管理端接口

```http
GET    /api/v1/learning/visual-programming/admin/missions
GET    /api/v1/learning/visual-programming/admin/missions/{id}
GET    /api/v1/learning/visual-programming/admin/templates
POST   /api/v1/learning/visual-programming/admin/missions
PUT    /api/v1/learning/visual-programming/admin/missions/{id}
POST   /api/v1/learning/visual-programming/admin/missions/{id}/duplicate
POST   /api/v1/learning/visual-programming/admin/missions/{id}/publish
POST   /api/v1/learning/visual-programming/admin/missions/{id}/offline
PUT    /api/v1/learning/visual-programming/admin/missions/order
DELETE /api/v1/learning/visual-programming/admin/missions/{id}
```

列表筛选参数：`status`、`templateCode`、`keyword`、`stageCode`。

状态规则：

```text
DRAFT -> PUBLISHED
PUBLISHED -> OFFLINE
OFFLINE -> PUBLISHED
DRAFT -> DELETE（仅无学生记录）
```

发布前必须完整执行模板配置校验。

### 6.3 写接口请求示例

```json
{
  "missionCode": "pet-confidence-check",
  "templateCode": "CONFIDENCE_GATE",
  "title": "宠物识别信心挑战",
  "shortTitle": "判断识别信心",
  "stageCode": "UPPER_PRIMARY",
  "knowledgeCode": "ai.ml.confidence",
  "description": "观察预测结果和置信度。",
  "story": "校园里出现了一张新的宠物照片。",
  "goal": "置信度达到 85% 后再回答。",
  "hint": "把置信度判断放进如果积木。",
  "badge": "信心观察员",
  "reflection": "高置信度不代表永远正确。",
  "steps": ["训练模型", "预测图片", "判断置信度"],
  "concepts": ["置信度", "阈值"],
  "config": {
    "imageId": "mystery-cat",
    "predictionCategory": "cat",
    "simulatedConfidence": 92,
    "minimumThreshold": 85,
    "messageKeyword": "有把握"
  },
  "sortOrder": 10,
  "lockVersion": 0
}
```

## 7. 权限与安全

第一版配置接口仅允许系统管理员：

```java
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
```

需要同时补充两层规则：

1. `k12-common` Servlet Security；
2. `k12-gateway-service` WebFlux Security。

管理接口规则必须放在通用 `/api/v1/learning/**` 规则之前：

```text
/api/v1/learning/visual-programming/admin/** -> ROLE_ADMIN
```

已发布关卡查询可设为 `permitAll`，让游客试玩也能看到管理端最新内容；保存项目接口仍要求登录。若不开放公开查询，则游客只使用前端内置兜底关卡，管理员修改仅对登录用户生效，不推荐。

服务端还必须保证：

- 只接受模板注册表中的模板；
- 只接受模板允许的 Blockly block type；
- 拒绝脚本、HTML、事件属性和控制字符；
- `missionCode` 创建后不可修改；
- 已产生学生记录时禁止修改 `templateCode`；
- 删除仅允许无记录的草稿；
- 所有写操作记录操作人和时间；
- 乐观锁冲突返回 409，而不是静默覆盖。

## 8. 管理端实现

### 8.1 文件结构

```text
qianduan/admin-app/src/
  pages/VisualProgrammingMissionManagement.jsx
  components/visual-programming/MissionEditorModal.jsx
  components/visual-programming/MissionPreview.jsx
  components/visual-programming/TemplateConfigFields.jsx
  data/visualMissionTemplates.js
  api/client.js
  styles.css
```

### 8.2 导航

在 `admin-app/src/App.jsx` 中增加管理员菜单：

```text
id: visual-programming
label: 图形化关卡
icon: Blocks
adminOnly: true
```

`renderPage()` 增加 `VisualProgrammingMissionManagement`。

### 8.3 API 封装

在 `admin-app/src/api/client.js` 增加：

```javascript
export const visualMissionsApi = {
  list: (filters = {}) => api(`/api/v1/learning/visual-programming/admin/missions?${query(filters)}`),
  get: (id) => api(`/api/v1/learning/visual-programming/admin/missions/${id}`),
  templates: () => api("/api/v1/learning/visual-programming/admin/templates"),
  create: (body) => api("/api/v1/learning/visual-programming/admin/missions", {
    method: "POST", body: JSON.stringify(body),
  }),
  update: (id, body) => api(`/api/v1/learning/visual-programming/admin/missions/${id}`, {
    method: "PUT", body: JSON.stringify(body),
  }),
  duplicate: (id, body) => api(`/api/v1/learning/visual-programming/admin/missions/${id}/duplicate`, {
    method: "POST", body: JSON.stringify(body),
  }),
  publish: (id) => api(`/api/v1/learning/visual-programming/admin/missions/${id}/publish`, { method: "POST" }),
  offline: (id) => api(`/api/v1/learning/visual-programming/admin/missions/${id}/offline`, { method: "POST" }),
  reorder: (items) => api("/api/v1/learning/visual-programming/admin/missions/order", {
    method: "PUT", body: JSON.stringify({ items }),
  }),
  remove: (id) => api(`/api/v1/learning/visual-programming/admin/missions/${id}`, { method: "DELETE" }),
};
```

### 8.4 页面布局

列表页应包含：

- 顶部标题、状态统计、新建按钮；
- 关键词、状态、模板筛选；
- 关卡顺序、名称、模板、知识点、状态、版本、学生数量；
- 编辑、复制、发布/下架、删除按钮；
- 空状态、加载状态、接口错误状态；
- 移动端不使用超宽表格，改为卡片或响应式表格。

编辑弹窗分为 4 个区域：

1. 基础信息；
2. 教学内容；
3. 模板参数；
4. 学生端预览。

模板参数必须根据 `/admin/templates` 返回的字段定义生成，不能允许管理员直接编辑原始 JSON。可以保留“高级查看 JSON”，但必须只读。

## 9. 学生端改造

### 9.1 API

在 `user-app/src/api/client.js` 增加：

```javascript
missions: () => api("/api/v1/learning/visual-programming/missions/published", { public: true })
```

若用户端 `api()` 尚不支持 `public` 参数，需要参考管理端封装，公开请求不附带 JWT，但已有 JWT 时允许附带也可以。

### 9.2 数据来源

将 `BLOCKLY_MISSIONS` 改名为 `DEFAULT_BLOCKLY_MISSIONS`，只作为以下情况的兜底：

- 后端服务不可用；
- 数据库升级尚未执行；
- 已发布关卡列表为空且当前是开发环境。

`VisualCodeLabPage` 挂载时：

1. 请求已发布关卡；
2. 成功后以服务端列表为准；
3. 失败时使用内置 5 关并显示“使用内置课程”；
4. 从服务端返回的 `templateCode` 和 `runtimeConfig` 驱动运行器；
5. 本地进度中已经下架的关卡不展示，但不删除。

### 9.3 本地评分改造

将：

```javascript
evaluateBlocklyMission(missionId, trace)
```

改为：

```javascript
evaluateBlocklyMission(mission, trace)
```

按 `mission.templateCode` 和 `mission.runtimeConfig` 评分。本地评分只用于即时反馈；登录用户最终完成状态仍以服务端返回的 `evaluation` 为准。

### 9.4 Blockly 工具箱

不要让数据库直接传 block type。后端响应 `toolboxCategories`，前端再通过本地白名单：

```javascript
const SAFE_TOOLBOX_CATEGORIES = new Set([
  "events", "data", "ai", "logic", "control", "motion", "looks",
]);
```

未知分类忽略。积木定义和编译器继续由代码维护。

## 10. 编辑约束与版本策略

### 草稿

- 所有字段可修改；
- `missionCode` 创建后不可修改；
- 可以删除；
- 学生端不可见。

### 已发布

- 可修改标题、描述、故事、目标、提示、徽章、反思、步骤、概念和排序；
- 修改后 `contentVersion + 1`；
- 若已有学生进度，禁止修改 `templateCode`；
- 评分参数发生变化时必须提示“只影响后续提交，不重算历史最好成绩”。

### 下架

- 学生端列表不可见；
- 历史进度保留；
- 可以重新发布；
- 不能物理删除。

## 11. 测试要求

### Java 单元测试

- 8 个模板合法配置均可通过校验；
- 未知模板被拒绝；
- 配置包含未知字段或越界值被拒绝；
- 新建、修改、发布、下架状态流转；
- 已有学习记录时禁止修改模板；
- 草稿不能被学生提交；
- 下架后不能继续提交；
- 服务端评分使用数据库配置；
- 工作区包含模板未允许积木时拒绝；
- 乐观锁冲突返回 409。

### Security 测试

- 匿名可读取 published 列表；
- 学生不能访问 admin 接口；
- 教师不能访问 admin 接口；
- 管理员可以 CRUD；
- 未登录不能保存项目。

### 前端测试

- API 成功时使用动态关卡；
- API 失败时回退 8 个内置关卡；
- 不认识的工具箱分类被过滤；
- 八类模板的本地即时评分；
- 管理端表单按模板显示正确字段；
- 发布和下架后列表刷新；
- 409 冲突提示管理员刷新后重试。

### 人工验收

1. 管理员新建 `CONFIDENCE_GATE` 草稿；
2. 配置标题、故事、80% 阈值并发布；
3. 学生端刷新后出现新关卡；
4. 学生完成关卡并得到服务端 3 星；
5. 管理员修改标题，学生端刷新后显示新标题；
6. 管理员下架，学生端不再展示；
7. 历史项目记录仍保留；
8. 学生请求 admin API 返回 403。

## 12. Cursor 分阶段执行顺序

不要让 Cursor 一次修改全部模块。按以下顺序逐阶段执行并在每阶段跑测试。

### 阶段 A：数据库和后端目录

1. 新增关卡表升级脚本；
2. 写入 5 条小型种子数据；
3. 新增 Entity、Mapper、DTO；
4. 新增模板枚举、接口、Registry 和配置校验；
5. 暂不修改前端；
6. 编译并运行模板单元测试。

### 阶段 B：后端 CRUD 与评分迁移

1. 实现管理端 CRUD、发布、下架、复制和排序；
2. 实现 published 查询；
3. 将现有评分器迁移到模板策略；
4. 删除静态 mission code 白名单；
5. 增加 Gateway、Servlet Security 和测试；
6. 保持现有 5 关接口行为兼容。

### 阶段 C：学生端动态加载

1. 增加 missions API；
2. 内置关卡改为 fallback；
3. 页面使用动态关卡；
4. 运行器和本地评分读取模板参数；
5. 保持游客试玩和登录同步；
6. 运行前端测试与生产构建。

### 阶段 D：管理端页面

1. 增加导航和 API 封装；
2. 完成列表、筛选和状态操作；
3. 完成分区表单和模板参数字段；
4. 增加只读预览；
5. 完成响应式布局；
6. 进行管理员真实 HTTP 联调。

## 13. 交给 Cursor 的首轮提示词

```text
请阅读 docs/visual-programming-admin-authoring-plan.md，只执行“阶段 A：数据库和后端目录”。

要求：
1. 遵循现有 k12-learning-service 的 Controller/Service/Mapper/DTO/Model 分层和命名风格。
2. 使用 MyBatis-Plus，不引入 JPA。
3. 使用 Lombok @Getter/@Setter，不使用 @Data。
4. 使用 Java 17，DTO 可以使用 record。
5. 所有配置必须做白名单和长度校验，不允许保存或执行 JavaScript。
6. SQL 拆成小语句，避免 max_allowed_packet 问题；不要使用 PREPARE/EXECUTE。
7. 不修改现有学生端和管理端。
8. 增加中文注释和针对模板配置校验的 JUnit 5 测试。
9. 完成后执行 Maven 定向测试，输出修改文件和测试结果，不提交 Git。
```

阶段 A 验证成功后，再让 Cursor 执行阶段 B，避免一次改动范围过大。
