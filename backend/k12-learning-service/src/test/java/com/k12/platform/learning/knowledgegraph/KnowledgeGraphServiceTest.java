package com.k12.platform.learning.knowledgegraph;

import com.k12.platform.learning.dto.KnowledgeCoverSuggestion;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgeGraphServiceTest {

    @Test
    @DisplayName("Cypher 脚本应按分号拆分并忽略注释行")
    void splitsCypherStatements() {
        String script = """
                // comment
                CREATE CONSTRAINT x IF NOT EXISTS FOR (n:T) REQUIRE n.id IS UNIQUE;
                MATCH (a) RETURN a;
                """;
        List<String> statements = KnowledgeGraphService.splitCypher(script);
        assertThat(statements).hasSize(2);
        assertThat(statements.get(0)).startsWith("CREATE CONSTRAINT");
        assertThat(statements.get(1)).startsWith("MATCH");
    }

    @Test
    @DisplayName("章节覆盖建议应按标题命中排序")
    void scoresLexicalCoversByTitleHit() {
        List<KnowledgePointResponse> catalog = List.of(
                new KnowledgePointResponse("machine_learning.supervised_learning", "监督学习", "JUNIOR_HIGH", 3, "APPROVED"),
                new KnowledgePointResponse("generative_ai.prompt_basics", "提示词基础", "PRIMARY_UPPER", 2, "APPROVED"),
                new KnowledgePointResponse("data_literacy.what_is_data", "什么是数据", "PRIMARY_UPPER", 1, "APPROVED")
        );
        List<KnowledgeCoverSuggestion> suggestions = KnowledgeGraphService.scoreAgainstCatalog(
                "本课学习监督学习与分类",
                "<p>介绍监督学习和标签</p>",
                catalog,
                5
        );
        assertThat(suggestions).isNotEmpty();
        assertThat(suggestions.get(0).code()).isEqualTo("machine_learning.supervised_learning");
    }

    @Test
    @DisplayName("章节覆盖建议应支持知识点别名和主题词")
    void scoresLexicalCoversByAliasesAndKeywords() {
        KnowledgePointResponse rag = new KnowledgePointResponse(
                "ai_agents.rag_pipeline",
                "RAG检索增强生成流程",
                "初中、高中",
                4,
                "APPROVED",
                "category.ai_agents",
                "智能体与知识增强",
                "TOPIC",
                List.of("初中", "高中"),
                List.of("知识库问答", "检索增强生成"),
                List.of("文档切分", "向量检索", "重排")
        );

        List<KnowledgeCoverSuggestion> suggestions = KnowledgeGraphService.scoreAgainstCatalog(
                "搭建知识库问答助手",
                "资料需要先文档切分，再进行向量检索和重排。",
                List.of(rag),
                5
        );

        assertThat(suggestions).singleElement()
                .satisfies(item -> {
                    assertThat(item.code()).isEqualTo("ai_agents.rag_pipeline");
                    assertThat(item.score()).isGreaterThanOrEqualTo(10);
                });
    }

    @Test
    @DisplayName("章节 refKey 由课程与章节 ID 组成")
    void buildsChapterRefKey() {
        assertThat(KnowledgeGraphService.chapterRefKey(12, 34)).isEqualTo("12:34");
    }

    @Test
    @DisplayName("扩展目录应包含大类与数百知识点")
    void expandedCatalogHasCategoriesAndHundredsOfTopics() {
        BuiltinKnowledgeCatalog.bootstrapForTests();
        assertThat(BuiltinKnowledgeCatalog.categories()).hasSizeGreaterThanOrEqualTo(10);
        assertThat(BuiltinKnowledgeCatalog.all()).hasSizeGreaterThanOrEqualTo(300);
        assertThat(BuiltinKnowledgeCatalog.titleForCode("data_literacy.privacy_basics"))
                .isEqualTo("数据与隐私入门");
        assertThat(BuiltinKnowledgeCatalog.relatedExplainCodes("generative_ai.hallucination"))
                .contains("generative_ai.prompt_basics", "generative_ai.hallucination");
        assertThat(BuiltinKnowledgeCatalog.find("generative_ai.prompt_basics").categoryTitle())
                .isEqualTo("生成式人工智能");
    }

    @Test
    @DisplayName("Neo4j 不可用时内置目录仍可勾选")
    void builtinCatalogHasAiLiteracyPoints() {
        BuiltinKnowledgeCatalog.bootstrapForTests();
        assertThat(BuiltinKnowledgeCatalog.filter(null, null, 500))
                .extracting(KnowledgePointResponse::code)
                .contains("machine_learning.supervised_learning", "generative_ai.prompt_basics");
    }
}
