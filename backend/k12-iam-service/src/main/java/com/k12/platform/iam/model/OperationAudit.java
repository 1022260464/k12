package com.k12.platform.iam.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 管理员敏感操作审计实体。detail 只记录摘要，不记录密码等秘密。 */
@Getter
@Setter
@TableName("sys_operation_audit")
public class OperationAudit {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long operatorUserId;
    private String action;
    private String targetType;
    private String targetId;
    private String detail;
    private Instant createdTime;
}
