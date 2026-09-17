package com.k12.platform.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 智能体产生的图表、表格、图片或文件，对应 agent_artifact 表。 */
@Getter
@Setter
@TableName("agent_artifact")
public class AgentArtifact {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String artifactId;
    private String runId;
    private String kind;
    private String title;
    private String mimeType;
    private String storageUri;
    private String payloadJson;
    private Long sizeBytes;
    private String checksumSha256;
    private Instant createdTime;
}
