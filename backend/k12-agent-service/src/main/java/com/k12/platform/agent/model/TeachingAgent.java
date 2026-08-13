package com.k12.platform.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("agent_config")
public class TeachingAgent {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String type;
    private String description;
    private String status;
    private Instant updatedTime;

    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
