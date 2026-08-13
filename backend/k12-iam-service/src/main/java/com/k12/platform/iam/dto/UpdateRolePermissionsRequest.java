package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateRolePermissionsRequest(
        @NotNull @Size(max = 100)
        List<@NotBlank @Size(max = 128) @Pattern(regexp = "[a-z][a-z0-9-]*:[a-z][a-z0-9-]*") String> permissionCodes
) {
}
