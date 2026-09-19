package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.assessment.dto.QuestionAttachmentResponse;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.mapper.HomeworkQuestionMapper;
import com.k12.platform.assessment.mapper.QuestionAttachmentMapper;
import com.k12.platform.assessment.model.Homework;
import com.k12.platform.assessment.model.HomeworkQuestion;
import com.k12.platform.assessment.model.QuestionAttachment;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class QuestionAttachmentService {
    public static final int MAX_ATTACHMENTS_PER_HOMEWORK = 5;

    private final HomeworkMapper homeworkMapper;
    private final HomeworkQuestionMapper questionMapper;
    private final QuestionAttachmentMapper attachmentMapper;
    private final QuestionAttachmentStorage storage;

    public QuestionAttachmentService(HomeworkMapper homeworkMapper, HomeworkQuestionMapper questionMapper,
                                     QuestionAttachmentMapper attachmentMapper, QuestionAttachmentStorage storage) {
        this.homeworkMapper = homeworkMapper;
        this.questionMapper = questionMapper;
        this.attachmentMapper = attachmentMapper;
        this.storage = storage;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:read')")
    public List<QuestionAttachmentResponse> list(Long homeworkId, Long questionId) {
        requireVisibleQuestion(homeworkId, questionId);
        return attachmentMapper.selectList(Wrappers.lambdaQuery(QuestionAttachment.class)
                .eq(QuestionAttachment::getQuestionId, questionId)
                .orderByAsc(QuestionAttachment::getId)).stream()
                .map(QuestionAttachmentResponse::from).toList();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:read')")
    public long countByHomework(Long homeworkId) {
        Homework homework = homeworkMapper.findVisibleById(homeworkId, K12SecurityContext.requireUserId(),
                K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN));
        if (homework == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在或无权查看");
        return attachmentMapper.countByHomeworkId(homeworkId);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:read')")
    public String downloadUrl(Long homeworkId, Long questionId, Long attachmentId) {
        requireVisibleQuestion(homeworkId, questionId);
        return storage.downloadUrl(requireAttachment(questionId, attachmentId).getObjectKey());
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:update')")
    public QuestionAttachmentResponse upload(Long homeworkId, Long questionId, MultipartFile file) {
        requireEditableQuestion(homeworkId, questionId);
        if (attachmentMapper.countByHomeworkId(homeworkId) >= MAX_ATTACHMENTS_PER_HOMEWORK) {
            throw new IllegalArgumentException("每个作业最多上传 " + MAX_ATTACHMENTS_PER_HOMEWORK + " 个附件");
        }
        QuestionAttachmentStorage.Stored stored = storage.upload(file);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.removeQuietly(stored.objectKey());
            }
        });
        QuestionAttachment attachment = new QuestionAttachment();
        attachment.setQuestionId(questionId);
        attachment.setObjectKey(stored.objectKey());
        attachment.setOriginalFilename(stored.filename());
        attachment.setMimeType(stored.mimeType());
        attachment.setSizeBytes(stored.sizeBytes());
        attachment.setCreatedTime(Instant.now());
        attachment.setDeleted(0);
        attachmentMapper.insert(attachment);
        return QuestionAttachmentResponse.from(attachment);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:update')")
    public void delete(Long homeworkId, Long questionId, Long attachmentId) {
        requireEditableQuestion(homeworkId, questionId);
        QuestionAttachment attachment = requireAttachment(questionId, attachmentId);
        attachmentMapper.deleteById(attachmentId);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { storage.removeQuietly(attachment.getObjectKey()); }
        });
    }

    private void requireVisibleQuestion(Long homeworkId, Long questionId) {
        Homework homework = homeworkMapper.findVisibleById(homeworkId, K12SecurityContext.requireUserId(),
                K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN));
        if (homework == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在或无权查看");
        requireQuestion(homeworkId, questionId);
    }

    private void requireEditableQuestion(Long homeworkId, Long questionId) {
        Homework homework = homeworkMapper.selectForUpdate(homeworkId);
        if (homework == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "作业不存在");
        if (!K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)
                && !K12SecurityContext.requireUserId().equals(homework.getTeacherUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能维护自己的题目附件");
        }
        if (!"DRAFT".equals(homework.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "只有草稿作业可以修改附件");
        }
        requireQuestion(homeworkId, questionId);
    }

    private void requireQuestion(Long homeworkId, Long questionId) {
        HomeworkQuestion question = questionMapper.selectById(questionId);
        if (question == null || !homeworkId.equals(question.getHomeworkId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "题目不存在");
        }
    }

    private QuestionAttachment requireAttachment(Long questionId, Long attachmentId) {
        QuestionAttachment attachment = attachmentMapper.selectById(attachmentId);
        if (attachment == null || !questionId.equals(attachment.getQuestionId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "题目附件不存在");
        }
        return attachment;
    }
}
