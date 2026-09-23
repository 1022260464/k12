package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.ContentImageResponse;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.CoursePageResponse;
import com.k12.platform.learning.dto.PersonalizedCourseRequest;
import com.k12.platform.learning.dto.PersonalizedCourseResponse;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.k12.platform.common.security.K12Authorities;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class CourseService {

    private final CourseMapper courseMapper;
    private final CourseMediaUrlResolver mediaUrlResolver;
    private final CourseCoverStorage coverStorage;
    private final KnowledgeGraphService knowledgeGraphService;
    private final PublishedCourseListCache publishedCourseListCache;
    private final CourseMediaUrlCache mediaUrlCache;

    public CourseService(CourseMapper courseMapper, CourseMediaUrlResolver mediaUrlResolver,
                         CourseCoverStorage coverStorage,
                         KnowledgeGraphService knowledgeGraphService,
                         ObjectProvider<PublishedCourseListCache> publishedCourseListCache,
                         ObjectProvider<CourseMediaUrlCache> mediaUrlCache) {
        this.courseMapper = courseMapper;
        this.mediaUrlResolver = mediaUrlResolver;
        this.coverStorage = coverStorage;
        this.knowledgeGraphService = knowledgeGraphService;
        this.publishedCourseListCache = publishedCourseListCache.getIfAvailable();
        this.mediaUrlCache = mediaUrlCache.getIfAvailable();
    }

    /* 查询课程需要 course:read 权限。管理员、教师、学生默认都拥有。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_READ + "')")
    public List<CourseResponse> listCourses() {
        var query = Wrappers.lambdaQuery(Course.class);
        if (!K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)) {
            Long userId = K12SecurityContext.requireUserId();
            query.and(scope -> scope.eq(Course::getStatus, 1).or().eq(Course::getTeacherId, userId));
        }
        return courseMapper.selectList(query
                        .orderByDesc(Course::getUpdatedTime, Course::getId)
                        .last("LIMIT 100"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * 首页推荐：仅已发布课程，整表结果可 Redis 缓存；封面 URL 另有签名缓存。
     */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_READ + "')")
    public List<CourseResponse> listRecommendedCourses(int limit) {
        int size = Math.min(Math.max(limit, 1), 24);
        if (publishedCourseListCache != null) {
            try {
                Optional<List<CourseResponse>> cached = publishedCourseListCache.read();
                if (cached.isPresent()) {
                    return cached.get().stream().limit(size).toList();
                }
            } catch (RuntimeException ignored) {
                // 降级查库
            }
        }
        List<CourseResponse> published = courseMapper.selectList(Wrappers.lambdaQuery(Course.class)
                        .eq(Course::getStatus, 1)
                        .orderByDesc(Course::getUpdatedTime, Course::getId)
                        .last("LIMIT 48"))
                .stream()
                .map(this::toResponse)
                .toList();
        if (publishedCourseListCache != null) {
            try {
                publishedCourseListCache.replace(published);
            } catch (RuntimeException ignored) {
                // ignore
            }
        }
        return published.stream().limit(size).toList();
    }

    /** 根据多个课程形成的掌握度，跨课程寻找覆盖薄弱知识点的已发布章节。 */
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public List<PersonalizedCourseResponse> personalized(PersonalizedCourseRequest request) {
        int limit = request.limit() == null ? 6 : request.limit();
        List<PersonalizedCourseRequest.MasteryHint> hints = request.mastery() == null
                ? List.of() : request.mastery().stream()
                .filter(item -> item != null && StringUtils.hasText(item.knowledgeCode()))
                .sorted(Comparator.comparingInt(PersonalizedCourseRequest.MasteryHint::masteryPercent))
                .toList();
        Map<Long, PersonalizedCourseResponse> selected = new LinkedHashMap<>();
        for (PersonalizedCourseRequest.MasteryHint hint : hints) {
            for (Map<String, Object> chapter : knowledgeGraphService.listChaptersCovering(hint.knowledgeCode())) {
                Object rawCourseId = chapter.get("courseId");
                if (!(rawCourseId instanceof Number number) || selected.containsKey(number.longValue())) continue;
                Course course = courseMapper.selectById(number.longValue());
                if (course == null || !Integer.valueOf(1).equals(course.getStatus())) continue;
                Long chapterId = chapter.get("chapterId") instanceof Number value ? value.longValue() : null;
                String chapterTitle = chapter.get("chapterTitle") instanceof String value ? value : null;
                String reason = hint.masteryPercent() < 60
                        ? "你在「" + hint.knowledgeCode() + "」上的掌握度较低，建议先通过这门课程的相关章节复习。"
                        : "这门课程覆盖你正在巩固的「" + hint.knowledgeCode() + "」，适合继续练习和迁移应用。";
                selected.put(course.getId(), new PersonalizedCourseResponse(toResponse(course), chapterId,
                        chapterTitle, hint.knowledgeCode(), hint.masteryPercent(), reason));
                if (selected.size() >= limit) return new ArrayList<>(selected.values());
            }
        }
        if (selected.isEmpty()) {
            for (CourseResponse course : listRecommendedCourses(limit)) {
                selected.put(course.id(), new PersonalizedCourseResponse(course, null, null, null, null,
                        "暂未积累足够的跨课程练习证据，先从已发布的 AI 通识课程开始。"));
            }
        }
        return new ArrayList<>(selected.values()).stream().limit(limit).toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_READ + "')")
    public Optional<CourseResponse> getCourse(Long id) {
        return Optional.ofNullable(courseMapper.selectById(id))
                .filter(course -> Integer.valueOf(1).equals(course.getStatus())
                        || K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)
                        || K12SecurityContext.requireUserId().equals(course.getTeacherId()))
                .map(this::toResponse);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public CoursePageResponse search(int page, int size, String keyword, String subject, String gradeLevel, boolean mine) {
        if (page < 1 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page 必须大于等于 1，size 必须在 1 到 100 之间");
        }
        List<Course> rows = courseMapper.search(clean(keyword), clean(subject), clean(gradeLevel),
                mine ? K12SecurityContext.requireUserId() : null, (long) (page - 1) * size, size + 1);
        return new CoursePageResponse(page, size, rows.size() > size,
                rows.stream().limit(size).map(this::toResponse).toList());
    }

    /* 创建、修改、删除课程属于教学管理能力，学生默认没有这些权限。 */
    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_CREATE + "')")
    public CourseResponse createCourse(CourseRequest request) {
        Course course = new Course();
        applyRequest(course, request);
        course.setStatus(0);
        course.setDeleted(0);
        course.setTeacherId(K12SecurityContext.requireUserId());

        courseMapper.insert(course);
        return toResponse(courseMapper.selectById(course.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_UPDATE + "')")
    public Optional<CourseResponse> updateCourse(Long id, CourseRequest request) {
        Course course = courseMapper.selectForUpdate(id);
        if (course == null) {
            return Optional.empty();
        }
        requireOwner(course);
        String previousCover = course.getCoverObjectKey();
        applyRequest(course, request);
        course.setUpdatedTime(Instant.now());
        courseMapper.updateById(course);
        evictCoverUrl(previousCover);
        evictCoverUrl(course.getCoverObjectKey());
        invalidatePublishedList();
        return Optional.of(toResponse(courseMapper.selectById(id)));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_DELETE + "')")
    public boolean deleteCourse(Long id) {
        Course course = courseMapper.selectForUpdate(id);
        if (course == null) {
            return false;
        }
        requireOwner(course);
        boolean deleted = courseMapper.deleteById(id) > 0;
        if (deleted) {
            knowledgeGraphService.removeCourseChapterRefs(id);
            evictCoverUrl(course.getCoverObjectKey());
            invalidatePublishedList();
        }
        return deleted;
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_UPDATE + "')")
    public CourseResponse uploadCover(Long id, MultipartFile file) {
        Course course = courseMapper.selectForUpdate(id);
        if (course == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在");
        }
        requireOwner(course);
        String previous = course.getCoverObjectKey();
        String objectKey = coverStorage.upload(id, file);
        course.setCoverObjectKey(objectKey);
        course.setUpdatedTime(Instant.now());
        courseMapper.updateById(course);
        if (StringUtils.hasText(previous) && !previous.equals(objectKey)) {
            coverStorage.removeQuietly(previous);
            evictCoverUrl(previous);
        }
        invalidatePublishedList();
        return toResponse(courseMapper.selectById(id));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.COURSE_UPDATE + "')")
    public ContentImageResponse uploadContentImage(Long id, MultipartFile file) {
        Course course = courseMapper.selectById(id);
        if (course == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在");
        }
        requireOwner(course);
        String objectKey = coverStorage.uploadContentImage(id, file);
        String url = mediaUrlResolver.resolve(objectKey);
        if (!StringUtils.hasText(url)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "课程媒体访问地址不可用");
        }
        return new ContentImageResponse(objectKey, url);
    }

    public void invalidatePublishedList() {
        if (publishedCourseListCache == null) {
            return;
        }
        try {
            publishedCourseListCache.invalidate();
        } catch (RuntimeException ignored) {
            // ignore
        }
    }

    private void evictCoverUrl(String objectKey) {
        if (mediaUrlCache == null || !StringUtils.hasText(objectKey)) {
            return;
        }
        try {
            mediaUrlCache.evict(objectKey);
        } catch (RuntimeException ignored) {
            // ignore
        }
    }

    private CourseResponse toResponse(Course course) {
        return new CourseResponse(
                course.getId(),
                course.getTitle(),
                course.getSubject(),
                course.getGradeLevel(),
                course.getDescription(),
                course.getCoverObjectKey(),
                mediaUrlResolver.resolve(course.getCoverObjectKey()),
                course.getUpdatedTime(),
                course.getTeacherId(),
                course.getStatus()
        );
    }

    private void applyRequest(Course course, CourseRequest request) {
        course.setTitle(request.title().trim());
        course.setSubject(request.subject().trim());
        course.setGradeLevel(request.gradeLevel().trim());
        course.setDescription(StringUtils.hasText(request.description()) ? request.description().trim() : null);
        course.setCoverObjectKey(cleanCoverObjectKey(request.coverObjectKey()));
    }

    private void requireOwner(Course course) {
        if (!K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)
                && !K12SecurityContext.requireUserId().equals(course.getTeacherId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能管理自己创建的课程");
        }
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String cleanCoverObjectKey(String value) {
        String objectKey = clean(value);
        if (objectKey != null && !CourseMediaUrlResolver.isAllowedObjectKey(objectKey)) {
            throw new IllegalArgumentException("课程封面对象键必须位于 course-assets/ 目录且不能包含路径穿越字符");
        }
        return objectKey;
    }
}
