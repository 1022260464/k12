package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
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
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class HomeworkService {
    private final HomeworkMapper homeworkMapper;
    private final HomeworkSubmissionMapper submissionMapper;
    private final HomeworkGradeHistoryMapper historyMapper;

    public HomeworkService(HomeworkMapper homeworkMapper, HomeworkSubmissionMapper submissionMapper,
                           HomeworkGradeHistoryMapper historyMapper) {
        this.homeworkMapper = homeworkMapper;
        this.submissionMapper = submissionMapper;
        this.historyMapper = historyMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public List<HomeworkResponse> listHomeworks(int page, int size) {
        checkPage(page, size);
        return homeworkMapper.findVisible(K12SecurityContext.requireUserId(), isAdmin(),
                (long) (page - 1) * size, size).stream().map(this::toResponse).toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public Optional<HomeworkResponse> getHomework(Long id) {
        Homework homework = homeworkMapper.selectById(id);
        if (homework == null || !visible(homework)) return Optional.empty();
        return Optional.of(toResponse(homework));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_CREATE + "')")
    public HomeworkResponse createHomework(HomeworkRequest request) {
        require("DRAFT".equals(request.status()), HttpStatus.CONFLICT, "新作业必须为 DRAFT，请使用发布接口");
        Homework homework = new Homework();
        homework.setTeacherUserId(K12SecurityContext.requireUserId());
        homework.setCourseId(request.courseId());
        homework.setTitle(request.title());
        homework.setDescription(request.description());
        homework.setStatus("DRAFT");
        homework.setDeleted(0);
        homeworkMapper.insert(homework);
        return toResponse(homeworkMapper.selectById(homework.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public Optional<HomeworkResponse> updateHomework(Long id, HomeworkRequest request) {
        Homework homework = owned(id, true);
        require("DRAFT".equals(homework.getStatus()), HttpStatus.CONFLICT, "仅草稿作业可以修改内容");
        require("DRAFT".equals(request.status()), HttpStatus.CONFLICT, "请使用发布或关闭接口变更状态");
        homework.setCourseId(request.courseId());
        homework.setTitle(request.title());
        homework.setDescription(request.description());
        homeworkMapper.updateById(homework);
        return Optional.of(toResponse(homeworkMapper.selectById(id)));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_DELETE + "')")
    public boolean deleteHomework(Long id) {
        owned(id, true);
        require(submissionMapper.countPage(id, null) == 0, HttpStatus.CONFLICT, "已有提交记录，请关闭作业而不是删除");
        return homeworkMapper.deleteById(id) > 0;
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public List<Long> setRecipients(Long id, HomeworkRecipientsRequest request) {
        Homework homework = owned(id, true);
        require("DRAFT".equals(homework.getStatus()), HttpStatus.CONFLICT, "只能在发布前调整学生名单");
        List<Long> ids = request.studentUserIds().stream().distinct().toList();
        require(!ids.isEmpty() && ids.size() <= 500, HttpStatus.BAD_REQUEST, "请选择 1 至 500 名学生");
        homeworkMapper.deleteRecipients(id);
        homeworkMapper.insertRecipients(id, ids);
        return homeworkMapper.findRecipients(id);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public List<Long> getRecipients(Long id) {
        owned(id, false);
        return homeworkMapper.findRecipients(id);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public HomeworkResponse publish(Long id) {
        Homework homework = owned(id, true);
        require("DRAFT".equals(homework.getStatus()), HttpStatus.CONFLICT, "只有草稿可以发布");
        require(!homeworkMapper.findRecipients(id).isEmpty(), HttpStatus.CONFLICT, "发布前请指定学生名单");
        homework.setStatus("PUBLISHED");
        homeworkMapper.updateById(homework);
        return toResponse(homeworkMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public HomeworkResponse close(Long id) {
        Homework homework = owned(id, true);
        require("PUBLISHED".equals(homework.getStatus()), HttpStatus.CONFLICT, "只有已发布作业可以关闭");
        homework.setStatus("CLOSED");
        homeworkMapper.updateById(homework);
        return toResponse(homeworkMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_SUBMIT + "')")
    public HomeworkSubmissionResponse submitHomework(Long id, HomeworkSubmitRequest request) {
        // Lock the parent to serialize submission, deletion, recipient changes and closing.
        Homework homework = existing(id, true);
        Long studentId = K12SecurityContext.requireUserId();
        require(homeworkMapper.isRecipient(id, studentId) > 0, HttpStatus.NOT_FOUND, "作业不存在或未分配给当前学生");
        require("PUBLISHED".equals(homework.getStatus()), HttpStatus.CONFLICT, "作业尚未发布或已关闭");
        require(submissionMapper.findForStudent(id, studentId) == null, HttpStatus.CONFLICT, "该作业已经提交，请勿重复提交");
        HomeworkSubmission submission = new HomeworkSubmission();
        submission.setHomeworkId(id);
        submission.setCourseId(homework.getCourseId());
        submission.setStudentUserId(studentId);
        submission.setAnswerContent(request.answerContent());
        submission.setStatus("SUBMITTED");
        submission.setVersion(0);
        submission.setSubmittedTime(Instant.now());
        submission.setUpdatedTime(submission.getSubmittedTime());
        submissionMapper.insert(submission);
        return submissionResponse(submissionMapper.selectById(submission.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public HomeworkSubmissionResponse gradeHomework(Long id, HomeworkGradeRequest request) {
        owned(id, true);
        HomeworkSubmission submission = submissionMapper.findForStudent(id, request.studentUserId());
        require(submission != null, HttpStatus.NOT_FOUND, "该学生尚未提交此作业");
        require(request.score() != null && request.score().signum() >= 0
                && request.score().compareTo(new java.math.BigDecimal("100")) <= 0
                && request.score().scale() <= 2, HttpStatus.BAD_REQUEST, "分数须为 0 至 100，最多两位小数");
        // A missing version is accepted for the first grading only.
        int expected = request.expectedVersion() == null ? 0 : request.expectedVersion();
        require(submission.getVersion() == expected, HttpStatus.CONFLICT, "成绩已更新，请刷新并提交 expectedVersion");
        submission.setScore(request.score());
        submission.setFeedback(request.feedback());
        submission.setGradedBy(K12SecurityContext.requireUserId());
        submission.setGradedTime(Instant.now());
        submission.setUpdatedTime(submission.getGradedTime());
        require(submissionMapper.gradeIfVersion(submission, expected) == 1,
                HttpStatus.CONFLICT, "成绩已被其他请求更新，请刷新重试");
        HomeworkGradeHistory history = new HomeworkGradeHistory();
        history.setSubmissionId(submission.getId());
        history.setVersion(expected + 1);
        history.setScore(request.score());
        history.setFeedback(request.feedback());
        history.setGradedBy(submission.getGradedBy());
        history.setGradedTime(submission.getGradedTime());
        historyMapper.insert(history);
        return submissionResponse(submissionMapper.selectById(submission.getId()));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public HomeworkSubmissionResponse mySubmission(Long id) {
        HomeworkSubmission submission = submissionMapper.findForStudent(id, K12SecurityContext.requireUserId());
        require(submission != null, HttpStatus.NOT_FOUND, "尚无提交记录");
        return submissionResponse(submission);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public SubmissionPageResponse listSubmissions(Long id, int page, int size) {
        owned(id, false);
        return submissionPage(id, null, page, size);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public SubmissionPageResponse myLearningResults(int page, int size) {
        return submissionPage(null, K12SecurityContext.requireUserId(), page, size);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public List<HomeworkGradeHistoryResponse> gradeHistory(Long id, Long studentId) {
        owned(id, false);
        HomeworkSubmission submission = submissionMapper.findForStudent(id, studentId);
        require(submission != null, HttpStatus.NOT_FOUND, "提交记录不存在");
        return historyMapper.selectList(Wrappers.lambdaQuery(HomeworkGradeHistory.class)
                .eq(HomeworkGradeHistory::getSubmissionId, submission.getId())
                .orderByDesc(HomeworkGradeHistory::getVersion).last("LIMIT 100")).stream()
                .map(h -> new HomeworkGradeHistoryResponse(h.getId(), h.getSubmissionId(), h.getVersion(),
                        h.getScore(), h.getFeedback(), h.getGradedBy(), h.getGradedTime())).toList();
    }

    private SubmissionPageResponse submissionPage(Long homeworkId, Long studentId, int page, int size) {
        checkPage(page, size);
        return new SubmissionPageResponse(submissionMapper.findPage(homeworkId, studentId,
                (long) (page - 1) * size, size).stream().map(this::submissionResponse).toList(),
                page, size, submissionMapper.countPage(homeworkId, studentId));
    }

    private Homework existing(Long id, boolean lock) {
        Homework homework = lock ? homeworkMapper.lockById(id) : homeworkMapper.selectById(id);
        require(homework != null, HttpStatus.NOT_FOUND, "作业不存在");
        return homework;
    }
    private Homework owned(Long id, boolean lock) {
        Homework homework = existing(id, lock);
        require(isAdmin() || Objects.equals(homework.getTeacherUserId(), K12SecurityContext.requireUserId()),
                HttpStatus.NOT_FOUND, "作业不存在或无权管理");
        return homework;
    }
    private boolean visible(Homework homework) {
        Long userId = K12SecurityContext.requireUserId();
        return isAdmin() || Objects.equals(homework.getTeacherUserId(), userId)
                || (List.of("PUBLISHED", "CLOSED").contains(homework.getStatus())
                    && homeworkMapper.isRecipient(homework.getId(), userId) > 0);
    }
    private boolean isAdmin() { return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN); }
    private void checkPage(int page, int size) {
        require(page >= 1 && size >= 1 && size <= 100, HttpStatus.BAD_REQUEST, "page 须大于 0，size 须为 1 至 100");
    }
    private void require(boolean condition, HttpStatus status, String message) {
        if (!condition) throw new ResponseStatusException(status, message);
    }
    private HomeworkResponse toResponse(Homework h) {
        return new HomeworkResponse(h.getId(), h.getCourseId(), h.getTitle(), h.getDescription(),
                h.getStatus(), h.getUpdatedTime(), h.getTeacherUserId());
    }
    private HomeworkSubmissionResponse submissionResponse(HomeworkSubmission s) {
        return new HomeworkSubmissionResponse(s.getId(), s.getHomeworkId(), s.getStudentUserId(),
                s.getCourseId(), s.getAnswerContent(), s.getStatus(), s.getScore(), s.getFeedback(),
                s.getGradedBy(), s.getVersion(), s.getSubmittedTime(), s.getGradedTime(), s.getUpdatedTime());
    }
}
