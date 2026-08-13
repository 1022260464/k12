package com.k12.platform.assessment.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.model.Homework;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.k12.platform.common.security.K12Authorities;

import java.util.List;
import java.util.Optional;

@Service
public class HomeworkService {

    private final HomeworkMapper homeworkMapper;

    public HomeworkService(HomeworkMapper homeworkMapper) {
        this.homeworkMapper = homeworkMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public List<HomeworkResponse> listHomeworks() {
        return homeworkMapper.selectList(Wrappers.lambdaQuery(Homework.class)
                        .orderByDesc(Homework::getUpdatedTime))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_READ + "')")
    public Optional<HomeworkResponse> getHomework(Long id) {
        return Optional.ofNullable(homeworkMapper.selectById(id)).map(this::toResponse);
    }

    /* 作业维护默认开放给教师和管理员，学生只拥有读取权限。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_CREATE + "')")
    public HomeworkResponse createHomework(HomeworkRequest request) {
        Homework homework = new Homework();
        homework.setCourseId(request.courseId());
        homework.setTitle(request.title());
        homework.setDescription(request.description());
        homework.setStatus(request.status());
        homework.setDeleted(0);

        homeworkMapper.insert(homework);
        return toResponse(homeworkMapper.selectById(homework.getId()));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public Optional<HomeworkResponse> updateHomework(Long id, HomeworkRequest request) {
        Homework homework = homeworkMapper.selectById(id);
        if (homework == null) {
            return Optional.empty();
        }

        homework.setCourseId(request.courseId());
        homework.setTitle(request.title());
        homework.setDescription(request.description());
        homework.setStatus(request.status());
        homeworkMapper.updateById(homework);

        return Optional.of(toResponse(homeworkMapper.selectById(id)));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_DELETE + "')")
    public boolean deleteHomework(Long id) {
        return homeworkMapper.deleteById(id) > 0;
    }

    private HomeworkResponse toResponse(Homework homework) {
        return new HomeworkResponse(
                homework.getId(),
                homework.getCourseId(),
                homework.getTitle(),
                homework.getDescription(),
                homework.getStatus(),
                homework.getUpdatedTime()
        );
    }
}
