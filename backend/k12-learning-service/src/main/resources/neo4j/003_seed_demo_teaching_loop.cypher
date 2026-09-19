// Formal demo teaching loop: CourseChapterRef COVERS + KnowledgeDocumentRef EXPLAINS.
// Depends on 002_seed_ai_literacy.cypher (KnowledgePoint codes must already exist).
// Safe to re-run: clears previous formal-demo:* nodes then recreates.

MATCH (c:CourseChapterRef)
WHERE c.refKey STARTS WITH 'formal-demo:'
DETACH DELETE c;

MATCH (d:KnowledgeDocumentRef)
WHERE d.documentId STARTS WITH 'formal-demo-'
DETACH DELETE d;

// ----- 章节覆盖（COVERS）-----
// 章 1：数据
MERGE (c:CourseChapterRef {refKey:'formal-demo:ch1'})
SET c.courseId = 0,
    c.chapterId = 1,
    c.title = '第一章 数据从哪里来',
    c.description = '认识「数据」是什么，以及为什么收集与使用数据时要保护隐私。对应：什么是数据、数据与隐私入门。',
    c.updatedAt = datetime()
WITH c
MATCH (p:KnowledgePoint)
WHERE p.code IN ['data_literacy.what_is_data', 'data_literacy.privacy_basics']
MERGE (c)-[r:COVERS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

// 章 2：算法
MERGE (c:CourseChapterRef {refKey:'formal-demo:ch2'})
SET c.courseId = 0,
    c.chapterId = 2,
    c.title = '第二章 用步骤解决问题',
    c.description = '算法是解决问题的一组清晰、有限、可执行的步骤。对应：算法入门、循环基础。',
    c.updatedAt = datetime()
WITH c
MATCH (p:KnowledgePoint)
WHERE p.code IN ['computing.algorithm_basics', 'computing.loop_basics']
MERGE (c)-[r:COVERS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

// 章 3：机器学习
MERGE (c:CourseChapterRef {refKey:'formal-demo:ch3'})
SET c.courseId = 0,
    c.chapterId = 3,
    c.title = '第三章 特征、标签与分类',
    c.description = '特征是描述样本的可量化信息，标签是希望预测的答案。对应：特征与标签、监督学习、分类与回归。',
    c.updatedAt = datetime()
WITH c
MATCH (p:KnowledgePoint)
WHERE p.code IN [
  'machine_learning.features_labels',
  'machine_learning.supervised_learning',
  'machine_learning.classification_regression'
]
MERGE (c)-[r:COVERS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

// 章 4：生成式 AI
MERGE (c:CourseChapterRef {refKey:'formal-demo:ch4'})
SET c.courseId = 0,
    c.chapterId = 4,
    c.title = '第四章 会说话的大模型',
    c.description = '提示词、幻觉与负责任使用。对应：提示词基础、大模型幻觉、负责任使用生成式 AI。',
    c.updatedAt = datetime()
WITH c
MATCH (p:KnowledgePoint)
WHERE p.code IN [
  'generative_ai.prompt_basics',
  'generative_ai.hallucination',
  'generative_ai.responsible_use'
]
MERGE (c)-[r:COVERS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

// ----- 资料讲解（EXPLAINS + description）-----
MERGE (d:KnowledgeDocumentRef {documentId:'formal-demo-doc-what-is-data'})
SET d.title = '讲义 · 什么是数据',
    d.description = '用体温表、借阅记录等例子说明「数据是对事实的记录」，并区分数据与结论。',
    d.updatedAt = datetime()
WITH d
MATCH (p:KnowledgePoint {code:'data_literacy.what_is_data'})
MERGE (d)-[r:EXPLAINS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

MERGE (d:KnowledgeDocumentRef {documentId:'formal-demo-doc-features-labels'})
SET d.title = '讲义 · 特征与标签',
    d.description = '以水果识别说明特征（颜色、形状）与标签（苹果/香蕉），并引出监督学习。',
    d.updatedAt = datetime()
WITH d
MATCH (p:KnowledgePoint {code:'machine_learning.features_labels'})
MERGE (d)-[r:EXPLAINS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();

MERGE (d:KnowledgeDocumentRef {documentId:'formal-demo-doc-prompt-basics'})
SET d.title = '讲义 · 提示词与负责任使用',
    d.description = '如何写清角色/任务/约束，如何识别幻觉，以及隐私与学术诚信底线。',
    d.updatedAt = datetime()
WITH d
MATCH (p:KnowledgePoint {code:'generative_ai.prompt_basics'})
MERGE (d)-[r:EXPLAINS]->(p)
SET r.source = 'formal-demo', r.updatedAt = datetime();
