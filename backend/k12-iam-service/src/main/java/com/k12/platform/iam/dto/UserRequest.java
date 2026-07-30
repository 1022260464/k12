package com.k12.platform.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UserRequest(
        @NotBlank String username,
        @NotBlank String nickname,
        @Email String email,
        @NotBlank String roleCode
) {
}
