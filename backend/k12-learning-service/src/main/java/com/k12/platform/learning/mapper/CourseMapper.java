package com.k12.platform.learning.mapper;

import com.k12.platform.learning.model.Course;

import java.util.List;
import java.util.Optional;

public interface CourseMapper {

    List<Course> findAll();

    Optional<Course> findById(Long id);

    Course insert(Course course);

    Course update(Course course);

    boolean deleteById(Long id);

    boolean existsById(Long id);
}
