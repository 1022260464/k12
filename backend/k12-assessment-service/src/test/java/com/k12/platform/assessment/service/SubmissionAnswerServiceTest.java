package com.k12.platform.assessment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.SubmissionAnswerRequest;
import com.k12.platform.assessment.mapper.*;
import com.k12.platform.assessment.model.HomeworkQuestion;
import com.k12.platform.assessment.model.HomeworkSubmission;
import com.k12.platform.assessment.model.SubmissionAnswer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("结构化答题与自动计分")
class SubmissionAnswerServiceTest {
    private HomeworkQuestionMapper questionMapper;
    private HomeworkSubmissionMapper submissionMapper;
    private SubmissionAnswerMapper answerMapper;
    private SubmissionAnswerService service;

    @BeforeEach
    void setUp() {
        questionMapper = mock(HomeworkQuestionMapper.class);
        submissionMapper = mock(HomeworkSubmissionMapper.class);
        answerMapper = mock(SubmissionAnswerMapper.class);
        service = new SubmissionAnswerService(
                mock(HomeworkMapper.class), questionMapper, submissionMapper, answerMapper,
                mock(HomeworkGradeHistoryMapper.class), new ObjectMapper());
    }

    @Test
    @DisplayName("客观题答案完全匹配时自动获得该题满分")
    void autoGradesObjectiveAnswer() {
        HomeworkQuestion question = question(10L, "SINGLE_CHOICE", "[\"B\"]", "20.00");
        when(questionMapper.findByHomeworkId(1L)).thenReturn(List.of(question));
        HomeworkSubmission submission = submission();

        service.saveSubmittedAnswers(submission,
                List.of(new SubmissionAnswerRequest(10L, List.of("b"), null)));

        ArgumentCaptor<SubmissionAnswer> captor = ArgumentCaptor.forClass(SubmissionAnswer.class);
        verify(answerMapper).insert(captor.capture());
        assertThat(captor.getValue().getFinalScore()).isEqualByComparingTo("20.00");
        assertThat(captor.getValue().getGradingStatus()).isEqualTo("AUTO_GRADED");
        assertThat(submission.getStatus()).isEqualTo("GRADED");
        assertThat(submission.getScore()).isEqualByComparingTo("20.00");
        verify(submissionMapper).updateById(submission);
    }

    @Test
    @DisplayName("简答题提交后进入待批改，不能伪造最终成绩")
    void keepsSubjectiveAnswerPending() {
        HomeworkQuestion question = question(11L, "SHORT_ANSWER", "[]", "30.00");
        when(questionMapper.findByHomeworkId(1L)).thenReturn(List.of(question));
        HomeworkSubmission submission = submission();

        service.saveSubmittedAnswers(submission,
                List.of(new SubmissionAnswerRequest(11L, List.of(), "我的解题过程")));

        ArgumentCaptor<SubmissionAnswer> captor = ArgumentCaptor.forClass(SubmissionAnswer.class);
        verify(answerMapper).insert(captor.capture());
        assertThat(captor.getValue().getFinalScore()).isNull();
        assertThat(captor.getValue().getGradingStatus()).isEqualTo("PENDING_REVIEW");
        assertThat(submission.getStatus()).isEqualTo("PENDING_GRADING");
        assertThat(submission.getScore()).isNull();
    }

    @Test
    @DisplayName("有结构化题目时不允许只提交旧版文本答案")
    void rejectsMissingStructuredAnswers() {
        when(questionMapper.findByHomeworkId(1L))
                .thenReturn(List.of(question(10L, "SINGLE_CHOICE", "[\"A\"]", "10")));
        assertThatThrownBy(() -> service.saveSubmittedAnswers(submission(), List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("必须提交 answers");
        verify(answerMapper, never()).insert(any(SubmissionAnswer.class));
    }

    private HomeworkQuestion question(Long id, String type, String answers, String score) {
        HomeworkQuestion question = new HomeworkQuestion();
        question.setId(id);
        question.setHomeworkId(1L);
        question.setQuestionType(type);
        question.setStem("测试题");
        question.setCorrectAnswersJson(answers);
        question.setScore(new BigDecimal(score));
        return question;
    }

    private HomeworkSubmission submission() {
        HomeworkSubmission submission = new HomeworkSubmission();
        submission.setId(2L);
        submission.setHomeworkId(1L);
        submission.setStatus("SUBMITTED");
        submission.setVersion(0);
        return submission;
    }
}
