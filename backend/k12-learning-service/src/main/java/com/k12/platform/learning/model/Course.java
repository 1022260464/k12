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
@TableName("learning_course")
public class Course {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String subject;
    private String gradeLevel;
    private String description;
    private Integer status;
    private Instant updatedTime;

    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
