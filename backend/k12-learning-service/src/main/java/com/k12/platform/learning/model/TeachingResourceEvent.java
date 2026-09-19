package com.k12.platform.learning.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("learning_teaching_resource_event")
public class TeachingResourceEvent {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long resourceId;
    private Long actorId;
    private String action;
    private String fromStatus;
    private String toStatus;
    private String note;
    private Instant createdTime;
}
