package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("learning_teaching_resource_binding")
public class TeachingResourceBinding {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long resourceId;
    private Long courseId;
    private Long chapterId;
    private String chapterTitle;
    private Instant createdTime;
}
