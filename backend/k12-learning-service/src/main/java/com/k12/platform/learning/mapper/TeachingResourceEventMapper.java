package com.k12.platform.learning.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TeachingResourceEventMapper extends BaseMapper<TeachingResourceEvent> {
    @Select("SELECT * FROM learning_teaching_resource_event WHERE resource_id = #{resourceId} ORDER BY id DESC LIMIT 100")
    List<TeachingResourceEvent> recent(@Param("resourceId") Long resourceId);
}
