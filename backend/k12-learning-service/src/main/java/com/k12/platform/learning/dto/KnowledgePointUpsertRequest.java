package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record KnowledgePointUpsertRequest(
        @NotBlank
        @Pattern(regexp = "[a-z][a-z0-9_.-]{2,63}", message = "知识点编码需为小写字母开头，长度 3-64")
        String code,
        @NotBlank
        @Size(max = 128)
        String title,
        /** 兼容旧客户端：单个学段；与 {@link #stages} 合并。 */
        @Size(max = 64)
        String stage,
        /** 适用学段（可多选），如：小学低年级、小学高年级、初中、高中。 */
        List<String> stages,
        @Min(1) @Max(5)
        Integer difficulty,
        @Size(max = 64)
        String categoryCode,
        @Size(max = 128)
        String categoryTitle,
        @Size(max = 32)
        String kind,
        @Size(max = 64)
        String parentCode,
        /** 先修知识点编码：这些节点应先掌握，边为 (pre)-[:PREREQUISITE_OF]->(本节点) */
        List<String> prerequisiteCodes,
        /** 相关拓展知识点编码：边为 (本节点)-[:RELATED_TO]->(other) */
        List<String> relatedCodes
) {
}
