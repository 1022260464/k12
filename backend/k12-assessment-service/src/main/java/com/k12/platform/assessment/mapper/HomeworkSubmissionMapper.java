package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.HomeworkSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface HomeworkSubmissionMapper extends BaseMapper<HomeworkSubmission> {
    HomeworkSubmission findForStudent(@Param("homeworkId") Long homeworkId, @Param("studentId") Long studentId);
    List<HomeworkSubmission> findPage(@Param("homeworkId") Long homeworkId, @Param("studentId") Long studentId,
                                    @Param("offset") long offset, @Param("size") int size);
    long countPage(@Param("homeworkId") Long homeworkId, @Param("studentId") Long studentId);
    int gradeIfVersion(@Param("submission") HomeworkSubmission submission, @Param("expectedVersion") int expectedVersion);
}
