package com.k12.platform.assessment.service;

import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.model.Homework;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class HomeworkService {

    private final HomeworkMapper homeworkMapper;

    public HomeworkService(HomeworkMapper homeworkMapper) {
        this.homeworkMapper = homeworkMapper;
    }

    public List<HomeworkResponse> listHomeworks() {
        return homeworkMapper.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<HomeworkResponse> getHomework(Long id) {
        return homeworkMapper.findById(id).map(this::toResponse);
    }

    public HomeworkResponse createHomework(HomeworkRequest request) {
        Homework homework = new Homework(
                null,
                request.courseId(),
                request.title(),
                request.description(),
                request.status(),
                Instant.now()
        );
        return toResponse(homeworkMapper.insert(homework));
    }

    public Optional<HomeworkResponse> updateHomework(Long id, HomeworkRequest request) {
        if (!homeworkMapper.existsById(id)) {
            return Optional.empty();
        }

        Homework homework = new Homework(
                id,
                request.courseId(),
                request.title(),
                request.description(),
                request.status(),
                Instant.now()
        );
        return Optional.of(toResponse(homeworkMapper.update(homework)));
    }

    public boolean deleteHomework(Long id) {
        return homeworkMapper.deleteById(id);
    }

    private HomeworkResponse toResponse(Homework homework) {
        return new HomeworkResponse(
                homework.id(),
                homework.courseId(),
                homework.title(),
                homework.description(),
                homework.status(),
                homework.updatedTime()
        );
    }
}
