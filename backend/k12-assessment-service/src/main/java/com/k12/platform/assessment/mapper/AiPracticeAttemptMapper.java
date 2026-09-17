package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface AiPracticeAttemptMapper extends BaseMapper<AiPracticeAttempt> {
    AiPracticeAttempt findByRunAndStudent(@Param("runId") String runId, @Param("studentUserId") Long studentUserId);

    AiPracticeAttempt findByRunAndStudentForUpdate(@Param("runId") String runId,
                                                   @Param("studentUserId") Long studentUserId);

    List<AiPracticeAttempt> findRecentByStudent(@Param("studentUserId") Long studentUserId,
                                                @Param("limit") int limit);
}
