package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("learning_visual_programming_project")
public class VisualProgrammingProject {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long studentUserId;
    private String missionCode;
    private String workspaceJson;
    private String status;
    private Integer bestStars;
    private Integer attemptCount;
    private Instant completedTime;
    private Instant createdTime;
    private Instant updatedTime;
}

