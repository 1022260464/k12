package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("assessment_question_attachment")
public class QuestionAttachment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long questionId;
    private String objectKey;
    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;
    private Instant createdTime;
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
