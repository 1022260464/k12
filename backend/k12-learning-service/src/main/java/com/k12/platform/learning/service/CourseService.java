package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CourseService {

    private final CourseMapper courseMapper;

    public CourseService(CourseMapper courseMapper) {
        this.courseMapper = courseMapper;
    }

    public List<CourseResponse> listCourses() {
        return courseMapper.selectList(Wrappers.lambdaQuery(Course.class)
                        .orderByDesc(Course::getUpdatedTime))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<CourseResponse> getCourse(Long id) {
        return Optional.ofNullable(courseMapper.selectById(id)).map(this::toResponse);
    }

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
