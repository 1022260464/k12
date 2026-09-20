package com.k12.platform.learning.dto;

/** 清理图谱中未发布/已删除课程章节引用、无效资料讲解边的结果。 */
public record KnowledgeGraphPurgeResult(
        int removedChapterRefs,
        int removedDocumentRefs,
        int remainingChapterRefs,
        int remainingDocumentRefs,
        String message
) {
    public boolean clean() {
        return remainingChapterRefs <= 0 && remainingDocumentRefs <= 0;
    }
}
