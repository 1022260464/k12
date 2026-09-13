package com.k12.platform.iam.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 登录审计实体，不存密码、JWT 等认证秘密。 */
@Getter
@Setter
@TableName("sys_login_audit")
public class LoginAudit {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String username;
    private Integer success;
    private String failureReason;
    private String clientIp;
    private String userAgent;
    private Instant createdTime;
}
