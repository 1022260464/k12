-- =============================================================================
-- 正式演示数据：人工智能通识闭环（课程 → 章节 → 知识点 → 教学资料）
-- 库：k12_auth（查用户）+ k12_business（写业务）
--
-- 知识点编码与 Neo4j / BuiltinKnowledgeCatalog 一致，例如：
--   data_literacy.what_is_data / computing.algorithm_basics /
--   machine_learning.features_labels / generative_ai.prompt_basics
--
-- 执行顺序建议：
--   1) 本脚本（MySQL）
--   2) Neo4j：001_constraints + 002_seed_ai_literacy + 003_seed_demo_teaching_loop
--      或管理端 POST /api/v1/learning/knowledge-graph/admin/seed（已含 003）
--   3) 可选：uv run python scripts/seed_demo_knowledge.py \
--        --data-file=data/formal_ai_literacy_knowledge.json
-- =============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

-- ========== 0) 确认教师 / 学生 ==========
USE k12_auth;

-- 按本机账号改这两行（诊断可用旧脚本里的 SELECT）
SET @teacher_username = CONVERT('fenghongtao_teacher' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @student_username = CONVERT('fenghongtao' USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SET @teacher_id = (
  SELECT u.id FROM sys_user u
  JOIN sys_user_role ur ON ur.user_id = u.id
  JOIN sys_role r ON r.id = ur.role_id
  WHERE u.username = @teacher_username
    AND r.role_code = CONVERT('ROLE_TEACHER' USING utf8mb4) COLLATE utf8mb4_unicode_ci
    AND u.deleted = 0 AND u.status = 1
  LIMIT 1
);
SET @student_id = (
  SELECT u.id FROM sys_user u
  JOIN sys_user_role ur ON ur.user_id = u.id
  JOIN sys_role r ON r.id = ur.role_id
  WHERE u.username = @student_username
    AND r.role_code = CONVERT('ROLE_STUDENT' USING utf8mb4) COLLATE utf8mb4_unicode_ci
    AND u.deleted = 0 AND u.status = 1
  LIMIT 1
);

SELECT @teacher_username AS teacher_username, @teacher_id AS teacher_id,
       @student_username AS student_username, @student_id AS student_id;
-- 若 id 为 NULL：改用户名，或确认角色 / status / deleted

-- ========== 1) 清理旧混乱演示（软删，可重复执行） ==========
USE k12_business;

-- 旧演示课标题
UPDATE learning_course
SET deleted = 1, updated_time = CURRENT_TIMESTAMP(3)
WHERE teacher_id = @teacher_id
  AND deleted = 0
  AND title IN (
    CONVERT('人工智能入门' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('机器学习基础（草稿）' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('Python 入门体验课' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('生活中的人工智能' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('人工智能通识 · 正式演示课' USING utf8mb4) COLLATE utf8mb4_unicode_ci
  );

-- 错误知识点编码的旧资料
UPDATE learning_teaching_resource
SET status = CONVERT('WITHDRAWN' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    updated_time = CURRENT_TIMESTAMP(3)
WHERE created_by = @teacher_id
  AND knowledge_code IN (
    CONVERT('ai.intro' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('ml.features' USING utf8mb4) COLLATE utf8mb4_unicode_ci
  );

UPDATE learning_teaching_resource
SET status = CONVERT('WITHDRAWN' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    updated_time = CURRENT_TIMESTAMP(3)
WHERE created_by = @teacher_id
  AND title IN (
    CONVERT('AI 入门讲义' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('数据与特征课件' USING utf8mb4) COLLATE utf8mb4_unicode_ci
  );

-- ========== 2) 正式课程（1 门 · 4 章 · 对齐图谱） ==========
INSERT INTO learning_course (teacher_id, title, subject, grade_level, description, status, deleted)
VALUES (
  @teacher_id,
  CONVERT('人工智能通识 · 正式演示课' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('人工智能' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('初中' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('正式演示：数据素养 → 算法思维 → 机器学习入门 → 生成式 AI 与负责任使用。章节导语可直接作为图谱描述与 AI 建议依据。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  1,
  0
);
SET @course_id = LAST_INSERT_ID();

-- 章 1：数据
INSERT INTO learning_course_chapter (course_id, title, content, sort_order, deleted)
VALUES (
  @course_id,
  CONVERT('第一章 数据从哪里来' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('本章导语：认识「数据」是什么，以及为什么收集与使用数据时要保护隐私。生活中的打卡记录、相册标签、问卷结果都是数据；未经同意分享同学个人信息则可能侵犯隐私。学完后应能举出生活中的数据例子，并说出一条隐私保护做法。对应知识点：什么是数据、数据与隐私入门。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  1, 0
);
SET @ch1 = LAST_INSERT_ID();

INSERT INTO learning_course_section (chapter_id, title, content, sort_order, deleted)
VALUES
  (@ch1,
   CONVERT('1.1 什么是数据' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('数据是对事实的记录，可以是数字、文字、图片或声音。例如：班级体温表里的体温读数、图书馆借阅次数。数据本身不等于结论，需要整理与分析后才能得到有用信息。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   1, 0),
  (@ch1,
   CONVERT('1.2 数据与隐私' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('隐私是个人不愿随意公开的信息，如真实姓名、住址、电话、证件号。使用智能应用时，不要把敏感信息告诉陌生程序；分享班级照片前应征得同学同意。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   2, 0);

-- 章 2：算法
INSERT INTO learning_course_chapter (course_id, title, content, sort_order, deleted)
VALUES (
  @course_id,
  CONVERT('第二章 用步骤解决问题' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('本章导语：算法是解决问题的一组清晰、有限、可执行的步骤。用「做水果沙拉」或「从教室走到图书馆」来理解顺序、条件与循环。对应知识点：算法入门、循环基础。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  2, 0
);
SET @ch2 = LAST_INSERT_ID();

INSERT INTO learning_course_section (chapter_id, title, content, sort_order, deleted)
VALUES
  (@ch2,
   CONVERT('2.1 算法就是清晰步骤' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('好的算法要写清输入、处理与输出。只说「把水果处理好」不够具体；应写成清洗、去皮、切块、装盘等可执行动作。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   1, 0),
  (@ch2,
   CONVERT('2.2 循环：重复做有限次' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('当同一动作需要重复多次时，可用循环描述，例如「连续跳绳 10 次」。循环必须能结束，否则程序会一直运行。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   2, 0);

-- 章 3：机器学习
INSERT INTO learning_course_chapter (course_id, title, content, sort_order, deleted)
VALUES (
  @course_id,
  CONVERT('第三章 特征、标签与分类' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('本章导语：特征是描述样本的可量化信息，标签是我们希望模型预测的答案。监督学习用「带标签的例子」训练模型，常见任务包括分类（判断类别）与回归（预测数值）。对应知识点：特征与标签、监督学习、分类与回归。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  3, 0
);
SET @ch3 = LAST_INSERT_ID();

INSERT INTO learning_course_section (chapter_id, title, content, sort_order, deleted)
VALUES
  (@ch3,
   CONVERT('3.1 特征与标签' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('以识别水果为例：颜色、形状、大小是特征；「苹果 / 香蕉」是标签。特征选不好，再好的算法也学不出可靠规律。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   1, 0),
  (@ch3,
   CONVERT('3.2 监督学习与分类' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('监督学习先看大量「已标注例子」，再对新样本做预测。分类回答「属于哪一类」，例如垃圾邮件检测；图像分类是常见应用。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   2, 0);

-- 章 4：生成式 AI
INSERT INTO learning_course_chapter (course_id, title, content, sort_order, deleted)
VALUES (
  @course_id,
  CONVERT('第四章 会说话的大模型' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('本章导语：提示词决定模型「听懂」什么；大模型可能产生幻觉（说得很肯定但不正确）。要负责任使用：核对事实、保护隐私、不直接交作业。对应知识点：提示词基础、大模型幻觉、负责任使用生成式 AI。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  4, 0
);
SET @ch4 = LAST_INSERT_ID();

INSERT INTO learning_course_section (chapter_id, title, content, sort_order, deleted)
VALUES
  (@ch4,
   CONVERT('4.1 写好提示词' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('提示词应说明角色、任务、约束与输出格式。例如：「用初二学生能懂的话，解释什么是特征，不超过 80 字。」' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   1, 0),
  (@ch4,
   CONVERT('4.2 幻觉与负责任使用' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('模型可能编造日期、人物或公式。作业中的事实结论应查教材或可信来源。不要输入真实姓名、住址、证件号；不要把生成内容原样当作自己的作业。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   2, 0);

INSERT INTO learning_course_enrollment (course_id, user_id, status)
VALUES (@course_id, @student_id, CONVERT('ACTIVE' USING utf8mb4) COLLATE utf8mb4_unicode_ci)
ON DUPLICATE KEY UPDATE status = CONVERT('ACTIVE' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
                        updated_time = CURRENT_TIMESTAMP(3);

-- ========== 3) 作业（对齐第 3 章） ==========
INSERT INTO assessment_homework (course_id, teacher_user_id, title, description, status, deleted)
VALUES (
  @course_id, @teacher_id,
  CONVERT('第三章巩固：特征与分类' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('检查是否理解特征、标签与监督学习的基本概念。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  CONVERT('PUBLISHED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
  0
);
SET @hw_id = LAST_INSERT_ID();

INSERT INTO assessment_homework_recipient (homework_id, student_user_id)
VALUES (@hw_id, @student_id)
ON DUPLICATE KEY UPDATE homework_id = homework_id;

INSERT INTO assessment_homework_question
  (homework_id, question_type, stem, score, sort_order, correct_answers_json, reference_answer, analysis, deleted)
VALUES
  (@hw_id, CONVERT('SINGLE_CHOICE' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('识别水果时，「颜色、形状」通常属于？' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   10.00, 1, JSON_ARRAY('A'), NULL,
   CONVERT('特征是描述样本的可量化信息。' USING utf8mb4) COLLATE utf8mb4_unicode_ci, 0);

SET @q1 = LAST_INSERT_ID();
INSERT INTO assessment_question_option (question_id, option_key, content, sort_order, deleted)
VALUES
  (@q1, 'A', CONVERT('特征' USING utf8mb4) COLLATE utf8mb4_unicode_ci, 1, 0),
  (@q1, 'B', CONVERT('标签' USING utf8mb4) COLLATE utf8mb4_unicode_ci, 2, 0),
  (@q1, 'C', CONVERT('损失函数' USING utf8mb4) COLLATE utf8mb4_unicode_ci, 3, 0);

INSERT INTO assessment_homework_question
  (homework_id, question_type, stem, score, sort_order, correct_answers_json, reference_answer, analysis, deleted)
VALUES
  (@hw_id, CONVERT('SHORT_ANSWER' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('用一句话说明什么是监督学习。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   10.00, 2, JSON_ARRAY(),
   CONVERT('用带标签的例子训练模型，再对新样本做预测。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
   CONVERT('抓住「带标签的训练例子」即可。' USING utf8mb4) COLLATE utf8mb4_unicode_ci, 0);

-- 教学资料：以下 INSERT 的 object_key 仍是历史占位，不能入库。
-- 真实 PDF 已生成在：
--   ai-services/k12-agent-runtime/data/formal_materials/
-- 生成命令：
--   uv run python scripts/generate_formal_material_pdfs.py
-- 管理端用这三份重新上传后再入库：
--   讲义-什么是数据.pdf / 讲义-特征与标签.pdf / 讲义-提示词与负责任使用.pdf
INSERT INTO learning_teaching_resource
  (title, description, stage_code, subject, source_note, original_filename, mime_type, size_bytes,
   object_key, status, rag_index_status, created_by, course_id, chapter_id, chapter_title, grade,
   textbook, knowledge_code, published_by, published_time)
VALUES
  (
    CONVERT('讲义 · 什么是数据' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('正式演示资料简介：用体温表、借阅记录等例子说明「数据是对事实的记录」，并区分数据与结论。供 GraphRAG 按 data_literacy.what_is_data 检索。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('JUNIOR_HIGH' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('人工智能' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('校本正式演示 · 人工智能通识' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('formal-what-is-data.pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('application/pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    4096,
    CONCAT('teaching-resources/formal-demo-data-', @teacher_id, '-', UNIX_TIMESTAMP(), '.pdf'),
    CONVERT('PUBLISHED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('NOT_INDEXED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, @course_id, @ch1,
    CONVERT('第一章 数据从哪里来' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('初中' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('K12 人工智能通识 · 正式演示' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('data_literacy.what_is_data' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, CURRENT_TIMESTAMP(3)
  ),
  (
    CONVERT('讲义 · 特征与标签' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('正式演示资料简介：以水果识别说明特征（颜色、形状）与标签（苹果/香蕉），并引出监督学习。供 GraphRAG 按 machine_learning.features_labels 检索。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('JUNIOR_HIGH' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('人工智能' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('校本正式演示 · 人工智能通识' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('formal-features-labels.pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('application/pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    5120,
    CONCAT('teaching-resources/formal-demo-features-', @teacher_id, '-', UNIX_TIMESTAMP(), '.pdf'),
    CONVERT('PUBLISHED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('NOT_INDEXED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, @course_id, @ch3,
    CONVERT('第三章 特征、标签与分类' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('初中' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('K12 人工智能通识 · 正式演示' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('machine_learning.features_labels' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, CURRENT_TIMESTAMP(3)
  ),
  (
    CONVERT('讲义 · 提示词与负责任使用' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('正式演示资料简介：如何写清角色/任务/约束，如何识别幻觉，以及隐私与学术诚信底线。供 GraphRAG 按 generative_ai.prompt_basics 检索。' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('JUNIOR_HIGH' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('人工智能' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('校本正式演示 · 人工智能通识' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('formal-prompt-responsible.pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('application/pdf' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    4608,
    CONCAT('teaching-resources/formal-demo-prompt-', @teacher_id, '-', UNIX_TIMESTAMP(), '.pdf'),
    CONVERT('PUBLISHED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('NOT_INDEXED' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, @course_id, @ch4,
    CONVERT('第四章 会说话的大模型' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('初中' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('K12 人工智能通识 · 正式演示' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('generative_ai.prompt_basics' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    @teacher_id, CURRENT_TIMESTAMP(3)
  );

-- 写入挂载绑定表（需已执行 k12_business_teaching_resource_binding.sql）
INSERT INTO learning_teaching_resource_binding (resource_id, course_id, chapter_id, chapter_title)
SELECT r.id, r.course_id, r.chapter_id, r.chapter_title
FROM learning_teaching_resource r
WHERE r.created_by = @teacher_id
  AND r.course_id = @course_id
  AND r.knowledge_code IN (
    CONVERT('data_literacy.what_is_data' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('machine_learning.features_labels' USING utf8mb4) COLLATE utf8mb4_unicode_ci,
    CONVERT('generative_ai.prompt_basics' USING utf8mb4) COLLATE utf8mb4_unicode_ci
  )
  AND NOT EXISTS (
    SELECT 1 FROM learning_teaching_resource_binding b WHERE b.resource_id = r.id
  );

-- ========== 5) 核对 ==========
SELECT id, title, status FROM learning_course
WHERE id = @course_id;

SELECT id, title, LEFT(content, 40) AS intro_preview, sort_order
FROM learning_course_chapter
WHERE course_id = @course_id AND deleted = 0
ORDER BY sort_order;

SELECT id, title, knowledge_code, chapter_title, status, rag_index_status
FROM learning_teaching_resource
WHERE course_id = @course_id
ORDER BY id;

SELECT CONCAT(
  '下一步：1) Neo4j 跑 003_seed_demo_teaching_loop 或 admin/seed；',
  '2) 管理端打开本课四章，点「保存知识点绑定」（或依赖 003 演示 COVERS）；',
  '3) 可选 seed_demo_knowledge.py --data-file=data/formal_ai_literacy_knowledge.json'
) AS next_steps;
