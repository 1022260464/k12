package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.HomeworkSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface HomeworkSubmissionMapper extends BaseMapper<HomeworkSubmission> {

    HomeworkSubmission findByHomeworkAndStudent(
            @Param("homeworkId") Long homeworkId,
            @Param("studentUserId") Long studentUserId
    );

    List<HomeworkSubmission> findByHomeworkPage(
            @Param("homeworkId") Long homeworkId,
            @Param("offset") int offset,
            @Param("size") int size
    );

    long countByHomework(@Param("homeworkId") Long homeworkId);

    List<HomeworkSubmission> findByStudentPage(
            @Param("studentUserId") Long studentUserId,
            @Param("offset") int offset,
            @Param("size") int size
    );

    long countByStudent(@Param("studentUserId") Long studentUserId);

    int gradeOptimistically(
            @Param("id") Long id,
            @Param("expectedVersion") Integer expectedVersion,
            @Param("score") BigDecimal score,
            @Param("feedback") String feedback,
            @Param("gradedBy") Long gradedBy
    );
}
