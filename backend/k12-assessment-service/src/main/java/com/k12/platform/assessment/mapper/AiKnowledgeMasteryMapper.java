package com.k12.platform.assessment.mapper;

import com.k12.platform.assessment.model.AiKnowledgeMastery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;

@Mapper
public interface AiKnowledgeMasteryMapper {
    int recordAttempt(@Param("studentUserId") Long studentUserId,
                      @Param("knowledgeCode") String knowledgeCode,
                      @Param("topic") String topic,
                      @Param("score") int score,
                      @Param("maxScore") int maxScore,
                      @Param("scorePercent") int scorePercent,
                      @Param("practicedTime") Instant practicedTime);

    List<AiKnowledgeMastery> findByStudent(@Param("studentUserId") Long studentUserId,
                                           @Param("limit") int limit);
}
