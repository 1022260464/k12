package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 管理员重置密码，不回传明文密码。 */
public record ResetPasswordRequest(
        @NotBlank @Size(min = 8, max = 72) String newPassword
) {
}
