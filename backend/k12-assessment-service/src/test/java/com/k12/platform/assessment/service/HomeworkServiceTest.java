package com.k12.platform.assessment.service;

import com.k12.platform.assessment.client.IamStudentClient;
import com.k12.platform.assessment.dto.HomeworkGradeRequest;
import com.k12.platform.assessment.dto.HomeworkRecipientsRequest;
import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.dto.HomeworkSubmissionResponse;
import com.k12.platform.assessment.dto.HomeworkSubmitRequest;
import com.k12.platform.assessment.mapper.HomeworkGradeHistoryMapper;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.mapper.HomeworkSubmissionMapper;
import com.k12.platform.assessment.model.Homework;
import com.k12.platform.assessment.model.HomeworkGradeHistory;
import com.k12.platform.assessment.model.HomeworkSubmission;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import com.k12.platform.common.security.K12Authorities;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * 作业闭环单元测试。
 * 测试不启动 Spring、不连接 MySQL/Nacos，使用 Mockito 精确模拟 Mapper 和 IAM 返回值。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("作业发布、提交和批改业务")
class HomeworkServiceTest {

    private static final Long TEACHER_ID = 10L;
    private static final Long STUDENT_ID = 20L;
    private static final Long HOMEWORK_ID = 30L;

    @Mock
    private HomeworkMapper homeworkMapper;

    @Mock
    private HomeworkSubmissionMapper submissionMapper;

    @Mock
    private HomeworkGradeHistoryMapper gradeHistoryMapper;

    @Mock
    private IamStudentClient iamStudentClient;

    @Mock
    private SubmissionAnswerService submissionAnswerService;

    @InjectMocks
    private HomeworkService homeworkService;

    @BeforeEach
    void setUp() {
        authenticate(TEACHER_ID, "teacher10", K12Authorities.HOMEWORK_CREATE, K12Authorities.HOMEWORK_UPDATE);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("创建作业时强制为草稿并记录 JWT 当前教师")
    void shouldCreateDraftForCurrentTeacher() {
        AtomicReference<Homework> inserted = new AtomicReference<>();
        when(homeworkMapper.insert(any(Homework.class))).thenAnswer(invocation -> {
            Homework homework = invocation.getArgument(0);
            homework.setId(HOMEWORK_ID);
            inserted.set(homework);
            return 1;
        });
        when(homeworkMapper.selectById(HOMEWORK_ID)).thenAnswer(invocation -> inserted.get());

        HomeworkResponse response = homeworkService.createHomework(
                new HomeworkRequest(1L, "  循环练习  ", "  完成十道题  ", "DRAFT")
        );

        assertThat(response.id()).isEqualTo(HOMEWORK_ID);
        assertThat(response.teacherUserId()).isEqualTo(TEACHER_ID);
        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.title()).isEqualTo("循环练习");
        assertThat(response.description()).isEqualTo("完成十道题");
    }

    @Test
    @DisplayName("设置接收人时 IAM 返回无效账号就不得写数据库")
    void shouldRejectInvalidRecipientsBeforeDatabaseWrite() {
        when(iamStudentClient.validateStudents(any())).thenReturn(ApiResponse.ok(
                new StudentValidationResponse(List.of(STUDENT_ID), List.of(99L))
        ));

        assertThatThrownBy(() -> homeworkService.setRecipients(
                HOMEWORK_ID,
                new HomeworkRecipientsRequest(List.of(STUDENT_ID, 99L))
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("99");

        verify(homeworkMapper, never()).deleteRecipients(any());
        verify(homeworkMapper, never()).insertRecipients(any(), any());
    }

    @Test
    @DisplayName("合法接收人应去重后整体替换")
    @SuppressWarnings("unchecked")
    void shouldReplaceDistinctRecipients() {
        when(iamStudentClient.validateStudents(any())).thenReturn(ApiResponse.ok(
                new StudentValidationResponse(List.of(STUDENT_ID, 21L), List.of())
        ));
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("DRAFT", TEACHER_ID));
        when(homeworkMapper.findRecipientIds(HOMEWORK_ID)).thenReturn(List.of(STUDENT_ID, 21L));

        List<Long> result = homeworkService.setRecipients(
                HOMEWORK_ID,
                new HomeworkRecipientsRequest(List.of(STUDENT_ID, STUDENT_ID, 21L))
        );

        ArgumentCaptor<List<Long>> idsCaptor = ArgumentCaptor.forClass(List.class);
        verify(homeworkMapper).deleteRecipients(HOMEWORK_ID);
        verify(homeworkMapper).insertRecipients(eq(HOMEWORK_ID), idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(STUDENT_ID, 21L);
        assertThat(result).containsExactly(STUDENT_ID, 21L);
    }

    @Test
    @DisplayName("没有接收人时草稿不能发布")
    void shouldRejectPublishWithoutRecipients() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("DRAFT", TEACHER_ID));
        when(homeworkMapper.countRecipients(HOMEWORK_ID)).thenReturn(0L);

        assertThatThrownBy(() -> homeworkService.publish(HOMEWORK_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("至少设置一个学生");
        verify(homeworkMapper, never()).updateById(any(Homework.class));
    }

    @Test
    @DisplayName("发布后应把作业状态改为 PUBLISHED")
    void shouldPublishDraftHomework() {
        Homework homework = homework("DRAFT", TEACHER_ID);
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework);
        when(homeworkMapper.countRecipients(HOMEWORK_ID)).thenReturn(1L);
        when(homeworkMapper.selectById(HOMEWORK_ID)).thenAnswer(invocation -> homework);

        HomeworkResponse response = homeworkService.publish(HOMEWORK_ID);

        assertThat(response.status()).isEqualTo("PUBLISHED");
        verify(homeworkMapper).updateById(homework);
    }

    @Test
    @DisplayName("不在接收名单内的学生不能提交")
    void shouldRejectSubmissionFromNonRecipient() {
        authenticate(STUDENT_ID, "student20", K12Authorities.HOMEWORK_SUBMIT);
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("PUBLISHED", TEACHER_ID));
        when(homeworkMapper.isRecipient(HOMEWORK_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> homeworkService.submitHomework(
                HOMEWORK_ID,
                new HomeworkSubmitRequest("answer")
        )).isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(submissionMapper, never()).insert(any(HomeworkSubmission.class));
    }

    @Test
    @DisplayName("名单内学生可以提交，学生 ID 必须来自 JWT")
    void shouldSubmitForCurrentStudent() {
        authenticate(STUDENT_ID, "student20", K12Authorities.HOMEWORK_SUBMIT);
        Homework homework = homework("PUBLISHED", TEACHER_ID);
        homework.setCourseId(3L);
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework);
        when(homeworkMapper.isRecipient(HOMEWORK_ID, STUDENT_ID)).thenReturn(true);
        when(submissionMapper.findByHomeworkAndStudent(HOMEWORK_ID, STUDENT_ID)).thenReturn(null);

        AtomicReference<HomeworkSubmission> inserted = new AtomicReference<>();
        when(submissionMapper.insert(any(HomeworkSubmission.class))).thenAnswer(invocation -> {
            HomeworkSubmission submission = invocation.getArgument(0);
            submission.setId(40L);
            inserted.set(submission);
            return 1;
        });
        when(submissionMapper.selectById(40L)).thenAnswer(invocation -> inserted.get());

        HomeworkSubmissionResponse response = homeworkService.submitHomework(
                HOMEWORK_ID,
                new HomeworkSubmitRequest("  我的答案  ")
        );

        assertThat(response.studentUserId()).isEqualTo(STUDENT_ID);
        assertThat(response.courseId()).isEqualTo(3L);
        assertThat(response.answerContent()).isEqualTo("我的答案");
        assertThat(response.status()).isEqualTo("SUBMITTED");
        assertThat(response.version()).isZero();
    }

    @Test
    @DisplayName("同一学生重复提交同一作业时返回 409")
    void shouldRejectDuplicateSubmission() {
        authenticate(STUDENT_ID, "student20", K12Authorities.HOMEWORK_SUBMIT);
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("PUBLISHED", TEACHER_ID));
        when(homeworkMapper.isRecipient(HOMEWORK_ID, STUDENT_ID)).thenReturn(true);
        when(submissionMapper.findByHomeworkAndStudent(HOMEWORK_ID, STUDENT_ID))
                .thenReturn(submission(40L, 0));

        assertThatThrownBy(() -> homeworkService.submitHomework(
                HOMEWORK_ID,
                new HomeworkSubmitRequest("answer")
        )).isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("批改成功后版本加一并写入批改历史")
    void shouldGradeAndCreateHistory() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("PUBLISHED", TEACHER_ID));
        HomeworkSubmission original = submission(40L, 0);
        HomeworkSubmission graded = submission(40L, 1);
        graded.setStatus("GRADED");
        graded.setScore(new BigDecimal("95.50"));
        graded.setFeedback("完成得很好");
        graded.setGradedBy(TEACHER_ID);
        graded.setGradedTime(Instant.parse("2026-09-13T12:00:00Z"));
        when(submissionMapper.findByHomeworkAndStudent(HOMEWORK_ID, STUDENT_ID)).thenReturn(original);
        when(submissionMapper.gradeOptimistically(
                40L, 0, new BigDecimal("95.50"), "完成得很好", TEACHER_ID
        )).thenReturn(1);
        when(submissionMapper.selectById(40L)).thenReturn(graded);

        HomeworkSubmissionResponse response = homeworkService.gradeHomework(
                HOMEWORK_ID,
                new HomeworkGradeRequest(STUDENT_ID, new BigDecimal("95.50"), "完成得很好", 0)
        );

        ArgumentCaptor<HomeworkGradeHistory> historyCaptor = ArgumentCaptor.forClass(HomeworkGradeHistory.class);
        verify(gradeHistoryMapper).insert(historyCaptor.capture());
        assertThat(response.version()).isEqualTo(1);
        assertThat(response.score()).isEqualByComparingTo("95.50");
        assertThat(historyCaptor.getValue().getVersion()).isEqualTo(1);
        assertThat(historyCaptor.getValue().getGradedBy()).isEqualTo(TEACHER_ID);
    }

    @Test
    @DisplayName("版本号过期时批改返回 409 且不得写历史")
    void shouldRejectStaleGradeVersion() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("PUBLISHED", TEACHER_ID));
        when(submissionMapper.findByHomeworkAndStudent(HOMEWORK_ID, STUDENT_ID))
                .thenReturn(submission(40L, 1));
        when(submissionMapper.gradeOptimistically(
                40L, 0, new BigDecimal("88"), null, TEACHER_ID
        )).thenReturn(0);

        assertThatThrownBy(() -> homeworkService.gradeHomework(
                HOMEWORK_ID,
                new HomeworkGradeRequest(STUDENT_ID, new BigDecimal("88"), null, 0)
        )).isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(gradeHistoryMapper, never()).insert(any(HomeworkGradeHistory.class));
    }

    @Test
    @DisplayName("教师不能修改其他教师创建的作业")
    void shouldRejectUpdateByDifferentTeacher() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("DRAFT", 99L));

        assertThatThrownBy(() -> homeworkService.updateHomework(
                HOMEWORK_ID,
                new HomeworkRequest(1L, "title", null, "DRAFT")
        )).isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(homeworkMapper, never()).updateById(any(Homework.class));
    }

    private Homework homework(String status, Long teacherUserId) {
        Homework homework = new Homework();
        homework.setId(HOMEWORK_ID);
        homework.setCourseId(1L);
        homework.setTeacherUserId(teacherUserId);
        homework.setTitle("测试作业");
        homework.setStatus(status);
        homework.setDeleted(0);
        return homework;
    }

    private HomeworkSubmission submission(Long id, int version) {
        HomeworkSubmission submission = new HomeworkSubmission();
        submission.setId(id);
        submission.setHomeworkId(HOMEWORK_ID);
        submission.setStudentUserId(STUDENT_ID);
        submission.setCourseId(1L);
        submission.setAnswerContent("answer");
        submission.setStatus("SUBMITTED");
        submission.setVersion(version);
        return submission;
    }

    private void authenticate(Long userId, String username, String... authorities) {
        List<SimpleGrantedAuthority> grantedAuthorities = List.of(authorities).stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject(username)
                .claim("userId", userId.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, grantedAuthorities, username)
        );
    }
}
