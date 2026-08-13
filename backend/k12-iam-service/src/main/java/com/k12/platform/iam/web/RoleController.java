package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.RoleResponse;
import com.k12.platform.iam.dto.UpdateRolePermissionsRequest;
import com.k12.platform.iam.service.RoleService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/* 角色权限管理接口，实际权限由 Gateway 和 RoleService 的 @PreAuthorize 共同校验。 */
@RestController
@RequestMapping("/api/v1/iam/roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    public ApiResponse<List<RoleResponse>> listRoles() {
        return ApiResponse.ok(roleService.listRoles());
    }

    @PutMapping("/{id}/permissions")
    public ApiResponse<RoleResponse> updatePermissions(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRolePermissionsRequest request
    ) {
        return ApiResponse.ok(roleService.updatePermissions(id, request.permissionCodes()));
    }
}
