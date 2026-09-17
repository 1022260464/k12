package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("learning_chapter_progress")
public class ChapterProgress {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long enrollmentId;
    private Long chapterId;
    private Integer progressPercent;
    private java.time.Instant updatedTime;
}

