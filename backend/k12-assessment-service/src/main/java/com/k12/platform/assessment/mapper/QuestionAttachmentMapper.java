package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.QuestionAttachment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QuestionAttachmentMapper extends BaseMapper<QuestionAttachment> {
    @Select("""
            SELECT COUNT(1)
            FROM assessment_question_attachment a
            INNER JOIN assessment_homework_question q
                ON q.id = a.question_id AND q.deleted = 0
            WHERE q.homework_id = #{homeworkId}
              AND a.deleted = 0
            """)
    long countByHomeworkId(@Param("homeworkId") Long homeworkId);
}
