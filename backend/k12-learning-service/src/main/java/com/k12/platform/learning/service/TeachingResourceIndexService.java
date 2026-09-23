package com.k12.platform.learning.service;

import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.TeachingResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TeachingResourceIndexService {
    private static final Logger log = LoggerFactory.getLogger(TeachingResourceIndexService.class);
    private final TeachingResourceIndexState state;
    private final TeachingResourceIndexClient client;
    private final TeachingResourceMapper mapper;
    private final KnowledgeGraphService knowledgeGraphService;
    private final TaskExecutor executor;

    public TeachingResourceIndexService(TeachingResourceIndexState state, TeachingResourceIndexClient client,
                                        TeachingResourceMapper mapper, KnowledgeGraphService knowledgeGraphService,
                                        @Qualifier("teachingResourceIndexExecutor") TaskExecutor executor) {
        this.state = state;
        this.client = client;
        this.mapper = mapper;
        this.knowledgeGraphService = knowledgeGraphService;
        this.executor = executor;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse index(long id) {
        return scheduleIndex(id, false);
    }

    /**
     * 为已入库资料重新提取文本并生成向量，主要用于切换 embedding 模型或切分策略。
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse reindex(long id) {
        return scheduleIndex(id, true);
    }

    private TeachingResourceResponse scheduleIndex(long id, boolean reindex) {
        TeachingResource resource = mapper.selectById(id);
        if (resource == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "资料不存在");
        }
        if (!StringUtils.hasText(resource.getKnowledgeCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "入库前请填写主知识点编码");
        }
        if (!StringUtils.hasText(resource.getDescription())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "入库前请填写资料简介（将写入知识图谱）");
        }
        knowledgeGraphService.requireCatalogCode(resource.getKnowledgeCode());
        long actorId = K12SecurityContext.requireUserId();
        TeachingResourceResponse response = reindex
                ? state.beginReindex(id, actorId)
                : state.beginIndex(id, actorId);
        try {
            executor.execute(() -> indexInBackground(id, actorId, reindex));
        } catch (RuntimeException error) {
            if (reindex) {
                state.reindexFailed(id, actorId, "后台入库任务队列已满");
            } else {
                state.indexFailed(id, actorId, "后台入库任务队列已满");
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "后台入库任务队列已满");
        }
        return response;
    }

    /**
     * 已入库资料：仅按当前 knowledgeCode + 简介同步图谱 EXPLAINS，无需重新抽向量。
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse syncGraph(long id) {
        TeachingResource resource = mapper.selectById(id);
        if (resource == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "资料不存在");
        }
        if (!"PUBLISHED".equals(resource.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅已发布资料可同步图谱");
        }
        if (!"INDEXED".equals(resource.getRagIndexStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "请先完成知识库入库，再同步图谱");
        }
        if (!StringUtils.hasText(resource.getKnowledgeCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先填写主知识点编码");
        }
        if (!StringUtils.hasText(resource.getDescription())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先填写资料简介（将写入图谱 description）");
        }
        knowledgeGraphService.requireCatalogCode(resource.getKnowledgeCode());
        String documentId = "teaching-resource-" + id;
        knowledgeGraphService.syncDocumentExplains(
                documentId,
                resource.getKnowledgeCode(),
                resource.getTitle(),
                resource.getDescription()
        );
        return TeachingResourceResponse.from(resource);
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceResponse withdraw(long id) {
        long actorId = K12SecurityContext.requireUserId();
        if (!state.beginWithdrawal(id, actorId)) {
            return TeachingResourceResponse.from(mapper.selectById(id));
        }
        try {
            client.delete(id);
            TeachingResource resource = mapper.selectById(id);
            if (resource != null) {
                knowledgeGraphService.removeDocumentExplains("teaching-resource-" + id);
            }
            return state.withdrawalSucceeded(id, actorId);
        } catch (RuntimeException error) {
            log.warn("教学资料撤回去索引失败：id={}", id, error);
            state.withdrawalFailed(id, actorId, "知识库删除失败，资料仍保持发布状态");
            throw error;
        }
    }

    private void indexInBackground(long id, long actorId, boolean reindex) {
        try {
            TeachingResource resource = mapper.selectById(id);
            if (resource == null) throw new IllegalStateException("资料不存在");
            TeachingResourceIndexClient.IndexedResult result = client.index(resource);
            String note = "文档 " + result.documentId() + "，片段 " + result.chunkCount();
            if (reindex) {
                state.reindexSucceeded(id, actorId, note);
            } else {
                state.indexSucceeded(id, actorId, note);
            }
            if (StringUtils.hasText(resource.getKnowledgeCode())) {
                try {
                    knowledgeGraphService.syncDocumentExplains(
                            result.documentId() != null ? result.documentId() : "teaching-resource-" + id,
                            resource.getKnowledgeCode(),
                            resource.getTitle(),
                            resource.getDescription()
                    );
                } catch (RuntimeException graphError) {
                    log.warn("教学资料入库成功但同步图谱失败：id={}, err={}", id, graphError.getMessage());
                }
            }
        } catch (TeachingResourceIndexClient.IndexOutcomeUnknownException error) {
            log.warn("教学资料入库远端结果待确认：id={}", id, error);
            if (reindex) {
                state.reindexUnknown(id, actorId);
            } else {
                state.indexUnknown(id, actorId);
            }
        } catch (RuntimeException error) {
            log.warn("教学资料入库失败：id={}", id, error);
            try {
                String note = error instanceof ResponseStatusException status
                        ? status.getReason() : "知识库入库失败，请查看 Learning/Python 服务日志";
                if (reindex) {
                    state.reindexFailed(id, actorId, note);
                } else {
                    state.indexFailed(id, actorId, note);
                }
            } catch (RuntimeException stateError) {
                log.error("教学资料入库失败状态回写失败：id={}", id, stateError);
            }
        }
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public TeachingResourceIndexClient.SearchResult testSearch(
            TeachingResourceIndexClient.SearchRequest request) {
        return client.search(request);
    }
}
