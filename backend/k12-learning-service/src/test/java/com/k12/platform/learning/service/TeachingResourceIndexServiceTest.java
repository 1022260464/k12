package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.TeachingResource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeachingResourceIndexServiceTest {
    @Mock TeachingResourceIndexState state;
    @Mock TeachingResourceIndexClient client;
    @Mock TeachingResourceMapper mapper;
    @Mock com.k12.platform.learning.knowledgegraph.KnowledgeGraphService knowledgeGraphService;
    TeachingResourceIndexService service;

    @BeforeEach
    void setup() {
        service = new TeachingResourceIndexService(state, client, mapper, knowledgeGraphService, Runnable::run);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                Jwt.withTokenValue("test").header("alg", "none").subject("admin")
                        .claim("userId", "42").build(),
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void indexRequestRunsRemoteWorkAndWritesSuccess() {
        TeachingResource resource = new TeachingResource();
        resource.setId(7L);
        resource.setRagIndexStatus("INDEXING");
        when(state.beginIndex(7L, 42L)).thenReturn(TeachingResourceResponse.from(resource));
        when(mapper.selectById(7L)).thenReturn(resource);
        when(client.index(resource)).thenReturn(
                new TeachingResourceIndexClient.IndexedResult("teaching-resource-7", 2, "bge-m3"));

        assertThat(service.index(7L).ragIndexStatus()).isEqualTo("INDEXING");
        verify(state).indexSucceeded(7L, 42L, "文档 teaching-resource-7，片段 2");
    }

    @Test
    void failedRemoteDeleteKeepsWithdrawalUnfinished() {
        when(state.beginWithdrawal(7L, 42L)).thenReturn(true);
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "删除失败"))
                .when(client).delete(7L);

        assertThatThrownBy(() -> service.withdraw(7L)).isInstanceOf(ResponseStatusException.class);
        verify(state).withdrawalFailed(7L, 42L, "知识库删除失败，资料仍保持发布状态");
    }
}
