package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.HomeworkQuestionRequest;
import com.k12.platform.assessment.dto.HomeworkQuestionResponse;
import com.k12.platform.assessment.dto.QuestionOptionRequest;
import com.k12.platform.assessment.dto.QuestionOptionResponse;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.mapper.HomeworkQuestionMapper;
import com.k12.platform.assessment.mapper.QuestionOptionMapper;
import com.k12.platform.assessment.model.Homework;
import com.k12.platform.assessment.model.HomeworkQuestion;
import com.k12.platform.assessment.model.QuestionOption;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/** 作业题目聚合服务：题目与选项必须在一个事务内共同保存。 */
@Service
public class HomeworkQuestionService {

    private final HomeworkMapper homeworkMapper;
    private final HomeworkQuestionMapper questionMapper;
    private final QuestionOptionMapper optionMapper;
    private final ObjectMapper objectMapper;

    public HomeworkQuestionService(HomeworkMapper homeworkMapper, HomeworkQuestionMapper questionMapper,
                                   QuestionOptionMapper optionMapper, ObjectMapper objectMapper) {
        this.homeworkMapper = homeworkMapper;
        this.questionMapper = questionMapper;
        this.optionMapper = optionMapper;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public List<HomeworkQuestionResponse> list(Long homeworkId) {
        Homework homework = homeworkMapper.findVisibleById(homeworkId, K12SecurityContext.requireUserId(), isAdmin());
        if (homework == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在或当前用户无权查看");
        }
        boolean answerVisible = isAdmin()
                || K12SecurityContext.requireUserId().equals(homework.getTeacherUserId())
                || "CLOSED".equals(homework.getStatus());
        return questionMapper.findByHomeworkId(homeworkId).stream()
                .map(question -> toResponse(question, answerVisible)).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_CREATE + "')")
    public HomeworkQuestionResponse create(Long homeworkId, HomeworkQuestionRequest request) {
        Homework homework = requireEditableHomework(homeworkId);
        validateRequest(request);
        HomeworkQuestion question = new HomeworkQuestion();
        copy(question, homeworkId, request);
        question.setDeleted(0);
        questionMapper.insert(question);
        replaceOptions(question.getId(), request.options());
        requireTotalWithinLimit(homework.getId());
        return toResponse(questionMapper.selectById(question.getId()), true);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public HomeworkQuestionResponse update(Long homeworkId, Long questionId, HomeworkQuestionRequest request) {
        requireEditableHomework(homeworkId);
        HomeworkQuestion question = requireQuestion(homeworkId, questionId);
        validateRequest(request);
        copy(question, homeworkId, request);
        questionMapper.updateById(question);
        optionMapper.delete(Wrappers.<QuestionOption>lambdaQuery().eq(QuestionOption::getQuestionId, questionId));
        replaceOptions(questionId, request.options());
        requireTotalWithinLimit(homeworkId);
        return toResponse(questionMapper.selectById(questionId), true);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public void delete(Long homeworkId, Long questionId) {
        requireEditableHomework(homeworkId);
        requireQuestion(homeworkId, questionId);
        optionMapper.delete(Wrappers.<QuestionOption>lambdaQuery().eq(QuestionOption::getQuestionId, questionId));
        questionMapper.deleteById(questionId);
    }

    private Homework requireEditableHomework(Long homeworkId) {
        Homework homework = homeworkMapper.selectForUpdate(homeworkId);
        if (homework == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        }
        if (!isAdmin() && !K12SecurityContext.requireUserId().equals(homework.getTeacherUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能维护自己创建的作业");
        }
        if (!"DRAFT".equals(homework.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "只有草稿作业可以修改题目");
        }
        return homework;
    }

    private HomeworkQuestion requireQuestion(Long homeworkId, Long questionId) {
        HomeworkQuestion question = questionMapper.selectById(questionId);
        if (question == null || !homeworkId.equals(question.getHomeworkId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "题目不存在");
        }
        return question;
    }

    private void validateRequest(HomeworkQuestionRequest request) {
        List<QuestionOptionRequest> options = request.options() == null ? List.of() : request.options();
        List<String> answers = normalize(request.correctAnswers());
        if (request.type() == HomeworkQuestionRequest.QuestionType.SINGLE_CHOICE
                || request.type() == HomeworkQuestionRequest.QuestionType.MULTIPLE_CHOICE) {
            if (options.size() < 2) {
                throw new IllegalArgumentException("选择题至少需要两个选项");
            }
            var keys = new HashSet<String>();
            for (QuestionOptionRequest option : options) {
                if (!keys.add(option.key().toUpperCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("选项 key 不能重复");
                }
            }
            if (answers.isEmpty() || !keys.containsAll(answers)) {
                throw new IllegalArgumentException("正确答案必须来自已有选项");
            }
            if (request.type() == HomeworkQuestionRequest.QuestionType.SINGLE_CHOICE && answers.size() != 1) {
                throw new IllegalArgumentException("单选题只能设置一个正确答案");
            }
        } else if (request.type() == HomeworkQuestionRequest.QuestionType.TRUE_FALSE) {
            if (answers.size() != 1 || !(answers.get(0).equals("TRUE") || answers.get(0).equals("FALSE"))) {
                throw new IllegalArgumentException("判断题正确答案只能是 TRUE 或 FALSE");
            }
        } else if (request.referenceAnswer() == null || request.referenceAnswer().isBlank()) {
            throw new IllegalArgumentException("简答题必须填写参考答案");
        }
    }

    private void copy(HomeworkQuestion target, Long homeworkId, HomeworkQuestionRequest request) {
        target.setHomeworkId(homeworkId);
        target.setQuestionType(request.type().name());
        target.setStem(request.stem().trim());
        target.setScore(request.score());
        target.setSortOrder(request.sortOrder());
        target.setCorrectAnswersJson(writeJson(normalize(request.correctAnswers())));
        target.setReferenceAnswer(trimToNull(request.referenceAnswer()));
        target.setAnalysis(trimToNull(request.analysis()));
    }

    private void replaceOptions(Long questionId, List<QuestionOptionRequest> requests) {
        if (requests == null) {
            return;
        }
        for (QuestionOptionRequest request : requests) {
            QuestionOption option = new QuestionOption();
            option.setQuestionId(questionId);
            option.setOptionKey(request.key().toUpperCase(Locale.ROOT));
            option.setContent(request.content().trim());
            option.setSortOrder(request.sortOrder());
            option.setDeleted(0);
            optionMapper.insert(option);
        }
    }

    private void requireTotalWithinLimit(Long homeworkId) {
        if (questionMapper.totalScore(homeworkId).compareTo(new BigDecimal("100.00")) > 0) {
            throw new IllegalArgumentException("作业题目总分不能超过 100 分");
        }
    }

    private HomeworkQuestionResponse toResponse(HomeworkQuestion question, boolean answerVisible) {
        List<QuestionOptionResponse> options = optionMapper.findByQuestionId(question.getId()).stream()
                .map(option -> new QuestionOptionResponse(option.getId(), option.getOptionKey(),
                        option.getContent(), option.getSortOrder())).toList();
        return new HomeworkQuestionResponse(question.getId(), question.getHomeworkId(),
                question.getQuestionType(), question.getStem(), question.getScore(), question.getSortOrder(), options,
                answerVisible ? readJson(question.getCorrectAnswersJson()) : List.of(),
                answerVisible ? question.getReferenceAnswer() : null,
                answerVisible ? question.getAnalysis() : null, answerVisible);
    }

    private List<String> normalize(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream().filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase(Locale.ROOT)).distinct().sorted().toList();
    }

    private String writeJson(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("答案格式错误", exception);
        }
    }

    private List<String> readJson(String value) {
        try {
            return value == null ? List.of() : objectMapper.readValue(value, new TypeReference<>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库中的标准答案格式错误", exception);
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isAdmin() {
        return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN);
    }
}
