package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.RoleResponse;
import com.k12.platform.iam.mapper.RoleMapper;
import com.k12.platform.iam.model.RoleAccount;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import com.k12.platform.common.security.K12Authorities;

import java.util.Arrays;
import java.util.List;

/* 角色权限业务层，负责把一次权限更新放在同一个数据库事务中。 */
@Service
public class RoleService {

    private final RoleMapper roleMapper;

    public RoleService(RoleMapper roleMapper) {
        this.roleMapper = roleMapper;
    }

    /*
     * 表达式在方法执行前运行。字符串拼接使用的是编译期常量，最终效果等同于：
     * hasAuthority('ROLE_ADMIN') or hasAuthority('role:read')。
     */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.ROLE_READ + "')")
    public List<RoleResponse> listRoles() {
        return roleMapper.findAllRoles().stream().map(this::toResponse).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.ROLE_UPDATE + "')")
    public RoleResponse updatePermissions(Long roleId, List<String> permissionCodes) {
        RoleAccount role = roleMapper.findRoleById(roleId);
        if (role == null) {
            throw new IllegalArgumentException("Role not found: " + roleId);
        }
        if (K12Authorities.ROLE_ADMIN.equals(role.getCode())) {
            throw new IllegalArgumentException("ROLE_ADMIN permissions cannot be removed");
        }

        roleMapper.deleteRolePermissions(roleId);
        permissionCodes.stream().distinct().forEach(permissionCode -> {
            if (roleMapper.assignPermissionByCode(roleId, permissionCode) == 0) {
                throw new IllegalArgumentException("Permission not found or disabled: " + permissionCode);
            }
        });
        return toResponse(roleMapper.findRoleById(roleId));
    }

    private RoleResponse toResponse(RoleAccount role) {
        List<String> permissions = role.getPermissionCodes() == null || role.getPermissionCodes().isBlank()
                ? List.of()
                : Arrays.stream(role.getPermissionCodes().split(",")).toList();
        return new RoleResponse(role.getId(), role.getName(), role.getCode(), role.getDescription(), permissions);
    }
}
