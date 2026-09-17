package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.SubmissionAnswer;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface SubmissionAnswerMapper extends BaseMapper<SubmissionAnswer> {
    List<SubmissionAnswer> findBySubmissionId(@Param("submissionId") Long submissionId);

    SubmissionAnswer findForUpdate(@Param("submissionId") Long submissionId,
                                   @Param("questionId") Long questionId);

    BigDecimal sumFinalScore(@Param("submissionId") Long submissionId);

    long countPending(@Param("submissionId") Long submissionId);
}
