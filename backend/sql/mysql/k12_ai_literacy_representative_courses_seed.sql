-- Idempotent representative-course seed for the K12 AI literacy competition demo.
-- Prerequisite: k12_business_course_section_activity.sql.
-- Change @teacher_username when the demo teacher account differs.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

USE k12_auth;
SET @teacher_username = CONVERT('fenghongtao_teacher' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @teacher_id = (
  SELECT u.id FROM sys_user u
  JOIN sys_user_role ur ON ur.user_id = u.id
  JOIN sys_role r ON r.id = ur.role_id
  WHERE u.username = @teacher_username
    AND r.role_code = CONVERT('ROLE_TEACHER' USING utf8mb4) COLLATE utf8mb4_unicode_ci
    AND u.deleted = 0 AND u.status = 1
  LIMIT 1
);

USE k12_business;
SELECT IF(@teacher_id IS NULL,
  '需要人工操作：把 @teacher_username 改为有效教师账号后重跑；本次不会写入课程。',
  CONCAT('将为教师用户 ', @teacher_id, ' 补齐三门代表课程。')) AS seed_guard;

-- ---------------------------------------------------------------------------
-- 小学低年级：AI 小侦探
-- ---------------------------------------------------------------------------
SET @lower_title = CONVERT('AI 小侦探：机器怎样认识世界' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
INSERT INTO learning_course (teacher_id, title, subject, grade_level, description, status, deleted)
SELECT @teacher_id, @lower_title, '人工智能', '小学低年级',
       '从小猫图片出发，经历故事、标签、分类、反馈和安全提醒，完成适合低龄学生的 AI 感知闭环。', 0, 0
WHERE @teacher_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM learning_course WHERE teacher_id=@teacher_id AND title=@lower_title AND deleted=0
);
SET @lower_course = (SELECT id FROM learning_course WHERE teacher_id=@teacher_id AND title=@lower_title AND deleted=0 ORDER BY id LIMIT 1);
UPDATE learning_course SET subject='人工智能', grade_level='小学低年级',
  description='从小猫图片出发，经历故事、标签、分类、反馈和安全提醒，完成适合低龄学生的 AI 感知闭环。'
WHERE id=@lower_course;

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @lower_course,'第一章 AI 看见了什么','学习目标：能说出图片和标签的区别；知道 AI 需要看很多例子。情境：小智为什么能认出小猫？',1,0
WHERE @lower_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=1 AND deleted=0);
SET @lower_ch1=(SELECT id FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch1,'1.1 AI 为什么能认出小猫','<h3>今天的小目标</h3><p>听故事、看图片，发现小猫常见的样子。</p><p><strong>易错点：</strong>AI 不是天生认识小猫，它要从许多经过确认的例子中学习。</p>',1,0
WHERE @lower_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch1 AND sort_order=1 AND deleted=0);
SET @lower_s11=(SELECT id FROM learning_course_section WHERE chapter_id=@lower_ch1 AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @lower_s11,'CAT_LESSON','cat-recognition','小猫图片侦探','阅读四页互动绘本，听文字讲解并完成三关图片分类。',1,1,0
WHERE @lower_s11 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@lower_s11 AND activity_type='CAT_LESSON' AND reference_key='cat-recognition' AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch1,'1.2 图片和名字卡','<p>图片是 AI 看到的例子，名字卡是人给出的标签。标签写错了，AI 也可能学错。</p><p>试一试：说出一张动物图片和它应该配对的名字卡。</p>',2,0
WHERE @lower_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch1 AND sort_order=2 AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @lower_course,'第二章 教 AI 分一分类','学习目标：理解分类是把相似的图片放进同一组；能检查一次分类结果。',2,0
WHERE @lower_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=2 AND deleted=0);
SET @lower_ch2=(SELECT id FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch2,'2.1 从例子里找特点','<p>小猫可能有尖耳朵、胡须和圆眼睛，但一个特点不能保证答案正确。AI 会一起观察多个特点。</p>',1,0
WHERE @lower_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch2 AND sort_order=1 AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch2,'2.2 训练、预测和纠错','<p>训练时看带标签的例子，预测时判断新图片，发现错误后再检查数据和标签。</p>',2,0
WHERE @lower_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch2 AND sort_order=2 AND deleted=0);
SET @lower_s22=(SELECT id FROM learning_course_section WHERE chapter_id=@lower_ch2 AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @lower_s22,'TEACHING_TOPIC','image-classification','图像分类步骤课堂','让 AI 小老师用低龄短句复习训练、预测和纠错。',1,1,0
WHERE @lower_s22 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@lower_s22 AND activity_type='TEACHING_TOPIC' AND reference_key='image-classification' AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @lower_course,'第三章 AI 也会认错','学习目标：知道 AI 可能犯错；遇到不确定答案时会请老师或家长帮忙；不上传个人隐私照片。',3,0
WHERE @lower_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=3 AND deleted=0);
SET @lower_ch3=(SELECT id FROM learning_course_chapter WHERE course_id=@lower_course AND sort_order=3 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch3,'3.1 为什么会认错','<p>照片太暗、角度特别或学习例子太少，都可能让 AI 认错。看到答案要先观察证据。</p>',1,0
WHERE @lower_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch3 AND sort_order=1 AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @lower_ch3,'3.2 图片隐私小约定','<p>不要上传真实姓名、学校、住址或包含陌生同学正脸的照片。拿不准时先问老师或家长。</p>',2,0
WHERE @lower_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@lower_ch3 AND sort_order=2 AND deleted=0);

-- ---------------------------------------------------------------------------
-- 初中：训练集、测试集与准确率
-- ---------------------------------------------------------------------------
SET @junior_title = CONVERT('从数据到模型：训练集、测试集与准确率' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
INSERT INTO learning_course (teacher_id,title,subject,grade_level,description,status,deleted)
SELECT @teacher_id,@junior_title,'人工智能','初中','用可复现实验理解数据划分、预测记录、准确率及数据泄漏风险。',0,0
WHERE @teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course WHERE teacher_id=@teacher_id AND title=@junior_title AND deleted=0);
SET @junior_course=(SELECT id FROM learning_course WHERE teacher_id=@teacher_id AND title=@junior_title AND deleted=0 ORDER BY id LIMIT 1);
UPDATE learning_course SET subject='人工智能',grade_level='初中',description='用可复现实验理解数据划分、预测记录、准确率及数据泄漏风险。' WHERE id=@junior_course;

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @junior_course,'第一章 从样本到数据集','区分样本、特征和标签，检查数据是否覆盖真实使用场景。',1,0
WHERE @junior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=1 AND deleted=0);
SET @junior_ch1=(SELECT id FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch1,'1.1 样本、特征与标签','<p>样本是一条学习记录；特征描述样本；标签是希望模型预测的答案。三者混淆会让实验结论失真。</p>',1,0
WHERE @junior_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch1 AND sort_order=1 AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch1,'1.2 数据质量与代表性','<p>数据要覆盖真实场景，并检查缺失、重复、标签错误和群体不均衡。数量多不等于质量高。</p>',2,0
WHERE @junior_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch1 AND sort_order=2 AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @junior_course,'第二章 训练集与测试集','学习目标：解释为什么要保留未见数据；识别一次数据泄漏。',2,0
WHERE @junior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=2 AND deleted=0);
SET @junior_ch2=(SELECT id FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch2,'2.1 为什么要分开数据','<p>训练集用于学习规律，测试集用于评估模型面对未见数据时的表现。测试集答案不能提前参与训练。</p>',1,0
WHERE @junior_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch2 AND sort_order=1 AND deleted=0);
SET @junior_s21=(SELECT id FROM learning_course_section WHERE chapter_id=@junior_ch2 AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @junior_s21,'TEACHING_TOPIC','train-test','训练集与测试集课堂','观看受控步骤讲解并完成服务端课堂小测。',1,1,0
WHERE @junior_s21 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@junior_s21 AND activity_type='TEACHING_TOPIC' AND reference_key='train-test' AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch2,'2.2 数据泄漏检查','<p>若先看测试答案再调整模型，评估会虚高。划分后应冻结测试集，并记录每次实验配置。</p>',2,0
WHERE @junior_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch2 AND sort_order=2 AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @junior_course,'第三章 准确率与错误分析','准确率要和混淆样本、类别分布及任务风险一起解释。',3,0
WHERE @junior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=3 AND deleted=0);
SET @junior_ch3=(SELECT id FROM learning_course_chapter WHERE course_id=@junior_course AND sort_order=3 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch3,'3.1 计算并解释准确率','<p>准确率 = 预测正确数 ÷ 总样本数。要同时说明测试样本数量与来源，避免只报一个百分比。</p>',1,0
WHERE @junior_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch3 AND sort_order=1 AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @junior_ch3,'3.2 从错误样本改进模型','<p>按错误类型分组，判断问题来自数据、标签、特征还是模型；修改后用同一评估规则再次验证。</p>',2,0
WHERE @junior_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@junior_ch3 AND sort_order=2 AND deleted=0);

-- ---------------------------------------------------------------------------
-- 高中：Embedding、RAG 与智能体
-- ---------------------------------------------------------------------------
SET @senior_title = CONVERT('构建可信 AI 应用：Embedding、RAG 与智能体' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
INSERT INTO learning_course (teacher_id,title,subject,grade_level,description,status,deleted)
SELECT @teacher_id,@senior_title,'人工智能','高中','通过受控讲解和三个本地 Python 实验，分析向量检索、引用忠实度、工具权限与人工确认。',0,0
WHERE @teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course WHERE teacher_id=@teacher_id AND title=@senior_title AND deleted=0);
SET @senior_course=(SELECT id FROM learning_course WHERE teacher_id=@teacher_id AND title=@senior_title AND deleted=0 ORDER BY id LIMIT 1);
UPDATE learning_course SET subject='人工智能',grade_level='高中',description='通过受控讲解和三个本地 Python 实验，分析向量检索、引用忠实度、工具权限与人工确认。' WHERE id=@senior_course;

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @senior_course,'第一章 Embedding 与相似度','理解向量表示、余弦相似度及“相似不等于真实”的边界。',1,0
WHERE @senior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=1 AND deleted=0);
SET @senior_ch1=(SELECT id FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch1,'1.1 从语义到向量','<p>Embedding 把对象映射为稠密向量，便于用距离或夹角比较相似性；维度本身通常不可直接解释。</p>',1,0
WHERE @senior_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch1 AND sort_order=1 AND deleted=0);
SET @senior_s11=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch1 AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s11,'TEACHING_TOPIC','embedding-intro','Embedding 原理课堂','比较不同学段的解释，并完成余弦相似度边界小测。',1,1,0
WHERE @senior_s11 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s11 AND activity_type='TEACHING_TOPIC' AND reference_key='embedding-intro' AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch1,'1.2 余弦相似度实验','<p>修改向量并观察相似度变化。结果解释必须指出：高相似度只代表当前表示下方向接近。</p>',2,0
WHERE @senior_ch1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch1 AND sort_order=2 AND deleted=0);
SET @senior_s12=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch1 AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s12,'PYTHON_LAB','embedding-similarity','Python：计算余弦相似度','运行审定的小向量实验，修改数值并解释输出。',1,1,0
WHERE @senior_s12 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s12 AND activity_type='PYTHON_LAB' AND reference_key='embedding-similarity' AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @senior_course,'第二章 RAG 与可追溯回答','理解混合召回、重排、证据引用和无证据拒答。',2,0
WHERE @senior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=2 AND deleted=0);
SET @senior_ch2=(SELECT id FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch2,'2.1 检索、重排与回答','<p>RAG 先检索候选证据，再重排并生成带引用回答。只显示真正支持回答的资料。</p>',1,0
WHERE @senior_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch2 AND sort_order=1 AND deleted=0);
SET @senior_s21=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch2 AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s21,'TEACHING_TOPIC','rag-basics','RAG 证据流程课堂','分析召回、重排、引用忠实度与降级。',1,1,0
WHERE @senior_s21 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s21 AND activity_type='TEACHING_TOPIC' AND reference_key='rag-basics' AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch2,'2.2 最小 RAG 实验','<p>在固定文档中检索证据并输出引用编号。若没有证据，程序应明确说明无法回答。</p>',2,0
WHERE @senior_ch2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch2 AND sort_order=2 AND deleted=0);
SET @senior_s22=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch2 AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s22,'PYTHON_LAB','rag-retrieval','Python：检索与引用核验','运行无网络依赖的最小检索实验，检查回答是否忠于证据。',1,1,0
WHERE @senior_s22 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s22 AND activity_type='PYTHON_LAB' AND reference_key='rag-retrieval' AND deleted=0);

INSERT INTO learning_course_chapter (course_id,title,content,sort_order,deleted)
SELECT @senior_course,'第三章 智能体的目标、工具与反馈','用有限状态组织规划、工具调用、观察和停止条件；高风险写操作保留人工确认。',3,0
WHERE @senior_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=3 AND deleted=0);
SET @senior_ch3=(SELECT id FROM learning_course_chapter WHERE course_id=@senior_course AND sort_order=3 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch3,'3.1 状态机与工具边界','<p>智能体根据当前状态选择白名单工具，将结果写回状态并检查停止条件。工具权限应遵循最小授权。</p>',1,0
WHERE @senior_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch3 AND sort_order=1 AND deleted=0);
SET @senior_s31=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch3 AND sort_order=1 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s31,'TEACHING_TOPIC','agent-basics','智能体流程课堂','理解目标、计划、工具、反馈、幂等与人工确认。',1,1,0
WHERE @senior_s31 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s31 AND activity_type='TEACHING_TOPIC' AND reference_key='agent-basics' AND deleted=0);
INSERT INTO learning_course_section (chapter_id,title,content,sort_order,deleted)
SELECT @senior_ch3,'3.2 白名单工具循环实验','<p>运行有限状态示例，观察计划、工具结果和人工确认点。程序不会发起真实外部写操作。</p>',2,0
WHERE @senior_ch3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section WHERE chapter_id=@senior_ch3 AND sort_order=2 AND deleted=0);
SET @senior_s32=(SELECT id FROM learning_course_section WHERE chapter_id=@senior_ch3 AND sort_order=2 AND deleted=0 ORDER BY id LIMIT 1);
INSERT INTO learning_course_section_activity (section_id,activity_type,reference_key,title,description,sort_order,required,deleted)
SELECT @senior_s32,'PYTHON_LAB','agent-tool-loop','Python：智能体工具循环','观察白名单工具、状态轨迹和人工确认点，不调用真实外部服务。',1,1,0
WHERE @senior_s32 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM learning_course_section_activity WHERE section_id=@senior_s32 AND activity_type='PYTHON_LAB' AND reference_key='agent-tool-loop' AND deleted=0);

SELECT c.id,c.title,c.grade_level,COUNT(DISTINCT ch.id) AS chapters,COUNT(DISTINCT s.id) AS sections,
       COUNT(DISTINCT a.id) AS activities
FROM learning_course c
LEFT JOIN learning_course_chapter ch ON ch.course_id=c.id AND ch.deleted=0
LEFT JOIN learning_course_section s ON s.chapter_id=ch.id AND s.deleted=0
LEFT JOIN learning_course_section_activity a ON a.section_id=s.id AND a.deleted=0
WHERE c.id IN (@lower_course,@junior_course,@senior_course)
GROUP BY c.id,c.title,c.grade_level
ORDER BY c.id;

SELECT '需要人工操作：在管理端为三门课程的章节绑定相应知识点并执行一次发布校验；随后用三个学段账号经 Gateway 报名并打开每个活动。' AS next_step;
