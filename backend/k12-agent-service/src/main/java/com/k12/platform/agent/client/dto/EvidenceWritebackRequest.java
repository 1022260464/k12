package com.k12.platform.agent.client.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** 教学运行完成后写回 Assessment 的证据载荷；字段校验规则与 Assessment 内部入口一致。 */
public record EvidenceWritebackRequest(
        @NotNull Long studentUserId,
        @NotBlank @Size(max = 64) String knowledgeCode,
        @NotBlank String evidenceType,
        @NotBlank @Size(max = 128) String title,
        @NotBlank @Size(max = 64) String referenceId,
        @Min(0) @Max(100) Integer scorePercent,
        @Min(1) @Max(100) Integer confidence,
        @Size(max = 4000) String detailJson,
        Instant occurredTime
) {
}
