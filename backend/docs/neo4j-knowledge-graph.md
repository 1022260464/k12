# Neo4j 知识关系层接入说明

形成「提问讲解 → RAG 引用 → 小测掌握度 → 先修缺口/下一主题」的教学闭环。

## 职责边界

| 存储 | 存什么 | 不存什么 |
| --- | --- | --- |
| Neo4j | 知识点先修/关联、章节/资料映射 | 正文、成绩、账号 |
| **知识目录 JSON** | 权威知识点元数据与目录边（版本化文件） | 运行时掌握度 |
| pgvector | 可引用正文切片 | 先修图 |
| MySQL | 作业/小测/掌握度 | 向量与图关系主存 |

## 知识目录从哪来？（白话）

系统里有一份「知识点清单」文件：

`backend/k12-learning-service/src/main/resources/knowledge/ai_literacy_catalog.json`

- 服务启动时读进内存
- 管理端「写进图谱」时，按这份清单去改 Neo4j 里的点
- 也可用外部文件（改完不用重新打包）：

```text
K12_KNOWLEDGE_CATALOG_LOCATION=file:D:/data/k12/ai_literacy_catalog.json
```

`sql/neo4j/` 下同名文件只是备份，服务不读。

**日常改名单：** 改 JSON →「重新读清单」→「写进图谱」  
**新环境第一次：** 点「一键初始化」（= 基础数据 + 重新读清单 + 写进图谱，不只是合并前两个按钮）

页面上单独改某个点，不会写回 JSON；以后再「写进图谱」，清单里有的编号仍会盖掉页面改动。

更细的说明：`k12-learning-service/src/main/resources/knowledge/README.md`。

## 知识目录从哪来？（工程约定）

**权威源（SSOT）**

`backend/k12-learning-service/src/main/resources/knowledge/ai_literacy_catalog.json`

- 由 `KnowledgeCatalogStore` 在启动时加载到内存
- 可用环境变量覆盖为外部文件（热更后点「重新读清单」即可，无需重打包）：

```text
K12_KNOWLEDGE_CATALOG_LOCATION=file:D:/data/k12/ai_literacy_catalog.json
```

默认：

```text
K12_KNOWLEDGE_CATALOG_LOCATION=classpath:knowledge/ai_literacy_catalog.json
```

仓库里的 `sql/neo4j/ai_literacy_catalog.json` 只是运维镜像，**服务进程不读它**。

**与 Cypher 小种子的关系**

| 层 | 内容 | 规模 |
| --- | --- | --- |
| `002_seed_ai_literacy.cypher` 等 | 基础数据：少量示例点 + 示例章节/资料闭环 | 十余点级 |
| JSON 目录 +「写进图谱」 | 全量分类 / 知识点 / 目录边 | 数百点 |

启动或「一键初始化」：先跑 Cypher，再按 JSON 覆盖同步到 Neo4j。

## 本机/联调配置

在启动 Learning 服务前设置（**不要把密码写进 Git**）：

```text
K12_NEO4J_ENABLED=true
K12_NEO4J_URI=bolt://122.51.54.52:7687
K12_NEO4J_USERNAME=neo4j
K12_NEO4J_PASSWORD=<your-password>
K12_NEO4J_DATABASE=neo4j
K12_NEO4J_SEED_ON_STARTUP=true
# 可选：外部目录文件
# K12_KNOWLEDGE_CATALOG_LOCATION=file:/path/to/ai_literacy_catalog.json
```

浏览器管理台：`http://122.51.54.52:7474`

脚本位置：

- `backend/sql/neo4j/001_constraints.cypher`
- `backend/sql/neo4j/002_seed_ai_literacy.cypher`
- `backend/sql/neo4j/003_seed_demo_teaching_loop.cypher`（正式演示：章节 COVERS + 资料 EXPLAINS）
- `backend/sql/neo4j/004_cleanup_formal_demo_docs.cypher`
- 运行时副本：`k12-learning-service/src/main/resources/neo4j/`

## 管理端三个按钮 / API

| 按钮 | API | 白话 |
| --- | --- | --- |
| 重新读清单 | `POST /admin/catalog/reload` | 重新读清单文件，图先不动 |
| 写进图谱 | `POST /admin/catalog/sync?reload=true` | 按清单改图上的点 |
| 一键初始化 | `POST /admin/seed` | 基础数据 + 重新读清单 + 写进图谱 |
| （查看） | `GET /admin/catalog` | 看当前读的是哪份、有多少点 |

均需管理员。前缀：`/api/v1/learning/knowledge-graph`。

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

管理端「知识图谱」应能看到：知识点、先修边、章节覆盖、讲解资料都有数据；页眉「知识点清单」一行显示版本和文件路径。

## 闭环链路

1. 学生提问 → Agent Service `LearnerContextEnricher` 读取掌握度，并调用 Learning `POST .../knowledge-graph/teaching-context`
2. Runtime Teaching Assistant 在回答中附加「知识图谱导航」（先修薄弱 / 下一主题）
3. 小测回写 `assessment_ai_knowledge_mastery`
4. 教学资料入库成功且带 `knowledgeCode` 时，写入 `(KnowledgeDocumentRef)-[:EXPLAINS]->(KnowledgePoint)`

知识点勾选目录：`GET .../points` 优先读 Neo4j；未启用或为空时回退内存中的 JSON 目录（数百知识点）。真正保存 `COVERS` 仍需 `K12_NEO4J_ENABLED=true` 且连通。

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
2. 管理端加载知识点目录（JSON/Neo4j）；Neo4j 不可用时回退内存目录勾选。
3. 点「AI 建议」：主要依据**章节导语**；优先大模型，失败则本地匹配。建议不落库。
4. 教师勾选/取消后点「保存知识点绑定」：先落库导语，再写 `(CourseChapterRef)-[:COVERS]->(KnowledgePoint)`。**只允许官方目录内的 code**，不会在图谱里造野点。
5. **发布课程前**：校验每章至少绑定一个目录内知识点；未绑定或绑定非法 code 会拒绝发布。发布成功后将该课图节点标为 `published=true`。
6. **教学资料**：发布 / 入库 / 同步图谱前须填写目录内 `knowledgeCode` 与简介；`EXPLAINS` 同样拒绝目录外编码。
7. **清理脏数据**：`POST .../admin/purge-dirty`（管理端「清理脏数据」）删除未发布/已删课程的 `CourseChapterRef`，以及非「已发布且已入库」的 `teaching-resource-*` 讲解节点；正式演示节点保留。检索侧也会过滤未发布课与无效资料。

管理端侧栏「知识图谱」：`GET .../knowledge-graph/overview` 提供节点/边/章节覆盖与教学闭环进度可视化（已绑章节仅含已发布课程）。

未启用 Neo4j 时章节导语仍必填并落 MySQL；`COVERS` 绑定会提示需开启图谱。图谱未启用时课程发布跳过 COVERS 校验。
