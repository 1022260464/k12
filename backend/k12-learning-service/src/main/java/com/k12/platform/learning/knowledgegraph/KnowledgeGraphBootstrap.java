package com.k12.platform.learning.knowledgegraph;

import com.k12.platform.learning.config.Neo4jProperties;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class KnowledgeGraphBootstrap implements ApplicationRunner {
    private final Neo4jProperties properties;
    private final KnowledgeGraphService knowledgeGraphService;

    public KnowledgeGraphBootstrap(Neo4jProperties properties, KnowledgeGraphService knowledgeGraphService) {
        this.properties = properties;
        this.knowledgeGraphService = knowledgeGraphService;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (properties.isEnabled() && properties.isSeedOnStartup()) {
            knowledgeGraphService.ensureSchemaAndSeed();
        }
    }
}
