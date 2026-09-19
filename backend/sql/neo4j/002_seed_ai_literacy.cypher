// Seed: reviewed AI literacy KnowledgePoints + prerequisite / related edges.
// Codes align with teaching_assistant/topics.py and assessment_ai_knowledge_mastery.knowledge_code.

UNWIND [
  {code:'data_literacy.what_is_data', title:'什么是数据', stage:'PRIMARY_UPPER', difficulty:1},
  {code:'data_literacy.privacy_basics', title:'数据与隐私入门', stage:'PRIMARY_UPPER', difficulty:2},
  {code:'computing.algorithm_basics', title:'算法入门', stage:'PRIMARY_UPPER', difficulty:2},
  {code:'computing.loop_basics', title:'循环基础', stage:'JUNIOR_HIGH', difficulty:2},
  {code:'machine_learning.features_labels', title:'特征与标签', stage:'JUNIOR_HIGH', difficulty:2},
  {code:'machine_learning.supervised_learning', title:'监督学习', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'machine_learning.classification_regression', title:'分类与回归', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'machine_learning.train_test_split', title:'训练/测试划分', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'machine_learning.overfitting', title:'过拟合', stage:'SENIOR_HIGH', difficulty:4},
  {code:'machine_learning.image_classification', title:'图像分类', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'machine_learning.data_bias', title:'数据偏差', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'machine_learning.neural_network_basics', title:'神经网络入门', stage:'SENIOR_HIGH', difficulty:4},
  {code:'generative_ai.prompt_basics', title:'提示词基础', stage:'PRIMARY_UPPER', difficulty:2},
  {code:'generative_ai.hallucination', title:'大模型幻觉', stage:'JUNIOR_HIGH', difficulty:3},
  {code:'generative_ai.responsible_use', title:'负责任使用生成式 AI', stage:'PRIMARY_UPPER', difficulty:2},
  {code:'generative_ai.copyright_originality', title:'版权与原创', stage:'JUNIOR_HIGH', difficulty:3}
] AS row
MERGE (p:KnowledgePoint {code: row.code})
SET p.title = row.title,
    p.stage = row.stage,
    p.difficulty = row.difficulty,
    p.reviewStatus = 'APPROVED',
    p.updatedAt = datetime();

// Prerequisite chains (A)-[:PREREQUISITE_OF]->(B) means A is prerequisite of B.
MATCH (a:KnowledgePoint {code:'data_literacy.what_is_data'}), (b:KnowledgePoint {code:'computing.algorithm_basics'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'computing.algorithm_basics'}), (b:KnowledgePoint {code:'computing.loop_basics'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'computing.loop_basics'}), (b:KnowledgePoint {code:'machine_learning.features_labels'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.features_labels'}), (b:KnowledgePoint {code:'machine_learning.supervised_learning'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.supervised_learning'}), (b:KnowledgePoint {code:'machine_learning.classification_regression'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.supervised_learning'}), (b:KnowledgePoint {code:'machine_learning.train_test_split'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.train_test_split'}), (b:KnowledgePoint {code:'machine_learning.overfitting'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.supervised_learning'}), (b:KnowledgePoint {code:'machine_learning.image_classification'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.features_labels'}), (b:KnowledgePoint {code:'machine_learning.data_bias'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.supervised_learning'}), (b:KnowledgePoint {code:'machine_learning.neural_network_basics'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'generative_ai.prompt_basics'}), (b:KnowledgePoint {code:'generative_ai.hallucination'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'generative_ai.hallucination'}), (b:KnowledgePoint {code:'generative_ai.responsible_use'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'generative_ai.responsible_use'}), (b:KnowledgePoint {code:'generative_ai.copyright_originality'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'data_literacy.privacy_basics'}), (b:KnowledgePoint {code:'generative_ai.responsible_use'})
MERGE (a)-[:PREREQUISITE_OF {source:'seed', version:1}]->(b);

// Related concepts (store one direction, queries treat as undirected).
MATCH (a:KnowledgePoint {code:'machine_learning.image_classification'}), (b:KnowledgePoint {code:'machine_learning.classification_regression'})
MERGE (a)-[:RELATED_TO {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'machine_learning.data_bias'}), (b:KnowledgePoint {code:'generative_ai.responsible_use'})
MERGE (a)-[:RELATED_TO {source:'seed', version:1}]->(b);
MATCH (a:KnowledgePoint {code:'data_literacy.what_is_data'}), (b:KnowledgePoint {code:'data_literacy.privacy_basics'})
MERGE (a)-[:RELATED_TO {source:'seed', version:1}]->(b);
