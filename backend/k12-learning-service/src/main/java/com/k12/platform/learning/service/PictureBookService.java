package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.PictureBookCreateRequest;
import com.k12.platform.learning.dto.PictureBookPageRequest;
import com.k12.platform.learning.dto.PictureBookPageResponse;
import com.k12.platform.learning.dto.PictureBookResponse;
import com.k12.platform.learning.dto.PictureBookUpdateRequest;
import com.k12.platform.learning.mapper.PictureBookMapper;
import com.k12.platform.learning.mapper.PictureBookPageMapper;
import com.k12.platform.learning.model.PictureBook;
import com.k12.platform.learning.model.PictureBookPage;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class PictureBookService {
    private static final String DRAFT = "DRAFT";
    private static final String PENDING_REVIEW = "PENDING_REVIEW";
    private static final String APPROVED = "APPROVED";
    private static final String PUBLISHED = "PUBLISHED";
    private static final String OFFLINE = "OFFLINE";

    private final PictureBookMapper bookMapper;
    private final PictureBookPageMapper pageMapper;
    private final CourseMediaUrlResolver mediaUrlResolver;
    private final ObjectMapper objectMapper;

    public PictureBookService(PictureBookMapper bookMapper, PictureBookPageMapper pageMapper,
                              CourseMediaUrlResolver mediaUrlResolver, ObjectMapper objectMapper) {
        this.bookMapper = bookMapper;
        this.pageMapper = pageMapper;
        this.mediaUrlResolver = mediaUrlResolver;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("permitAll()")
    public List<PictureBookResponse> listPublished() {
        return bookMapper.selectList(Wrappers.lambdaQuery(PictureBook.class)
                        .eq(PictureBook::getStatus, PUBLISHED)
                        .orderByAsc(PictureBook::getSortOrder, PictureBook::getId))
                .stream().map(this::toResponse).toList();
    }

    @PreAuthorize("permitAll()")
    public PictureBookResponse getPublished(String code) {
        PictureBook book = bookMapper.selectOne(Wrappers.lambdaQuery(PictureBook.class)
                .eq(PictureBook::getBookCode, code)
                .eq(PictureBook::getStatus, PUBLISHED));
        if (book == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "绘本不存在或未发布");
        return toResponse(book);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public List<PictureBookResponse> listAdmin() {
        return bookMapper.selectList(Wrappers.lambdaQuery(PictureBook.class)
                        .orderByAsc(PictureBook::getSortOrder)
                        .orderByDesc(PictureBook::getUpdatedTime, PictureBook::getId))
                .stream().map(this::toResponse).toList();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse getAdmin(long id) {
        return toResponse(requireBook(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse create(PictureBookCreateRequest request) {
        validatePages(request.pages());
        if (bookMapper.selectCount(Wrappers.lambdaQuery(PictureBook.class)
                .eq(PictureBook::getBookCode, request.bookCode())) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "绘本编码已存在");
        }
        validateMedia(request.coverObjectKey(), request.coverFallbackUrl(), "绘本封面");
        Long actor = K12SecurityContext.requireUserId();
        Instant now = Instant.now();
        PictureBook book = new PictureBook();
        book.setBookCode(request.bookCode().trim());
        apply(book, request.title(), request.subtitle(), request.summary(), request.stageCode(),
                request.knowledgeCode(), request.coverObjectKey(), request.coverFallbackUrl(),
                request.challengeType(), request.challengeReference(), request.sortOrder());
        book.setStatus(DRAFT);
        book.setContentVersion(1);
        book.setLockVersion(0);
        book.setCreatedBy(actor);
        book.setUpdatedBy(actor);
        book.setCreatedTime(now);
        book.setUpdatedTime(now);
        bookMapper.insert(book);
        replacePages(book.getId(), request.pages());
        return toResponse(bookMapper.selectById(book.getId()));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse update(long id, PictureBookUpdateRequest request) {
        PictureBook book = requireBook(id);
        if (PUBLISHED.equals(book.getStatus()) || PENDING_REVIEW.equals(book.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "请先下架或撤回审核后再修改绘本");
        }
        requireLock(book, request.lockVersion());
        validatePages(request.pages());
        validateMedia(request.coverObjectKey(), request.coverFallbackUrl(), "绘本封面");
        apply(book, request.title(), request.subtitle(), request.summary(), request.stageCode(),
                request.knowledgeCode(), request.coverObjectKey(), request.coverFallbackUrl(),
                request.challengeType(), request.challengeReference(), request.sortOrder());
        book.setStatus(DRAFT);
        book.setReviewNote(null);
        book.setReviewedBy(null);
        book.setReviewedTime(null);
        bumpAndUpdate(book);
        replacePages(id, request.pages());
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse submit(long id) {
        PictureBook book = requireBook(id);
        requireStatus(book, DRAFT, "只有草稿可以提交审核");
        requirePages(book.getId());
        book.setStatus(PENDING_REVIEW);
        bumpAndUpdate(book);
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse approve(long id, String note) {
        PictureBook book = requireBook(id);
        requireStatus(book, PENDING_REVIEW, "只有待审核绘本可以批准");
        book.setStatus(APPROVED);
        book.setReviewNote(clean(note));
        book.setReviewedBy(K12SecurityContext.requireUserId());
        book.setReviewedTime(Instant.now());
        bumpAndUpdate(book);
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse reject(long id, String note) {
        PictureBook book = requireBook(id);
        requireStatus(book, PENDING_REVIEW, "只有待审核绘本可以退回");
        book.setStatus(DRAFT);
        book.setReviewNote(StringUtils.hasText(note) ? note.trim() : "请修改后重新提交审核");
        book.setReviewedBy(K12SecurityContext.requireUserId());
        book.setReviewedTime(Instant.now());
        bumpAndUpdate(book);
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse publish(long id) {
        PictureBook book = requireBook(id);
        requireStatus(book, APPROVED, "绘本必须审核通过后才能发布");
        requirePages(book.getId());
        book.setStatus(PUBLISHED);
        book.setPublishedTime(Instant.now());
        bumpAndUpdate(book);
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PictureBookResponse offline(long id) {
        PictureBook book = requireBook(id);
        requireStatus(book, PUBLISHED, "只有已发布绘本可以下架");
        book.setStatus(OFFLINE);
        bumpAndUpdate(book);
        return toResponse(bookMapper.selectById(id));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public void delete(long id) {
        PictureBook book = requireBook(id);
        requireStatus(book, DRAFT, "只能删除草稿绘本");
        pageMapper.delete(Wrappers.lambdaQuery(PictureBookPage.class).eq(PictureBookPage::getBookId, id));
        bookMapper.deleteById(id);
    }

    private void apply(PictureBook book, String title, String subtitle, String summary, String stageCode,
                       String knowledgeCode, String coverObjectKey, String coverFallbackUrl,
                       String challengeType, String challengeReference, Integer sortOrder) {
        book.setTitle(title.trim());
        book.setSubtitle(clean(subtitle));
        book.setSummary(summary.trim());
        book.setStageCode(stageCode.trim());
        book.setKnowledgeCode(knowledgeCode.trim());
        book.setCoverObjectKey(clean(coverObjectKey));
        book.setCoverFallbackUrl(clean(coverFallbackUrl));
        book.setChallengeType(challengeType.trim());
        book.setChallengeReference(challengeReference.trim());
        book.setSortOrder(sortOrder == null ? 0 : Math.max(0, sortOrder));
    }

    private void validatePages(List<PictureBookPageRequest> pages) {
        if (pages.size() > 20) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "每本绘本最多20页");
        Set<Integer> numbers = new HashSet<>();
        for (PictureBookPageRequest page : pages) {
            if (!numbers.add(page.pageNo())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "绘本页码不能重复");
            }
            validateMedia(page.imageObjectKey(), page.imageFallbackUrl(), "第" + page.pageNo() + "页图片");
        }
    }

    private void validateMedia(String objectKey, String fallbackUrl, String label) {
        String key = clean(objectKey);
        String fallback = clean(fallbackUrl);
        if (key == null && fallback == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "必须配置对象键或本地保底地址");
        }
        if (key != null && !CourseMediaUrlResolver.isAllowedObjectKey(key)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "对象键必须位于 course-assets/ 目录");
        }
        if (fallback != null && !fallback.startsWith("/assets/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "保底地址必须位于 /assets/ 目录");
        }
    }

    private void replacePages(long bookId, List<PictureBookPageRequest> pages) {
        pageMapper.delete(Wrappers.lambdaQuery(PictureBookPage.class).eq(PictureBookPage::getBookId, bookId));
        for (PictureBookPageRequest request : pages.stream().sorted((a, b) -> Integer.compare(a.pageNo(), b.pageNo())).toList()) {
            PictureBookPage page = new PictureBookPage();
            page.setBookId(bookId);
            page.setPageNo(request.pageNo());
            page.setTitle(request.title().trim());
            page.setNarration(request.narration().trim());
            page.setPrompt(clean(request.prompt()));
            page.setImageObjectKey(clean(request.imageObjectKey()));
            page.setImageFallbackUrl(clean(request.imageFallbackUrl()));
            page.setAltText(request.altText().trim());
            page.setInteractionJson(writeJson(request.interaction()));
            pageMapper.insert(page);
        }
    }

    private void requirePages(long bookId) {
        if (pageMapper.selectCount(Wrappers.lambdaQuery(PictureBookPage.class)
                .eq(PictureBookPage::getBookId, bookId)) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "绘本至少需要一页内容");
        }
    }

    private PictureBook requireBook(long id) {
        PictureBook book = bookMapper.selectById(id);
        if (book == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "绘本不存在");
        return book;
    }

    private void requireStatus(PictureBook book, String expected, String message) {
        if (!expected.equals(book.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private void requireLock(PictureBook book, Integer lockVersion) {
        if (lockVersion == null || !lockVersion.equals(book.getLockVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "绘本已被其他人修改，请刷新后重试");
        }
    }

    private void bumpAndUpdate(PictureBook book) {
        Integer expected = book.getLockVersion();
        book.setLockVersion(expected + 1);
        book.setContentVersion(book.getContentVersion() + 1);
        book.setUpdatedBy(K12SecurityContext.requireUserId());
        book.setUpdatedTime(Instant.now());
        int updated = bookMapper.update(book, Wrappers.lambdaUpdate(PictureBook.class)
                .eq(PictureBook::getId, book.getId())
                .eq(PictureBook::getLockVersion, expected));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "绘本已被其他人修改，请刷新后重试");
    }

    private PictureBookResponse toResponse(PictureBook book) {
        List<PictureBookPageResponse> pages = pageMapper.selectList(Wrappers.lambdaQuery(PictureBookPage.class)
                        .eq(PictureBookPage::getBookId, book.getId())
                        .orderByAsc(PictureBookPage::getPageNo))
                .stream().map(this::toPage).toList();
        return new PictureBookResponse(book.getId(), book.getBookCode(), book.getTitle(), book.getSubtitle(),
                book.getSummary(), book.getStageCode(), book.getKnowledgeCode(), book.getCoverObjectKey(),
                book.getCoverFallbackUrl(), resolveMedia(book.getCoverObjectKey(), book.getCoverFallbackUrl()), book.getChallengeType(),
                book.getChallengeReference(), book.getSortOrder(), book.getStatus(), book.getReviewNote(),
                book.getReviewedBy(), book.getReviewedTime(), book.getPublishedTime(), book.getContentVersion(),
                book.getLockVersion(), pages, book.getUpdatedTime());
    }

    private PictureBookPageResponse toPage(PictureBookPage page) {
        return new PictureBookPageResponse(page.getId(), page.getPageNo(), page.getTitle(), page.getNarration(),
                page.getPrompt(), page.getImageObjectKey(), page.getImageFallbackUrl(),
                resolveMedia(page.getImageObjectKey(), page.getImageFallbackUrl()),
                page.getAltText(), readJson(page.getInteractionJson()));
    }

    private String resolveMedia(String objectKey, String fallback) {
        if (StringUtils.hasText(objectKey)) {
            String resolved = mediaUrlResolver.resolve(objectKey);
            if (StringUtils.hasText(resolved)) return resolved;
        }
        return clean(fallback);
    }

    private String writeJson(JsonNode value) {
        if (value == null || value.isNull()) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "绘本互动配置格式错误");
        }
    }

    private JsonNode readJson(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return objectMapper.readTree(value);
        } catch (Exception error) {
            return null;
        }
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
