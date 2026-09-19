package com.k12.platform.iam.service;

import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.iam.dto.RoleResponse;
import com.k12.platform.iam.mapper.RoleMapper;
import com.k12.platform.iam.model.RoleAccount;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

/* 角色权限业务层：更新在同一事务中完成，并强制应用安全白名单。 */
@Service
public class RoleService {

    private final RoleMapper roleMapper;
    private final OperationAuditService operationAuditService;

    public RoleService(RoleMapper roleMapper, OperationAuditService operationAuditService) {
        this.roleMapper = roleMapper;
        this.operationAuditService = operationAuditService;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.ROLE_READ + "')")
    public List<RoleResponse> listRoles() {
        return roleMapper.findAllRoles().stream().map(this::toResponse).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.ROLE_UPDATE + "')")
    public RoleResponse updatePermissions(Long roleId, List<String> permissionCodes) {
        RoleAccount locked = roleMapper.findRoleByIdForUpdate(roleId);
        if (locked == null) {
            throw new IllegalArgumentException("Role not found: " + roleId);
        }

        RoleAccount current = roleMapper.findRoleById(roleId);
        if (current == null) {
            throw new IllegalArgumentException("Role not found: " + roleId);
        }

        List<String> currentCodes = parsePermissionCodes(current.getPermissionCodes());
        List<String> merged = RolePermissionPolicy.mergeOrReject(
                locked.getCode(),
                currentCodes,
                permissionCodes
        );

        roleMapper.deleteRolePermissions(roleId);
        merged.forEach(permissionCode -> {
            if (roleMapper.assignPermissionByCode(roleId, permissionCode) == 0) {
                throw new IllegalArgumentException("Permission not found or disabled: " + permissionCode);
            }
        });
        roleMapper.bumpAuthVersionForRoleUsers(roleId);
        operationAuditService.record(
                "ROLE_PERMISSIONS_UPDATE",
                "ROLE",
                roleId,
                "permissionCount=" + merged.size() + ";role=" + locked.getCode()
        );
        return toResponse(roleMapper.findRoleById(roleId));
    }

    private RoleResponse toResponse(RoleAccount role) {
        return new RoleResponse(
                role.getId(),
                role.getName(),
                role.getCode(),
                role.getDescription(),
                parsePermissionCodes(role.getPermissionCodes())
        );
    }

    private static List<String> parsePermissionCodes(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .toList();
    }
}
