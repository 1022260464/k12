package com.k12.platform.learning.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.mapper.VisualProgrammingMissionMapper;
import com.k12.platform.learning.model.VisualProgrammingMission;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@ExtendWith(MockitoExtension.class)
class VisualProgrammingEvaluatorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private VisualProgrammingMissionMapper missionMapper;

    private VisualProgrammingEvaluator evaluator;

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
        evaluator = new VisualProgrammingEvaluator(missionMapper, registry, objectMapper);
    }

    @Test
    void acceptsCorrectTrainingDataMission() throws Exception {
        stubPublished("label-training-data", "DATA_LABELING", """
                {"expectedLabels":{"cat-1":"cat","cat-2":"cat","dog-1":"dog","dog-2":"dog"},
                 "requiredClasses":["cat","dog"],"requireTrain":true}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"cat-1","CATEGORY":"cat"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"cat-2","CATEGORY":"cat"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"dog-1","CATEGORY":"dog"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"dog-2","CATEGORY":"dog"},"next":{"block":
                  {"type":"k12_train_classifier"}}}}}}}}}}}]}}
                """);

        var result = evaluator.evaluate("label-training-data", workspace);

        assertThat(result.passed()).isTrue();
        assertThat(result.stars()).isEqualTo(3);
    }

    @Test
    void rejectsPredictionWithoutConditionalResponse() throws Exception {
        stubPublished("predict-and-decide", "PREDICTION_BRANCH", """
                {"imageId":"mystery-cat","expectedCategory":"cat","messageKeyword":"猫","requireTrain":true}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_train_classifier","next":{"block":
                  {"type":"k12_predict_image","fields":{"IMAGE":"mystery-cat"}}}}}}]}}
                """);

        var result = evaluator.evaluate("predict-and-decide", workspace);

        assertThat(result.passed()).isFalse();
        assertThat(result.stars()).isEqualTo(2);
    }

    @Test
    void acceptsRepeatedRobotRoute() throws Exception {
        stubPublished("repeat-a-route", "LOOP_ROUTE", """
                {"minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"controls_repeat_ext","inputs":{
                    "TIMES":{"shadow":{"type":"math_number","fields":{"NUM":4}}},
                    "DO":{"block":{"type":"k12_move","fields":{"STEPS":2}}}},
                   "next":{"block":{"type":"k12_say","fields":{"MESSAGE":"任务完成"}}}}}}]}}
                """);

        var result = evaluator.evaluate("repeat-a-route", workspace);

        assertThat(result.passed()).isTrue();
        assertThat(result.stars()).isEqualTo(3);
    }

    @Test
    void acceptsConfidenceGate() throws Exception {
        stubPublished("confidence-gate", "CONFIDENCE_GATE", """
                {"imageId":"mystery-cat","predictionCategory":"cat","simulatedConfidence":92,
                 "minimumThreshold":80,"messageKeyword":"很有把握"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_train_classifier","next":{"block":
                  {"type":"k12_predict_image","fields":{"IMAGE":"mystery-cat"},"next":{"block":
                  {"type":"controls_if","inputs":{
                    "IF0":{"block":{"type":"k12_confidence_at_least","fields":{"THRESHOLD":80}}},
                    "DO0":{"block":{"type":"k12_say","fields":{"MESSAGE":"我很有把握"}}}}}}}}}}}]} }
                """);

        var result = evaluator.evaluate("confidence-gate", workspace);

        assertThat(result.passed()).isTrue();
        assertThat(result.stars()).isEqualTo(3);
    }

    @Test
    void acceptsCampusPatrolChallenge() throws Exception {
        stubPublished("campus-ai-patrol", "AGENT_PATROL", """
                {"imageId":"mystery-dog","expectedCategory":"dog","minRepeatTimes":2,"maxRepeatTimes":10,
                 "minDistance":8,"messageKeyword":"巡检完成"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_train_classifier","next":{"block":
                  {"type":"k12_predict_image","fields":{"IMAGE":"mystery-dog"},"next":{"block":
                  {"type":"controls_if","inputs":{
                    "IF0":{"block":{"type":"k12_prediction_equals","fields":{"CATEGORY":"dog"}}},
                    "DO0":{"block":{"type":"controls_repeat_ext","inputs":{
                      "TIMES":{"shadow":{"type":"math_number","fields":{"NUM":4}}},
                      "DO":{"block":{"type":"k12_move","fields":{"STEPS":2}}}},
                      "next":{"block":{"type":"k12_say","fields":{"MESSAGE":"巡检完成"}}}}}}}}}}}}}]} }
                """);

        var result = evaluator.evaluate("campus-ai-patrol", workspace);

        assertThat(result.passed()).isTrue();
        assertThat(result.stars()).isEqualTo(3);
    }

    @Test
    void rejectsDisallowedBlocks() throws Exception {
        stubPublished("repeat-a-route", "LOOP_ROUTE", """
                {"minRepeatTimes":2,"maxRepeatTimes":10,"minDistance":8,"messageKeyword":"任务完成"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_train_classifier"}}}]}}
                """);

        assertThatThrownBy(() -> evaluator.evaluate("repeat-a-route", workspace))
                .hasMessageContaining("不允许的积木")
                .extracting("statusCode").isEqualTo(BAD_REQUEST);
    }

    @Test
    void acceptsBalancedTrainingData() throws Exception {
        stubPublished("balance-training-data", "DATA_BALANCE", """
                {"requiredClasses":["cat","dog"],"minSamplesPerClass":2,
                 "maxDifference":0,"messageKeyword":"数据要均衡"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"cat-1","CATEGORY":"cat"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"cat-2","CATEGORY":"cat"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"dog-1","CATEGORY":"dog"},"next":{"block":
                  {"type":"k12_label_image","fields":{"IMAGE":"dog-2","CATEGORY":"dog"},"next":{"block":
                  {"type":"k12_check_balance","next":{"block":
                  {"type":"k12_say","fields":{"MESSAGE":"数据要均衡"}}}}}}}}}}}}}}]} }
                """);
        assertThat(evaluator.evaluate("balance-training-data", workspace).passed()).isTrue();
    }

    @Test
    void acceptsQuizGame() throws Exception {
        stubPublished("ai-knowledge-quiz", "QUIZ_GAME", """
                {"expectedAnswers":["b","b","a"],"passScore":3}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_quiz_answer","fields":{"QUESTION":"q1","ANSWER":"b"},"next":{"block":
                  {"type":"k12_quiz_answer","fields":{"QUESTION":"q2","ANSWER":"b"},"next":{"block":
                  {"type":"k12_quiz_answer","fields":{"QUESTION":"q3","ANSWER":"a"},"next":{"block":
                  {"type":"k12_submit_quiz"}}}}}}}}}]} }
                """);
        assertThat(evaluator.evaluate("ai-knowledge-quiz", workspace).passed()).isTrue();
    }

    @Test
    void acceptsSequenceStory() throws Exception {
        stubPublished("ai-sequence-story", "SEQUENCE_STORY", """
                {"requiredScenes":["classroom","lab","future"],"minWaitSeconds":1,
                 "messageKeyword":"故事结束"}
                """);
        JsonNode workspace = objectMapper.readTree("""
                {"blocks":{"blocks":[{"type":"k12_when_start","next":{"block":
                  {"type":"k12_switch_scene","fields":{"SCENE":"classroom"},"next":{"block":
                  {"type":"k12_wait","fields":{"SECONDS":1},"next":{"block":
                  {"type":"k12_switch_scene","fields":{"SCENE":"lab"},"next":{"block":
                  {"type":"k12_wait","fields":{"SECONDS":1},"next":{"block":
                  {"type":"k12_switch_scene","fields":{"SCENE":"future"},"next":{"block":
                  {"type":"k12_say","fields":{"MESSAGE":"故事结束"}}}}}}}}}}}}}}]} }
                """);
        assertThat(evaluator.evaluate("ai-sequence-story", workspace).passed()).isTrue();
    }

    private void stubPublished(String missionCode, String templateCode, String configJson) {
        VisualProgrammingMission mission = new VisualProgrammingMission();
        mission.setMissionCode(missionCode);
        mission.setTemplateCode(templateCode);
        mission.setStatus("PUBLISHED");
        mission.setConfigJson(configJson);
        when(missionMapper.selectOne(any())).thenReturn(mission);
    }
}
