package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.CourseEnrollmentMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseEnrollment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** 统一课程存在性和数据权限。功能权限在各业务 Service 的 @PreAuthorize 中校验。 */
@Service
public class CourseAccessService {
    private final CourseMapper courseMapper;
    private final CourseEnrollmentMapper enrollmentMapper;

    public CourseAccessService(CourseMapper courseMapper, CourseEnrollmentMapper enrollmentMapper) {
        this.courseMapper = courseMapper;
        this.enrollmentMapper = enrollmentMapper;
    }

    public Course requireCourse(Long id, boolean forUpdate) {
        Course course = forUpdate ? courseMapper.selectForUpdate(id) : courseMapper.selectById(id);
        if (course == null || !Integer.valueOf(1).equals(course.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在或未启用");
        }
        return course;
    }

    public void requireOwner(Course course) {
        if (!isOwnerOrAdmin(course)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能管理自己创建的课程");
        }
    }

    public void requireContentAccess(Course course) {
        if (!isOwnerOrAdmin(course)) {
            requireEnrollment(course.getId());
        }
    }

    public CourseEnrollment enrollment(Long courseId) {
        return enrollmentMapper.selectOne(Wrappers.lambdaQuery(CourseEnrollment.class)
                .eq(CourseEnrollment::getCourseId, courseId)
                .eq(CourseEnrollment::getUserId, K12SecurityContext.requireUserId()));
    }

    public CourseEnrollment requireEnrollment(Long courseId) {
        CourseEnrollment enrollment = enrollment(courseId);
        if (enrollment == null || !"ACTIVE".equals(enrollment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "请先选课");
        }
        return enrollment;
    }

    private boolean isOwnerOrAdmin(Course course) {
        return K12SecurityContext.hasAuthority("ROLE_ADMIN")
                || K12SecurityContext.requireUserId().equals(course.getTeacherId());
    }
}
