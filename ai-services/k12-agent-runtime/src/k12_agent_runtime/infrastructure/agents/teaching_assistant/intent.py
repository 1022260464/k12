"""教学助手意图分流：关键词优先，避免无关闲聊浪费模型 Token。"""

from __future__ import annotations

import re
from typing import Literal

from k12_agent_runtime.infrastructure.agents.teaching_assistant.topics import TOPICS

IntentMode = Literal["EXPLAIN", "COURSE_RECOMMEND", "OFF_TOPIC"]

OFF_TOPIC_LIMIT = 5

# 明显非学习闲聊 / 娱乐 / 生活 / 违规（匹配后且无学习信号 → OFF_TOPIC）
_OFF_TOPIC_KEYWORDS: tuple[str, ...] = (
    # 天气 / 出行
    "今天天气", "明天天气", "后天天气", "气温", "下雨吗", "下雪吗", "天气预报",
    "多少度", "冷不冷", "热不热", "出门带伞", "堵车吗",
    # 饮食 / 生活琐事
    "吃什么", "喝什么", "午饭", "晚饭", "早餐", "夜宵", "外卖", "点外卖",
    "饿了", "好饿", "推荐餐厅", "附近美食", "怎么做饭", "菜谱",
    "逛街", "网购", "双十一", "拼多多", "淘宝买",
    # 游戏 / 娱乐
    "王者荣耀", "原神", "和平精英", "英雄联盟", "lol", "csgo", "抖音",
    "小红书刷", "看直播", "打游戏", "玩游戏", "开黑", "上分", "段位",
    "追剧", "追番", "看电影", "综艺", "短视频", "刷手机",
    "minecraft", "我的世界", "steam", "主机游戏",
    # 情感 / 社交闲聊
    "谈恋爱", "女朋友", "男朋友", "相亲", "表白", "分手", "暗恋",
    "相亲角", "脱单", "约会", "结婚吗", "生孩子",
    "你喜欢我吗", "你爱我吗", "做我对象", "陪我睡觉",
    # 笑话 / 迷信 / 八卦
    "讲个笑话", "说个笑话", "段子", "冷笑话", "讲笑话",
    "星座运势", "算命", "塔罗", "占卜", "风水", "看相",
    "八卦新闻", "明星八卦", "追星", "爱豆", "应援",
    # 理财投机（非课程）
    "股票涨", "炒股", "买彩票", "比特币", "以太坊", "期货", "加杠杆",
    "怎么赚钱快", "一夜暴富",
    # 人身 / 角色扮演闲聊
    "你是谁开发的", "你几岁了", "你是男是女", "你结婚了吗",
    "谈心", "陪聊", "哄我开心", "骂人", "说脏话",
    "角色扮演", "你当我妈", "你当我爸", "叫我主人",
    # 作弊 / 代写（非正当学习求助）
    "帮我写作业答案直接给", "代写论文", "帮我作弊", "考试作弊",
    "直接给答案别解释", "替我考试", "买答案",
    # 政治敏感 / 暴力等（直接拒答）
    "怎么造反", "怎么打架", "教我打人", "制作炸弹",
    # 其他常见跑题
    "讲个鬼故事", "恐怖故事", "算命准吗", "中奖号码",
    "彩票号码", "今晚看啥", "有什么好玩的",
)

# 课程 / 章节推荐意图
_RECOMMEND_KEYWORDS: tuple[str, ...] = (
    "推荐课程", "推荐一下课", "推荐章节", "课程推荐", "章节推荐",
    "有什么课", "有哪些课", "哪门课", "哪节课", "哪一章",
    "学哪门", "学哪节", "去哪学", "在哪学", "上哪门", "上哪节",
    "相关课程", "相关章节", "找课程", "找章节", "对应课程", "对应章节",
    "挂载的课", "绑定的课", "有没有课", "推荐学习内容", "推荐学什么",
    "想学什么课", "适合学哪", "该上哪",
)

# 讲解 / 理解意图（与推荐并存时优先走讲解模板）
_EXPLAIN_KEYWORDS: tuple[str, ...] = (
    "什么是", "为什么", "怎么理解", "如何理解", "解释一下", "讲一下", "讲讲",
    "原理", "区别", "对比", "步骤", "怎么做", "如何做", "举例", "举个例子",
    "详细说说", "帮我弄懂", "不明白", "看不懂", "怎么用", "如何用",
)

_GREETING_ONLY = re.compile(
    r"^(你好|您好|嗨|哈喽|hello|hi|在吗|在不在|早上好|中午好|晚上好)[!！.。~～\s]*$",
    re.IGNORECASE,
)


def classify_intent(input_text: str, topic_code: str | None) -> IntentMode:
    """根据关键词分流意图；不调用模型，避免无关问题消耗 Token。"""
    text = (input_text or "").strip()
    if not text:
        return "EXPLAIN"
    if _GREETING_ONLY.match(text):
        return "EXPLAIN"

    normalized = _normalize(text)
    has_explain = _contains_any(normalized, _EXPLAIN_KEYWORDS)
    has_recommend = _contains_any(normalized, _RECOMMEND_KEYWORDS)
    has_off_topic = _contains_any(normalized, _OFF_TOPIC_KEYWORDS)
    # 仅看本轮文本是否含学习信号；不沿用上一轮 topic_code，避免闲聊被误判为讲解
    has_learning = _mentions_learning_topic(normalized)

    if has_off_topic and not has_explain and not has_recommend and not has_learning:
        return "OFF_TOPIC"

    if (
        not has_learning
        and not has_explain
        and not has_recommend
        and _looks_like_chitchat(normalized)
    ):
        return "OFF_TOPIC"

    if has_recommend and not has_explain:
        return "COURSE_RECOMMEND"

    # topic_code 仅用于推荐模式强化：有主题且明确推荐口吻
    if has_recommend and topic_code and not has_explain:
        return "COURSE_RECOMMEND"

    return "EXPLAIN"


def next_off_topic_strike(previous_count: int) -> int:
    previous = previous_count if isinstance(previous_count, int) and previous_count >= 0 else 0
    return previous + 1


def off_topic_message(strike_count: int) -> str:
    """拒答无关问题，同时给出可提问示例；重点提示用 Markdown 加粗。"""
    display = min(max(strike_count, 1), OFF_TOPIC_LIMIT)
    guide = _learning_guide_examples()
    if strike_count >= OFF_TOPIC_LIMIT:
        return (
            f"**无关提问已达 {OFF_TOPIC_LIMIT}/{OFF_TOPIC_LIMIT}。**"
            f"**账号将记一次异常行为并临时限制使用。**\n\n"
            f"{guide}"
        )
    remaining = OFF_TOPIC_LIMIT - display
    return (
        "这个问题看起来与当前学习关系不大，我先不按闲聊作答。"
        f"**（无关提问 {display}/{OFF_TOPIC_LIMIT}）**\n\n"
        f"{guide}\n\n"
        f"**再发送 {remaining} 次无关内容，账号将被临时封禁；"
        "反复违规累计异常行为达到上限后可能永久封禁。新开会话也不会清零计数。**"
    )


def soft_redirect_message(*, stage: str | None = None) -> str:
    """模型输出侧软拦截：只引导，不计入封禁次数（低年级误判友好）。"""
    if stage in {"lower_primary", "upper_primary"}:
        return (
            "我们先把注意力放回学习上吧～\n\n"
            f"{_learning_guide_examples()}\n\n"
            "用上面这类问题问我，我就能好好教你啦。"
        )
    return (
        "这一段内容偏离了学习主题，我先不继续闲聊展开。\n\n"
        f"{_learning_guide_examples()}\n\n"
        "围绕课程或知识点再问一次，我会按教学方式回答。"
    )


def looks_like_off_topic_model_output(text: str, *, stage: str | None = None) -> bool:
    """
    输出侧软校验：宁可漏拦，也不要轻易打断正常讲解。
    仅当正文几乎没有学习信号、且出现较明显的闲聊/娱乐应答时才触发。
    小学学段阈值更高，降低误伤。
    """
    if not text or len(text.strip()) < 24:
        return False
    normalized = _normalize(text)
    if _mentions_learning_topic(normalized):
        return False

    hits = sum(1 for keyword in _OFF_TOPIC_KEYWORDS if _normalize(keyword) in normalized)
    answer_patterns = (
        "今天气温", "明天有雨", "建议你带伞", "推荐餐厅", "可以去玩",
        "上分技巧", "这样撩她", "星座运势", "今晚看这部", "开黑吗",
        "股票会涨", "彩票号码", "陪你聊天", "我们聊点别的",
    )
    pattern_hits = sum(1 for pattern in answer_patterns if pattern in normalized)
    chitchat = _looks_like_chitchat(normalized)

    primary = stage in {"lower_primary", "upper_primary"}
    if primary:
        # 小学：至少 3 个无关词，或 2 个无关词 + 明显应答句式
        return hits >= 3 or (hits >= 2 and pattern_hits >= 1)
    # 初高中：2 个无关词，或 1 个无关词 + 应答/闲聊句式
    return hits >= 2 or (hits >= 1 and (pattern_hits >= 1 or chitchat))


def _learning_guide_examples() -> str:
    return (
        "我是 AI 素养学习助手，更适合回答课程相关问题。你可以试试：\n"
        "- 「什么是提示词？」\n"
        "- 「为什么大模型会出现幻觉？」\n"
        "- 「推荐提示词相关课程」\n"
        "- 「冒泡排序是怎么比较的？」"
    )


def _normalize(text: str) -> str:
    return text.casefold().replace(" ", "").replace("　", "").replace("\n", "")


def _contains_any(normalized: str, keywords: tuple[str, ...]) -> bool:
    return any(_normalize(keyword) in normalized for keyword in keywords)


def _mentions_learning_topic(normalized: str) -> bool:
    for topic in TOPICS:
        for alias in topic.aliases:
            needle = _normalize(alias)
            if len(needle) >= 2 and needle in normalized:
                return True
        title = _normalize(topic.title)
        if len(title) >= 2 and title in normalized:
            return True
    # 常见学科锚点，防止漏检内置目录外的学习问法
    anchors = (
        "算法", "排序", "查找", "提示词", "幻觉", "大模型", "机器学习",
        "神经网络", "数据", "知识点", "课程", "章节", "讲义", "作业",
        "编程", "python", "人工智能", "ai素养", "信息模型", "训练",
        "过拟合", "监督学习", "深度学习", "向量", "嵌入", "rag",
    )
    return any(anchor in normalized for anchor in anchors)


def _looks_like_chitchat(normalized: str) -> bool:
    if len(normalized) <= 1:
        return True
    chitchat = (
        "哈哈", "呵呵", "嘿嘿", "嘻嘻", "无聊", "好无聊", "好烦",
        "你真笨", "你傻", "滚蛋", "闭嘴", "stupid", "idiot",
        "唱首歌", "跳个舞", "讲故事", "陪我玩", "聊会天", "随便聊聊",
        "你在干嘛", "你忙吗", "今晚干嘛", "约吗", "出来玩",
        "夸夸我", "骂我一句", "说句好听的", "讲个段子",
        "测试一下你", "你能做什么无关", "随便说说",
    )
    return any(item in normalized for item in chitchat)
