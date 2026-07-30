package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class CourseService {

    private final CourseMapper courseMapper;

    public CourseService(CourseMapper courseMapper) {
        this.courseMapper = courseMapper;
    }

    public List<CourseResponse> listCourses() {
        return courseMapper.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<CourseResponse> getCourse(Long id) {
        return courseMapper.findById(id).map(this::toResponse);
    }

    public CourseResponse createCourse(CourseRequest request) {
        Course course = new Course(
                null,
                request.title(),
                request.subject(),
                request.gradeLevel(),
                request.description(),
                Instant.now()
        );
        return toResponse(courseMapper.insert(course));
    }

    public Optional<CourseResponse> updateCourse(Long id, CourseRequest request) {
        if (!courseMapper.existsById(id)) {
            return Optional.empty();
        }

        Course course = new Course(
                id,
                request.title(),
                request.subject(),
                request.gradeLevel(),
                request.description(),
                Instant.now()
        );
        return Optional.of(toResponse(courseMapper.update(course)));
    }

    public boolean deleteCourse(Long id) {
        return courseMapper.deleteById(id);
    }

    private CourseResponse toResponse(Course course) {
        return new CourseResponse(
                course.id(),
                course.title(),
                course.subject(),
                course.gradeLevel(),
                course.description(),
                course.updatedTime()
        );
    }
}
