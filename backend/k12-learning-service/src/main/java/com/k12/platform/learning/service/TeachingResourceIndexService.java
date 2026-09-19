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
        long actorId = K12SecurityContext.requireUserId();
        TeachingResourceResponse response = state.beginIndex(id, actorId);
        try {
            executor.execute(() -> indexInBackground(id, actorId));
        } catch (RuntimeException error) {
            state.indexFailed(id, actorId, "后台入库任务队列已满");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "后台入库任务队列已满");
        }
        return response;
    }

    /**
     * 已入库资料：仅按当前 knowledgeCode + 简介同步图谱 EXPLAINS，无需重新抽向量。
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
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

    private void indexInBackground(long id, long actorId) {
        try {
            TeachingResource resource = mapper.selectById(id);
            if (resource == null) throw new IllegalStateException("资料不存在");
            TeachingResourceIndexClient.IndexedResult result = client.index(resource);
            state.indexSucceeded(id, actorId, "文档 " + result.documentId() + "，片段 " + result.chunkCount());
            if (StringUtils.hasText(resource.getKnowledgeCode())) {
                knowledgeGraphService.syncDocumentExplains(
                        result.documentId() != null ? result.documentId() : "teaching-resource-" + id,
                        resource.getKnowledgeCode(),
                        resource.getTitle(),
                        resource.getDescription()
                );
            }
        } catch (TeachingResourceIndexClient.IndexOutcomeUnknownException error) {
            log.warn("教学资料入库远端结果待确认：id={}", id, error);
            state.indexUnknown(id, actorId);
        } catch (RuntimeException error) {
            log.warn("教学资料入库失败：id={}", id, error);
            try {
                state.indexFailed(id, actorId, error instanceof ResponseStatusException status
                        ? status.getReason() : "知识库入库失败，请查看 Learning/Python 服务日志");
            } catch (RuntimeException stateError) {
                log.error("教学资料入库失败状态回写失败：id={}", id, stateError);
            }
        }
    }
}
