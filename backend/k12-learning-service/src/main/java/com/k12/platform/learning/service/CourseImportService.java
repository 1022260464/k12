package com.k12.platform.learning.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.dto.ChapterRequest;
import com.k12.platform.learning.dto.CourseImportDocument;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.SectionRequest;
import jakarta.validation.Validator;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class CourseImportService {
    private static final long MAX_BYTES = 1024 * 1024;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final CourseService courses;
    private final CourseChapterService chapters;
    private final CourseSectionService sections;

    public CourseImportService(ObjectMapper objectMapper, Validator validator, CourseService courses,
                               CourseChapterService chapters, CourseSectionService sections) {
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.courses = courses;
        this.chapters = chapters;
        this.sections = sections;
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or (hasAuthority('course:create') and hasAuthority('course:update'))")
    public List<CourseResponse> importBatch(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES
                || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".json")) {
            throw new IllegalArgumentException("请选择不超过 1 MB 的 JSON 课程文件");
        }
        CourseImportDocument document;
        try {
            document = objectMapper.readerFor(CourseImportDocument.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(file.getBytes());
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("课程文件 JSON 格式或字段不正确", error);
        } catch (IOException error) {
            throw new IllegalArgumentException("无法读取课程文件", error);
        }
        var violations = validator.validate(document);
        if (!violations.isEmpty()) {
            var first = violations.iterator().next();
            throw new IllegalArgumentException(first.getPropertyPath() + ": " + first.getMessage());
        }
        int totalSections = document.courses().stream().flatMap(course -> course.chapters().stream())
                .mapToInt(chapter -> chapter.sections() == null ? 0 : chapter.sections().size()).sum();
        if (totalSections > 500) {
            throw new IllegalArgumentException("单次最多导入 500 个小节");
        }
        List<CourseResponse> result = new ArrayList<>();
        for (var entry : document.courses()) {
            CourseResponse course = courses.createCourse(new CourseRequest(entry.title(), entry.subject(),
                    entry.gradeLevel(), entry.description()));
            for (var chapterEntry : entry.chapters()) {
                long chapterId = chapters.create(course.id(), new ChapterRequest(chapterEntry.title(),
                        chapterEntry.content(), chapterEntry.sortOrder())).id();
                if (chapterEntry.sections() != null) {
                    for (var section : chapterEntry.sections()) {
                        sections.create(course.id(), chapterId,
                                new SectionRequest(section.title(), section.content(), section.sortOrder()));
                    }
                }
            }
            result.add(course);
        }
        return result;
    }
}
