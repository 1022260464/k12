package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 经教研审核后发布的互动绘本主数据。 */
@Getter
@Setter
@TableName("learning_picture_book")
public class PictureBook {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String bookCode;
    private String title;
    private String subtitle;
    private String summary;
    private String stageCode;
    private String knowledgeCode;
    private String coverObjectKey;
    private String coverFallbackUrl;
    private String challengeType;
    private String challengeReference;
    private Integer sortOrder;
    private String status;
    private String reviewNote;
    private Long reviewedBy;
    private Instant reviewedTime;
    private Instant publishedTime;
    private Integer contentVersion;
    @Version
    private Integer lockVersion;
    private Long createdBy;
    private Long updatedBy;
    private Instant createdTime;
    private Instant updatedTime;
}
