package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.k12.platform.common.security.K12Authorities;

import java.util.List;
import java.util.Optional;

@Service
public class CourseService {

    private final CourseMapper courseMapper;

    public CourseService(CourseMapper courseMapper) {
        this.courseMapper = courseMapper;
    }

    /* 查询课程需要 course:read 权限。管理员、教师、学生默认都拥有。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_READ + "')")
    public List<CourseResponse> listCourses() {
        return courseMapper.selectList(Wrappers.lambdaQuery(Course.class)
                        .orderByDesc(Course::getUpdatedTime))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_READ + "')")
    public Optional<CourseResponse> getCourse(Long id) {
        return Optional.ofNullable(courseMapper.selectById(id)).map(this::toResponse);
    }

    /* 创建、修改、删除课程属于教学管理能力，学生默认没有这些权限。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_CREATE + "')")
    public CourseResponse createCourse(CourseRequest request) {
        Course course = new Course();
        course.setTitle(request.title());
        course.setSubject(request.subject());
        course.setGradeLevel(request.gradeLevel());
        course.setDescription(request.description());
        course.setStatus(1);
        course.setDeleted(0);

        courseMapper.insert(course);
        return toResponse(courseMapper.selectById(course.getId()));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_UPDATE + "')")
    public Optional<CourseResponse> updateCourse(Long id, CourseRequest request) {
        Course course = courseMapper.selectById(id);
        if (course == null) {
            return Optional.empty();
        }

        course.setTitle(request.title());
        course.setSubject(request.subject());
        course.setGradeLevel(request.gradeLevel());
        course.setDescription(request.description());
        courseMapper.updateById(course);

        return Optional.of(toResponse(courseMapper.selectById(id)));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_DELETE + "')")
    public boolean deleteCourse(Long id) {
        return courseMapper.deleteById(id) > 0;
    }

    private CourseResponse toResponse(Course course) {
        return new CourseResponse(
                course.getId(),
                course.getTitle(),
                course.getSubject(),
                course.getGradeLevel(),
                course.getDescription(),
                course.getUpdatedTime()
        );
    }
}
