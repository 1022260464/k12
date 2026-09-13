package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
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
    /** 从 JWT 获取创建者，前端不能指定或修改课程归属。旧课程可为空。 */
    private Long teacherId;
    private String title;
    private String subject;
    private String gradeLevel;
    /** PUT 允许清空简介；默认 NOT_NULL 策略会跳过 null，导致旧简介无法删除。 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String description;
    private Integer status;
    private Instant updatedTime;

    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
