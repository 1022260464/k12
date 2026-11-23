package com.k12.platform.agent.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Rolling summary for the older portion of one trusted Agent conversation. */
@Getter
@Setter
@TableName("agent_session_summary")
public class AgentSessionSummary {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String agentCode;
    private String sessionId;
    private String summaryText;
    private Long coveredRunDbId;
    private String coveredRunId;
    private Integer summarizedTurnCount;
    private Integer summaryVersion;
    private String status;
    private String lastErrorCode;
    private Instant createdTime;
    private Instant updatedTime;
}
