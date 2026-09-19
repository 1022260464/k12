package com.k12.platform.assessment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.HomeworkQuestionRequest;
import com.k12.platform.assessment.dto.HomeworkQuestionResponse;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("题目 JSON 批量导入")
class QuestionImportServiceTest {

    private static final Long HOMEWORK_ID = 88L;

    @Mock HomeworkQuestionService questions;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private QuestionImportService service() {
        return new QuestionImportService(objectMapper, validator, questions);
    }

    @Test
    @DisplayName("合法模板应按序创建题目")
    void shouldImportQuestionsInOrder() {
        when(questions.create(eq(HOMEWORK_ID), any(HomeworkQuestionRequest.class)))
                .thenAnswer(invocation -> {
                    HomeworkQuestionRequest request = invocation.getArgument(1);
                    return new HomeworkQuestionResponse(1L, HOMEWORK_ID, request.type().name(), request.stem(),
                            request.score(), request.sortOrder(), List.of(), List.of(),
                            request.referenceAnswer(), request.analysis(), false);
                });

        var file = jsonFile("""
                {
                  "version": 1,
                  "questions": [{
                    "type": "SINGLE_CHOICE",
                    "stem": "下面哪项是机器学习的常见应用？",
                    "score": 10,
                    "sortOrder": 1,
                    "options": [
                      { "key": "A", "content": "图像分类", "sortOrder": 1 },
                      { "key": "B", "content": "手工抄写", "sortOrder": 2 }
                    ],
                    "correctAnswers": ["A"],
                    "referenceAnswer": null,
                    "analysis": "图像分类可以由机器学习模型完成。"
                  }]
                }
                """);

        assertThat(service().importBatch(HOMEWORK_ID, file)).hasSize(1);
        ArgumentCaptor<HomeworkQuestionRequest> captor = ArgumentCaptor.forClass(HomeworkQuestionRequest.class);
        verify(questions).create(eq(HOMEWORK_ID), captor.capture());
        assertThat(captor.getValue().type()).isEqualTo(HomeworkQuestionRequest.QuestionType.SINGLE_CHOICE);
        assertThat(captor.getValue().correctAnswers()).containsExactly("A");
    }

    @Test
    @DisplayName("空文件或非 JSON 必须拒绝")
    void shouldRejectInvalidFile() {
        var empty = new MockMultipartFile("file", "questions.json", "application/json", new byte[0]);
        assertThatThrownBy(() -> service().importBatch(HOMEWORK_ID, empty))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("512 KB");
        verify(questions, never()).create(any(), any());
    }

    @Test
    @DisplayName("version 错误时应在创建前失败")
    void shouldRejectWrongVersion() {
        var file = jsonFile("""
                { "version": 9, "questions": [{
                  "type": "SHORT_ANSWER", "stem": "简述监督学习", "score": 5, "sortOrder": 1,
                  "options": null, "correctAnswers": null, "referenceAnswer": "参考", "analysis": null
                }] }
                """);
        assertThatThrownBy(() -> service().importBatch(HOMEWORK_ID, file))
                .isInstanceOf(IllegalArgumentException.class);
        verify(questions, never()).create(any(), any());
    }

    private static MockMultipartFile jsonFile(String content) {
        return new MockMultipartFile("file", "question-import.json", "application/json",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
