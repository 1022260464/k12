-- 批次二：小学端插图绘本扩充（低年级 2 本 + 高年级 2 本），封面为专属生成插图。
-- 幂等：书按 book_code 去重，页按 (book_id, page_no) 去重，可重复执行。

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'password-guardian','密码小卫士','小智教我的第一个安全密码',
       '跟小智学会保护自己的账号：什么样的密码最结实，密码能不能告诉别人。',
       'PRIMARY_LOWER','digital_citizenship.password_hygiene',
       '/assets/experience/primary/books/book-password-guardian.webp','AI_TOPIC','数字公民与密码安全',3,'PUBLISHED',
       '教研审核通过：安全习惯短句准确，无恐吓表述。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='password-guardian');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'小智的新朋友','乐乐有一台平板电脑。小智说：里面的世界，需要一把看不见的锁来保护。',
       '猜一猜：看不见的锁是什么呀？','/assets/experience/primary/books/book-password-guardian.webp','小机器人和小朋友一起守卫平板电脑'
FROM learning_picture_book b WHERE b.book_code='password-guardian'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'看不见的锁','这把锁就是密码。只有乐乐知道的秘密词语，别人猜不到，就打不开乐乐的账号。',
       '你的密码只有谁知道呢？','/assets/experience/primary/ai-brain.webp','小智解释密码像一把看不见的锁'
FROM learning_picture_book b WHERE b.book_code='password-guardian'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'结实的密码','小乐试着造了一把结实的锁：把喜欢的动物、数字和符号连起来，又长又特别。',
       '试试连一连：小猫＋数字＋符号，会变成什么？','/assets/experience/primary/goal-mountain.webp','用动物数字符号拼出结实密码的插画'
FROM learning_picture_book b WHERE b.book_code='password-guardian'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'密码不告诉别人','小智悄悄话：密码不告诉别人，除了爸爸妈妈。生日和名字当密码，坏人一下子就能猜到哦。',
       '记住啦？跟小智拉个钩：保护好我的密码！','/assets/experience/primary/mascot-wave.webp','小智提醒密码不能告诉别人'
FROM learning_picture_book b WHERE b.book_code='password-guardian'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'little-ears','小智的耳朵','机器是怎么听见我说话的',
       '跟小智发现声音的小秘密：声音变成图案跳进机器，机器再把它变回话。',
       'PRIMARY_LOWER','ai_overview.ai_perception',
       '/assets/experience/primary/books/book-little-ears.webp','AI_TOPIC','语音与感知智能',4,'PUBLISHED',
       '教研审核通过：感知过程表述准确，拟人化适度。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='little-ears');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'小智听见了','乐乐说：小智你好呀！小智没有耳朵，却听清楚了。它是怎么做到的？',
       '没有耳朵，也能听见吗？','/assets/experience/primary/books/book-little-ears.webp','小机器人侧头倾听声波与音符'
FROM learning_picture_book b WHERE b.book_code='little-ears'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'声音的小图案','声音像水波一样荡出去。小智把声波画成一条条弯弯的小图案，收进肚子里。',
       '对着空气说句话，声音的波纹会是什么样子？','/assets/experience/primary/science-flask.webp','声波被画成彩色小图案的插画'
FROM learning_picture_book b WHERE b.book_code='little-ears'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'找最像的话','小智翻看学过的话，找和自己收藏的小图案最像的一句：原来你说的是你好呀！',
       '说得清楚一点，小智找得就更快！','/assets/experience/primary/student-reading.webp','小智比对声音图案找最像的一句话'
FROM learning_picture_book b WHERE b.book_code='little-ears'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'小智也会听错','旁边小狗汪汪叫，小智可能听错。听错了没关系，再说一遍就好。人说话慢一点，AI 听得更准。',
       '去和小智说句话试试，看它听得准不准！','/assets/experience/primary/mascot-wave.webp','小狗叫时小智听错了，小朋友再说一遍'
FROM learning_picture_book b WHERE b.book_code='little-ears'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'algo-cart','积木小车的算法之旅','一句话让小车跑一圈又一圈',
       '跟小智用积木指挥小车：先想清楚步骤，再用重复积木让路线一圈圈跑起来。',
       'PRIMARY_UPPER','computing.loop_basics',
       '/assets/experience/primary/books/book-algo-cart.webp','VISUAL_MISSION','repeat-a-route',5,'PUBLISHED',
       '教研审核通过：循环概念准确，与积木实验室任务衔接。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='algo-cart');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'小车想去环线旅行','彩色积木小车想去环形轨道旅行。可是它很小，需要有人告诉它每一步怎么走。',
       '如果你来指挥，先告诉它什么？','/assets/experience/primary/books/book-algo-cart.webp','积木小车在环形轨道上等待指令'
FROM learning_picture_book b WHERE b.book_code='algo-cart'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'一步一步写清楚','前进、转弯、再前进——把每一步按顺序写下来，小车才不会迷路。这就是算法。',
       '顺序乱了会怎样？小车会撞墙吗？','/assets/experience/primary/code-laptop.webp','把前进转弯步骤按顺序排好的插画'
FROM learning_picture_book b WHERE b.book_code='algo-cart'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'重复的秘密','写十遍前进太累啦！用一块重复积木把路线圈起来，小车就能一圈又一圈地跑。',
       '数一数：重复积木帮你少写了几行？','/assets/experience/primary/books/book-algo-cart.webp','重复积木让小车一圈圈循环行驶'
FROM learning_picture_book b WHERE b.book_code='algo-cart'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'轮到你出发','改一改重复的次数，换一换转弯的方向，新的旅行路线就出现啦。读完去积木实验室试一试！',
       '准备好看你的小车跑起来了吗？','/assets/experience/primary/achievement-trophy.webp','小朋友改参数设计新路线'
FROM learning_picture_book b WHERE b.book_code='algo-cart'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);

INSERT INTO learning_picture_book (
    book_code,title,subtitle,summary,stage_code,knowledge_code,
    cover_fallback_url,challenge_type,challenge_reference,sort_order,status,
    review_note,reviewed_by,reviewed_time,published_time,created_by,updated_by
)
SELECT 'data-speaks','数据会说话','图形是小数据的悄悄话',
       '跟小智听图表说话：一根柱子、一块扇形，都是数据在讲自己的故事。',
       'PRIMARY_UPPER','data_literacy.charts_basics',
       '/assets/experience/primary/books/book-data-speaks.webp','AI_TOPIC','数据与图表',6,'PUBLISHED',
       '教研审核通过：读图方法准确，强调亲口验证。',0,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),0,0
WHERE NOT EXISTS (SELECT 1 FROM learning_picture_book WHERE book_code='data-speaks');

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,1,'会说话的图形','教室里有四根彩色柱子，它们吵着要说话。小智说：别急，一个一个讲。',
       '柱子会讲什么故事呢？','/assets/experience/primary/books/book-data-speaks.webp','拟人化的彩色柱状图张嘴说话'
FROM learning_picture_book b WHERE b.book_code='data-speaks'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=1);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,2,'柱子的高低','红色柱子最高——喜欢红色的人最多！柱子越高，数量越多。这是柱状图在说话。',
       '数数看：最矮的柱子代表几个人？','/assets/experience/primary/books.webp','高低不同的柱子表示数量多少'
FROM learning_picture_book b WHERE b.book_code='data-speaks'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=2);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,3,'圆圆的扇形图','圆形图表像切开的蛋糕。块越大，那一部分越多。一眼就能看出谁是大头。',
       '如果全班都爱吃苹果，蛋糕会变成什么样？','/assets/experience/primary/ai-brain.webp','扇形图表像切开的蛋糕'
FROM learning_picture_book b WHERE b.book_code='data-speaks'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=3);

INSERT INTO learning_picture_book_page
    (book_id,page_no,title,narration,prompt,image_fallback_url,alt_text)
SELECT b.id,4,'图形也会骗人','小智提醒：图形可以画得很夸张。先看数字、再下结论，别只相信看起来很厉害的图。',
       '下次看到图表，记得问它：你的数字是多少？','/assets/experience/primary/student-thinker.webp','小朋友思考核对图表背后的数字'
FROM learning_picture_book b WHERE b.book_code='data-speaks'
AND NOT EXISTS (SELECT 1 FROM learning_picture_book_page p WHERE p.book_id=b.id AND p.page_no=4);
