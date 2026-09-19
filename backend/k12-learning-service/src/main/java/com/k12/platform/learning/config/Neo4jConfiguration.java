package com.k12.platform.learning.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class Neo4jConfiguration {
    private static final Logger log = LoggerFactory.getLogger(Neo4jConfiguration.class);

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(prefix = "k12.learning.neo4j", name = "enabled", havingValue = "true")
    public Driver neo4jDriver(Neo4jProperties properties) {
        if (!StringUtils.hasText(properties.getUri()) || !StringUtils.hasText(properties.getPassword())) {
            throw new IllegalStateException("已启用 Neo4j，但缺少 k12.learning.neo4j.uri 或 password");
        }
        log.info("正在连接 Neo4j: {}", properties.getUri());
        return GraphDatabase.driver(
                properties.getUri(),
                AuthTokens.basic(properties.getUsername(), properties.getPassword())
        );
    }
}
