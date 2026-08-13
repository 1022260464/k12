package com.k12.platform.iam.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/*
 * 用户接口展示模型。
 *
 * 它来自 sys_user + sys_user_role + sys_role 的查询结果，
 * 用于用户列表和用户详情响应，不包含 password_hash。
 */
@Getter
@Setter
public class UserAccount {

    private Long id;
    private String username;
    private String nickname;
    private String email;
    private String roleCode;
    private String status;
    private Instant updatedTime;
}
