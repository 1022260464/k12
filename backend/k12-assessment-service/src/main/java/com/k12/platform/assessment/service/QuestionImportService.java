package com.k12.platform.assessment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.HomeworkQuestionResponse;
import com.k12.platform.assessment.dto.QuestionImportDocument;
import jakarta.validation.Validator;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class QuestionImportService {
    private static final long MAX_BYTES = 512 * 1024;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final HomeworkQuestionService questions;

    public QuestionImportService(ObjectMapper objectMapper, Validator validator, HomeworkQuestionService questions) {
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.questions = questions;
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:create')")
    public List<HomeworkQuestionResponse> importBatch(Long homeworkId, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES
                || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".json")) {
            throw new IllegalArgumentException("请选择不超过 512 KB 的 JSON 题目文件");
        }
        QuestionImportDocument document;
        try {
            document = objectMapper.readerFor(QuestionImportDocument.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(file.getBytes());
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("题目文件 JSON 格式或字段不正确", error);
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取题目文件", error);
        }
        var violations = validator.validate(document);
        if (!violations.isEmpty()) {
            var first = violations.iterator().next();
            throw new IllegalArgumentException(first.getPropertyPath() + ": " + first.getMessage());
        }
        List<HomeworkQuestionResponse> result = new ArrayList<>();
        for (var question : document.questions()) {
            result.add(questions.create(homeworkId, question));
        }
        return result;
    }
}
