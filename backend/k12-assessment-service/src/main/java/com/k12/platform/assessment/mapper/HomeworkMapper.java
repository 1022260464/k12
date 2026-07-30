package com.k12.platform.assessment.mapper;

import com.k12.platform.assessment.model.Homework;

import java.util.List;
import java.util.Optional;

public interface HomeworkMapper {

    List<Homework> findAll();

    Optional<Homework> findById(Long id);

    Homework insert(Homework homework);

    Homework update(Homework homework);

    boolean deleteById(Long id);

    boolean existsById(Long id);
}
