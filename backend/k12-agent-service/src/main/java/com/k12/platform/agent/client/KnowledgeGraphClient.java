package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.KnowledgeRecommendRequest;
import com.k12.platform.agent.config.DownstreamBearerFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

/** 查询 Neo4j 知识关系：先修缺口、相邻概念与下一主题推荐。 */
@FeignClient(
        name = "k12-learning-knowledge-graph",
        url = "${k12.clients.learning-url:http://127.0.0.1:8082}",
        configuration = DownstreamBearerFeignConfiguration.class
)
public interface KnowledgeGraphClient {

    @PostMapping("/api/v1/learning/knowledge-graph/teaching-context")
    ApiResponse<Map<String, Object>> teachingContext(@RequestBody KnowledgeRecommendRequest request);
}
