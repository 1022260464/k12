package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 当前用户修改自己的密码，必须同时提交旧密码。 */
public record ChangePasswordRequest(
        @NotBlank @Size(max = 72) String currentPassword,
        @NotBlank
        @Size(min = 8, max = 72, message = "新密码长度需为 8-72 位")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,72}$",
                message = "新密码需同时包含字母和数字，且不能包含空格"
        )
        String newPassword
) {
}
