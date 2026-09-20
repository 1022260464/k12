package com.k12.platform.learning.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.learning.model.TeachingResource;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TeachingResourceMapper extends BaseMapper<TeachingResource> {
    @Select("SELECT * FROM learning_teaching_resource WHERE id = #{id} FOR UPDATE")
    TeachingResource selectForUpdate(@Param("id") Long id);

    @Select("""
            <script>
            SELECT * FROM learning_teaching_resource
            WHERE 1 = 1
            <if test="ownerId != null">AND created_by = #{ownerId}</if>
            <if test="status != null">AND status = #{status}</if>
            <if test="keyword != null">AND (
                title LIKE CONCAT('%', #{keyword}, '%')
                OR description LIKE CONCAT('%', #{keyword}, '%')
                OR knowledge_code LIKE CONCAT('%', #{keyword}, '%')
            )</if>
            ORDER BY updated_time DESC, id DESC
            LIMIT #{limit} OFFSET #{offset}
            </script>
            """)
    List<TeachingResource> search(@Param("ownerId") Long ownerId, @Param("status") String status,
                                  @Param("keyword") String keyword, @Param("limit") int limit,
                                  @Param("offset") long offset);
}
