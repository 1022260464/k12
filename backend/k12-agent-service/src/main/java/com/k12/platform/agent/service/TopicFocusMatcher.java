package com.k12.platform.agent.service;

import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

/**
 * 从学生提问文本粗匹配知识点编码，供教学上下文在 Runtime 定题前选定图谱焦点。
 * 规则与 Runtime {@code topics.py} 常用别名对齐，宁可少匹配也不要落到「掌握度最弱」的无关点。
 */
final class TopicFocusMatcher {

    private record Rule(String code, String... needles) {}

    /** 更具体的别名靠前，避免「数据」等宽词抢先。 */
    private static final List<Rule> RULES = List.of(
            new Rule("sorting.bubble_sort", "冒泡排序", "bubblesort"),
            new Rule("sorting.selection_sort", "选择排序", "selectionsort"),
            new Rule("sorting.insertion_sort", "插入排序", "insertionsort"),
            new Rule("searching.binary_search", "二分查找", "二分搜索", "binarysearch"),
            new Rule("searching.linear_search", "线性查找", "顺序查找", "linearsearch"),
            new Rule("machine_learning.image_classification", "图像分类", "图片分类", "图像识别"),
            new Rule("machine_learning.features_labels", "特征与标签", "特征和标签", "特征", "标签", "feature", "label"),
            new Rule("machine_learning.supervised_learning", "监督学习", "有监督"),
            new Rule("machine_learning.classification_regression", "分类与回归", "回归"),
            new Rule("machine_learning.train_test_split", "训练集", "测试集", "训练测试"),
            new Rule("machine_learning.overfitting", "过拟合"),
            new Rule("machine_learning.data_bias", "数据偏差", "样本偏差"),
            new Rule("machine_learning.neural_network_basics", "神经网络"),
            new Rule("generative_ai.hallucination", "幻觉", "hallucination", "胡编", "编造"),
            new Rule("generative_ai.prompt_basics", "提示词", "prompt", "怎么问ai"),
            new Rule("generative_ai.copyright_originality", "版权", "原创", "抄袭"),
            new Rule("generative_ai.responsible_use", "负责任", "安全使用", "负责任使用"),
            new Rule("computing.loop_basics", "循环基础", "循环", "迭代"),
            new Rule("computing.algorithm_basics", "算法入门", "什么是算法", "算法就是"),
            new Rule("data_literacy.privacy_basics", "隐私", "个人信息"),
            new Rule("data_literacy.what_is_data", "什么是数据", "数据是什么", "什么叫数据", "数据")
    );

    private TopicFocusMatcher() {
    }

    static String match(String inputText) {
        if (!StringUtils.hasText(inputText)) {
            return null;
        }
        String normalized = inputText.toLowerCase(Locale.ROOT).replace(" ", "").replace("　", "");
        for (Rule rule : RULES) {
            for (String needle : rule.needles()) {
                if (normalized.contains(needle.toLowerCase(Locale.ROOT).replace(" ", ""))) {
                    return rule.code();
                }
            }
        }
        return null;
    }
}
