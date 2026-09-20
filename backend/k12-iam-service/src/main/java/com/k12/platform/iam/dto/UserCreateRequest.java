package com.k12.platform.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/*
 * 创建用户请求。
 *
 * 创建时必须传 password，因为要生成 sys_user.password_hash。
 * 更新用户资料时不使用这个 DTO，避免误改密码。
 */
public record UserCreateRequest(
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

        @NotBlank @Size(max = 64) String nickname,
        @Email @Size(max = 128) String email,
        @NotBlank @Size(max = 64) @Pattern(regexp = "ROLE_[A-Z][A-Z0-9_]*") String roleCode
) {
}
