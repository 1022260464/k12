"""Reviewed, deterministic lessons for supported AI literacy topics."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Lesson:
    strategy: str
    goal: str
    explanation: str
    example: str
    check: str


@dataclass(frozen=True)
class Topic:
    code: str
    title: str
    chapter: str
    aliases: tuple[str, ...]
    lessons: dict[str, Lesson]
    questions: dict[str, tuple[str, tuple[str, ...], str, str]]
    common_question: tuple[str, tuple[str, ...], str, str]
    challenge: tuple[str, tuple[str, ...], str, str]


_IMAGE_CLASSIFICATION = Topic(
    code="machine_learning.image_classification",
    title="图像分类",
    chapter="机器如何识别图片",
    aliases=("图像分类", "图片分类", "图像识别", "imageclassification"),
    lessons={
        "lower_primary": Lesson(
            "pictures-and-patterns",
            "能说出图片中的线索，并理解机器也会根据线索判断类别。",
            "看猫和狗的照片时，我们会观察耳朵、脸和身体等线索。机器也会从很多带名字的图片中学习，再猜新图片属于哪一类；它也可能猜错。",
            "看到一张小猫照片，可以先说出你看到了什么，再请机器猜它是猫还是狗。",
            "如果照片太模糊，机器猜错了怎么办？",
        ),
        "upper_primary": Lesson(
            "examples-and-testing",
            "区分训练图片、待识别图片和分类结果。",
            "图像分类是让模型从带类别标签的图片中学习规律，再对没见过的图片预测类别。训练样例需要多样；背景和光线变化也可能影响结果。",
            "用不同光线下的猫、狗图片训练，再拿新照片测试，不要只看训练时的正确率。",
            "为什么不能只用同一张猫的照片训练模型？",
        ),
        "middle_school": Lesson(
            "data-model-evaluation",
            "理解训练集、测试集、误分类及数据偏差。",
            "图像分类模型通过训练数据学习图像特征与类别的关联，并在未见过的测试数据上评估。若猫图都在室内、狗图都在室外，模型可能错误地依赖背景。",
            "把不同背景的猫狗图片分到训练集与测试集，检查误分类样例并改进数据。",
            "如果模型只在训练图片上准确，能说明它会识别新图片吗？",
        ),
        "high_school": Lesson(
            "pipeline-and-error-analysis",
            "能设计图像分类实验，并解释泛化、数据泄漏和分类指标。",
            "图像分类流程包括数据标注、训练/验证/测试划分、模型训练与误差分析。应避免同一对象的近重复照片跨集合造成数据泄漏；准确率也不能替代对少数类召回率的检查。",
            "设计猫狗分类实验时，按拍摄对象拆分数据，并查看混淆矩阵中的误判类型。",
            "类别不均衡时，只报告准确率为什么可能误导我们？",
        ),
    },
    questions={
        "lower_primary": (
            "机器把模糊照片猜错了，应该怎么办？",
            ("核对图片并告诉老师", "相信机器一定正确", "随便改掉照片"),
            "a",
            "分类结果需要核对，机器也会犯错。",
        ),
        "upper_primary": (
            "训练猫狗分类模型时，哪种图片更有帮助？",
            ("只有一张猫图", "不同光线和背景的猫狗图", "完全没有标签的图片"),
            "b",
            "多样且正确标注的样例有助于模型学习。",
        ),
        "middle_school": (
            "猫图都在室内、狗图都在室外，模型可能学到什么错误规律？",
            ("图片背景", "图片文件名", "图片顺序"),
            "a",
            "背景与类别偶然相关会造成偏差。",
        ),
        "high_school": (
            "同一只猫的近重复照片同时出现在训练集和测试集，主要风险是什么？",
            ("数据泄漏", "类别数量增加", "模型无法读取图片"),
            "a",
            "近重复样本跨集合会使测试结果过于乐观。",
        ),
    },
    common_question=(
        "模型给新图片的类别预测一定正确吗？",
        ("一定", "不一定，应结合样例核对", "只要速度快就正确"),
        "b",
        "预测可能受数据质量和场景变化影响。",
    ),
    challenge=(
        "如果模型把雨天的狗多次认成猫，下一步适合怎么做？",
        ("补充并检查雨天狗的标注样例", "只改答案展示文字", "删除全部测试数据"),
        "a",
        "先分析误差，再补充具有代表性的训练数据。",
    ),
)


_RESPONSIBLE_AI = Topic(
    code="generative_ai.responsible_use",
    title="负责任使用生成式 AI",
    chapter="与生成式 AI 安全相处",
    aliases=(
        "负责任使用生成式ai",
        "生成式ai",
        "生成式人工智能",
        "ai安全",
        "ai隐私",
        "大模型幻觉",
        "隐私保护",
    ),
    lessons={
        "lower_primary": Lesson(
            "safe-story-and-check",
            "知道不能向 AI 透露住址等个人信息，遇到奇怪回答要找大人核对。",
            "AI 像一个会说话的学习帮手，但它说的话不一定都对。"
            "不要告诉它家庭住址、电话或密码；不确定时请老师或家长帮忙。",
            "让 AI 讲动物故事可以；让它记住你家的详细地址就不合适。",
            "如果 AI 问你的家庭住址，你会怎么做？",
        ),
        "upper_primary": Lesson(
            "privacy-and-verification",
            "能识别敏感信息，学会核对 AI 给出的事实。",
            "生成式 AI 会根据提示生成文字、图片等内容，但可能编造看似可信的信息。"
            "提问时避免输入姓名、住址、账号密码；重要事实应查看教材或可靠来源。",
            "查某项科学知识时，可以请 AI 给出解释，再与教材内容对照。",
            "AI 给出一个没有来源的科学结论，你要怎么核对？",
        ),
        "middle_school": Lesson(
            "source-check-and-attribution",
            "理解幻觉、隐私与学术诚信，能制定核验步骤。",
            "大模型生成的是概率性的回答，可能出现虚构引文或错误结论。"
            "学习时要核查原始资料，不上传同学的隐私或未授权作品，"
            "也不能把生成内容冒充自己的独立作业。",
            "让 AI 帮你列研究提纲可以；引用它给出的论文前必须找到原文并核验。",
            "模型给出一条查不到的论文引用时，你应如何处理？",
        ),
        "high_school": Lesson(
            "risk-assessment-and-disclosure",
            "能评价生成内容的可靠性、隐私和版权风险，并说明使用边界。",
            "生成式 AI 可能产生幻觉、偏见和版权风险。"
            "使用时应检查来源与适用条件、最小化输入个人数据，"
            "按课程要求披露 AI 辅助范围；高风险判断不能仅依赖模型输出。",
            "在项目报告中使用 AI 整理资料时，逐条核对原始来源，并标明哪些部分由 AI 辅助。",
            "为什么即使 AI 的回答措辞很肯定，也不能直接当作事实引用？",
        ),
    },
    questions={
        "lower_primary": (
            "下面哪件事可以对 AI 说？",
            ("我家的门牌号", "我的账号密码", "请讲一个动物故事"),
            "c",
            "可以提出普通学习请求，不能透露敏感信息。",
        ),
        "upper_primary": (
            "AI 给出一个科学结论，最合适的做法是什么？",
            ("查教材或可靠来源", "直接当作事实", "把密码发给 AI 求证"),
            "a",
            "重要事实需要核验。",
        ),
        "middle_school": (
            "AI 提供一篇找不到原文的论文，应该怎么做？",
            ("先核对原文再决定是否引用", "直接写进作业", "把它当作已经证实"),
            "a",
            "虚构引用是常见风险，不能未经核查使用。",
        ),
        "high_school": (
            "在项目报告中使用 AI 生成的材料，哪种处理更合适？",
            (
                "核查来源并按要求披露辅助范围",
                "隐瞒并直接当作独立成果",
                "上传他人的私人信息作为提示",
            ),
            "a",
            "核验、隐私保护和披露是负责任使用的一部分。",
        ),
    },
    common_question=(
        "哪些信息不应直接输入公开的 AI 对话服务？",
        ("公开课程名称", "账号密码和家庭住址", "普通数学题目"),
        "b",
        "密码、住址等敏感信息应受到保护。",
    ),
    challenge=(
        "AI 生成的引用看起来很真实，但检索不到原文，应如何处理？",
        ("不要引用，继续查证可靠来源", "照抄并编造页码", "只要语言流畅就采用"),
        "a",
        "生成内容的可信度必须通过独立来源核验。",
    ),
)


_TRAIN_TEST_SPLIT = Topic(
    code="machine_learning.train_test_split",
    title="训练集与测试集",
    chapter="怎样公平地检查模型",
    aliases=("训练集", "测试集", "训练测试", "traintest", "数据划分"),
    lessons={
        "lower_primary": Lesson(
            "practice-and-exam",
            "知道练习题和考试题要分开，不能拿做过的题当真正考试。",
            "先用一些带答案的图片练习，再用没练过的新图片检查，才知道是不是真会。",
            "像先做练习册，再独立完成小测验。",
            "为什么检查时要换新的图片？",
        ),
        "upper_primary": Lesson(
            "separate-check",
            "能说出训练集用来学习、测试集用来检查。",
            "训练集是带标签的样例，供模型学习；测试集是留出的新样例，用来检查泛化能力。两者不应混用。",
            "把猫狗图片分成两堆：一堆学习，一堆只用于最后检查。",
            "如果把测试图片也拿去训练，检查结果会怎样？",
        ),
        "middle_school": Lesson(
            "generalization-check",
            "理解划分目的是估计模型在未见数据上的表现。",
            "合理的训练/测试划分避免“背答案”。若测试样例与训练样例过度相似，分数会虚高。",
            "按拍摄对象拆分，而不是随机打乱同一对象的近重复照片。",
            "近重复样本跨集合会出现什么问题？",
        ),
        "high_school": Lesson(
            "leakage-and-validation",
            "能解释数据泄漏，并区分训练、验证与测试用途。",
            "验证集用于调参，测试集尽量只用于最终评估。特征工程若用到测试信息会造成泄漏，使指标不可信。",
            "先固定测试集，只在训练集上做归一化拟合，再变换测试集。",
            "为什么在全体数据上先算均值再划分是危险的？",
        ),
    },
    questions={
        "lower_primary": (
            "检查模型时最好用什么样的图片？",
            ("练习时看过的同一张", "没练过的新图片", "没有标签也无所谓"),
            "b",
            "要用新样例检查是否真的学会。",
        ),
        "upper_primary": (
            "训练集的主要作用是什么？",
            ("学习规律", "只用来打印结果", "故意制造错误"),
            "a",
            "训练集提供带标签的学习样例。",
        ),
        "middle_school": (
            "训练和测试使用同一批近重复照片，主要风险是？",
            ("分数虚高", "模型更安全", "标签自动变多"),
            "a",
            "检查不再代表未见数据上的真实能力。",
        ),
        "high_school": (
            "调参应主要依赖哪一类数据？",
            ("验证集", "最终锁定的测试集反复试", "随便混用全部数据"),
            "a",
            "测试集应尽量保留给最终评估。",
        ),
    },
    common_question=(
        "测试集的核心目的是什么？",
        ("估计未见数据表现", "让模型多背一点答案", "取代所有训练数据"),
        "a",
        "测试是为了检查泛化，不是继续训练。",
    ),
    challenge=(
        "发现测试准确率异常高，下一步应优先检查什么？",
        ("是否存在数据泄漏或划分不当", "立刻上线模型", "删除全部训练数据"),
        "a",
        "先排查评估是否可信。",
    ),
)


_NEURAL_NETWORK_BASICS = Topic(
    code="machine_learning.neural_network_basics",
    title="神经网络入门",
    chapter="一层层传递的判断",
    aliases=("神经网络", "多层感知", "neuralnetwork", "神经元"),
    lessons={
        "lower_primary": Lesson(
            "layers-of-clues",
            "知道机器可以一层层看线索，再做出猜测。",
            "先看简单线索，再组合线索，最后猜类别。中间任何一层猜错，后面也可能跟着错。",
            "像接力：第一位同学看颜色，第二位看形状，最后一位说出是什么。",
            "如果第一层看错了颜色，后面会怎样？",
        ),
        "upper_primary": Lesson(
            "input-hidden-output",
            "能说出输入、中间处理和输出的大致关系。",
            "输入是数字特征，中间层组合特征，输出是类别或数值。网络需要用许多样例调整连接强度。",
            "把像素亮度当作输入，经过几层计算后输出“猫/狗”。",
            "没有中间层、直接输出，会缺少什么？",
        ),
        "middle_school": Lesson(
            "weighted-combination",
            "理解加权求和与逐层变换的直观含义。",
            "每个连接有权重，输入被加权组合后再激活。训练通过误差反向调整权重，使预测更接近标签。",
            "画一个两输入一输出的小网络，手动计算一次前向结果。",
            "权重全为 0 时输出会有什么特点？",
        ),
        "high_school": Lesson(
            "forward-and-limit",
            "能描述前向传播，并指出过拟合与可解释性局限。",
            "前向传播按层计算表示；更深网络可拟合复杂函数，但也更易过拟合、更难解释。"
            "需要正则、更多数据或更简单结构来平衡效果。",
            "比较浅层与深层网络在小数据集上的验证曲线。",
            "为什么训练误差很低、验证误差却升高时要警惕？",
        ),
    },
    questions={
        "lower_primary": (
            "神经网络做判断时更像什么？",
            ("一层层看线索再猜", "随便掷骰子", "只看文件名"),
            "a",
            "它按层次组合线索。",
        ),
        "upper_primary": (
            "输入层的作用是什么？",
            ("接收特征", "直接给最终分数就结束", "删除全部样例"),
            "a",
            "输入层接收特征数据。",
        ),
        "middle_school": (
            "训练时主要在调整什么？",
            ("连接权重", "图片文件格式", "教室桌椅编号"),
            "a",
            "通过误差信号调整权重。",
        ),
        "high_school": (
            "训练误差持续下降而验证误差上升，常见原因是？",
            ("过拟合", "测试集太大", "输入维度一定变少"),
            "a",
            "模型可能记住训练细节而泛化变差。",
        ),
    },
    common_question=(
        "神经网络的输出一定正确吗？",
        ("不一定，需要数据和评估", "只要层数多就一定对", "只要算得快就正确"),
        "a",
        "输出依赖数据质量与评估方式。",
    ),
    challenge=(
        "小样本上深层网络效果很差，较合理的做法是？",
        ("简化模型或增加多样数据", "只报训练准确率", "关掉所有验证"),
        "a",
        "控制复杂度并改善数据。",
    ),
)


def _lessons(
    *,
    strategy: str,
    goal: tuple[str, str, str, str],
    explanation: tuple[str, str, str, str],
    example: tuple[str, str, str, str],
    check: tuple[str, str, str, str],
) -> dict[str, Lesson]:
    stages = ("lower_primary", "upper_primary", "middle_school", "high_school")
    return {
        stage: Lesson(strategy, goal[index], explanation[index], example[index], check[index])
        for index, stage in enumerate(stages)
    }


_OVERFITTING = Topic(
    code="machine_learning.overfitting",
    title="过拟合",
    chapter="模型学得太像练习题",
    aliases=("过拟合", "overfitting", "背答案", "泛化差"),
    lessons=_lessons(
        strategy="practice-vs-exam",
        goal=(
            "知道只背练习题、换新题就不会，就有点像过拟合。",
            "能说出过拟合是训练表现好、新数据表现差。",
            "理解训练误差下降而验证误差上升是过拟合信号。",
            "能列举缓解过拟合的常见做法并说明适用场景。",
        ),
        explanation=(
            "如果只把练习册答案背熟，换一套新题就不会做，这就像模型过拟合：只记住旧样例，不会应对新情况。",
            "过拟合指模型在训练数据上很准，但在没见过的测试数据上变差。原因常常是样例太少或模型太复杂。",
            "观察训练曲线：训练误差持续下降、验证误差开始升高时，要怀疑过拟合。可用更多样数据、更简单模型或正则化缓解。",
            "过拟合意味着模型拟合了训练噪声而非可泛化规律。可从数据增广、早停、正则、降低复杂度等方向处理，并保留独立测试集评估。",
        ),
        example=(
            "只练三道加法题，遇到新数字就不会。",
            "猫狗分类只在同一背景照片上练，换场景就错很多。",
            "画训练/验证误差曲线，看到验证误差掉头向上。",
            "对比浅层与深层网络在小样本上的验证曲线差异。",
        ),
        check=(
            "换新题目就不会，可能说明什么？",
            "训练很准、测试很差，通常叫什么？",
            "验证误差上升而训练误差还在下降，你该警惕什么？",
            "缓解过拟合时，为什么仍要保留独立测试集？",
        ),
    ),
    questions={
        "lower_primary": (
            "只背练习题、换新题就不会，更像什么？",
            ("过拟合", "一定更聪明", "不用再学习"),
            "a",
            "记住旧题却难应对新题，就像过拟合。",
        ),
        "upper_primary": (
            "过拟合时常见现象是？",
            ("训练好、新数据差", "训练差、新数据一定好", "完全不能训练"),
            "a",
            "训练表现好却泛化差。",
        ),
        "middle_school": (
            "哪项更像过拟合信号？",
            ("验证误差上升、训练误差仍降", "两边误差一起稳步下降", "没有验证集也无所谓"),
            "a",
            "验证变差说明泛化可能变差。",
        ),
        "high_school": (
            "缓解过拟合时，哪项做法更合理？",
            ("增加多样数据或简化模型", "只报训练准确率", "把测试集也拿去反复调参"),
            "a",
            "改善数据与复杂度，并保护测试集。",
        ),
    },
    common_question=(
        "过拟合主要伤害什么能力？",
        ("在新数据上的表现", "电脑开机速度", "文件存储格式"),
        "a",
        "核心是泛化能力下降。",
    ),
    challenge=(
        "小数据集上深层网络验证误差很高，优先尝试？",
        ("简化模型或扩充多样数据", "关掉验证只看训练", "删除全部标签"),
        "a",
        "控制复杂度并改善数据。",
    ),
)


_FEATURES_LABELS = Topic(
    code="machine_learning.features_labels",
    title="特征与标签",
    chapter="机器看见什么、要预测什么",
    aliases=("特征", "标签", "feature", "label", "标注"),
    lessons=_lessons(
        strategy="clue-and-answer",
        goal=(
            "能分清“线索”和“答案名字”。",
            "能说出特征是输入线索，标签是要预测的类别或数值。",
            "理解特征选择会影响模型学到的规律。",
            "能举例说明特征工程与标签质量对监督学习的影响。",
        ),
        explanation=(
            "看图片猜是猫还是狗时，耳朵、毛色是线索，猫/狗是答案名字。机器学习里，线索叫特征，答案叫标签。",
            "特征是模型看到的输入信息；标签是正确答案。监督学习就是用带标签的样例学习特征与标签的关系。",
            "选错特征（例如只用文件名）会让模型学到无用规律；标签标错也会把错误教给模型。",
            "特征工程决定表示质量，标注规范决定监督信号。噪声标签与泄漏特征都会让评估失真。",
        ),
        example=(
            "水果的颜色、形状是线索，苹果/香蕉是名字。",
            "身高体重是特征，是否偏瘦是标签之一。",
            "用像素作特征，用猫/狗作标签训练分类器。",
            "检查标注指南，避免同一对象在训练与测试中泄漏。",
        ),
        check=(
            "线索和答案名字分别对应什么？",
            "没有标签的样例，适合直接做哪种监督学习训练？",
            "为什么特征选得不好会影响结果？",
            "标签噪声会带来什么风险？",
        ),
    ),
    questions={
        "lower_primary": (
            "猜动物时，“耳朵长什么样”更像？",
            ("线索（特征）", "最终名字本身", "电源开关"),
            "a",
            "线索帮助判断，名字是标签。",
        ),
        "upper_primary": (
            "监督学习中标签是什么？",
            ("正确答案", "随便写的文件名", "电脑风扇转速"),
            "a",
            "标签提供监督信号。",
        ),
        "middle_school": (
            "只用图片文件名当特征，主要风险是？",
            ("学到无用规律", "一定更准确", "标签会自动变多"),
            "a",
            "特征应与任务相关。",
        ),
        "high_school": (
            "标注不一致的标签最可能导致？",
            ("监督信号噪声、评估不可靠", "模型不再需要特征", "测试集自动消失"),
            "a",
            "标签质量直接影响学习与评估。",
        ),
    },
    common_question=(
        "特征与标签的基本关系是？",
        ("特征是输入，标签是要预测的目标", "标签是输入，特征是装饰", "两者必须完全相同"),
        "a",
        "监督学习学习二者之间的映射。",
    ),
    challenge=(
        "发现部分标签明显标错，更合理的下一步？",
        ("核查并修正标注规范与样例", "假装没看见继续报高分", "删掉全部测试集"),
        "a",
        "先保证监督信号可靠。",
    ),
)


_HALLUCINATION = Topic(
    code="generative_ai.hallucination",
    title="AI 幻觉",
    chapter="说得像真的，却可能编造",
    aliases=("幻觉", "ai幻觉", "编造", "hallucination", "胡编"),
    lessons=_lessons(
        strategy="check-before-trust",
        goal=(
            "知道 AI 说的话不一定对，要找大人或教材核对。",
            "能识别“听起来很真但没有依据”的回答。",
            "理解大模型可能生成虚构事实与虚假引用。",
            "能制定核验步骤并说明高风险场景不可只靠模型。",
        ),
        explanation=(
            "AI 有时会编出听起来很真的话。不确定时，要问老师、家长，或对照课本。",
            "幻觉指模型生成看似合理但不真实的内容。重要信息要查教材或可靠来源，不要直接照抄。",
            "生成内容基于统计模式，可能捏造论文、数据或细节。学习中应交叉验证，并避免把幻觉当证据。",
            "幻觉是生成式模型的系统性风险。需来源核验、置信度管理；医疗法律等场景不能仅依赖模型输出。",
        ),
        example=(
            "AI 讲了一个课本上没有的“科学结论”，先去问老师。",
            "AI 给出查不到的书名，先检索确认再引用。",
            "让模型列参考文献后，逐条核对是否真实存在。",
            "在报告中披露 AI 辅助范围，并对关键事实做独立核验。",
        ),
        check=(
            "AI 说得特别肯定，就可以直接相信吗？",
            "遇到没有来源的结论，你怎么做？",
            "为什么虚构引用很危险？",
            "哪些场景更不能只靠模型回答？",
        ),
    ),
    questions={
        "lower_primary": (
            "AI 说了一句奇怪的话，你应该？",
            ("找老师或家长核对", "马上告诉所有同学当真相", "把密码发给它求证"),
            "a",
            "不确定就要核对。",
        ),
        "upper_primary": (
            "“听起来很真但没有依据”的回答，更可能是？",
            ("需要核验的幻觉风险", "一定完全正确", "可以代替所有课本"),
            "a",
            "要查证后再用。",
        ),
        "middle_school": (
            "模型给出找不到的论文，正确做法是？",
            ("不引用并继续查证", "照抄并编页码", "只要文笔好就采用"),
            "a",
            "虚构引用不能当证据。",
        ),
        "high_school": (
            "降低幻觉危害的关键做法是？",
            ("独立来源核验并限制高风险用途", "关闭所有核验环节", "把模型输出当法律结论"),
            "a",
            "核验与使用边界同样重要。",
        ),
    },
    common_question=(
        "应对 AI 幻觉的首要原则是？",
        ("重要事实要核验", "语气肯定就等于正确", "越长越好"),
        "a",
        "可信度来自核验，不是措辞。",
    ),
    challenge=(
        "作业里使用 AI 整理资料，哪项更负责任？",
        ("核对来源并按要求说明辅助范围", "隐瞒并当作全是自己写的", "把同学隐私贴进提示词"),
        "a",
        "核验与披露是基本要求。",
    ),
)


_WHAT_IS_ALGORITHM = Topic(
    code="computing.algorithm_basics",
    title="什么是算法",
    chapter="按步骤解决问题",
    aliases=("算法", "什么是算法", "algorithm", "步骤方法"),
    lessons=_lessons(
        strategy="steps-to-goal",
        goal=(
            "知道算法就是把事情一步步说清楚的方法。",
            "能举例说明算法是可执行的步骤序列。",
            "理解算法关注正确性、步骤是否清楚与是否会结束。",
            "能比较同一问题的不同算法在步骤与效率上的差异。",
        ),
        explanation=(
            "算法像一份说明书：先做什么、再做什么，最后得到结果。比如按步骤整理书包。",
            "算法是解决问题的清晰步骤。计算机程序常常是在执行某一种算法。",
            "好的算法步骤明确、能完成任务，并且会结束。排序就是一类常见算法问题。",
            "算法分析关心正确性与资源消耗。同一问题可有多种算法，如冒泡与选择排序。",
        ),
        example=(
            "刷牙：挤牙膏→刷上牙→刷下牙→漱口。",
            "查字典：按字母顺序一页页找。",
            "把数字从小到大排列的一套规则。",
            "比较两种排序算法的比较次数差异。",
        ),
        check=(
            "算法更像什么？",
            "步骤说不清楚会怎样？",
            "算法为什么最好能保证结束？",
            "为什么同一问题会有多种算法？",
        ),
    ),
    questions={
        "lower_primary": (
            "算法最像哪一样？",
            ("一步步说明书", "随便猜答案", "关掉电脑"),
            "a",
            "算法强调清楚的步骤。",
        ),
        "upper_primary": (
            "算法的主要作用是？",
            ("按步骤解决问题", "只用来画画", "自动删除作业"),
            "a",
            "它给出可执行步骤。",
        ),
        "middle_school": (
            "评价算法时，除了正确，还常关心？",
            ("步骤是否清楚、会不会结束", "字体颜色", "桌面壁纸"),
            "a",
            "清晰与终止性很重要。",
        ),
        "high_school": (
            "同一排序问题有多种算法，说明什么？",
            ("可用不同步骤与效率达到目标", "只能有一种正确方法", "算法与程序无关"),
            "a",
            "算法设计存在权衡空间。",
        ),
    },
    common_question=(
        "算法强调的核心是？",
        ("可执行的清楚步骤", "必须使用人工智能", "不能出现数字"),
        "a",
        "步骤清晰才能被执行与检查。",
    ),
    challenge=(
        "要把“分糖果”说成算法，最重要的是？",
        ("把规则写成可检查的步骤", "只说“分公平就行”", "不写结束条件"),
        "a",
        "规则要具体到可执行。",
    ),
)


def _stage_quiz(
    lower: tuple[str, tuple[str, ...], str, str],
    upper: tuple[str, tuple[str, ...], str, str],
    middle: tuple[str, tuple[str, ...], str, str],
    high: tuple[str, tuple[str, ...], str, str],
) -> dict[str, tuple[str, tuple[str, ...], str, str]]:
    return {
        "lower_primary": lower,
        "upper_primary": upper,
        "middle_school": middle,
        "high_school": high,
    }


_LOOP_BASICS = Topic(
    code="computing.loop_basics",
    title="循环与重复",
    chapter="把相同步骤做很多遍",
    aliases=("循环", "重复", "loop", "迭代"),
    lessons=_lessons(
        strategy="repeat-with-care",
        goal=(
            "知道有些事情可以一遍遍重复做。",
            "能说出循环是按规则重复执行一组步骤。",
            "理解循环需要明确开始、重复内容和结束条件。",
            "能区分计数循环与条件循环，并说明终止的重要性。",
        ),
        explanation=(
            "跳绳时一下一下跳，就是在重复。算法里也可以把同样的步骤重复很多次。",
            "循环让计算机按规则重复执行步骤，比如把一排数字逐个检查。",
            "写循环时要说清楚：重复什么、重复几次或何时停止，否则可能一直不停。",
            "循环是控制结构：计数循环按次数执行，条件循环在条件满足时继续；必须保证可终止。",
        ),
        example=(
            "拍三下手：拍一下，再拍，再拍。",
            "从 1 数到 10：每次加一。",
            "遍历数组每个元素做一次比较。",
            "用 while 在未排序完时继续下一轮。",
        ),
        check=(
            "循环最像什么？",
            "为什么循环要有结束办法？",
            "没有结束条件会怎样？",
            "计数循环和条件循环差在哪里？",
        ),
    ),
    questions=_stage_quiz(
        ("循环更像？", ("按规则重复做事", "只做一次就永远停", "随机关掉电脑"), "a", "循环强调有规则的重复。"),
        ("写循环时最需要清楚的是？", ("重复什么、何时停止", "字体颜色", "桌面壁纸"), "a", "内容和终止条件最重要。"),
        ("没有结束条件的循环，主要风险是？", ("可能一直不停", "一定更快", "自动变得更准确"), "a", "可能无法终止。"),
        ("条件循环继续执行的依据通常是？", ("某个条件仍成立", "必须固定次数", "文件名长度"), "a", "由条件控制是否继续。"),
    ),
    common_question=("循环的核心作用是？", ("重复执行步骤", "删除全部数据", "只能用于画画"), "a", "用规则完成重复劳动。"),
    challenge=("设计“发练习本”的循环，最重要的是？", ("说明每位同学发一本并何时发完", "只说“发一下”", "不写停止条件"), "a", "步骤与结束要可检查。"),
)


_SUPERVISED_LEARNING = Topic(
    code="machine_learning.supervised_learning",
    title="监督学习",
    chapter="带着答案学习",
    aliases=(
        "监督学习", "supervised", "有监督学习", "带标签学习",
        "监督相关", "监督式学习",
    ),
    lessons=_lessons(
        strategy="learn-with-answers",
        goal=(
            "知道学习时可以先看带答案的例子。",
            "能说出监督学习用带标签样例训练模型。",
            "理解输入特征与标签共同构成训练样例。",
            "能区分监督、无监督任务的基本差异。",
        ),
        explanation=(
            "像做题时先看例题和答案，再自己练习。监督学习也是先给机器很多“题目+答案”。",
            "监督学习使用带标签的数据：模型看到特征，并对照正确答案学习。",
            "每个训练样例通常包含特征与标签。学完后，模型要对新样例预测标签。",
            "监督学习依赖标注数据；无监督学习则主要发现数据自身结构，不依赖标签。",
        ),
        example=(
            "看很多“这是猫/狗”的图片再猜新图片。",
            "用成绩与是否及格的例子学习判断。",
            "用历史天气特征预测是否下雨。",
            "对比分类标注任务与聚类无标签任务。",
        ),
        check=(
            "监督学习为什么要先给答案？",
            "没有标签还能叫典型监督学习吗？",
            "训练样例通常包含哪两部分？",
            "监督与无监督最直观差别是什么？",
        ),
    ),
    questions=_stage_quiz(
        ("监督学习更像？", ("先看例题再练习", "完全不看答案瞎猜", "只背同学名字"), "a", "带答案的例子帮助学习。"),
        ("监督学习需要什么？", ("带标签的样例", "完全没有数据", "只能一张图"), "a", "标签提供正确答案。"),
        ("训练后模型通常要做什么？", ("预测新样例的标签", "删除全部特征", "停止使用数据"), "a", "目标是泛化预测。"),
        ("无监督学习相对监督学习缺少什么？", ("标签监督信号", "所有输入特征", "计算机本身"), "a", "主要差在是否有标签。"),
    ),
    common_question=("监督学习的关键材料是？", ("带标签数据", "无任何例子", "随机噪声即可"), "a", "标签驱动学习。"),
    challenge=("标注很少时监督学习变难，较合理？", ("补充标注或改用其他方法", "假装标签很多", "删掉测试集"), "a", "标注质量与数量关键。"),
)


_CLASSIFICATION_REGRESSION = Topic(
    code="machine_learning.classification_regression",
    title="分类与回归",
    chapter="猜类别还是猜数值",
    aliases=("分类", "回归", "classification", "regression", "预测数值"),
    lessons=_lessons(
        strategy="category-or-number",
        goal=(
            "能分清“猜名字”和“猜多少”。",
            "能说出分类预测类别，回归预测数值。",
            "能根据问题类型选择分类或回归思路。",
            "能举例说明两类任务的评价指标差异。",
        ),
        explanation=(
            "猜图片是猫还是狗，是在猜类别；猜明天温度多少度，是在猜数字。",
            "分类输出类别标签；回归输出连续数值。两者都可能用监督学习完成。",
            "先判断目标是离散类别还是连续数值，再选择合适的建模方式。",
            "分类常用准确率/召回等；回归常用误差度量。任务类型决定评价方式。",
        ),
        example=(
            "垃圾邮件/正常邮件是分类；身高预测是回归。",
            "疾病有/无是分类；房价多少是回归。",
            "手写数字识别是分类任务。",
            "比较分类准确率与回归均方误差的含义。",
        ),
        check=(
            "猜“是或不是”更像哪类？",
            "猜温度更像分类还是回归？",
            "为什么先要分清任务类型？",
            "两类任务的评价为什么不同？",
        ),
    ),
    questions=_stage_quiz(
        ("猜是猫还是狗，更像？", ("分类", "回归", "关机"), "a", "类别预测属于分类。"),
        ("预测明天气温，更像？", ("回归", "只能分类", "与数据无关"), "a", "数值预测常属回归。"),
        ("选择方法前应先确认？", ("目标是类别还是数值", "字体大小", "桌面壁纸"), "a", "任务类型决定方法。"),
        ("回归更常关注？", ("预测数值的误差", "只看类别对错", "忽略全部特征"), "a", "误差度量更贴合回归。"),
    ),
    common_question=("分类与回归的主要差别是？", ("输出类别还是数值", "是否使用电脑", "是否需要屏幕"), "a", "输出类型不同。"),
    challenge=("“预测考试分数”通常更接近？", ("回归", "只要两类标签", "不能用监督学习"), "a", "分数是连续数值。"),
)


_DATA_BIAS = Topic(
    code="machine_learning.data_bias",
    title="数据偏差",
    chapter="数据不公平，结果也可能歪",
    aliases=("数据偏差", "偏差", "bias", "样本偏差", "偏见数据"),
    lessons=_lessons(
        strategy="fair-examples",
        goal=(
            "知道例子偏了，判断也可能偏。",
            "能举例说明训练数据不均衡会造成偏差。",
            "理解数据采集与标注过程可能引入偏差。",
            "能提出检查与缓解数据偏差的基本步骤。",
        ),
        explanation=(
            "如果只给机器看晴天照片，它可能觉得下雨天很奇怪。例子偏了，结论也可能偏。",
            "数据偏差指训练样例不能代表真实世界，模型可能学到不公平或不完整的规律。",
            "偏差可能来自取样范围、标注习惯或历史偏见。需要检查各类别与场景是否覆盖充分。",
            "缓解途径包括更有代表性的采样、分层评估、偏差审计，并避免把偏差结果直接用于高风险决策。",
        ),
        example=(
            "只学男生的跑步成绩，就难理解女生成绩。",
            "某类样本很少时，模型总把它们判错。",
            "检查各类别数量是否差很多。",
            "做分群评估，查看少数群体指标。",
        ),
        check=(
            "例子太偏会怎样？",
            "什么叫数据偏差？",
            "偏差可能从哪里来？",
            "高风险场景为何更要警惕偏差？",
        ),
    ),
    questions=_stage_quiz(
        ("例子很偏时，结果可能？", ("也不公平或不完整", "一定更完美", "自动变公平"), "a", "数据偏会影响判断。"),
        ("数据偏差常见表现是？", ("某些情况总是学不好", "电脑发热", "字体变大"), "a", "覆盖不足导致偏科。"),
        ("检查偏差时可以先看？", ("各类别样例是否均衡", "壁纸颜色", "风扇噪音"), "a", "分布是第一步。"),
        ("缓解偏差较合理的是？", ("改善采样并做分群评估", "隐瞒少数类错误", "删掉测试集"), "a", "代表性与评估并重。"),
    ),
    common_question=("数据偏差主要影响？", ("模型是否公平、是否可靠", "键盘手感", "电源插头形状"), "a", "影响结果公正与可用。"),
    challenge=("发现某群体错误率特别高，优先？", ("检查数据覆盖与评估方式", "只提高整体准确率宣传", "忽略该群体"), "a", "先定位偏差来源。"),
)


_PROMPT_BASICS = Topic(
    code="generative_ai.prompt_basics",
    title="提示词入门",
    chapter="把需求说清楚",
    aliases=("提示词", "prompt", "提问技巧", "怎么问ai"),
    lessons=_lessons(
        strategy="ask-clearly",
        goal=(
            "知道把问题说清楚，AI 更好帮忙。",
            "能写出包含任务目标的简单提示。",
            "理解提示中角色、要求与例子能改善回答。",
            "能设计可检查输出格式的提示并评估结果。",
        ),
        explanation=(
            "问别人“帮我一下”不如说“帮我把铅笔盒收好”。问 AI 也要说清楚想做什么。",
            "提示词是给模型的说明。写清任务、对象和期望，回答通常更有用。",
            "可在提示中说明身份、步骤、长度或举例。提示越具体，越容易得到可用结果。",
            "结构化提示（目标、约束、输出格式、示例）便于核验。仍需人工检查事实与安全。",
        ),
        example=(
            "请用小学生能懂的话解释什么是循环。",
            "请列出三点学习建议，每点一句话。",
            "你是老师，请出一道关于分类的选择题。",
            "请用 JSON 字段 explanation/example 回答，并避免编造来源。",
        ),
        check=(
            "为什么要把需求说清楚？",
            "提示里通常要包含什么？",
            "举例为什么有帮助？",
            "为什么提示写得好仍要检查回答？",
        ),
    ),
    questions=_stage_quiz(
        ("问 AI 时更好的是？", ("说清楚想做什么", "只说“帮我”", "把密码发给它"), "a", "清楚的需求更有效。"),
        ("提示词主要是？", ("给模型的说明", "电脑电源", "桌面图标"), "a", "它引导模型回答。"),
        ("改善提示较有效的做法是？", ("补充要求与例子", "越含糊越好", "删除全部目标"), "a", "具体要求更易执行。"),
        ("结构化提示仍需人工检查，因为？", ("可能幻觉或不适龄", "模型永不犯错", "提示会自动消失"), "a", "核验不可替代。"),
    ),
    common_question=("好提示的共同点是？", ("目标清楚、要求明确", "越短越神秘", "必须包含隐私"), "a", "清楚可执行。"),
    challenge=("要生成课堂小测，提示应优先包含？", ("题型、知识点与难度要求", "学生家庭住址", "无任何主题"), "a", "任务约束要完整。"),
)


_COPYRIGHT_ORIGINALITY = Topic(
    code="generative_ai.copyright_originality",
    title="版权与原创",
    chapter="谁写的、能不能直接用",
    aliases=("版权", "原创", "抄袭", "copyright", "作品归属"),
    lessons=_lessons(
        strategy="credit-and-create",
        goal=(
            "知道别人的作品不能随便说成自己的。",
            "能区分参考、引用与直接照抄。",
            "理解生成内容也可能涉及版权与学术诚信。",
            "能说明合理使用、披露与二次创作的边界。",
        ),
        explanation=(
            "同学的绘画是同学的。AI 帮你写的句子，也不能假装全是自己想的，要按老师要求说明。",
            "原创强调自己的思考与表达。可以参考，但作业需按规则标注来源或 AI 辅助。",
            "生成式 AI 可能产出与已有作品相似的内容。学习与创作中要遵守学校规范与版权要求。",
            "版权保护表达形式；学术场景还需披露辅助工具。高风险商业使用前应评估授权与相似性风险。",
        ),
        example=(
            "把同学作文改几个字交上去，不算原创。",
            "用 AI 列提纲后自己改写，并按要求说明。",
            "引用资料时写明出处。",
            "项目报告中标注哪些段落由 AI 辅助生成。",
        ),
        check=(
            "别人的作品能直接当自己的吗？",
            "参考和照抄差在哪里？",
            "使用 AI 写作业时通常要怎样？",
            "为什么还要关注相似性风险？",
        ),
    ),
    questions=_stage_quiz(
        ("把别人画的画说成自己的，可以吗？", ("不可以", "可以", "只要好看就行"), "a", "要尊重他人作品。"),
        ("更合适的做法是？", ("参考后自己表达并按要求说明", "整段照抄不说明", "上传他人隐私当素材"), "a", "诚信与说明很重要。"),
        ("AI 生成内容用于作业时，常见要求是？", ("按课程披露辅助范围", "隐瞒来源", "禁止思考"), "a", "披露是负责任使用。"),
        ("版权主要保护？", ("表达形式与权利边界", "天气温度", "键盘颜色"), "a", "关注作品与授权。"),
    ),
    common_question=("原创最强调？", ("自己的思考与表达", "复制得越快越好", "隐藏来源"), "a", "诚实表达是基础。"),
    challenge=("用 AI 生成海报参加比赛，较合适？", ("确认规则并标注辅助", "冒充全手绘获奖", "抄袭后删记录"), "a", "遵守规则与披露。"),
)


_WHAT_IS_DATA = Topic(
    code="data_literacy.what_is_data",
    title="什么是数据",
    chapter="可记录的信息",
    aliases=("数据", "什么是数据", "data", "信息记录"),
    lessons=_lessons(
        strategy="record-and-use",
        goal=(
            "知道数据就是被记录下来的信息。",
            "能举出生活中的数据例子。",
            "理解原始数据需要整理才能更好使用。",
            "能区分数据、信息与结论三个层次。",
        ),
        explanation=(
            "考试分数、身高等被记下来，就成为数据。数据帮助我们了解情况。",
            "数据是可记录、可处理的事实或观测。表格、传感器读数都是常见数据。",
            "原始数据可能杂乱，需要清洗、分类后才能分析。数据质量影响后续结论。",
            "数据经处理成为信息，再解释形成结论。分析中要说明来源与局限。",
        ),
        example=(
            "点名表上的姓名就是一种数据。",
            "一周的气温记录。",
            "把问卷答案整理成表格。",
            "由销量数据得出“周末更好卖”的结论并说明依据。",
        ),
        check=(
            "数据是什么？",
            "生活中有哪些数据？",
            "为什么要整理数据？",
            "数据和结论有什么不同？",
        ),
    ),
    questions=_stage_quiz(
        ("被记下来的分数更像？", ("数据", "天气本身无法记录", "电源开关"), "a", "记录下来的信息是数据。"),
        ("下列哪项是数据例子？", ("身高测量值", "空想且未记录的感觉", "未发生的谣言"), "a", "可记录观测才是。"),
        ("原始数据很乱时，应先？", ("整理与清洗", "直接下绝对结论", "删掉全部来源"), "a", "质量影响分析。"),
        ("由数据到结论，中间通常需要？", ("处理与解释", "删除证据", "停止记录"), "a", "信息与解释连接二者。"),
    ),
    common_question=("数据的基本特点是？", ("可记录、可处理", "必须是图片", "不能是数字"), "a", "记录与处理是关键。"),
    challenge=("班级调查后只看平均数，还应注意？", ("来源、范围与是否有偏", "平均数一定代表每个人", "不用再记录"), "a", "结论要看局限。"),
)


_PRIVACY_BASICS = Topic(
    code="data_literacy.privacy_basics",
    title="隐私保护",
    chapter="哪些信息要小心分享",
    aliases=("隐私", "隐私保护", "个人信息", "privacy"),
    lessons=_lessons(
        strategy="share-with-care",
        goal=(
            "知道住址、密码等不能随便告诉别人或 AI。",
            "能识别常见的敏感个人信息。",
            "理解最小必要原则：能不传就不传。",
            "能在数字场景中制定隐私自我保护步骤。",
        ),
        explanation=(
            "家庭住址、电话、密码是重要秘密。不要发到公开聊天或随便告诉 AI。",
            "隐私信息一旦泄露可能被滥用。提问学习时，尽量用一般问题，避免真实身份细节。",
            "分享前问自己：对方是否需要这些信息？能脱敏就脱敏，能不传就不传。",
            "隐私保护包括权限管理、最小化收集、避免二次传播。未成年人场景更应遵循监护与校园规范。",
        ),
        example=(
            "可以说喜欢恐龙，不要说自家门牌号。",
            "用“某城市某学校”代替真实全名地址。",
            "截图打码后再分享。",
            "检查 App 权限，关闭不必要的定位与通讯录访问。",
        ),
        check=(
            "哪些信息更要保密？",
            "向 AI 提问时应注意什么？",
            "什么是最小必要？",
            "发现自己信息被传播应怎么做？",
        ),
    ),
    questions=_stage_quiz(
        ("不该随便告诉 AI 的是？", ("家庭住址和密码", "公开课名称", "普通数学题"), "a", "敏感信息要保护。"),
        ("更安全的提问方式是？", ("去掉真实身份细节", "粘贴全班通讯录", "上传证件照片"), "a", "最小化个人信息。"),
        ("最小必要原则强调？", ("只提供完成任务所需信息", "越多隐私越好", "公开全部数据"), "a", "够用即可。"),
        ("发现隐私泄露，较合适？", ("告知家长老师并寻求帮助", "继续扩散", "不理睬"), "a", "及时求助很重要。"),
    ),
    common_question=("隐私保护的核心是？", ("谨慎分享个人信息", "把密码告诉所有人", "关闭所有学习"), "a", "控制分享边界。"),
    challenge=("用公开 AI 润色作文时，应避免？", ("粘贴含真实姓名地址的全文", "粘贴不含隐私的段落", "自己再检查一遍"), "a", "先脱敏再使用。"),
)


TOPICS = (
    _IMAGE_CLASSIFICATION,
    _RESPONSIBLE_AI,
    _TRAIN_TEST_SPLIT,
    _NEURAL_NETWORK_BASICS,
    _OVERFITTING,
    _FEATURES_LABELS,
    _HALLUCINATION,
    _WHAT_IS_ALGORITHM,
    _LOOP_BASICS,
    _SUPERVISED_LEARNING,
    _CLASSIFICATION_REGRESSION,
    _DATA_BIAS,
    _PROMPT_BASICS,
    _COPYRIGHT_ORIGINALITY,
    _WHAT_IS_DATA,
    _PRIVACY_BASICS,
)


def resolve_topic(question: str, context_topic: object) -> Topic | str | None:
    """An explicit question wins; otherwise retain the selected topic."""
    normalized = question.casefold().replace(" ", "")
    compact = normalized.replace(" ", "")
    if "冒泡排序" in normalized or "bubblesort" in compact:
        return "sorting.bubble_sort"
    if "选择排序" in normalized or "selectionsort" in compact:
        return "sorting.selection_sort"
    if "插入排序" in normalized or "insertionsort" in compact:
        return "sorting.insertion_sort"
    if "二分查找" in normalized or "二分搜索" in normalized or "binarysearch" in compact:
        return "searching.binary_search"
    if (
        "线性查找" in normalized
        or "顺序查找" in normalized
        or "linearsearch" in compact
    ):
        return "searching.linear_search"
    for topic in TOPICS:
        if any(alias in normalized for alias in topic.aliases):
            return topic
    # An explicit new definition request must not silently reuse an older lesson.
    if ("什么是" in normalized or "是什么" in normalized) and not normalized.startswith(
        ("它", "这", "那", "这个")
    ):
        return None
    if isinstance(context_topic, str):
        if "冒泡排序" in context_topic:
            return "sorting.bubble_sort"
        if "选择排序" in context_topic:
            return "sorting.selection_sort"
        if "插入排序" in context_topic:
            return "sorting.insertion_sort"
        if "二分查找" in context_topic or "二分搜索" in context_topic:
            return "searching.binary_search"
        if "线性查找" in context_topic or "顺序查找" in context_topic:
            return "searching.linear_search"
        context_text = context_topic.casefold().replace(" ", "")
        for topic in TOPICS:
            if any(alias in context_text for alias in topic.aliases):
                return topic
    return None


def lesson_for(topic: Topic, stage: str) -> dict[str, str]:
    lesson = topic.lessons[stage]
    return {
        "strategy": lesson.strategy,
        "learning_goal": lesson.goal,
        "explanation": lesson.explanation,
        "example": lesson.example,
        "understanding_check": lesson.check,
    }


def quiz_for(topic: Topic, stage: str, mastery: int | None) -> dict[str, Any]:
    level = "STANDARD"
    question_stage = stage
    if mastery is not None and mastery < 60:
        level = "REINFORCE"
        if stage in {"middle_school", "high_school"}:
            question_stage = "upper_primary"
    questions = [
        _question(f"{topic.code}.stage", topic.questions[question_stage]),
        _question(f"{topic.code}.common", topic.common_question),
    ]
    if mastery is not None and mastery >= 80:
        level = "EXTEND"
        questions.append(_question(f"{topic.code}.challenge", topic.challenge))
    return {
        "schemaVersion": "1.0",
        "gameType": "multiple-choice-quiz",
        "scoringMode": "RECORDED_PRACTICE",
        "knowledgeCode": topic.code,
        "practiceLevel": level,
        "title": f"{topic.title}课堂小测",
        "instructions": "选择答案后提交。练习结果会保存，但不计入正式作业或考试成绩。",
        "maxScore": sum(question["points"] for question in questions),
        "questions": questions,
    }


def _question(identifier: str, data: tuple[str, tuple[str, ...], str, str]) -> dict[str, Any]:
    prompt, options, correct_option_id, explanation = data
    return {
        "id": identifier,
        "prompt": prompt,
        "options": [
            {"id": chr(ord("a") + index), "text": option} for index, option in enumerate(options)
        ],
        "correctOptionId": correct_option_id,
        "explanation": explanation,
        "points": 10,
    }
