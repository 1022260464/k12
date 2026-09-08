package com.k12.platform.assessment.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.assessment.model.Homework;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface HomeworkMapper extends BaseMapper<Homework> {
    Homework lockById(@Param("id") Long id);
    List<Homework> findVisible(@Param("userId") Long userId, @Param("admin") boolean admin,
                               @Param("offset") long offset, @Param("size") int size);
    int isRecipient(@Param("id") Long id, @Param("userId") Long userId);
    List<Long> findRecipients(@Param("id") Long id);
    int deleteRecipients(@Param("id") Long id);
    int insertRecipients(@Param("id") Long id, @Param("studentIds") List<Long> studentIds);
}
