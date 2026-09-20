package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 管理员重置密码，不回传明文密码。 */
public record ResetPasswordRequest(
        @NotBlank
        @Size(min = 8, max = 72, message = "新密码长度需为 8-72 位")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,72}$",
                message = "新密码需同时包含字母和数字，且不能包含空格"
        )
        String newPassword
) {
}
