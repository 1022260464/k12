# 教学图谱 · GraphRAG · 意图分流 沉淀说明

> 面向联调与后续维护。对应代码主要在 Learning / Agent / Agent-Runtime / admin-app。

## 1. 教学闭环数据流

```
学生提问
  → Agent 注入画像 + teachingContext(Neo4j)
  → Runtime 意图分流（关键词）
  → RAG（pgvector，按 knowledgeCode 过滤）
  → 讲解 / 课程推荐 / 软引导拒答
  → 前端展示讲义引用 + 课程章节推荐
```

| 关系 | 含义 | 写入位置 |
|------|------|----------|
| `HAS_CHILD` | 大类 → 知识点 | 目录同步 / seed |
| `PREREQUISITE_OF` | 先修 | 目录 / seed |
| `RELATED_TO` | 相关 | 目录 / seed |
| `COVERS` | 课程章节 → 知识点 | 课程工作台绑定 |
| `EXPLAINS` | 教学资料 → 知识点 | 资料入库索引 |

学生端**不展示** knowledgeCode，只展示中文标题与可打开链接。

## 2. 意图模式（Runtime）

| intentMode | 触发 | 行为 |
|------------|------|------|
| `EXPLAIN` | 默认 / 讲解口吻 | 学段讲解模板（可走模型） |
| `COURSE_RECOMMEND` | 「推荐课程」等 | **不发**四段讲解，只推课程/资料 |
| `OFF_TOPIC` | 无关关键词 | 拒答 + 账号计数；不计 RAG/模型 |
| `SOFT_REDIRECT` | 模型输出疑似跑题 | 引导回学习；**不计**封禁次数 |

输入侧关键词 + 输出侧软校验（小学阈值更高）。锚点有学习信号则放行，宁可漏拦不可误封。

## 3. 账号惩戒（IAM，账号级）

配置前缀：`k12.iam.behavior`（`application.yml` / 环境变量）。

| 参数 | 默认 | 说明 |
|------|------|------|
| `off-topic-limit` | 5 | 无关满 N 次 → 异常 +1 + 临时封禁 |
| `abnormal-behavior-limit` | 5 | 异常满 M 次 → `status=LOCKED` 永久封禁 |
| `temp-ban-duration` | 本地 `2m` / 生产建议 `2h` | `K12_OFF_TOPIC_TEMP_BAN_DURATION` |

字段（`sys_user`，见 `k12_account_behavior_upgrade.sql`）：

- `off_topic_strike_count`
- `abnormal_behavior_count`
- 复用 `locked_until` + `auth_version`（封禁时抬升版本踢登录）

新开会话**不能**清零。管理员把账号改回启用会清零计数。

## 4. 课程推荐为何曾不显示

Runtime `_read_knowledge_graph` 曾只保留带 `code`/`documentId` 的项，丢掉了 `coveredChapters` 的 `courseId`/`chapterId`。已修复。

## 5. 前端图谱页

管理端 / 教师共用「知识图谱」页：

- **ECharts 力导向图**（类 Neo4j Browser）：按类着色、可拖拽、聚焦邻居
- **统计**：学段分布、类别分布、边类型、章节覆盖率
- 教师工作台增加图谱就绪摘要卡片

## 6. 联调检查清单

1. 执行 `backend/sql/mysql/k12_account_behavior_upgrade.sql`
2. 重启 IAM、Learning、Agent、Agent-Runtime、Gateway
3. 问「什么是提示词」→ 讲义 + 课程推荐
4. 问「推荐提示词相关课程」→ 仅推荐块
5. 无关闲聊 → `1/5` 引导文案（加粗）
6. 管理端打开知识图谱 → 力图可交互、统计有数
