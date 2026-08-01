package com.k12.platform.learning.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.learning.model.Course;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CourseMapper extends BaseMapper<Course> {
}
