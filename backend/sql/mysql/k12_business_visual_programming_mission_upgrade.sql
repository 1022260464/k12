USE k12_business;

-- 图形化编程关卡定义表（管理端可配置；执行逻辑仅允许白名单模板）
CREATE TABLE IF NOT EXISTS learning_visual_programming_mission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mission_code VARCHAR(64) NOT NULL COMMENT '稳定业务编码，创建后不可修改',
    template_code VARCHAR(32) NOT NULL COMMENT '服务端白名单任务模板',
    title VARCHAR(80) NOT NULL,
    short_title VARCHAR(40) NOT NULL,
    stage_code VARCHAR(32) NOT NULL DEFAULT 'UPPER_PRIMARY',
    knowledge_code VARCHAR(128) NOT NULL,
    description VARCHAR(300) NOT NULL,
    story VARCHAR(600) NOT NULL,
    goal VARCHAR(400) NOT NULL,
    hint VARCHAR(600) NOT NULL,
    badge VARCHAR(40) NOT NULL,
    reflection VARCHAR(500) NOT NULL,
    steps_json JSON NOT NULL,
    concepts_json JSON NOT NULL,
    config_json JSON NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    content_version INT UNSIGNED NOT NULL DEFAULT 1,
    lock_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    updated_by BIGINT UNSIGNED NOT NULL,
    published_time DATETIME(3) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_visual_mission_code (mission_code),
    KEY idx_visual_mission_status_order (status, sort_order, id),
    KEY idx_visual_mission_stage (stage_code, status, sort_order),
    CONSTRAINT chk_visual_mission_status
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'OFFLINE')),
    CONSTRAINT chk_visual_mission_template
        CHECK (template_code IN (
            'DATA_LABELING',
            'PREDICTION_BRANCH',
            'LOOP_ROUTE',
            'CONFIDENCE_GATE',
            'AGENT_PATROL',
            'DATA_BALANCE',
            'QUIZ_GAME',
            'SEQUENCE_STORY'
        ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Blockly AI mission definition managed by administrators';

-- 进度表索引：执行前请先 SHOW INDEX FROM learning_visual_programming_project;
-- 若 idx_visual_project_mission_status 已存在则跳过本语句，避免重复索引错误。
-- ALTER TABLE learning_visual_programming_project
--     ADD KEY idx_visual_project_mission_status (mission_code, status, updated_time);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'label-training-data', 'DATA_LABELING',
    '给图片贴标签', '整理训练数据', 'UPPER_PRIMARY', 'ai.data.labeling',
    '把猫和狗图片贴上正确标签，再训练一个分类器。',
    '数据站收到了一批没有名字的图片。请你成为数据整理员，教会机器人认识猫和狗。',
    '正确标注 4 张图片，并完成一次训练。',
    '从“AI 数据”中拖出 4 个贴标签积木，选择正确分类，再接上训练分类器。',
    '数据整理员',
    'AI 不会凭空认识图片，它需要人类提供正确、丰富的训练数据。',
    CAST('["观察图片编号","贴上猫或狗标签","训练分类器"]' AS JSON),
    CAST('["训练数据","标签","分类"]' AS JSON),
    CAST('{"expectedLabels":{"cat-1":"cat","cat-2":"cat","dog-1":"dog","dog-2":"dog"},"requiredClasses":["cat","dog"],"requireTrain":true}' AS JSON),
    1, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'predict-and-decide', 'PREDICTION_BRANCH',
    '让 AI 做出判断', '预测与条件', 'UPPER_PRIMARY', 'ai.ml.classification',
    '训练分类器、预测新图片，并根据预测结果说出答案。',
    '新的图片没有标签。让机器人用刚刚学到的规律进行预测，并用条件积木决定是否回答。',
    '完成训练和预测，用条件积木判断“神秘图片”是不是猫。',
    '依次连接训练、预测、如果积木；把“预测结果是猫”放进如果的判断位置。',
    '分类小侦探',
    '预测是 AI 根据已有规律作出的判断，它不一定永远正确。',
    CAST('["训练已有数据","预测神秘图片","判断后说出答案"]' AS JSON),
    CAST('["训练","预测","条件判断"]' AS JSON),
    CAST('{"imageId":"mystery-cat","expectedCategory":"cat","messageKeyword":"猫","requireTrain":true}' AS JSON),
    2, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'repeat-a-route', 'LOOP_ROUTE',
    '规划机器人的路线', '循环与行动', 'UPPER_PRIMARY', 'programming.loop.sequence',
    '使用循环减少重复积木，让 AI 机器人走到数据站。',
    '机器人要搬运训练数据。重复拖很多相同积木太麻烦，请用循环设计更简洁的路线。',
    '让机器人累计前进至少 8 步，并在到达后说“任务完成”。',
    '把“前进 2 步”放进重复 4 次里，然后在循环后连接说话积木。',
    '循环工程师',
    '循环可以让计算机重复执行同一组指令，使程序更短、更容易修改。',
    CAST('["设定重复次数","把移动放入循环","到达后播报结果"]' AS JSON),
    CAST('["顺序","循环","自动执行"]' AS JSON),
    CAST('{"minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成"}' AS JSON),
    3, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'confidence-gate', 'CONFIDENCE_GATE',
    '有把握再回答', '认识置信度', 'UPPER_PRIMARY', 'ai.ml.confidence',
    '读取预测置信度，只有把握足够大时才让机器人回答。',
    'AI 有时也会犹豫。请设置一道“信心门”，让它只有在置信度达到 80% 时才回答。',
    '训练并预测神秘图片；当置信度至少为 80% 时，说“我很有把握”。',
    '依次连接训练、预测和如果；把“预测置信度至少 80%”放进如果，再在里面放说话积木。',
    '谨慎判断员',
    '置信度表示模型有多确定，但高置信度也不等于答案一定正确。',
    CAST('["完成模型训练","获得预测置信度","达到阈值才回答"]' AS JSON),
    CAST('["置信度","阈值","负责任的 AI"]' AS JSON),
    CAST('{"imageId":"mystery-cat","predictionCategory":"cat","simulatedConfidence":92,"minimumThreshold":80,"messageKeyword":"很有把握"}' AS JSON),
    4, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'campus-ai-patrol', 'AGENT_PATROL',
    '校园 AI 巡检挑战', '综合智能任务', 'UPPER_PRIMARY', 'ai.agent.sense-decide-act',
    '把训练、感知、判断、循环行动组合成一套完整的智能任务。',
    '机器人要识别校园小狗，识别成功后前往数据站并报告巡检完成。现在由你设计完整流程。',
    '预测校园小狗；判断为狗后，用循环前进至少 8 步，并说“巡检完成”。',
    '训练后预测校园小狗，把循环移动和说“巡检完成”都放在“如果预测结果是狗”里面。',
    'AI 巡检队长',
    '智能体通常会经历感知环境、作出决策、执行行动三个连续步骤。',
    CAST('["感知校园图片","判断识别结果","循环行动并报告"]' AS JSON),
    CAST('["感知","决策","行动","智能体"]' AS JSON),
    CAST('{"imageId":"mystery-dog","expectedCategory":"dog","minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"巡检完成"}' AS JSON),
    5, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'balance-training-data', 'DATA_BALANCE', '让训练数据更公平', '数据均衡',
    'UPPER_PRIMARY', 'data_literacy.bias_in_data',
    '比较猫和狗的样本数量，发现不均衡数据可能带来的偏差。',
    '机器人只看过很多猫，却只看过一只狗。请补齐训练数据，让它公平地学习每个类别。',
    '猫和狗各准备 2 个样本，检查数据均衡，并说明“数据要均衡”。',
    '各放两个猫、狗标签积木，再连接“检查数据是否均衡”和说话积木。',
    '公平数据观察员', '训练数据失衡会让模型更熟悉某些类别，可能产生不公平的结果。',
    CAST('["准备两类训练样本","比较类别数量","解释为什么要均衡"]' AS JSON),
    CAST('["数据均衡","偏差","负责任 AI"]' AS JSON),
    CAST('{"requiredClasses":["cat","dog"],"minSamplesPerClass":2,"maxDifference":0,"messageKeyword":"数据要均衡"}' AS JSON),
    6, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'ai-knowledge-quiz', 'QUIZ_GAME', 'AI 知识连胜挑战', '趣味小测',
    'UPPER_PRIMARY', 'visual_programming.conditionals',
    '回答三道 AI 基础题，提交答案并获得即时计分反馈。',
    '知识星球开启了三道挑战门。连续答对问题，帮助机器人收集全部能量星。',
    '依次回答三道题，至少答对 3 题并提交答案。',
    '第 1 题选 B、第 2 题选 B、第 3 题选 A，最后连接提交积木。',
    'AI 知识连胜王', '及时反馈可以帮助我们发现误解，并调整下一步学习内容。',
    CAST('["阅读三道问题","选择每题答案","提交并查看得分"]' AS JSON),
    CAST('["即时反馈","知识巩固","连续答对"]' AS JSON),
    CAST('{"expectedAnswers":["b","b","a"],"passScore":3}' AS JSON),
    7, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO learning_visual_programming_mission (
    mission_code, template_code, title, short_title, stage_code, knowledge_code,
    description, story, goal, hint, badge, reflection,
    steps_json, concepts_json, config_json, sort_order, status,
    content_version, lock_version, created_by, updated_by, published_time
) VALUES (
    'ai-sequence-story', 'SEQUENCE_STORY', '小机器人的 AI 一天', '顺序绘本',
    'UPPER_PRIMARY', 'multimodal_learning.ai_storybook',
    '用场景、角色台词和等待积木制作一段按顺序播放的 AI 知识故事。',
    '小机器人从教室出发，走进实验室学习 AI，最后来到未来城市分享自己的发现。',
    '按教室、实验室、未来城市的顺序切换场景，场景之间等待，并说“故事结束”。',
    '每次切换场景后让角色说一句话；前两幕之后连接等待积木，最后说结束语。',
    'AI 绘本导演', '计算机会严格按顺序执行指令，清晰的流程能让故事更容易理解。',
    CAST('["进入教室场景","经过实验室场景","在未来城市结束故事"]' AS JSON),
    CAST('["顺序执行","场景叙事","互动绘本"]' AS JSON),
    CAST('{"requiredScenes":["classroom","lab","future"],"minWaitSeconds":1,"messageKeyword":"故事结束"}' AS JSON),
    8, 'PUBLISHED', 1, 0, 0, 0, CURRENT_TIMESTAMP(3)
);
