package com.k12.platform.learning.mapper.memory;

import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryCourseMapper implements CourseMapper {

    private final AtomicLong idGenerator = new AtomicLong(2);
    private final Map<Long, Course> courses = new ConcurrentHashMap<>();

    public InMemoryCourseMapper() {
        courses.put(1L, new Course(
                1L,
                "AI Basics for K12",
                "AI",
                "BEGINNER",
                "Draft course for AI learning",
                Instant.now()
        ));
    }

    @Override
    public List<Course> findAll() {
        return new ArrayList<>(courses.values());
    }

    @Override
    public Optional<Course> findById(Long id) {
        return Optional.ofNullable(courses.get(id));
    }

    @Override
    public Course insert(Course course) {
        Long id = idGenerator.getAndIncrement();
        Course saved = new Course(
                id,
                course.title(),
                course.subject(),
                course.gradeLevel(),
                course.description(),
                course.updatedTime()
        );
        courses.put(id, saved);
        return saved;
    }

    @Override
    public Course update(Course course) {
        courses.put(course.id(), course);
        return course;
    }

    @Override
    public boolean deleteById(Long id) {
        return courses.remove(id) != null;
    }

    @Override
    public boolean existsById(Long id) {
        return courses.containsKey(id);
    }
}
