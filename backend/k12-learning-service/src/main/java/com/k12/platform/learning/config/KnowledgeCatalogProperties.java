package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 知识目录（内置 JSON）配置。
 * <p>权威源：classpath {@code knowledge/ai_literacy_catalog.json}；
 * 可用 {@code location} 指向外部 file: 以便运维热更，无需重新打包。
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.knowledge-catalog")
public class KnowledgeCatalogProperties {
    /**
     * Spring Resource 位置。
     * 例：{@code classpath:knowledge/ai_literacy_catalog.json}
     * 或 {@code file:D:/data/k12/ai_literacy_catalog.json}
     */
    private String location = "classpath:knowledge/ai_literacy_catalog.json";
}
