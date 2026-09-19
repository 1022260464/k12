# 教学资料审核与手动入库

## 边界

资料上传到 MinIO，元数据和审核历史保存在 MySQL `k12_business`。
状态流转为 `DRAFT -> PENDING_REVIEW -> APPROVED -> PUBLISHED`，审核驳回回到 `REJECTED`，可编辑后重新提交；已发布可撤回为 `WITHDRAWN`，再打开为草稿重新送审。

**发布不等于知识库入库。** 新资料的 `rag_index_status` 固定为 `NOT_INDEXED`。管理员在发布后单独点击“入库”，Python Runtime 从 MinIO 读取 PDF/DOCX/PPTX，提取文本、切块、向量化后写入 pgvector；失败会记为 `FAILED`，资料仍保持 `PUBLISHED`，可点击“重试入库”。扫描版 PDF、图片和视频没有 OCR/转写能力，不提供入库按钮。

## 部署与操作

1. 在 MySQL 的 `k12_business` 执行 `backend/sql/mysql/k12_business_teaching_resource.sql`。若使用数据库客户端，逐条执行两条 `CREATE TABLE` 即可；重复执行不会清空数据。
   已有资料表还需**执行一次** `backend/sql/mysql/k12_business_teaching_resource_context_upgrade.sql`，再启动新版 Learning Service。新部署也是先建表、再执行该升级。升级只增加可空关联列，不猜测或改写旧资料；重复执行 `ALTER` 会报列已存在，执行前先用 `SHOW COLUMNS FROM k12_business.learning_teaching_resource;` 检查 `course_id` 等六列。升级涉及课程、章节外键，须先有 `learning_course` 和 `learning_course_chapter` 表。
2. Learning Service 已沿用课程素材 MinIO 配置：设置 `K12_COURSE_MEDIA_ENABLED=true`、`K12_MINIO_ENDPOINT`、`K12_MINIO_ACCESS_KEY`、`K12_MINIO_SECRET_KEY`、`K12_MINIO_BUCKET`。桶需预先存在，服务账号需对 `teaching-resources/` 有读写权限。不要把密钥提交到 Git。浏览器需要能访问签名 URL 使用的 endpoint。
3. 重启 Learning Service；管理端进入“教学资料”，上传文件与来源说明（可关联已发布课程/章节），提交审核，再由管理员审核和发布。发布后，已报名学生可在课程详情与章节阅读页的“教学附件”中下载。
4. 手动入库前，确认 Python Runtime 已启用 RAG 与 MinIO，且 `K12_AGENT_MINIO_BUCKET` 与 Learning 的 `K12_MINIO_BUCKET` **相同**。Python 需有对资料对象的读取权限；配置 `K12_AGENT_RAG_ENABLED=true`、`K12_AGENT_RAG_DATABASE_URL`、`K12_AGENT_MINIO_ENABLED=true`、`K12_AGENT_MINIO_ENDPOINT`、Access/Secret Key。Learning 配置 `K12_AGENT_RUNTIME_URL=http://127.0.0.1:8090` 和 `K12_AGENT_INTERNAL_API_KEY`，后者必须与 Python Runtime 的同名变量一致，勿提交真实密钥。重启两个服务。

如果数据库软件提示 `Packet for query is too large`，先**逐条**执行脚本，不要将整个文件作为一条 SQL 发送。当前两条建表语句分别约 0.94 KB、0.63 KB，用于兼容 1 KB 的异常低限制。随后在数据库软件里分别查询：

```sql
SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet';
SHOW SESSION VARIABLES LIKE 'max_allowed_packet';
```

若实际值为 `1024`，应由有权限的数据库管理员在 MySQL 服务端提升限制（例如 `SET GLOBAL max_allowed_packet = 67108864;`），然后**断开并重新连接**数据库软件和 Java 服务。生产容器还应在持久化的 MySQL 配置中设置 `max_allowed_packet=64M`，避免重启后恢复为 1 KB。SQL 缩短只解决建表；后续较长的资料简介、审核意见等写入仍可能超过 1 KB。不要在业务 SQL 中尝试 `SET SESSION max_allowed_packet`，MySQL 8 的 session 值只读。

上传限制：PDF、DOCX、PPTX、PNG、JPG、MP4，最大 50 MB；服务校验文件头和扩展名。来源 / 版权说明由上传人填写，审核人负责确认授权。教师只能管理自己上传的资料，管理员可查看全部。下载地址短期有效，不在数据库存储。

## API

上传和草稿编辑的 `metadata` 继续要求 `title,stageCode,subject,sourceNote`。可选字段为 `courseId,chapterId,grade,textbook,knowledgeCode`；旧请求无需改动。章节必须属于所选且已存在的课程，课程必须已发布；非管理员只能关联本人创建的课程。关联课程后学科必须一致，年级缺省时从课程取得，填写时须与课程年级一致。知识点编码沿用 Assessment 的小写稳定编码格式，例如 `machine_learning.datasets`。资料只记录一个主知识点；多知识点映射和正式知识点目录留待后续建设。

`chapterTitle` 由服务端在保存时记录章节标题快照，不接受客户端指定。旧资料的关联字段保持空；已发布资料不能直接修改，需撤回、重新编辑、审核、发布并再次入库。课程或章节改名不会悄悄改写已审核资料，必要时也走此流程。

入库时年级、教材、章节进入 pgvector 的结构化字段，`courseId,chapterId,knowledgeCode` 进入文档和切片元数据；原有学段过滤继续生效。当前对话链路使用年级、教材精确过滤，课程 ID 与知识点编码先用于引用溯源，**尚未作为对话检索过滤条件**。

网关前缀为 `/api/v1/learning/teaching-resources`：

- `GET /`：管理员全部，其他有课程读取权限的用户仅自己的资料；支持 `page,size,status,keyword`。
- `POST /`：multipart `metadata` JSON + `file`，创建草稿。
- `GET /{id}`、`GET /{id}/download-url`、`PUT /{id}`：详情、下载、编辑草稿/驳回资料。
- `GET /{id}/events`：最近 100 条审核与状态变更记录。
- `POST /{id}/submit`：提交审核。
- `POST /{id}/approve`、`POST /{id}/reject`：管理员审核；JSON `{ "note": "..." }`，驳回原因必填。
- `POST /{id}/publish`、`POST /{id}/withdraw`：管理员发布与撤回；撤回后可调用 `POST /{id}/reopen` 重新编辑和送审。
- `POST /{id}/index`：仅管理员，已发布且未入库/失败资料可调用。HTTP 202 表示任务已进入后台队列，**不是已经入库成功**；读取 `GET /{id}` 的 `ragIndexStatus`，直到 `INDEXED` 或 `FAILED`。
- `GET /published`、`GET /published/{id}`、`GET /published/{id}/download-url`：仅返回已发布资料。用户端课程详情与章节阅读页通过 `GET /api/v1/learning/courses/{courseId}/attachments` 与 `.../chapters/{chapterId}/attachments` 按课程/章节拉取已发布且已关联的资料，再用上述 download-url 获取短期签名地址。

入库状态为 `NOT_INDEXED -> INDEXING -> INDEXED/FAILED/UNKNOWN`。`UNKNOWN` 表示 Java 与 Python 的连接中断，不能确认远端是否已写入；15 分钟内禁止撤回或重试，超过后可重试或撤回（撤回仍会删除可能存在的向量）。Python 单次入库最多执行 4 分钟，Java 等待最多 5 分钟。后台线程池最多 2 个并发、20 个排队；服务重启中断任务后，超过 15 分钟的 `INDEXING` 可再次点击入库。文档 ID 固定为 `teaching-resource-{id}`，重试替换原向量而非累积副本。入库文件最大 20 MB、PDF 最多 100 页、正文最多 20 万字符；失败原因和状态流转写入 `learning_teaching_resource_event`。

撤回已入库资料先调用 Python 删除 pgvector 文档及其切片，再将 MySQL 状态改为 `WITHDRAWN`、`NOT_INDEXED`。删除失败则**不撤回发布**，可重试；未入库的资料可直接撤回。撤回期间 `DEINDEXING`，删除任务异常记录为 `FAILED`；该 `FAILED` 仍可能存在向量，因此下一次撤回会再次尝试删除。检索缓存随入库和删除失效；如果 Redis 故障，应先恢复缓存服务后再重试撤回。模型首次加载可能较慢，页面会轮询状态。

Learning 的 `LOW_PRIMARY/HIGH_PRIMARY/JUNIOR_HIGH/SENIOR_HIGH` 入库时分别转换为 RAG 的 `lower_primary/upper_primary/middle_school/high_school`，与学生提问的学段过滤一致。用户端 AI 助教显示引用时，对 `teaching-resource-{id}` 调用已发布资料下载接口获取短期签名 URL；撤回后接口不再返回文件地址。

验证顺序：上传一份含可复制文本的小 PDF -> 提交 -> 管理员审核 -> 发布 -> 确认仍为“未入库” -> 点击入库 -> 等到“已入库” -> 使用 Python 内部 RAG 搜索同学段内容 -> 学生提问并检查引用打开 -> 撤回 -> 确认搜索结果消失且引用无法再下载。使用真实 MinIO/pgvector 的联调需本机相关服务可达；单元测试不写团队共享库。

关联字段的人工验收只需一份资料：选择已发布课程和其章节，确认详情返回 `courseId/chapterId/chapterTitle/grade/textbook/knowledgeCode`；尝试选其他课程的章节应返回 400，教师关联他人课程应返回 403；发布入库后按相同年级、教材检索并核对元数据。旧资料也应能正常查询。不要用真实教学资源反复上传做测试。
