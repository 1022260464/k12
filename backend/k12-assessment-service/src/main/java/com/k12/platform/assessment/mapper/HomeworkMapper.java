package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.Homework;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface HomeworkMapper extends BaseMapper<Homework> {

    Homework selectForUpdate(@Param("id") Long id);

    Homework findVisibleById(
            @Param("id") Long id,
            @Param("currentUserId") Long currentUserId,
            @Param("admin") boolean admin
    );

    List<Homework> findVisiblePage(
            @Param("currentUserId") Long currentUserId,
            @Param("admin") boolean admin,
            @Param("offset") int offset,
            @Param("size") int size
    );

    long countVisible(@Param("currentUserId") Long currentUserId, @Param("admin") boolean admin);

    List<Long> findRecipientIds(@Param("homeworkId") Long homeworkId);

    int deleteRecipients(@Param("homeworkId") Long homeworkId);

    int insertRecipients(@Param("homeworkId") Long homeworkId, @Param("studentUserIds") List<Long> studentUserIds);

    long countRecipients(@Param("homeworkId") Long homeworkId);

    long countQuestions(@Param("homeworkId") Long homeworkId);

    boolean isRecipient(@Param("homeworkId") Long homeworkId, @Param("studentUserId") Long studentUserId);

    long countSubmissions(@Param("homeworkId") Long homeworkId);
}
