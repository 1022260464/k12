USE k12_business;

-- 已存在图形化编程关卡表时执行本脚本；无需重建表或清空原有关卡。
ALTER TABLE learning_visual_programming_mission
    DROP CHECK chk_visual_mission_template;

ALTER TABLE learning_visual_programming_mission
    ADD CONSTRAINT chk_visual_mission_template
    CHECK (template_code IN (
        'DATA_LABELING', 'PREDICTION_BRANCH', 'LOOP_ROUTE', 'CONFIDENCE_GATE',
        'AGENT_PATROL', 'DATA_BALANCE', 'QUIZ_GAME', 'SEQUENCE_STORY'
    ));

INSERT IGNORE INTO learning_visual_programming_mission
(mission_code,template_code,title,short_title,stage_code,knowledge_code,description,story,goal,hint,badge,reflection,steps_json,concepts_json,config_json,sort_order,status,content_version,lock_version,created_by,updated_by,published_time)
VALUES
('balance-training-data','DATA_BALANCE','让训练数据更公平','数据均衡','UPPER_PRIMARY','data_literacy.bias_in_data','比较猫和狗的样本数量，发现不均衡数据可能带来的偏差。','机器人只看过很多猫，却只看过一只狗。请补齐训练数据，让它公平地学习每个类别。','猫和狗各准备 2 个样本，检查数据均衡，并说明“数据要均衡”。','各放两个猫、狗标签积木，再连接“检查数据是否均衡”和说话积木。','公平数据观察员','训练数据失衡会让模型更熟悉某些类别，可能产生不公平的结果。',JSON_ARRAY('准备两类训练样本','比较类别数量','解释为什么要均衡'),JSON_ARRAY('数据均衡','偏差','负责任 AI'),JSON_OBJECT('requiredClasses',JSON_ARRAY('cat','dog'),'minSamplesPerClass',2,'maxDifference',0,'messageKeyword','数据要均衡'),6,'PUBLISHED',1,0,0,0,CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO learning_visual_programming_mission
(mission_code,template_code,title,short_title,stage_code,knowledge_code,description,story,goal,hint,badge,reflection,steps_json,concepts_json,config_json,sort_order,status,content_version,lock_version,created_by,updated_by,published_time)
VALUES
('ai-knowledge-quiz','QUIZ_GAME','AI 知识连胜挑战','趣味小测','UPPER_PRIMARY','visual_programming.conditionals','回答三道 AI 基础题，提交答案并获得即时计分反馈。','知识星球开启了三道挑战门。连续答对问题，帮助机器人收集全部能量星。','依次回答三道题，至少答对 3 题并提交答案。','第 1 题选 B、第 2 题选 B、第 3 题选 A，最后连接提交积木。','AI 知识连胜王','及时反馈可以帮助我们发现误解，并调整下一步学习内容。',JSON_ARRAY('阅读三道问题','选择每题答案','提交并查看得分'),JSON_ARRAY('即时反馈','知识巩固','连续答对'),JSON_OBJECT('expectedAnswers',JSON_ARRAY('b','b','a'),'passScore',3),7,'PUBLISHED',1,0,0,0,CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO learning_visual_programming_mission
(mission_code,template_code,title,short_title,stage_code,knowledge_code,description,story,goal,hint,badge,reflection,steps_json,concepts_json,config_json,sort_order,status,content_version,lock_version,created_by,updated_by,published_time)
VALUES
('ai-sequence-story','SEQUENCE_STORY','小机器人的 AI 一天','顺序绘本','UPPER_PRIMARY','multimodal_learning.ai_storybook','用场景、角色台词和等待积木制作一段按顺序播放的 AI 知识故事。','小机器人从教室出发，走进实验室学习 AI，最后来到未来城市分享自己的发现。','按教室、实验室、未来城市的顺序切换场景，场景之间等待，并说“故事结束”。','每次切换场景后让角色说一句话；前两幕之后连接等待积木，最后说结束语。','AI 绘本导演','计算机会严格按顺序执行指令，清晰的流程能让故事更容易理解。',JSON_ARRAY('进入教室场景','经过实验室场景','在未来城市结束故事'),JSON_ARRAY('顺序执行','场景叙事','互动绘本'),JSON_OBJECT('requiredScenes',JSON_ARRAY('classroom','lab','future'),'minWaitSeconds',1,'messageKeyword','故事结束'),8,'PUBLISHED',1,0,0,0,CURRENT_TIMESTAMP(3));
