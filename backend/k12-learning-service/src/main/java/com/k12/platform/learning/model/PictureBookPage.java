package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 绘本分页。图片保存稳定对象键，同时允许仓库静态素材作为演示降级。 */
@Getter
@Setter
@TableName("learning_picture_book_page")
public class PictureBookPage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long bookId;
    private Integer pageNo;
    private String title;
    private String narration;
    private String prompt;
    private String imageObjectKey;
    private String imageFallbackUrl;
    private String altText;
    private String interactionJson;
    private Instant createdTime;
    private Instant updatedTime;
}
