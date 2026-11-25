package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * Java 服务间写回证据的内部请求；调用方必须持有内部共享密钥，
 * 学生 Token 不允许直达本接口，防止伪造学习证据。
 */
public record InternalEvidenceRequest(
        @NotNull Long studentUserId,
        @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z][a-z0-9_.-]{2,63}") String knowledgeCode,
        /* PRACTICE_QUIZ 由练习判分链路自己写入，不从该入口接收。 */
        @NotBlank @Pattern(regexp = "TUTOR_CHAT|DIAGNOSTIC") String evidenceType,
        @NotBlank @Size(max = 128) String title,
        @NotBlank @Size(max = 64) String referenceId,
        @Min(0) @Max(100) Integer scorePercent,
        @Min(1) @Max(100) Integer confidence,
        @Size(max = 4000) String detailJson,
        Instant occurredTime
) {
}
