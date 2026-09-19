package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 学生/教师自助更新昵称与邮箱。 */
public record SelfProfileUpdateRequest(
        @NotBlank @Size(max = 64) String nickname,
        @Size(max = 128) String email
) {
}
