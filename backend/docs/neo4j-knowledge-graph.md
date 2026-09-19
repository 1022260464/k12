# Neo4j 知识关系层接入说明

形成「提问讲解 → RAG 引用 → 小测掌握度 → 先修缺口/下一主题」的教学闭环。

## 职责边界

| 存储 | 存什么 | 不存什么 |
| --- | --- | --- |
| Neo4j | 知识点先修/关联、章节/资料映射 | 正文、成绩、账号 |
| pgvector | 可引用正文切片 | 先修图 |
| MySQL | 作业/小测/掌握度 | 向量与图关系主存 |

## 本机/联调配置

在启动 Learning 服务前设置（**不要把密码写进 Git**）：

```text
K12_NEO4J_ENABLED=true
K12_NEO4J_URI=bolt://122.51.54.52:7687
K12_NEO4J_USERNAME=neo4j
K12_NEO4J_PASSWORD=<your-password>
K12_NEO4J_DATABASE=neo4j
K12_NEO4J_SEED_ON_STARTUP=true
```

浏览器管理台：`http://122.51.54.52:7474`

脚本位置：

- `backend/sql/neo4j/001_constraints.cypher`
- `backend/sql/neo4j/002_seed_ai_literacy.cypher`
- `backend/sql/neo4j/003_seed_demo_teaching_loop.cypher`（正式演示：章节 COVERS + 资料 EXPLAINS）
- 同步副本：`k12-learning-service/src/main/resources/neo4j/`

也可管理员调用：

```http
POST /api/v1/learning/knowledge-graph/admin/seed
```

会依次应用 001 → 002 → 003。

## 正式演示数据（推荐）

一套对齐图谱编码的「人工智能通识 · 正式演示课」，避免旧脚本里的 `ai.intro` / `ml.features` 乱码。

| 层 | 文件 | 作用 |
| --- | --- | --- |
| MySQL | `backend/sql/mysql/k12_formal_demo_ai_literacy.sql` | 1 门课 4 章 + 作业 + 3 份已发布资料（含简介与正确 `knowledge_code`） |
| Neo4j | `003_seed_demo_teaching_loop.cypher` | 4 章 COVERS + 3 份 EXPLAINS（含 description） |
| 课程导入 | `qianduan/admin-app/public/templates/samples/course-import-ai-literacy.json` | 管理端 JSON 导入同结构课程 |
| pgvector | `ai-services/k12-agent-runtime/data/formal_ai_literacy_knowledge.json` | 带 `metadata.knowledgeCode` 的正式语料 |

写入顺序：

1. MySQL 执行 `k12_formal_demo_ai_literacy.sql`（先改脚本顶部教师/学生用户名）
2. Learning 服务 `K12_NEO4J_SEED_ON_STARTUP=true` 重启，或调用 `admin/seed`
3. 可选向量：`uv run python scripts/seed_demo_knowledge.py --data-file=data/formal_ai_literacy_knowledge.json`

管理端「知识图谱」总览应能看到：知识点、先修边、章节覆盖、讲解（EXPLAINS）均 > 0。

## 闭环链路

1. 学生提问 → Agent Service `LearnerContextEnricher` 读取掌握度，并调用 Learning `POST .../knowledge-graph/teaching-context`
2. Runtime Teaching Assistant 在回答中附加「知识图谱导航」（先修薄弱 / 下一主题）
3. 小测回写 `assessment_ai_knowledge_mastery`
4. 教学资料入库成功且带 `knowledgeCode` 时，写入 `(KnowledgeDocumentRef)-[:EXPLAINS]->(KnowledgePoint)`

知识点勾选目录：`GET .../points` 在 Neo4j 未启用或为空时，会回退内置 AI 通识种子目录（约 16 项），管理端始终能看到多选勾选框。真正保存 `COVERS` 仍需 `K12_NEO4J_ENABLED=true` 且连通。

## 查询 API（需登录）

- `GET /api/v1/learning/knowledge-graph/status`
- `GET /api/v1/learning/knowledge-graph/overview`（管理端总览：点/边/章节覆盖/闭环状态）
- `GET /api/v1/learning/knowledge-graph/points?q=&stage=&limit=`（知识点目录，供章节勾选）
- `GET /api/v1/learning/knowledge-graph/points/{code}`
- `GET /api/v1/learning/knowledge-graph/points/{code}/neighbors`
- `GET /api/v1/learning/knowledge-graph/points/{code}/prerequisite-gaps?mastery=code:percent`
- `POST /api/v1/learning/knowledge-graph/recommendations/next`
- `POST /api/v1/learning/knowledge-graph/teaching-context`
- `POST /api/v1/learning/knowledge-graph/suggest-covers`（AI/本地建议，不落库）
- `GET/PUT /api/v1/learning/courses/{courseId}/chapters/{chapterId}/covers`（章节 COVERS 读写）

### 章节绑定工作流

1. **先写章节导语（必填）**：保存章节时同步到 `CourseChapterRef.title` + `description`（导语纯文本）。
2. 管理端加载知识点目录（种子图约十余个 AI 通识点）；Neo4j 不可用时回退内置目录勾选。
3. 点「AI 建议」：主要依据**章节导语**；优先大模型，失败则本地匹配。建议不落库。
4. 教师勾选/取消后点「保存知识点绑定」：先落库导语，再写 `(CourseChapterRef)-[:COVERS]->(KnowledgePoint)`。

管理端侧栏「知识图谱」：`GET .../knowledge-graph/overview` 提供节点/边/章节覆盖与教学闭环进度可视化。

未启用 Neo4j 时章节导语仍必填并落 MySQL；`COVERS` 绑定会提示需开启图谱。
