package com.k12.platform.learning.service;

import com.k12.platform.learning.mapper.TeachingResourceEventMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeachingResourceIndexStateTest {
    @Mock TeachingResourceMapper mapper;
    @Mock TeachingResourceEventMapper events;
    TeachingResourceIndexState state;

    @BeforeEach
    void setup() { state = new TeachingResourceIndexState(mapper, events); }

    @Test
    void publishedDocumentRequiresExplicitIndexAndRecordsTransitions() {
        TeachingResource resource = resource("PUBLISHED", "NOT_INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);

        assertThat(state.beginIndex(7L, 42L).ragIndexStatus()).isEqualTo("INDEXING");
        state.indexSucceeded(7L, 42L, "文档 teaching-resource-7，片段 1");

        assertThat(resource.getRagIndexStatus()).isEqualTo("INDEXED");
        ArgumentCaptor<TeachingResourceEvent> captor = ArgumentCaptor.forClass(TeachingResourceEvent.class);
        verify(events, org.mockito.Mockito.times(2)).insert(captor.capture());
        assertThat(captor.getAllValues()).extracting(TeachingResourceEvent::getAction)
                .containsExactly("INDEX_START", "INDEX_SUCCESS");
    }

    @Test
    void indexFailureCanRetryWithoutUnpublishing() {
        TeachingResource resource = resource("PUBLISHED", "NOT_INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);
        state.beginIndex(7L, 42L);
        state.indexFailed(7L, 42L, "Python 服务不可用");
        assertThat(resource.getStatus()).isEqualTo("PUBLISHED");
        assertThat(resource.getRagIndexStatus()).isEqualTo("FAILED");
        assertThat(state.beginIndex(7L, 42L).ragIndexStatus()).isEqualTo("INDEXING");
    }

    @Test
    void indexedDocumentCanBeReindexedWithDedicatedAuditActions() {
        TeachingResource resource = resource("PUBLISHED", "INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);

        assertThat(state.beginReindex(7L, 42L).ragIndexStatus()).isEqualTo("INDEXING");
        state.reindexSucceeded(7L, 42L, "文档 teaching-resource-7，片段 2");

        assertThat(resource.getRagIndexStatus()).isEqualTo("INDEXED");
        ArgumentCaptor<TeachingResourceEvent> captor = ArgumentCaptor.forClass(TeachingResourceEvent.class);
        verify(events, org.mockito.Mockito.times(2)).insert(captor.capture());
        assertThat(captor.getAllValues()).extracting(TeachingResourceEvent::getAction)
                .containsExactly("REINDEX_START", "REINDEX_SUCCESS");
    }

    @Test
    void documentMustAlreadyBeIndexedBeforeReindex() {
        when(mapper.selectForUpdate(7L)).thenReturn(resource("PUBLISHED", "NOT_INDEXED"));
        assertThatThrownBy(() -> state.beginReindex(7L, 42L))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("只有已入库");
    }

    @Test
    void uncertainRemoteOutcomeBlocksEarlyRetryAndWithdrawal() {
        TeachingResource resource = resource("PUBLISHED", "NOT_INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);
        state.beginIndex(7L, 42L);
        state.indexUnknown(7L, 42L);
        assertThat(resource.getRagIndexStatus()).isEqualTo("UNKNOWN");
        assertThatThrownBy(() -> state.beginIndex(7L, 42L))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("15 分钟");
        assertThatThrownBy(() -> state.beginWithdrawal(7L, 42L))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("15 分钟");
        resource.setUpdatedTime(Instant.now().minusSeconds(901));
        assertThat(state.beginWithdrawal(7L, 42L)).isTrue();
    }

    @Test
    void withdrawalDeletesIndexBeforeHidingResource() {
        TeachingResource resource = resource("PUBLISHED", "INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);

        assertThat(state.beginWithdrawal(7L, 42L)).isTrue();
        assertThat(resource.getStatus()).isEqualTo("PUBLISHED");
        assertThat(resource.getRagIndexStatus()).isEqualTo("DEINDEXING");

        state.withdrawalSucceeded(7L, 42L);
        assertThat(resource.getStatus()).isEqualTo("WITHDRAWN");
        assertThat(resource.getRagIndexStatus()).isEqualTo("NOT_INDEXED");
    }

    @Test
    void failedDeindexKeepsResourcePublishedForRetry() {
        TeachingResource resource = resource("PUBLISHED", "INDEXED");
        when(mapper.selectForUpdate(7L)).thenReturn(resource);
        state.beginWithdrawal(7L, 42L);
        state.withdrawalFailed(7L, 42L, "删除失败");
        assertThat(resource.getStatus()).isEqualTo("PUBLISHED");
        assertThat(resource.getRagIndexStatus()).isEqualTo("FAILED");
    }

    @Test
    void draftCannotIndex() {
        when(mapper.selectForUpdate(7L)).thenReturn(resource("DRAFT", "NOT_INDEXED"));
        assertThatThrownBy(() -> state.beginIndex(7L, 42L))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("只有已发布");
        verify(mapper, never()).updateById(any(TeachingResource.class));
    }

    private TeachingResource resource(String status, String indexStatus) {
        TeachingResource resource = new TeachingResource();
        resource.setId(7L);
        resource.setStatus(status);
        resource.setRagIndexStatus(indexStatus);
        resource.setMimeType("application/pdf");
        resource.setSizeBytes(1024L);
        resource.setUpdatedTime(Instant.now());
        return resource;
    }
}
