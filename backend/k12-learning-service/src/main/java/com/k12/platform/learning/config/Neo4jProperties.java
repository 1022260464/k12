package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Neo4j 知识关系层配置；默认关闭，未启用时教学闭环降级为无图导航。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.neo4j")
public class Neo4jProperties {
    private boolean enabled;
    /** Bolt URI，例如 bolt://122.51.54.52:7687 */
    private String uri = "bolt://127.0.0.1:7687";
    private String username = "neo4j";
    private String password = "";
    private String database = "neo4j";
    /** 启动时是否自动执行约束与 AI 通识种子图。 */
    private boolean seedOnStartup;
}
