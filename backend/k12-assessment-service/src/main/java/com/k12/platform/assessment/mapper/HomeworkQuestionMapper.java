package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.HomeworkQuestion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface HomeworkQuestionMapper extends BaseMapper<HomeworkQuestion> {
    List<HomeworkQuestion> findByHomeworkId(@Param("homeworkId") Long homeworkId);

    BigDecimal totalScore(@Param("homeworkId") Long homeworkId);
}
