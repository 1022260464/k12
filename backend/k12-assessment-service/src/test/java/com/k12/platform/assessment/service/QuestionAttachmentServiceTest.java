package com.k12.platform.assessment.service;

import com.k12.platform.assessment.dto.QuestionAttachmentResponse;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.mapper.HomeworkQuestionMapper;
import com.k12.platform.assessment.mapper.QuestionAttachmentMapper;
import com.k12.platform.assessment.model.Homework;
import com.k12.platform.assessment.model.HomeworkQuestion;
import com.k12.platform.assessment.model.QuestionAttachment;
import com.k12.platform.common.security.K12Authorities;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("题目附件业务规则")
class QuestionAttachmentServiceTest {

    private static final Long TEACHER_ID = 10L;
    private static final Long HOMEWORK_ID = 30L;
    private static final Long QUESTION_ID = 40L;

    @Mock HomeworkMapper homeworkMapper;
    @Mock HomeworkQuestionMapper questionMapper;
    @Mock QuestionAttachmentMapper attachmentMapper;
    @Mock QuestionAttachmentStorage storage;
    @InjectMocks QuestionAttachmentService service;

    @BeforeEach
    void setUp() {
        authenticate(TEACHER_ID, K12Authorities.HOMEWORK_UPDATE, K12Authorities.HOMEWORK_READ);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("可见作业可列出附件元数据")
    void shouldListAttachmentsForVisibleHomework() {
        when(homeworkMapper.findVisibleById(HOMEWORK_ID, TEACHER_ID, false)).thenReturn(homework("PUBLISHED"));
        when(questionMapper.selectById(QUESTION_ID)).thenReturn(question());
        QuestionAttachment attachment = new QuestionAttachment();
        attachment.setId(1L);
        attachment.setQuestionId(QUESTION_ID);
        attachment.setOriginalFilename("stem.pdf");
        attachment.setMimeType("application/pdf");
        attachment.setSizeBytes(1024L);
        attachment.setCreatedTime(Instant.now());
        when(attachmentMapper.selectList(any())).thenReturn(List.of(attachment));

        List<QuestionAttachmentResponse> items = service.list(HOMEWORK_ID, QUESTION_ID);
        assertThat(items).hasSize(1);
        assertThat(items.get(0).filename()).isEqualTo("stem.pdf");
    }

    @Test
    @DisplayName("非草稿作业禁止上传附件")
    void shouldRejectUploadWhenNotDraft() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("PUBLISHED"));
        var file = new MockMultipartFile("file", "stem.pdf", "application/pdf", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> service.upload(HOMEWORK_ID, QUESTION_ID, file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("草稿");
        verify(storage, never()).upload(any());
    }

    @Test
    @DisplayName("整份作业附件达到上限时拒绝上传")
    void shouldRejectUploadWhenHomeworkAttachmentLimitReached() {
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework("DRAFT"));
        when(questionMapper.selectById(QUESTION_ID)).thenReturn(question());
        when(attachmentMapper.countByHomeworkId(HOMEWORK_ID)).thenReturn(5L);
        var file = new MockMultipartFile("file", "stem.pdf", "application/pdf", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> service.upload(HOMEWORK_ID, QUESTION_ID, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("每个作业最多上传");
        verify(storage, never()).upload(any());
    }

    @Test
    @DisplayName("其他教师不能维护附件")
    void shouldForbidOtherTeacher() {
        Homework homework = homework("DRAFT");
        homework.setTeacherUserId(99L);
        when(homeworkMapper.selectForUpdate(HOMEWORK_ID)).thenReturn(homework);
        var file = new MockMultipartFile("file", "stem.pdf", "application/pdf", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> service.upload(HOMEWORK_ID, QUESTION_ID, file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("自己的题目附件");
        verify(storage, never()).upload(any());
    }

    private Homework homework(String status) {
        Homework homework = new Homework();
        homework.setId(HOMEWORK_ID);
        homework.setTeacherUserId(TEACHER_ID);
        homework.setStatus(status);
        return homework;
    }

    private HomeworkQuestion question() {
        HomeworkQuestion question = new HomeworkQuestion();
        question.setId(QUESTION_ID);
        question.setHomeworkId(HOMEWORK_ID);
        return question;
    }

    private static void authenticate(Long userId, String... authorities) {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none")
                .claim("userId", userId.toString()).subject("teacher")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                .build();
        var granted = java.util.Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, granted, "teacher"));
    }
}
