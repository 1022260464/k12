package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("learning_course_enrollment")
public class CourseEnrollment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long courseId;
    private Long userId;
    private String status;
    private java.time.Instant enrolledTime;
    private java.time.Instant updatedTime;
}

