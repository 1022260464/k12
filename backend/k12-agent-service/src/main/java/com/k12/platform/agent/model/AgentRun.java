package com.k12.platform.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * 一次智能体运行记录，对应 MySQL 的 agent_run 表。
 *
 * Java 服务负责保存可审计的调用记录，真正的 Agent 推理由 Python Runtime 完成。
 */
@Getter
@Setter
@TableName("agent_run")
public class AgentRun {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String runId;
    private String agentCode;
    private Long userId;
    private String sessionId;
    private String executionMode;
    private String inputText;
    private String inputContext;
    private String status;
    private String outputText;
    private String outputMetadata;
    private String errorCode;
    private String errorMessage;
    private Long durationMs;
    private Instant startedTime;
    private Instant finishedTime;
    private Instant createdTime;
    private Instant updatedTime;
}
