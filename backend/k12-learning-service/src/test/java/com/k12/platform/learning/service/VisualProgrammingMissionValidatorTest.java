package com.k12.platform.learning.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.service.visualmission.AgentPatrolMissionTemplate;
import com.k12.platform.learning.service.visualmission.ConfidenceGateMissionTemplate;
import com.k12.platform.learning.service.visualmission.DataLabelingMissionTemplate;
import com.k12.platform.learning.service.visualmission.DataBalanceMissionTemplate;
import com.k12.platform.learning.service.visualmission.LoopRouteMissionTemplate;
import com.k12.platform.learning.service.visualmission.PredictionBranchMissionTemplate;
import com.k12.platform.learning.service.visualmission.QuizGameMissionTemplate;
import com.k12.platform.learning.service.visualmission.SequenceStoryMissionTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VisualProgrammingMissionValidatorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private VisualProgrammingMissionValidator validator;

    @BeforeEach
    void setUp() {
        VisualProgrammingMissionTemplateRegistry registry = new VisualProgrammingMissionTemplateRegistry(List.of(
                new DataLabelingMissionTemplate(),
                new PredictionBranchMissionTemplate(),
                new LoopRouteMissionTemplate(),
                new ConfidenceGateMissionTemplate(),
                new AgentPatrolMissionTemplate(),
                new DataBalanceMissionTemplate(),
                new QuizGameMissionTemplate(),
                new SequenceStoryMissionTemplate()));
        validator = new VisualProgrammingMissionValidator(registry, objectMapper);
    }

    @Test
    void acceptsSeedConfigsForAllTemplates() throws Exception {
        assertThatCode(() -> validator.validateConfig("DATA_LABELING", json("""
                {"expectedLabels":{"cat-1":"cat","cat-2":"cat","dog-1":"dog","dog-2":"dog"},
                 "requiredClasses":["cat","dog"],"requireTrain":true}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("PREDICTION_BRANCH", json("""
                {"imageId":"mystery-cat","expectedCategory":"cat","messageKeyword":"猫","requireTrain":true}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("LOOP_ROUTE", json("""
                {"minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成"}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("CONFIDENCE_GATE", json("""
                {"imageId":"mystery-cat","predictionCategory":"cat","simulatedConfidence":92,
                 "minimumThreshold":80,"messageKeyword":"很有把握"}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("AGENT_PATROL", json("""
                {"imageId":"mystery-dog","expectedCategory":"dog","minRepeatTimes":2,"maxRepeatTimes":10,
                 "minDistance":8,"messageKeyword":"巡检完成"}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("DATA_BALANCE", json("""
                {"requiredClasses":["cat","dog"],"minSamplesPerClass":2,
                 "maxDifference":0,"messageKeyword":"数据要均衡"}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("QUIZ_GAME", json("""
                {"expectedAnswers":["b","b","a"],"passScore":3}
                """))).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateConfig("SEQUENCE_STORY", json("""
                {"requiredScenes":["classroom","lab","future"],"minWaitSeconds":1,
                 "messageKeyword":"故事结束"}
                """))).doesNotThrowAnyException();
    }

    @Test
    void rejectsUnknownTemplate() {
        assertThatThrownBy(() -> validator.requireTemplateCode("UNKNOWN_TEMPLATE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不支持的任务模板");
    }

    @Test
    void rejectsUnknownConfigField() throws Exception {
        assertThatThrownBy(() -> validator.validateConfig("LOOP_ROUTE", json("""
                {"minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成","script":"alert(1)"}
                """)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未声明字段");
    }

    @Test
    void rejectsOutOfRangeValues() throws Exception {
        assertThatThrownBy(() -> validator.validateConfig("CONFIDENCE_GATE", json("""
                {"imageId":"mystery-cat","predictionCategory":"cat","simulatedConfidence":120,
                 "minimumThreshold":80,"messageKeyword":"很有把握"}
                """)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("模拟置信度");

        assertThatThrownBy(() -> validator.validateConfig("LOOP_ROUTE", json("""
                {"minRepeatTimes":0,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成"}
                """)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("最小循环次数");
    }

    private JsonNode json(String raw) throws Exception {
        return objectMapper.readTree(raw);
    }
}
