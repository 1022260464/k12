package com.k12.platform.iam.dto;

import java.util.List;

public record RoleResponse(
        Long id,
        String name,
        String code,
        String description,
        List<String> permissionCodes
) {
}
