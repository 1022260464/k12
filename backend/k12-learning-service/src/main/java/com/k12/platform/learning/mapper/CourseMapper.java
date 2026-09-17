package com.k12.platform.learning.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.learning.model.Course;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface CourseMapper extends BaseMapper<Course> {
    Course selectForUpdate(@Param("id") Long id);

    List<Course> search(@Param("keyword") String keyword, @Param("subject") String subject,
                        @Param("gradeLevel") String gradeLevel, @Param("teacherId") Long teacherId,
                        @Param("offset") long offset, @Param("limit") int limit);
}
