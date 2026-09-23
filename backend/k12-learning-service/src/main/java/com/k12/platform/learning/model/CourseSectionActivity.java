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
@TableName("learning_course_section_activity")
public class CourseSectionActivity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sectionId;
    private String activityType;
    private String referenceKey;
    private String title;
    private String description;
    private Integer sortOrder;
    private Boolean required;
    private Instant updatedTime;
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
