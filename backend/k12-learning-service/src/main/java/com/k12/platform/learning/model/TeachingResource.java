package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("learning_teaching_resource")
public class TeachingResource {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String description;
    private String stageCode;
    private String subject;
    private String sourceNote;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Long courseId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Long chapterId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String chapterTitle;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String grade;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String textbook;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String knowledgeCode;
    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;
    private String objectKey;
    private String status;
    private String ragIndexStatus;
    private Long createdBy;
    private Long reviewedBy;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String reviewNote;
    private Instant reviewedTime;
    private Long publishedBy;
    private Instant publishedTime;
    private Instant createdTime;
    private Instant updatedTime;
}
