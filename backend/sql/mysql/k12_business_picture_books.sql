USE k12_business;

CREATE TABLE IF NOT EXISTS learning_picture_book (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    book_code VARCHAR(64) NOT NULL,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(200) DEFAULT NULL,
    summary VARCHAR(600) NOT NULL,
    stage_code VARCHAR(32) NOT NULL,
    knowledge_code VARCHAR(128) NOT NULL,
    cover_object_key VARCHAR(500) DEFAULT NULL,
    cover_fallback_url VARCHAR(500) DEFAULT NULL,
    challenge_type VARCHAR(32) NOT NULL,
    challenge_reference VARCHAR(128) NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    review_note VARCHAR(1000) DEFAULT NULL,
    reviewed_by BIGINT UNSIGNED DEFAULT NULL,
    reviewed_time DATETIME(3) DEFAULT NULL,
    published_time DATETIME(3) DEFAULT NULL,
    content_version INT UNSIGNED NOT NULL DEFAULT 1,
    lock_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_picture_book_code (book_code),
    KEY idx_picture_book_status_order (status, sort_order, id),
    KEY idx_picture_book_stage (stage_code, status, sort_order),
    CONSTRAINT chk_picture_book_status CHECK (status IN ('DRAFT','PENDING_REVIEW','APPROVED','PUBLISHED','OFFLINE')),
    CONSTRAINT chk_picture_book_challenge CHECK (challenge_type IN ('CAT_LESSON','VISUAL_MISSION','AI_TOPIC'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Reviewed interactive picture books';

CREATE TABLE IF NOT EXISTS learning_picture_book_page (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    book_id BIGINT UNSIGNED NOT NULL,
    page_no INT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    narration VARCHAR(1200) NOT NULL,
    prompt VARCHAR(500) DEFAULT NULL,
    image_object_key VARCHAR(500) DEFAULT NULL,
    image_fallback_url VARCHAR(500) DEFAULT NULL,
    alt_text VARCHAR(300) NOT NULL,
    interaction_json JSON DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_picture_book_page_no (book_id, page_no),
    CONSTRAINT fk_picture_book_page_book FOREIGN KEY (book_id)
        REFERENCES learning_picture_book (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Picture book pages';

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'ai-recognizes-cats','AI 为什么能认出小猫','图片、标签与机器的第一次观察',
       '跟着小智认识图片线索、标签和分类，并理解 AI 也会猜错。',
       'PRIMARY_LOWER','machine_learning.image_classification',
       '/assets/experience/primary/student-reading.webp','CAT_LESSON','cat-recognition',1,'PUBLISHED',
       '教研审核通过：短句准确，包含不确定性提醒。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='ai-recognizes-cats');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'小智的新任务','小智收到一张小猫照片。它想知道：机器没有眼睛，为什么也能认出小猫呢？',
       '先找找看：你会注意小猫的哪些样子？','/assets/experience/primary/student-reading.webp','小学生打开一本关于小猫的故事书'
FROM learning_picture_book b WHERE b.book_code='ai-recognizes-cats'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'从很多卡片里学习','老师先给 AI 看很多图片，并告诉它哪些是小猫、哪些是小狗。这些名字叫做标签。',
       '图片和正确名字放在一起，AI 才知道要学什么。','/assets/experience/primary/ai-brain.webp','人工智能从图片卡片里寻找线索'
FROM learning_picture_book b WHERE b.book_code='ai-recognizes-cats'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'寻找不一样的线索','AI 会从图片里的形状、颜色和纹理寻找规律。不同颜色、角度和背景的图片越丰富，学习越可靠。',
       '只看过白色小猫，遇到黑色小猫时会怎样？','/assets/experience/primary/science-flask.webp','用不同样子的动物图片做小实验'
FROM learning_picture_book b WHERE b.book_code='ai-recognizes-cats'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'AI 也会猜错','照片太暗、太模糊，或者训练图片太少时，AI 可能猜错。我们要核对结果，不要把 AI 的答案当成永远正确。',
       '准备好了吗？接下来去当图片分类小侦探！','/assets/experience/primary/mascot-wave.webp','小智提醒大家人工智能也会犯错'
FROM learning_picture_book b WHERE b.book_code='ai-recognizes-cats'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'fair-picture-team','每张图片都要被看见','小智的公平训练队',
       '通过猫狗图片数量差异认识数据均衡、模型偏差和负责任的人工智能。',
       'PRIMARY_LOWER','data_literacy.bias_in_data',
       '/assets/experience/primary/student-thinker.webp','VISUAL_MISSION','balance-training-data',2,'PUBLISHED',
       '教研审核通过：不把公平简化为绝对相等，适合低龄数据启蒙。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='fair-picture-team');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'照片篮子不一样大','小智准备学习认识猫和狗，可是猫照片装满了一大篮，狗照片只有一张。',
       '如果你是小智，会不会更熟悉照片更多的那一类？','/assets/experience/primary/books.webp','一大篮猫照片和一张狗照片'
FROM learning_picture_book b WHERE b.book_code='fair-picture-team'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'偏心不是小智故意的','小智不是故意偏心。它只能从看到的例子中学习，例子太少的一类就更容易猜错。',
       '问题可能来自模型，也可能来自我们准备的数据。','/assets/experience/primary/ai-brain.webp','小智观察数量不均衡的训练图片'
FROM learning_picture_book b WHERE b.book_code='fair-picture-team'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'补齐不同的例子','同学们补充了不同颜色、角度和背景里的猫狗照片，还认真检查每张图片的标签。',
       '数量更均衡只是开始，图片还要足够丰富。','/assets/experience/primary/student-explorer.webp','学生为训练集补充多样图片'
FROM learning_picture_book b WHERE b.book_code='fair-picture-team'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'一起检查才更可靠','训练完成后，大家用新图片分别测试猫和狗。发现错误时继续记录、核对和改进。',
       '公平的 AI 需要合适的数据，也需要人持续检查。','/assets/experience/primary/achievement-trophy.webp','学生和小智一起检查分类结果'
FROM learning_picture_book b WHERE b.book_code='fair-picture-team'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);
