package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.QuestionOption;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface QuestionOptionMapper extends BaseMapper<QuestionOption> {
    List<QuestionOption> findByQuestionId(@Param("questionId") Long questionId);
}
