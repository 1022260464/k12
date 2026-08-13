package com.k12.platform.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/*
 * 公开注册请求不允许提交 roleCode。
 * 服务端会强制分配 ROLE_STUDENT，避免越权注册管理员账号。
 */
public record RegisterRequest(
        @NotBlank @Size(max = 64) String username,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 64) String nickname,
        @Email @Size(max = 128) String email
) {
}
