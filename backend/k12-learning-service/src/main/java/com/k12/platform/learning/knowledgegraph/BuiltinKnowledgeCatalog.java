package com.k12.platform.learning.knowledgegraph;

import com.k12.platform.learning.dto.KnowledgeEdgeResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import org.springframework.core.io.DefaultResourceLoader;

import java.util.List;

/**
 * 兼容门面：委托给 {@link KnowledgeCatalogStore}。
 * <p>新代码请注入 {@link KnowledgeCatalogStore}。
 * 单元测试在无 Spring 时可调用 {@link #bootstrapForTests()}。
 */
public final class BuiltinKnowledgeCatalog {
    private static volatile KnowledgeCatalogStore delegate;

    private BuiltinKnowledgeCatalog() {
    }

    static void bind(KnowledgeCatalogStore store) {
        delegate = store;
    }

    /** 无 Spring 场景（单测）从默认 classpath 加载一次。 */
    public static synchronized KnowledgeCatalogStore bootstrapForTests() {
        if (delegate != null) {
            return delegate;
        }
        var props = new com.k12.platform.learning.config.KnowledgeCatalogProperties();
        KnowledgeCatalogStore store = new KnowledgeCatalogStore(props, new DefaultResourceLoader());
        store.reload();
        bind(store);
        return store;
    }

    private static KnowledgeCatalogStore require() {
        KnowledgeCatalogStore store = delegate;
        if (store == null) {
            return bootstrapForTests();
        }
        return store;
    }

    public static List<KnowledgePointResponse> all() {
        return require().topics();
    }

    public static List<KnowledgePointResponse> allNodes() {
        return require().allNodes();
    }

    public static List<KnowledgePointResponse> categories() {
        return require().categories();
    }

    public static KnowledgePointResponse find(String code) {
        return require().find(code);
    }

    public static String titleForCode(String code) {
        return require().titleForCode(code);
    }

    public static List<String> relatedExplainCodes(String focusCode) {
        return require().relatedExplainCodes(focusCode);
    }

    public static List<KnowledgeEdgeResponse> seedEdges() {
        return require().edges();
    }

    public static List<KnowledgePointResponse> filter(String query, String stage, int limit) {
        return require().filter(query, stage, limit);
    }
}
