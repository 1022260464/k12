package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.mapper.TeachingResourceEventMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

@Service
public class TeachingResourceIndexState {
    private static final Duration STALE_AFTER = Duration.ofMinutes(15);
    private static final long MAX_INDEX_BYTES = 20L * 1024 * 1024;
    private static final Set<String> INDEXABLE = Set.of("application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation");

    private final TeachingResourceMapper mapper;
    private final TeachingResourceEventMapper events;

    public TeachingResourceIndexState(TeachingResourceMapper mapper, TeachingResourceEventMapper events) {
        this.mapper = mapper;
        this.events = events;
    }

    @Transactional
    public TeachingResourceResponse beginIndex(long id, long actorId) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus())) conflict("只有已发布资料可入库");
        requireIndexable(resource);
        String current = resource.getRagIndexStatus();
        if ("INDEXED".equals(current)) conflict("资料已经入库");
        if ("DEINDEXING".equals(current) || ("INDEXING".equals(current) && !stale(resource))) {
            conflict("资料正在处理，请稍后刷新");
        }
        if ("UNKNOWN".equals(current) && !stale(resource)) conflict("入库结果待确认，15 分钟后可重试");
        changeIndex(resource, actorId, "INDEX_START", "INDEXING", null);
        return TeachingResourceResponse.from(resource);
    }

    /**
     * 已入库资料切换向量模型或调整切分策略后，可显式重新生成向量。
     * 这里不删除原文档；Python 端成功写入后会按同一 documentId 原子替换旧片段。
     */
    @Transactional
    public TeachingResourceResponse beginReindex(long id, long actorId) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus())) conflict("只有已发布资料可重新向量化");
        requireIndexable(resource);
        if (!"INDEXED".equals(resource.getRagIndexStatus())) {
            conflict("只有已入库资料可重新向量化");
        }
        changeIndex(resource, actorId, "REINDEX_START", "INDEXING", "重新提取文本并生成向量");
        return TeachingResourceResponse.from(resource);
    }

    @Transactional
    public void indexSucceeded(long id, long actorId, String note) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus()) || !"INDEXING".equals(resource.getRagIndexStatus())) {
            throw new IllegalStateException("入库完成时资料状态已变化");
        }
        changeIndex(resource, actorId, "INDEX_SUCCESS", "INDEXED", note);
    }

    @Transactional
    public void indexFailed(long id, long actorId, String note) {
        TeachingResource resource = locked(id);
        if ("INDEXING".equals(resource.getRagIndexStatus())) {
            changeIndex(resource, actorId, "INDEX_FAILED", "FAILED", note);
        }
    }

    @Transactional
    public void indexUnknown(long id, long actorId) {
        TeachingResource resource = locked(id);
        if ("INDEXING".equals(resource.getRagIndexStatus())) {
            changeIndex(resource, actorId, "INDEX_UNKNOWN", "UNKNOWN", "远端结果待确认，15 分钟后可重试或撤回");
        }
    }

    @Transactional
    public void reindexSucceeded(long id, long actorId, String note) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus()) || !"INDEXING".equals(resource.getRagIndexStatus())) {
            throw new IllegalStateException("重新向量化完成时资料状态已变化");
        }
        changeIndex(resource, actorId, "REINDEX_SUCCESS", "INDEXED", note);
    }

    @Transactional
    public void reindexFailed(long id, long actorId, String note) {
        TeachingResource resource = locked(id);
        if ("INDEXING".equals(resource.getRagIndexStatus())) {
            changeIndex(resource, actorId, "REINDEX_FAILED", "FAILED", note);
        }
    }

    @Transactional
    public void reindexUnknown(long id, long actorId) {
        TeachingResource resource = locked(id);
        if ("INDEXING".equals(resource.getRagIndexStatus())) {
            changeIndex(resource, actorId, "REINDEX_UNKNOWN", "UNKNOWN", "远端结果待确认，15 分钟后可重试或撤回");
        }
    }

    @Transactional
    public boolean beginWithdrawal(long id, long actorId) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus())) conflict("只有已发布资料可撤回");
        String current = resource.getRagIndexStatus();
        if ("INDEXING".equals(current)) conflict("资料正在入库，请完成后再撤回");
        if ("UNKNOWN".equals(current) && !stale(resource)) conflict("入库结果待确认，15 分钟后可撤回");
        if ("DEINDEXING".equals(current) && !stale(resource)) conflict("资料正在撤回，请稍后刷新");
        if ("NOT_INDEXED".equals(current)) {
            finishWithdrawal(resource, actorId);
            return false;
        }
        changeIndex(resource, actorId, "DEINDEX_START", "DEINDEXING", null);
        return true;
    }

    @Transactional
    public TeachingResourceResponse withdrawalSucceeded(long id, long actorId) {
        TeachingResource resource = locked(id);
        if (!"PUBLISHED".equals(resource.getStatus()) || !"DEINDEXING".equals(resource.getRagIndexStatus())) {
            throw new IllegalStateException("撤回完成时资料状态已变化");
        }
        changeIndex(resource, actorId, "DEINDEX_SUCCESS", "NOT_INDEXED", null);
        finishWithdrawal(resource, actorId);
        return TeachingResourceResponse.from(resource);
    }

    @Transactional
    public void withdrawalFailed(long id, long actorId, String note) {
        TeachingResource resource = locked(id);
        if ("DEINDEXING".equals(resource.getRagIndexStatus())) {
            changeIndex(resource, actorId, "DEINDEX_FAILED", "FAILED", note);
        }
    }

    private void finishWithdrawal(TeachingResource resource, long actorId) {
        resource.setStatus("WITHDRAWN");
        resource.setUpdatedTime(Instant.now());
        mapper.updateById(resource);
        event(resource.getId(), actorId, "WITHDRAW", "PUBLISHED", "WITHDRAWN", null);
    }

    private void changeIndex(TeachingResource resource, long actorId, String action, String to, String note) {
        String from = resource.getRagIndexStatus();
        resource.setRagIndexStatus(to);
        resource.setUpdatedTime(Instant.now());
        mapper.updateById(resource);
        event(resource.getId(), actorId, action, from, to, note);
    }

    private void event(long id, long actorId, String action, String from, String to, String note) {
        TeachingResourceEvent event = new TeachingResourceEvent();
        event.setResourceId(id);
        event.setActorId(actorId);
        event.setAction(action);
        event.setFromStatus(from);
        event.setToStatus(to);
        event.setNote(note);
        event.setCreatedTime(Instant.now());
        events.insert(event);
    }

    private TeachingResource locked(long id) {
        TeachingResource resource = mapper.selectForUpdate(id);
        if (resource == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "资料不存在");
        return resource;
    }

    private void requireIndexable(TeachingResource resource) {
        if (!INDEXABLE.contains(resource.getMimeType()) || resource.getSizeBytes() == null
                || resource.getSizeBytes() > MAX_INDEX_BYTES) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "仅支持不超过 20 MB 的 PDF、DOCX、PPTX 文本入库");
        }
    }

    private boolean stale(TeachingResource resource) {
        return resource.getUpdatedTime() != null
                && resource.getUpdatedTime().isBefore(Instant.now().minus(STALE_AFTER));
    }

    private void conflict(String message) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
