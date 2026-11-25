package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.EvidenceWritebackRequest;
import com.k12.platform.agent.config.AssessmentInternalFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** 把已完成教学运行的知识点证据写回 Assessment；失败不影响教学响应。 */
@FeignClient(
        name = "k12-assessment-service-evidence",
        url = "${k12.clients.assessment-url:http://127.0.0.1:8084}",
        configuration = AssessmentInternalFeignConfiguration.class
)
public interface AssessmentEvidenceClient {

    @PostMapping("/api/v1/assessments/evidence/internal")
    ApiResponse<Void> record(@RequestBody EvidenceWritebackRequest request);
}
