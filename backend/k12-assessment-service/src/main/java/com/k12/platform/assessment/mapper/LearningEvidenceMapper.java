package com.k12.platform.assessment.mapper;

import com.k12.platform.assessment.model.LearningEvidence;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface LearningEvidenceMapper {
    /** 唯一键 (student, type, reference) 冲突时保留首条，重试不产生重复证据。 */
    int insert(LearningEvidence evidence);

    List<LearningEvidence> findByStudent(@Param("studentUserId") Long studentUserId,
                                         @Param("limit") int limit);
}
