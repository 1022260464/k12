package com.k12.platform.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/*
 * 更新用户资料请求。
 *
 * 这里不包含 password。
 * 密码修改后续应该单独设计接口，例如 /users/{id}/password。
 */
public record UserUpdateRequest(
        @NotBlank @Size(max = 64) String username,
        @NotBlank @Size(max = 64) String nickname,
        @Email @Size(max = 128) String email,
        @NotBlank @Size(max = 64) @Pattern(regexp = "ROLE_[A-Z][A-Z0-9_]*") String roleCode
) {
}
