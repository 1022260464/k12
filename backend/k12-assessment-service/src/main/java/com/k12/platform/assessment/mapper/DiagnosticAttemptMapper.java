package com.k12.platform.assessment.mapper;

import com.k12.platform.assessment.model.DiagnosticAttempt;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface DiagnosticAttemptMapper {
    int insert(DiagnosticAttempt attempt);

    DiagnosticAttempt findLatestByStudent(@Param("studentUserId") Long studentUserId);
}
