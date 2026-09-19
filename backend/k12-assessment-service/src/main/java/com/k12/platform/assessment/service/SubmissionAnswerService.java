package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.*;
import com.k12.platform.assessment.mapper.*;
import com.k12.platform.assessment.model.*;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 逐题答案、客观题自动计分和教师复核服务。 */
@Service
public class SubmissionAnswerService {
    private final HomeworkMapper homeworkMapper;
    private final HomeworkQuestionMapper questionMapper;
    private final HomeworkSubmissionMapper submissionMapper;
    private final SubmissionAnswerMapper answerMapper;
    private final HomeworkGradeHistoryMapper historyMapper;
    private final ObjectMapper objectMapper;

    public SubmissionAnswerService(HomeworkMapper homeworkMapper, HomeworkQuestionMapper questionMapper,
                                   HomeworkSubmissionMapper submissionMapper, SubmissionAnswerMapper answerMapper,
                                   HomeworkGradeHistoryMapper historyMapper, ObjectMapper objectMapper) {
        this.homeworkMapper = homeworkMapper;
        this.questionMapper = questionMapper;
        this.submissionMapper = submissionMapper;
        this.answerMapper = answerMapper;
        this.historyMapper = historyMapper;
        this.objectMapper = objectMapper;
    }

    /** 与提交主事务一起调用，任何一道答案不合法都会回滚整个提交。 */
    public void saveSubmittedAnswers(HomeworkSubmission submission, List<SubmissionAnswerRequest> requests) {
        persistAnswers(submission, requests, false);
    }

    /** 退回后重新提交：先清空旧答案再写入新答案。 */
    public void replaceSubmittedAnswers(HomeworkSubmission submission, List<SubmissionAnswerRequest> requests) {
        answerMapper.delete(Wrappers.<SubmissionAnswer>lambdaQuery()
                .eq(SubmissionAnswer::getSubmissionId, submission.getId()));
        persistAnswers(submission, requests, true);
    }

    private void persistAnswers(HomeworkSubmission submission, List<SubmissionAnswerRequest> requests, boolean alreadyUpdated) {
        List<HomeworkQuestion> questions = questionMapper.findByHomeworkId(submission.getHomeworkId());
        if (requests == null || requests.isEmpty()) {
            if (!questions.isEmpty()) {
                throw new IllegalArgumentException("该作业包含结构化题目，必须提交 answers");
            }
            if (alreadyUpdated) {
                submissionMapper.updateById(submission);
            }
            return;
        }
        Map<Long, HomeworkQuestion> byId = questions.stream()
                .collect(Collectors.toMap(HomeworkQuestion::getId, Function.identity()));
        if (requests.size() != questions.size()
                || requests.stream().map(SubmissionAnswerRequest::questionId).distinct().count() != questions.size()) {
            throw new IllegalArgumentException("必须提交该作业的全部题目，且题目不能重复");
        }
        BigDecimal autoTotal = BigDecimal.ZERO;
        boolean hasSubjective = false;
        for (SubmissionAnswerRequest request : requests) {
            HomeworkQuestion question = byId.get(request.questionId());
            if (question == null) {
                throw new IllegalArgumentException("答案中包含不属于当前作业的题目: " + request.questionId());
            }
            SubmissionAnswer answer = new SubmissionAnswer();
            answer.setSubmissionId(submission.getId());
            answer.setQuestionId(question.getId());
            answer.setAnswerJson(writeJson(normalize(request.selectedAnswers())));
            answer.setAnswerText(trimToNull(request.answerText()));
            if ("SHORT_ANSWER".equals(question.getQuestionType())) {
                if (answer.getAnswerText() == null) {
                    throw new IllegalArgumentException("简答题必须填写文本答案");
                }
                answer.setGradingStatus("PENDING_REVIEW");
                hasSubjective = true;
            } else {
                List<String> actual = normalize(request.selectedAnswers());
                BigDecimal score = actual.equals(readJson(question.getCorrectAnswersJson()))
                        ? question.getScore() : BigDecimal.ZERO;
                answer.setAutoScore(score);
                answer.setFinalScore(score);
                answer.setGradingStatus("AUTO_GRADED");
                autoTotal = autoTotal.add(score);
            }
            answerMapper.insert(answer);
        }
        if (hasSubjective) {
            submission.setStatus("PENDING_GRADING");
            submission.setScore(null);
        } else {
            submission.setStatus("GRADED");
            submission.setScore(autoTotal);
            submission.setGradedTime(Instant.now());
        }
        submissionMapper.updateById(submission);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public SubmissionDetailResponse myDetail(Long homeworkId) {
        HomeworkSubmission submission = submissionMapper.findByHomeworkAndStudent(homeworkId,
                K12SecurityContext.requireUserId());
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "尚未提交该作业");
        }
        return detail(submission);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public SubmissionDetailResponse studentDetail(Long homeworkId, Long studentId) {
        Homework homework = requireOwnedHomework(homeworkId);
        HomeworkSubmission submission = submissionMapper.findByHomeworkAndStudent(homework.getId(), studentId);
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该学生的提交记录");
        }
        return detail(submission);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public SubmissionDetailResponse gradeAnswer(Long homeworkId, Long studentId, Long questionId,
                                                SubmissionAnswerGradeRequest request) {
        requireOwnedHomework(homeworkId);
        HomeworkSubmission found = submissionMapper.findByHomeworkAndStudent(homeworkId, studentId);
        if (found == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该学生的提交记录");
        }
        HomeworkSubmission submission = submissionMapper.selectForUpdate(found.getId());
        if (!Objects.equals(submission.getVersion(), request.expectedSubmissionVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "提交记录已被其他请求修改，请刷新后重试");
        }
        HomeworkQuestion question = questionMapper.selectById(questionId);
        SubmissionAnswer answer = answerMapper.findForUpdate(submission.getId(), questionId);
        if (question == null || answer == null || !homeworkId.equals(question.getHomeworkId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该题答案");
        }
        if (request.score().compareTo(question.getScore()) > 0) {
            throw new IllegalArgumentException("评分不能超过该题满分 " + question.getScore());
        }
        answer.setManualScore(request.score());
        answer.setFinalScore(request.score());
        answer.setFeedback(trimToNull(request.feedback()));
        answer.setGradingStatus("MANUAL_GRADED");
        answerMapper.updateById(answer);

        submission.setVersion(submission.getVersion() + 1);
        submission.setGradedBy(K12SecurityContext.requireUserId());
        submission.setGradedTime(Instant.now());
        if (answerMapper.countPending(submission.getId()) == 0) {
            submission.setStatus("GRADED");
            submission.setScore(answerMapper.sumFinalScore(submission.getId()));
        } else {
            submission.setStatus("PENDING_GRADING");
            submission.setScore(null);
        }
        submissionMapper.updateById(submission);
        if ("GRADED".equals(submission.getStatus())) {
            HomeworkGradeHistory history = new HomeworkGradeHistory();
            history.setSubmissionId(submission.getId());
            history.setVersion(submission.getVersion());
            history.setScore(submission.getScore());
            history.setFeedback("逐题批改完成");
            history.setGradedBy(submission.getGradedBy());
            history.setGradedTime(submission.getGradedTime());
            historyMapper.insert(history);
        }
        return detail(submission);
    }

    private SubmissionDetailResponse detail(HomeworkSubmission submission) {
        Map<Long, HomeworkQuestion> questions = questionMapper.findByHomeworkId(submission.getHomeworkId()).stream()
                .collect(Collectors.toMap(HomeworkQuestion::getId, Function.identity()));
        List<SubmissionAnswerResponse> answers = answerMapper.findBySubmissionId(submission.getId()).stream()
                .map(answer -> toResponse(answer, questions.get(answer.getQuestionId()))).toList();
        HomeworkSubmissionResponse summary = new HomeworkSubmissionResponse(
                submission.getId(), submission.getHomeworkId(), submission.getStudentUserId(),
                submission.getCourseId(), submission.getAnswerContent(), submission.getStatus(),
                submission.getScore(), submission.getFeedback(), submission.getGradedBy(), submission.getVersion(),
                submission.getSubmittedTime(), submission.getGradedTime(), submission.getUpdatedTime());
        return new SubmissionDetailResponse(summary, answers);
    }

    private SubmissionAnswerResponse toResponse(SubmissionAnswer answer, HomeworkQuestion question) {
        return new SubmissionAnswerResponse(answer.getQuestionId(),
                question == null ? null : question.getQuestionType(), question == null ? null : question.getStem(),
                question == null ? null : question.getScore(), readJson(answer.getAnswerJson()), answer.getAnswerText(),
                answer.getAutoScore(), answer.getManualScore(), answer.getFinalScore(),
                answer.getGradingStatus(), answer.getFeedback());
    }

    private Homework requireOwnedHomework(Long homeworkId) {
        Homework homework = homeworkMapper.selectById(homeworkId);
        if (homework == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        if (!isAdmin() && !K12SecurityContext.requireUserId().equals(homework.getTeacherUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能批改自己创建的作业");
        }
        return homework;
    }

    private List<String> normalize(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(Objects::nonNull).map(String::trim).filter(v -> !v.isEmpty())
                .map(v -> v.toUpperCase(Locale.ROOT)).distinct().sorted().toList();
    }

    private String writeJson(List<String> value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("答案格式错误", e); }
    }

    private List<String> readJson(String value) {
        try { return value == null ? List.of() : objectMapper.readValue(value, new TypeReference<>() { }); }
        catch (JsonProcessingException e) { throw new IllegalStateException("数据库答案格式错误", e); }
    }

    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private boolean isAdmin() { return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN); }
}
