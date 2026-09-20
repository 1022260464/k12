package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.TeachingResourceMetadata;
import com.k12.platform.learning.dto.TeachingResourcePage;
import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.TeachingResourceBindingMapper;
import com.k12.platform.learning.mapper.TeachingResourceEventMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceBinding;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class TeachingResourceService {
    private static final String ADMIN = K12Authorities.ROLE_ADMIN;
    private static final Pattern KNOWLEDGE_CODE = Pattern.compile("[a-z][a-z0-9_.-]{2,63}");
    private final TeachingResourceMapper mapper;
    private final TeachingResourceEventMapper eventMapper;
    private final TeachingResourceBindingMapper bindingMapper;
    private final TeachingResourceStorage storage;
    private final CourseMapper courseMapper;
    private final CourseChapterMapper chapterMapper;
    private final KnowledgeGraphService knowledgeGraphService;

    public TeachingResourceService(TeachingResourceMapper mapper, TeachingResourceEventMapper eventMapper,
                                   TeachingResourceBindingMapper bindingMapper, TeachingResourceStorage storage,
                                   CourseMapper courseMapper, CourseChapterMapper chapterMapper,
                                   KnowledgeGraphService knowledgeGraphService) {
        this.mapper = mapper;
        this.eventMapper = eventMapper;
        this.bindingMapper = bindingMapper;
        this.storage = storage;
        this.courseMapper = courseMapper;
        this.chapterMapper = chapterMapper;
        this.knowledgeGraphService = knowledgeGraphService;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public TeachingResourcePage search(int page, int size, String status, String keyword) {
        if (page < 1 || size < 1 || size > 100 || (keyword != null && keyword.length() > 128)) {
            throw new IllegalArgumentException("分页或搜索参数不合法");
        }
        if (StringUtils.hasText(status)) requireStatus(status);
        Long ownerId = K12SecurityContext.hasAuthority(ADMIN) ? null : K12SecurityContext.requireUserId();
        List<TeachingResource> rows = mapper.search(ownerId, clean(status), clean(keyword), size + 1,
                (long) (page - 1) * size);
        return new TeachingResourcePage(page, size, rows.size() > size,
                rows.stream().limit(size).map(this::toResponse).toList());
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public TeachingResourcePage published(int page, int size) {
        if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数不合法");
        List<TeachingResource> rows = mapper.search(null, "PUBLISHED", null, size + 1, (long) (page - 1) * size);
        return new TeachingResourcePage(page, size, rows.size() > size,
                rows.stream().limit(size).map(this::toResponse).toList());
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public TeachingResourceResponse getPublished(long id) {
        return toResponse(requirePublished(id));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public String publishedDownload(long id) {
        return storage.downloadUrl(requirePublished(id).getObjectKey());
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public TeachingResourceResponse get(long id) {
        return toResponse(requireVisible(id));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public String download(long id) {
        return storage.downloadUrl(requireVisible(id).getObjectKey());
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public List<TeachingResourceEvent> history(long id) {
        requireVisible(id);
        return eventMapper.recent(id);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:create')")
    public TeachingResourceResponse upload(TeachingResourceMetadata metadata, MultipartFile file) {
        Long actorId = K12SecurityContext.requireUserId();
        List<TeachingResourceBinding> bindings = resolveBindings(metadata);
        TeachingResource resource = new TeachingResource();
        applyMetadata(resource, metadata, bindings);
        TeachingResourceStorage.StoredFile stored = storage.upload(file);
        try {
            resource.setObjectKey(stored.objectKey());
            resource.setOriginalFilename(stored.filename());
            resource.setMimeType(stored.mimeType());
            resource.setSizeBytes(stored.sizeBytes());
            resource.setCreatedBy(actorId);
            resource.setStatus("DRAFT");
            resource.setRagIndexStatus("NOT_INDEXED");
            resource.setCreatedTime(Instant.now());
            resource.setUpdatedTime(resource.getCreatedTime());
            mapper.insert(resource);
            replaceBindings(resource.getId(), bindings);
            event(resource.getId(), actorId, "UPLOAD", null, "DRAFT", null);
            return toResponse(resource);
        } catch (RuntimeException error) {
            storage.removeQuietly(stored.objectKey());
            throw error;
        }
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public TeachingResourceResponse update(long id, TeachingResourceMetadata metadata) {
        TeachingResource resource = locked(id);
        requireOwner(resource);
        if (!List.of("DRAFT", "REJECTED").contains(resource.getStatus())) conflict("只能编辑草稿或被驳回的资料");
        List<TeachingResourceBinding> bindings = resolveBindings(metadata);
        applyMetadata(resource, metadata, bindings);
        resource.setUpdatedTime(Instant.now());
        mapper.updateById(resource);
        replaceBindings(id, bindings);
        event(id, K12SecurityContext.requireUserId(), "UPDATE", resource.getStatus(), resource.getStatus(), null);
        return toResponse(resource);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:create')")
    public TeachingResourceResponse submit(long id) {
        TeachingResource resource = locked(id);
        requireOwner(resource);
        if (!List.of("DRAFT", "REJECTED").contains(resource.getStatus())) conflict("只有草稿或被驳回的资料可提交审核");
        return transition(resource, "SUBMIT", "PENDING_REVIEW", null);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse review(long id, boolean approved, String note) {
        TeachingResource resource = locked(id);
        if (!"PENDING_REVIEW".equals(resource.getStatus())) conflict("仅待审核资料可审核");
        if (!approved && !StringUtils.hasText(note)) throw new IllegalArgumentException("驳回时请填写原因");
        resource.setReviewedBy(K12SecurityContext.requireUserId());
        resource.setReviewedTime(Instant.now());
        resource.setReviewNote(clean(note));
        return transition(resource, approved ? "APPROVE" : "REJECT", approved ? "APPROVED" : "REJECTED", note);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse publish(long id) {
        TeachingResource resource = locked(id);
        if (!"APPROVED".equals(resource.getStatus())) conflict("只有审核通过的资料可发布");
        if (!StringUtils.hasText(resource.getKnowledgeCode())) {
            throw new IllegalArgumentException("发布前请填写主知识点编码");
        }
        if (!StringUtils.hasText(resource.getDescription())) {
            throw new IllegalArgumentException("发布前请填写资料简介（入库后会写入知识图谱）");
        }
        knowledgeGraphService.requireCatalogCode(resource.getKnowledgeCode());
        resource.setPublishedBy(K12SecurityContext.requireUserId());
        resource.setPublishedTime(Instant.now());
        // 发布仅变更教学可见性；知识库入库必须由后续单独的管理员操作触发。
        return transition(resource, "PUBLISH", "PUBLISHED", null);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public TeachingResourceResponse reopen(long id) {
        TeachingResource resource = locked(id);
        requireOwner(resource);
        if (!"WITHDRAWN".equals(resource.getStatus())) conflict("只有已撤回资料可重新编辑");
        return transition(resource, "REOPEN", "DRAFT", null);
    }

    private TeachingResourceResponse transition(TeachingResource resource, String action, String to, String note) {
        String from = resource.getStatus();
        resource.setStatus(to);
        resource.setUpdatedTime(Instant.now());
        mapper.updateById(resource);
        event(resource.getId(), K12SecurityContext.requireUserId(), action, from, to, clean(note));
        return toResponse(resource);
    }

    private void event(Long id, Long actorId, String action, String from, String to, String note) {
        TeachingResourceEvent event = new TeachingResourceEvent();
        event.setResourceId(id);
        event.setActorId(actorId);
        event.setAction(action);
        event.setFromStatus(from);
        event.setToStatus(to);
        event.setNote(note);
        event.setCreatedTime(Instant.now());
        eventMapper.insert(event);
    }

    private TeachingResource requireVisible(long id) {
        TeachingResource resource = mapper.selectById(id);
        if (resource == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "资料不存在");
        requireOwner(resource);
        return resource;
    }

    private TeachingResource requirePublished(long id) {
        TeachingResource resource = mapper.selectById(id);
        if (resource == null || !"PUBLISHED".equals(resource.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "已发布资料不存在");
        }
        return resource;
    }

    private TeachingResource locked(long id) {
        TeachingResource resource = mapper.selectForUpdate(id);
        if (resource == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "资料不存在");
        return resource;
    }

    private void requireOwner(TeachingResource resource) {
        if (!K12SecurityContext.hasAuthority(ADMIN)
                && !K12SecurityContext.requireUserId().equals(resource.getCreatedBy())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能访问自己上传的资料");
        }
    }

    private TeachingResourceResponse toResponse(TeachingResource resource) {
        List<TeachingResourceBinding> rows = bindingMapper.selectList(Wrappers.lambdaQuery(TeachingResourceBinding.class)
                .eq(TeachingResourceBinding::getResourceId, resource.getId())
                .orderByAsc(TeachingResourceBinding::getId));
        if (rows.isEmpty() && resource.getCourseId() != null) {
            TeachingResourceBinding legacy = new TeachingResourceBinding();
            legacy.setCourseId(resource.getCourseId());
            legacy.setChapterId(resource.getChapterId());
            legacy.setChapterTitle(resource.getChapterTitle());
            rows = List.of(legacy);
        }
        List<TeachingResourceResponse.BindingView> views = rows.stream().map(row -> {
            Course course = courseMapper.selectById(row.getCourseId());
            return TeachingResourceResponse.fromBinding(row, course == null ? null : course.getTitle());
        }).toList();
        return TeachingResourceResponse.from(resource, views);
    }

    private List<TeachingResourceBinding> resolveBindings(TeachingResourceMetadata metadata) {
        List<TeachingResourceMetadata.Binding> requested = metadata.bindings();
        if (requested == null || requested.isEmpty()) {
            if (metadata.courseId() == null && metadata.chapterId() == null) return List.of();
            requested = List.of(new TeachingResourceMetadata.Binding(metadata.courseId(), metadata.chapterId()));
        }
        if (requested.size() > 50) throw new IllegalArgumentException("最多关联 50 条课程/章节绑定");
        Map<String, TeachingResourceBinding> unique = new LinkedHashMap<>();
        for (TeachingResourceMetadata.Binding item : requested) {
            if (item == null || item.courseId() == null) {
                throw new IllegalArgumentException("绑定项必须包含课程");
            }
            Course course = courseMapper.selectById(item.courseId());
            if (course == null) throw new IllegalArgumentException("关联课程不存在");
            if (!K12SecurityContext.hasAuthority(ADMIN)
                    && !K12SecurityContext.requireUserId().equals(course.getTeacherId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能关联自己创建的课程");
            }
            if (!Integer.valueOf(1).equals(course.getStatus())) {
                throw new IllegalArgumentException("只能关联已发布课程");
            }
            if (!metadata.subject().trim().equalsIgnoreCase(course.getSubject().trim())) {
                throw new IllegalArgumentException("资料学科必须与关联课程一致：" + course.getTitle());
            }
            String chapterTitle = null;
            if (item.chapterId() != null) {
                CourseChapter chapter = chapterMapper.selectById(item.chapterId());
                if (chapter == null || !item.courseId().equals(chapter.getCourseId())) {
                    throw new IllegalArgumentException("章节不属于所选课程或已删除");
                }
                chapterTitle = chapter.getTitle();
            }
            String key = item.courseId() + ":" + Objects.toString(item.chapterId(), "0");
            TeachingResourceBinding binding = new TeachingResourceBinding();
            binding.setCourseId(item.courseId());
            binding.setChapterId(item.chapterId());
            binding.setChapterTitle(chapterTitle);
            unique.put(key, binding);
        }
        return new ArrayList<>(unique.values());
    }

    private void replaceBindings(Long resourceId, List<TeachingResourceBinding> bindings) {
        bindingMapper.delete(Wrappers.lambdaQuery(TeachingResourceBinding.class)
                .eq(TeachingResourceBinding::getResourceId, resourceId));
        Instant now = Instant.now();
        for (TeachingResourceBinding binding : bindings) {
            binding.setId(null);
            binding.setResourceId(resourceId);
            binding.setCreatedTime(now);
            bindingMapper.insert(binding);
        }
    }

    private void applyMetadata(TeachingResource resource, TeachingResourceMetadata metadata,
                               List<TeachingResourceBinding> bindings) {
        if (!List.of("LOW_PRIMARY", "HIGH_PRIMARY", "JUNIOR_HIGH", "SENIOR_HIGH")
                .contains(metadata.stageCode())) {
            throw new IllegalArgumentException("请选择有效的学段");
        }
        String grade = clean(metadata.grade());
        TeachingResourceBinding primary = bindings.isEmpty() ? null : bindings.get(0);
        if (primary != null) {
            Course course = courseMapper.selectById(primary.getCourseId());
            String courseGrade = course == null ? null : clean(course.getGradeLevel());
            if (grade != null && courseGrade != null && !grade.equals(courseGrade)) {
                throw new IllegalArgumentException("资料年级必须与关联课程一致");
            }
            if (grade == null) grade = courseGrade;
        }
        String knowledgeCode = clean(metadata.knowledgeCode());
        if (!K12SecurityContext.hasAuthority(ADMIN)) {
            // 教师默认不能改知识点绑定：新建清空；编辑保留原值。
            knowledgeCode = resource.getId() == null ? null : resource.getKnowledgeCode();
        }
        if (knowledgeCode != null && !KNOWLEDGE_CODE.matcher(knowledgeCode).matches()) {
            throw new IllegalArgumentException("知识点编码格式不合法");
        }
        if (knowledgeCode != null) {
            knowledgeGraphService.requireCatalogCode(knowledgeCode);
        }
        resource.setTitle(metadata.title().trim());
        resource.setDescription(clean(metadata.description()));
        resource.setStageCode(metadata.stageCode().trim());
        resource.setSubject(metadata.subject().trim());
        resource.setSourceNote(metadata.sourceNote().trim());
        resource.setCourseId(primary == null ? null : primary.getCourseId());
        resource.setChapterId(primary == null ? null : primary.getChapterId());
        resource.setChapterTitle(primary == null ? null : primary.getChapterTitle());
        resource.setGrade(grade);
        resource.setTextbook(clean(metadata.textbook()));
        resource.setKnowledgeCode(knowledgeCode);
    }

    private void requireStatus(String status) {
        if (!List.of("DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "WITHDRAWN").contains(status)) {
            throw new IllegalArgumentException("资料状态不合法");
        }
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void conflict(String message) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
