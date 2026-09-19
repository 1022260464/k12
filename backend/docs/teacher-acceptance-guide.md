# 教师工作台与批量导入验收指南

面向联调/产品验收。覆盖教师登录分流、课程与作业、JSON 批量导入、教学资料（课程附件）、题目附件，以及学生端回显。

## 0. 验收前准备

### 账号

| 角色 | 用途 |
|------|------|
| 管理员 `ROLE_ADMIN` | 审核/发布教学资料，对照确认教师看不到管理入口 |
| 教师 `ROLE_TEACHER` | 主验收账号 |
| 学生 `ROLE_STUDENT` | 确认无法进管理端；验证课程附件与作业附件下载 |

### 服务与配置

需启动：Gateway、IAM、Learning、Assessment；管理端 `admin-app`、学生端 `user-app`。

附件相关（默认关闭，不配则上传会 503）：

```text
K12_COURSE_MEDIA_ENABLED=true
K12_ASSESSMENT_ATTACHMENTS_ENABLED=true
K12_MINIO_ENDPOINT=...
K12_MINIO_ACCESS_KEY=...
K12_MINIO_SECRET_KEY=...
K12_MINIO_BUCKET=...
```

Assessment 若使用独立附件配置项，以 `k12-assessment-service` 的 `application.yml` 中 `k12.assessment.attachments.*` 为准，同样打开 `enabled` 并指向同一可访问 MinIO。

### 数据库

已有库执行（新库可用 `k12_business_init.sql`）：

- `backend/sql/mysql/k12_business_course_section_upgrade.sql`
- `backend/sql/mysql/k12_business_teaching_resource.sql`（及 context 升级脚本，若尚未执行）
- `backend/sql/mysql/k12_business_question_attachment_upgrade.sql`

### 自动化测试（开发自测）

本机 Maven：

```powershell
$mvn = "D:\apache-maven-3.9.6\bin\mvn.cmd"
cd D:\CodeWorkPlace\k12\backend
& $mvn -pl k12-iam-service,k12-learning-service,k12-assessment-service -am test `
  "-Dtest=StudentDirectoryServiceTest,CourseImportServiceTest,TeachingResourceServiceTest,TeachingResourceStorageTest,QuestionImportServiceTest,QuestionAttachmentStorageTest,QuestionAttachmentServiceTest,HomeworkServiceTest" `
  "-Dsurefire.failIfNoSpecifiedTests=false"
```

覆盖：学生目录校验、课程/题目导入边界、资料与题目附件存储校验、草稿/权限规则、作业主流程。

---

## 1. 登录与菜单分流

| # | 步骤 | 期望 |
|---|------|------|
| 1.1 | 学生账号登录管理端 | 拒绝，提示无管理端访问权限 |
| 1.2 | 教师登录管理端 | 成功；品牌/标题为「教师工作台」一类文案 |
| 1.3 | 查看教师侧栏 | 可见：工作台、课程资源、教学资料、作业管理 |
| 1.4 | 同上 | 不可见：用户管理、角色与权限、安全审计、智能体管理、系统设置 |
| 1.5 | 管理员登录 | 可见全部管理入口 |

---

## 2. 课程：手工创建、发布、批量导入

模板：`qianduan/admin-app/public/templates/course-import.json`（浏览器「下载课程模板」同源）。

| # | 步骤 | 期望 |
|---|------|------|
| 2.1 | 教师「课程资源」→ 新建课程 | 状态为草稿；列表仅本人课程（非管理员全量） |
| 2.2 | 管理章节 / 小节 → 发布 | 至少一章，且每章有导语或小节；发布成功 |
| 2.3 | 「批量导入」上传合法模板 | 课程与章/节一次创建为草稿；提示成功数量 |
| 2.4 | 故意改坏 JSON（错误 version、缺章节） | 整批失败，库中不出现半成品课程 |
| 2.5 | 学生端浏览/报名已发布课程 | 可见并可读章节正文 |

边界：单文件 ≤ 1 MB、≤ 20 门课、每章 ≤ 100 小节、整批 ≤ 500 小节。

---

## 3. 教学资料作为课程附件

| # | 步骤 | 期望 |
|---|------|------|
| 3.1 | 教师上传教学资料，关联**已发布**本人课程（可选章节） | 草稿创建成功；对象在 MinIO |
| 3.2 | 教师提交审核 | 状态 `PENDING_REVIEW` |
| 3.3 | 教师界面 | 无「审核通过 / 发布 / 入库」按钮 |
| 3.4 | 管理员审核 → 发布 | 状态 `PUBLISHED` |
| 3.5 | 学生打开该课程详情 | 「教学附件」列表可见，可下载 |
| 3.6 | 学生进入已关联章节阅读页 | 章节级附件可见并可下载 |
| 3.7 | 未报名学生 | 无法通过课程附件接口拿到该课程资料 |

---

## 4. 作业：选人、题目导入、附件、发布

模板：`qianduan/admin-app/public/templates/question-import.json`。

| # | 步骤 | 期望 |
|---|------|------|
| 4.1 | 教师创建作业，课程仅能选本人已发布课 | 草稿作业 |
| 4.2 | 「接收人」搜索勾选学生 | 列表有启用学生（姓名/用户名/ID）；**不展示邮箱** |
| 4.3 | 校验并保存接收人 | 无效 ID 被标出；保存成功 |
| 4.4 | 「题目」批量导入合法 JSON | 题目写入草稿；选项与答案正确 |
| 4.5 | 导入非法 JSON / 超限 | 拒绝且不写入题目 |
| 4.6 | 「题目附件」选中题目上传 PDF/PNG/JPG/DOCX（≤10MB） | 草稿可上传；列表可下载 |
| 4.7 | 发布作业后再上传附件 | 拒绝（仅草稿可改） |
| 4.8 | 发布作业 | 指定学生在学生端可见 |

---

## 5. 学生端作业与题目附件

| # | 步骤 | 期望 |
|---|------|------|
| 5.1 | 学生打开已布置作业 | 可见题干与选项 |
| 5.2 | 有附件的题目 | 题干下方出现下载入口，可打开签名 URL |
| 5.3 | 完成作答并提交 | 提交成功；教师「提交与批改」可见 |
| 5.4 | 非接收人学生 | 看不到该作业 |

---

## 6. 权限与安全回归（抽检）

| # | 步骤 | 期望 |
|---|------|------|
| 6.1 | 教师 A 尝试改教师 B 的课程/作业/资料 | 403 或不可见 |
| 6.2 | 教师直打用户管理 API | 403（不仅是前端隐藏） |
| 6.3 | 关闭附件开关后再上传 | 503，提示存储未启用 |
| 6.4 | 上传扩展名与内容不符的伪 PDF | 业务校验拒绝 |

---

## 7. 验收结论模板

- 环境：______（日期 / 分支 / 是否开启 MinIO）
- 自动化测试：通过 / 失败（附命令输出摘要）
- 手工清单：第 1–6 节通过项 / 阻塞项
- 阻塞项负责人与修复跟踪：______

**建议最低通过线**：1.x、2.1–2.3、2.5、3.1–3.6、4.1–4.4、4.6–4.8、5.1–5.3 全部通过；附件开关未开时，将 3.x / 4.6 / 5.2 标为「环境未启用，跳过」并单独记入结论。
