package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.ContentImageResponse;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.CoursePageResponse;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.k12.platform.common.security.K12Authorities;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@Service
public class CourseService {

    private final CourseMapper courseMapper;
    private final CourseMediaUrlResolver mediaUrlResolver;
    private final CourseCoverStorage coverStorage;

    public CourseService(CourseMapper courseMapper, CourseMediaUrlResolver mediaUrlResolver,
                         CourseCoverStorage coverStorage) {
        this.courseMapper = courseMapper;
        this.mediaUrlResolver = mediaUrlResolver;
        this.coverStorage = coverStorage;
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
        applyRequest(course, request);
        course.setUpdatedTime(Instant.now());
        courseMapper.updateById(course);

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
        return courseMapper.deleteById(id) > 0;
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
        }
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
