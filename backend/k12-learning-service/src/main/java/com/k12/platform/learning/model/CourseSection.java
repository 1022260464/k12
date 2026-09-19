package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("learning_course_section")
public class CourseSection {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long chapterId;
    private String title;
    private String content;
    private Integer sortOrder;
    private Instant updatedTime;
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
