# 课程与作业发布流程

联调验收清单见 [teacher-acceptance-guide.md](./teacher-acceptance-guide.md)。
教师工作台空数据时可执行演示 SQL：`backend/sql/mysql/k12_teacher_workspace_demo_data.sql`（先改教师/学生用户名）。

## 部署前

已有 `k12_business` 数据库需执行：

- `backend/sql/mysql/k12_business_course_section_upgrade.sql`（小节表）
- `backend/sql/mysql/k12_business_question_attachment_upgrade.sql`（题目附件表）

新环境直接使用 `k12_business_init.sql`。升级脚本只新增表/列，不修改既有课程状态或章节内容。题目附件还需设置 `K12_ASSESSMENT_ATTACHMENTS_ENABLED=true` 与 MinIO 相关环境变量。升级后重启 Learning Service、Assessment Service 和 Gateway，前端刷新即可。

## 教师操作（教学工作台）

教师使用管理端登录后进入**教学工作台**（仅 `ROLE_TEACHER` / `ROLE_ADMIN` 可登录；学生会被拒绝）。教师侧栏只显示工作台、课程资源、教学资料、作业管理，不显示用户、角色、审计、智能体与系统设置。

1. 在“课程资源”优先点 **从 JSON 导入**（下载 `course-import.json`）。也可手工新建。封面请直接上传 PNG/JPG/WEBP，不要手填对象键。新课程为草稿，学生不可见。
2. 打开课程工作台：维护章节/小节，或在「课程附件」上传教学资料（关联本章后仍需管理员审核发布）。
3. 返回课程列表，点击发布。服务端要求至少一章，且每一章有导语或至少一个小节。原有已发布课程维持发布状态，不需要重发。
4. 在“作业管理”新建草稿后会自动进入工作台；优先 **下载题目模板批量导入**，再上传题目附件、勾选接收人，最后发布。
5. 学生端报名课程后，点击章节即可阅读小节，访问完每节可标记本章完成；收到作业后可按题型提交，并可下载题目附件。教师可在“提交与批改”查看答案。

## 当前边界

- 教学正文目前是纯文本，未提供富文本排版、媒体内嵌和自动生成。
- 题目与章节内容由教师录入、审核后发布；AI 起草与资料自动转课应作为后续功能，不应绕过教师确认直接公开。
- 章节进度以整章为单位，已访问小节的前端状态不跨设备保存；更细的学习轨迹需要独立的小节进度表。
- 批量导入目前仅支持带版本字段的 JSON，不解析 Excel。
- 题目附件仅草稿可增删；发布后学生只读下载。需启用 Assessment 附件存储与 MinIO。
