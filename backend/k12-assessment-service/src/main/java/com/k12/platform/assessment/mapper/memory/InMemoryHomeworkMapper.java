package com.k12.platform.assessment.mapper.memory;

import com.k12.platform.assessment.mapper.HomeworkMapper;
import com.k12.platform.assessment.model.Homework;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryHomeworkMapper implements HomeworkMapper {

    private final AtomicLong idGenerator = new AtomicLong(2);
    private final Map<Long, Homework> homeworks = new ConcurrentHashMap<>();

    public InMemoryHomeworkMapper() {
        homeworks.put(1L, new Homework(
                1L,
                1L,
                "Bubble Sort Practice",
                "Complete the sorting exercise and submit your explanation.",
                "DRAFT",
                Instant.now()
        ));
    }

    @Override
    public List<Homework> findAll() {
        return new ArrayList<>(homeworks.values());
    }

    @Override
    public Optional<Homework> findById(Long id) {
        return Optional.ofNullable(homeworks.get(id));
    }

    @Override
    public Homework insert(Homework homework) {
        Long id = idGenerator.getAndIncrement();
        Homework saved = new Homework(
                id,
                homework.courseId(),
                homework.title(),
                homework.description(),
                homework.status(),
                homework.updatedTime()
        );
        homeworks.put(id, saved);
        return saved;
    }

    @Override
    public Homework update(Homework homework) {
        homeworks.put(homework.id(), homework);
        return homework;
    }

    @Override
    public boolean deleteById(Long id) {
        return homeworks.remove(id) != null;
    }

    @Override
    public boolean existsById(Long id) {
        return homeworks.containsKey(id);
    }
}
