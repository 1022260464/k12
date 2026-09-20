package com.k12.platform.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/*
 * 公开注册请求不允许提交 roleCode。
 * 服务端会强制分配 ROLE_STUDENT，避免越权注册管理员账号。
 */
public record RegisterRequest(
        @NotBlank
        @Size(min = 4, max = 32, message = "用户名需为 4-32 位")
        @Pattern(
                regexp = "^[a-zA-Z][a-zA-Z0-9_]{3,31}$",
                message = "用户名需以字母开头，仅可用字母、数字和下划线"
        )
        String username,

        @NotBlank
        @Size(min = 8, max = 72, message = "密码长度需为 8-72 位")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,72}$",
                message = "密码需同时包含字母和数字，且不能包含空格"
        )
        String password,

        @NotBlank
        @Size(max = 64, message = "昵称最多 64 个字符")
        @Pattern(regexp = "^[^\\p{Cc}]+$", message = "昵称不能包含控制字符")
        String nickname,
        @Email @Size(max = 128) String email
) {
}
