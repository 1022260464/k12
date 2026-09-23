package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 图形化编程关卡定义，由管理端配置；执行逻辑由 templateCode 白名单决定。 */
@Getter
@Setter
@TableName("learning_visual_programming_mission")
public class VisualProgrammingMission {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String missionCode;
    private String templateCode;
    private String title;
    private String shortTitle;
    private String stageCode;
    private String knowledgeCode;
    private String description;
    private String story;
    private String goal;
    private String hint;
    private String badge;
    private String reflection;
    private String stepsJson;
    private String conceptsJson;
    private String configJson;
    private Integer sortOrder;
    private String status;
    private Integer contentVersion;
    @Version
    private Integer lockVersion;
    private Long createdBy;
    private Long updatedBy;
    private Instant publishedTime;
    private Instant createdTime;
    private Instant updatedTime;
}
