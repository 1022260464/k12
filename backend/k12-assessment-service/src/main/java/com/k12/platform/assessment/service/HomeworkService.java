package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.assessment.client.IamStudentClient;
import com.k12.platform.assessment.dto.HomeworkGradeHistoryResponse;
import com.k12.platform.assessment.dto.HomeworkGradeRequest;
import com.k12.platform.assessment.dto.HomeworkRecipientsRequest;
import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.dto.HomeworkSubmissionResponse;
import com.k12.platform.assessment.dto.HomeworkSubmitRequest;
import com.k12.platform.assessment.dto.SubmissionPageResponse;
import com.k12.platform.assessment.mapper.HomeworkGradeHistoryMapper;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.mapper.HomeworkSubmissionMapper;
import com.k12.platform.assessment.model.Homework;
import com.k12.platform.assessment.model.HomeworkGradeHistory;
import com.k12.platform.assessment.model.HomeworkSubmission;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.contract.iam.StudentValidationRequest;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

@Service
public class HomeworkService {

    private static final String DRAFT = "DRAFT";
    private static final String PUBLISHED = "PUBLISHED";
    private static final String CLOSED = "CLOSED";

    private final HomeworkMapper homeworkMapper;
    private final HomeworkSubmissionMapper submissionMapper;
    private final HomeworkGradeHistoryMapper gradeHistoryMapper;
    private final IamStudentClient iamStudentClient;

    public HomeworkService(
            HomeworkMapper homeworkMapper,
            HomeworkSubmissionMapper submissionMapper,
            HomeworkGradeHistoryMapper gradeHistoryMapper,
            IamStudentClient iamStudentClient
    ) {
        this.homeworkMapper = homeworkMapper;
        this.submissionMapper = submissionMapper;
        this.gradeHistoryMapper = gradeHistoryMapper;
        this.iamStudentClient = iamStudentClient;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public List<HomeworkResponse> listHomeworks(int page, int size) {
        PageRange range = pageRange(page, size);
        Long userId = K12SecurityContext.requireUserId();
        return homeworkMapper.findVisiblePage(userId, isAdmin(), range.offset(), range.size()).stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public Optional<HomeworkResponse> getHomework(Long id) {
        Homework homework = homeworkMapper.findVisibleById(id, K12SecurityContext.requireUserId(), isAdmin());
        return Optional.ofNullable(homework).map(this::toResponse);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_CREATE + "')")
    public HomeworkResponse createHomework(HomeworkRequest request) {
        Homework homework = new Homework();
        homework.setCourseId(request.courseId());
        homework.setTeacherUserId(K12SecurityContext.requireUserId());
        homework.setTitle(request.title().trim());
        homework.setDescription(trimToNull(request.description()));
        /* 新作业只能从草稿开始，发布必须走单独接口并检查接收人。 */
        homework.setStatus(DRAFT);
        homework.setDeleted(0);
        homeworkMapper.insert(homework);
        return toResponse(homeworkMapper.selectById(homework.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public Optional<HomeworkResponse> updateHomework(Long id, HomeworkRequest request) {
        Homework homework = homeworkMapper.selectForUpdate(id);
        if (homework == null) {
            return Optional.empty();
        }
        requireOwnerOrAdmin(homework);
        requireStatus(homework, DRAFT, "只有草稿作业可以修改");
        homework.setCourseId(request.courseId());
        homework.setTitle(request.title().trim());
        homework.setDescription(trimToNull(request.description()));
        homeworkMapper.updateById(homework);
        return Optional.of(toResponse(homeworkMapper.selectById(id)));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_DELETE + "')")
    public boolean deleteHomework(Long id) {
        Homework homework = homeworkMapper.selectForUpdate(id);
        if (homework == null) {
            return false;
        }
        requireOwnerOrAdmin(homework);
        requireStatus(homework, DRAFT, "只有草稿作业可以删除");
        if (homeworkMapper.countSubmissions(id) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有提交记录的作业不能删除");
        }
        return homeworkMapper.deleteById(id) > 0;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public List<Long> getRecipients(Long homeworkId) {
        Homework homework = requireHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        return homeworkMapper.findRecipientIds(homeworkId);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public List<Long> setRecipients(Long homeworkId, HomeworkRecipientsRequest request) {
        List<Long> studentIds = new LinkedHashSet<>(request.studentUserIds()).stream().toList();
        validateStudentRecipients(studentIds);
        Homework homework = requireLockedHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        requireStatus(homework, DRAFT, "只有草稿作业可以修改接收人");
        homeworkMapper.deleteRecipients(homeworkId);
        homeworkMapper.insertRecipients(homeworkId, studentIds);
        return homeworkMapper.findRecipientIds(homeworkId);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public HomeworkResponse publish(Long homeworkId) {
        Homework homework = requireLockedHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        requireStatus(homework, DRAFT, "只有草稿作业可以发布");
        if (homeworkMapper.countRecipients(homeworkId) == 0) {
            throw new IllegalArgumentException("发布前必须至少设置一个学生接收人");
        }
        homework.setStatus(PUBLISHED);
        homeworkMapper.updateById(homework);
        return toResponse(homeworkMapper.selectById(homeworkId));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public HomeworkResponse close(Long homeworkId) {
        Homework homework = requireLockedHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        requireStatus(homework, PUBLISHED, "只有已发布作业可以关闭");
        homework.setStatus(CLOSED);
        homeworkMapper.updateById(homework);
        return toResponse(homeworkMapper.selectById(homeworkId));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_SUBMIT + "')")
    public HomeworkSubmissionResponse submitHomework(Long homeworkId, HomeworkSubmitRequest request) {
        Long studentUserId = K12SecurityContext.requireUserId();
        Homework homework = requireLockedHomework(homeworkId);
        requireStatus(homework, PUBLISHED, "该作业当前不接受提交");
        if (!isAdmin() && !homeworkMapper.isRecipient(homeworkId, studentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前学生不是该作业接收人");
        }
        if (submissionMapper.findByHomeworkAndStudent(homeworkId, studentUserId) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该作业已经提交，不能重复提交");
        }

        HomeworkSubmission submission = new HomeworkSubmission();
        submission.setHomeworkId(homeworkId);
        submission.setStudentUserId(studentUserId);
        submission.setCourseId(homework.getCourseId());
        submission.setAnswerContent(request.answerContent().trim());
        submission.setStatus("SUBMITTED");
        submission.setVersion(0);
        submissionMapper.insert(submission);
        return toSubmissionResponse(submissionMapper.selectById(submission.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public HomeworkSubmissionResponse gradeHomework(Long homeworkId, HomeworkGradeRequest request) {
        Homework homework = requireLockedHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        if (DRAFT.equals(homework.getStatus())) {
            throw new IllegalArgumentException("草稿作业不能批改");
        }
        HomeworkSubmission submission = submissionMapper.findByHomeworkAndStudent(homeworkId, request.studentUserId());
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该学生的提交记录");
        }

        Long graderUserId = K12SecurityContext.requireUserId();
        int updated = submissionMapper.gradeOptimistically(
                submission.getId(),
                request.expectedVersion(),
                request.score(),
                trimToNull(request.feedback()),
                graderUserId
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "批改结果已被其他请求修改，请刷新后重试");
        }

        HomeworkSubmission graded = submissionMapper.selectById(submission.getId());
        HomeworkGradeHistory history = new HomeworkGradeHistory();
        history.setSubmissionId(graded.getId());
        history.setVersion(graded.getVersion());
        history.setScore(graded.getScore());
        history.setFeedback(graded.getFeedback());
        history.setGradedBy(graded.getGradedBy());
        history.setGradedTime(graded.getGradedTime());
        gradeHistoryMapper.insert(history);
        return toSubmissionResponse(graded);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public HomeworkSubmissionResponse mySubmission(Long homeworkId) {
        HomeworkSubmission submission = submissionMapper.findByHomeworkAndStudent(
                homeworkId,
                K12SecurityContext.requireUserId()
        );
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "尚未提交该作业");
        }
        return toSubmissionResponse(submission);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public SubmissionPageResponse listSubmissions(Long homeworkId, int page, int size) {
        Homework homework = requireHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        PageRange range = pageRange(page, size);
        List<HomeworkSubmissionResponse> items = submissionMapper
                .findByHomeworkPage(homeworkId, range.offset(), range.size())
                .stream().map(this::toSubmissionResponse).toList();
        return new SubmissionPageResponse(items, range.page(), range.size(), submissionMapper.countByHomework(homeworkId));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public SubmissionPageResponse myLearningResults(int page, int size) {
        Long studentUserId = K12SecurityContext.requireUserId();
        PageRange range = pageRange(page, size);
        List<HomeworkSubmissionResponse> items = submissionMapper
                .findByStudentPage(studentUserId, range.offset(), range.size())
                .stream().map(this::toSubmissionResponse).toList();
        return new SubmissionPageResponse(items, range.page(), range.size(), submissionMapper.countByStudent(studentUserId));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_GRADE + "')")
    public List<HomeworkGradeHistoryResponse> gradeHistory(Long homeworkId, Long studentUserId) {
        Homework homework = requireHomework(homeworkId);
        requireOwnerOrAdmin(homework);
        HomeworkSubmission submission = submissionMapper.findByHomeworkAndStudent(homeworkId, studentUserId);
        if (submission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到该学生的提交记录");
        }
        return gradeHistoryMapper.selectList(Wrappers.lambdaQuery(HomeworkGradeHistory.class)
                        .eq(HomeworkGradeHistory::getSubmissionId, submission.getId())
                        .orderByDesc(HomeworkGradeHistory::getVersion))
                .stream().map(this::toHistoryResponse).toList();
    }

    private void validateStudentRecipients(List<Long> studentIds) {
        ApiResponse<StudentValidationResponse> response;
        try {
            response = iamStudentClient.validateStudents(new StudentValidationRequest(studentIds));
        } catch (FeignException exception) {
            /* IAM 不可用时不能跳过身份校验，否则任意用户 ID 都可能被写入接收人表。 */
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IAM 学生账号校验暂时不可用", exception);
        }
        if (response == null || response.code() != 200 || response.data() == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IAM 学生账号校验暂时不可用");
        }
        if (!response.data().invalidUserIds().isEmpty()) {
            throw new IllegalArgumentException("以下账号不是可用学生账号: " + response.data().invalidUserIds());
        }
    }

    private Homework requireHomework(Long homeworkId) {
        Homework homework = homeworkMapper.selectById(homeworkId);
        if (homework == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        }
        return homework;
    }

    private Homework requireLockedHomework(Long homeworkId) {
        Homework homework = homeworkMapper.selectForUpdate(homeworkId);
        if (homework == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        }
        return homework;
    }

    private void requireOwnerOrAdmin(Homework homework) {
        if (!isAdmin() && !K12SecurityContext.requireUserId().equals(homework.getTeacherUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能维护自己创建的作业");
        }
    }

    private void requireStatus(Homework homework, String expectedStatus, String message) {
        if (!expectedStatus.equals(homework.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
    }

    private boolean isAdmin() {
        return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN);
    }

    private PageRange pageRange(int page, int size) {
        if (page < 1) {
            throw new IllegalArgumentException("page 必须大于等于 1");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size 必须在 1 到 100 之间");
        }
        return new PageRange(page, size, (page - 1) * size);
    }

    private HomeworkResponse toResponse(Homework homework) {
        return new HomeworkResponse(
                homework.getId(), homework.getCourseId(), homework.getTitle(), homework.getDescription(),
                homework.getStatus(), homework.getUpdatedTime(), homework.getTeacherUserId()
        );
    }

    private HomeworkSubmissionResponse toSubmissionResponse(HomeworkSubmission submission) {
        return new HomeworkSubmissionResponse(
                submission.getId(), submission.getHomeworkId(), submission.getStudentUserId(),
                submission.getCourseId(), submission.getAnswerContent(), submission.getStatus(),
                submission.getScore(), submission.getFeedback(), submission.getGradedBy(),
                submission.getVersion(), submission.getSubmittedTime(), submission.getGradedTime(),
                submission.getUpdatedTime()
        );
    }

    private HomeworkGradeHistoryResponse toHistoryResponse(HomeworkGradeHistory history) {
        return new HomeworkGradeHistoryResponse(
                history.getId(), history.getSubmissionId(), history.getVersion(), history.getScore(),
                history.getFeedback(), history.getGradedBy(), history.getGradedTime()
        );
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record PageRange(int page, int size, int offset) {
    }
}
