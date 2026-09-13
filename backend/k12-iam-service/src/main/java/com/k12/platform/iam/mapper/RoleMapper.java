package com.k12.platform.iam.mapper;

import com.k12.platform.iam.model.RoleAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/* 角色与权限关系 Mapper，SQL 统一放在 resources/mapper/iam/RoleMapper.xml。 */
@Mapper
public interface RoleMapper {

    List<RoleAccount> findAllRoles();

    RoleAccount findRoleById(@Param("id") Long id);

    RoleAccount findRoleByIdForUpdate(@Param("id") Long id);

    int deleteRolePermissions(@Param("roleId") Long roleId);

    int assignPermissionByCode(
            @Param("roleId") Long roleId,
            @Param("permissionCode") String permissionCode
    );

    /** 角色权限变化后，使拥有该角色的用户旧 JWT 失效。 */
    int bumpAuthVersionForRoleUsers(@Param("roleId") Long roleId);
}
