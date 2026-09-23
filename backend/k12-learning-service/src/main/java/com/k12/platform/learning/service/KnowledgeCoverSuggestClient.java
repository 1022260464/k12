package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.KnowledgeCoverSuggestion;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 调用 Agent Runtime 用大模型从候选目录中挑章节覆盖知识点；失败时返回空，由调用方走本地匹配。
 */
@Component
public class KnowledgeCoverSuggestClient {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeCoverSuggestClient.class);

    private final RestClient client;
    private final String apiKey;

    public KnowledgeCoverSuggestClient(
            @Value("${k12.learning.rag.runtime-url:http://127.0.0.1:8090}") String runtimeUrl,
            @Value("${k12.learning.rag.api-key:}") String apiKey
    ) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(8));
        this.client = RestClient.builder().baseUrl(runtimeUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
    }

    public List<KnowledgeCoverSuggestion> suggest(
            String title,
            String content,
            List<KnowledgePointResponse> candidates,
            int limit
    ) {
        if (!StringUtils.hasText(apiKey) || candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        try {
            List<Map<String, Object>> payloadCandidates = candidates.stream()
                    .map(point -> Map.of(
                            "code", point.code() == null ? "" : point.code(),
                            "title", point.title() == null ? "" : point.title(),
                            "category", point.categoryTitle() == null ? "" : point.categoryTitle(),
                            "aliases", point.aliases(),
                            "keywords", point.keywords()
                    ))
                    .toList();
            RemoteResponse response = client.post()
                    .uri("/internal/v1/knowledge/suggest-covers")
                    .header("X-Internal-Api-Key", apiKey)
                    .body(new RemoteRequest(
                            title == null ? "" : title,
                            content == null ? "" : content,
                            payloadCandidates,
                            limit
                    ))
                    .retrieve()
                    .body(RemoteResponse.class);
            if (response == null || response.code() != 200 || response.data() == null
                    || response.data().codes() == null) {
                return List.of();
            }
            Map<String, KnowledgePointResponse> byCode = new LinkedHashMap<>();
            for (KnowledgePointResponse point : candidates) {
                if (point != null && StringUtils.hasText(point.code())) {
                    byCode.put(point.code(), point);
                }
            }
            List<KnowledgeCoverSuggestion> rows = new ArrayList<>();
            int rank = 0;
            for (String code : response.data().codes()) {
                if (!StringUtils.hasText(code) || !byCode.containsKey(code)) continue;
                KnowledgePointResponse point = byCode.get(code.trim());
                rank += 1;
                String reason = response.data().reasons() != null
                        ? response.data().reasons().getOrDefault(code.trim(), "模型建议")
                        : "模型建议";
                rows.add(new KnowledgeCoverSuggestion(
                        point.code(),
                        point.title(),
                        Math.max(0.1, 1.0 - rank * 0.05),
                        reason
                ));
                if (rows.size() >= limit) break;
            }
            return rows;
        } catch (RestClientException error) {
            log.info("知识点 AI 建议暂不可用，将使用本地匹配: {}", error.getMessage());
            return List.of();
        }
    }

    private record RemoteRequest(
            String title,
            String content,
            List<Map<String, Object>> candidates,
            int limit
    ) {
    }

    private record RemoteData(List<String> codes, Map<String, String> reasons) {
    }

    private record RemoteResponse(int code, String message, RemoteData data) {
    }
}
