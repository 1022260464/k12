package com.k12.platform.iam.model;

import lombok.Getter;
import lombok.Setter;

/*
 * 登录认证查询结果。
 *
 * 这个类不是完整 sys_user 实体，只保留 Spring Security 登录校验需要的字段。
 */
@Getter
@Setter
public class AuthUser {

    private Long id;
    private String username;
    private String passwordHash;
    private int status;
}
