package com.k12.platform.learning.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.learning.model.TeachingResourceBinding;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TeachingResourceBindingMapper extends BaseMapper<TeachingResourceBinding> {

    @Select("""
            SELECT r.id
            FROM learning_teaching_resource r
            JOIN learning_teaching_resource_binding b ON b.resource_id = r.id
            WHERE r.status = 'PUBLISHED'
              AND b.course_id = #{courseId}
              AND (
                (#{chapterId} IS NULL AND b.chapter_id IS NULL)
                OR b.chapter_id = #{chapterId}
              )
            GROUP BY r.id
            ORDER BY MAX(r.published_time) DESC
            LIMIT 100
            """)
    List<Long> findPublishedResourceIds(@Param("courseId") Long courseId,
                                        @Param("chapterId") Long chapterId);
}
