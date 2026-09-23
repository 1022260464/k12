package com.k12.platform.learning.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.model.TeachingResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class TeachingResourceIndexClient {
    private final RestClient client;
    private final String apiKey;
    private final ObjectMapper json;

    public TeachingResourceIndexClient(
            @Value("${k12.learning.rag.runtime-url:http://127.0.0.1:8090}") String runtimeUrl,
            @Value("${k12.learning.rag.api-key:}") String apiKey, ObjectMapper json) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofMinutes(5));
        this.client = RestClient.builder().baseUrl(runtimeUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
        this.json = json;
    }

    public IndexedResult index(TeachingResource resource) {
        requireKey();
        try {
            RemoteResponse response = client.post().uri("/internal/v1/rag/teaching-resources/index")
                    .header("X-Internal-Api-Key", apiKey)
                    .body(new IndexRequest(resource.getId(), resource.getTitle(), resource.getObjectKey(),
                            resource.getStageCode(), resource.getSubject(), resource.getSourceNote(),
                            resource.getCourseId(), resource.getChapterId(), resource.getChapterTitle(),
                            resource.getGrade(), resource.getTextbook(), resource.getKnowledgeCode(),
                            resource.getDescription()))
                    .retrieve().body(RemoteResponse.class);
            if (response == null || response.code() != 200 || response.data() == null) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识库入库响应无效");
            }
            return response.data();
        } catch (RestClientResponseException error) {
            if (error.getStatusCode().value() == 422) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, validationMessage(error));
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Python 知识库服务暂不可用");
        } catch (ResourceAccessException error) {
            // 网络断开时无法知道远端是否已写入向量，不能立刻允许撤回。
            throw new IndexOutcomeUnknownException();
        }
    }

    public void delete(long resourceId) {
        requireKey();
        try {
            client.delete()
                    .uri("/internal/v1/rag/teaching-resources/{id}/index", resourceId)
                    .header("X-Internal-Api-Key", apiKey).retrieve().toBodilessEntity();
        } catch (RestClientResponseException | ResourceAccessException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识库删除失败，请稍后重试");
        }
    }

    public SearchResult search(SearchRequest request) {
        requireKey();
        try {
            RemoteSearchResponse response = client.post().uri("/internal/v1/rag/search")
                    .header("X-Internal-Api-Key", apiKey)
                    .body(request)
                    .retrieve().body(RemoteSearchResponse.class);
            if (response == null || response.code() != 200 || response.data() == null) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识库检索响应无效");
            }
            return response.data();
        } catch (RestClientResponseException | ResourceAccessException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Python 知识库服务暂不可用");
        }
    }

    private void requireKey() {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "未配置 K12_AGENT_INTERNAL_API_KEY，不能调用知识库");
        }
    }

    private String validationMessage(RestClientResponseException error) {
        try {
            String message = json.readTree(error.getResponseBodyAsByteArray()).path("message").asText("");
            if (StringUtils.hasText(message)) {
                return message.length() > 480 ? message.substring(0, 480) : message;
            }
        } catch (Exception ignored) {
            // 远端异常响应格式不可信，回退到固定提示。
        }
        return "资料无法提取文本或超出入库限制";
    }

    public record IndexRequest(long resourceId, String title, String objectKey, String stageCode,
                               String subject, String sourceNote, Long courseId, Long chapterId,
                               String chapter, String grade, String textbook, String knowledgeCode,
                               String description) {}
    public record IndexedResult(String documentId, int chunkCount, String embeddingModel) {}
    public record RemoteResponse(int code, String message, IndexedResult data) {}
    public record SearchRequest(String query, Integer candidateCount, Integer topK,
                                String stageCode, String grade, String textbook,
                                String knowledgeCode) {}
    public record SearchHit(String documentId, String text, double rerankScore,
                            Map<String, Object> metadata, Double retrievalScore) {}
    public record SearchResult(String query, String embeddingModel, int candidateCount,
                               List<SearchHit> documents) {}
    public record RemoteSearchResponse(int code, String message, SearchResult data) {}

    public static class IndexOutcomeUnknownException extends RuntimeException {
        public IndexOutcomeUnknownException() {
            super("入库请求结果待确认");
        }
    }
}
