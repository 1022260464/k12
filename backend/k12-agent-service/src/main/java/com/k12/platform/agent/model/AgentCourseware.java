package com.k12.platform.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * AI 生成的互动课件。管理端生成草稿并审核发布，学生端只读已发布课件。
 */
@Getter
@Setter
@TableName("agent_courseware")
public class AgentCourseware {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String coursewareId;
    private String title;
    private String stage;
    private String topicCode;
    private Integer slideCount;
    private String documentJson;
    private String status;
    private String createdBy;
    private Instant publishTime;
    private Instant createdTime;
    private Instant updatedTime;

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_PUBLISHED = "PUBLISHED";
}
