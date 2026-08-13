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

    int deleteRolePermissions(@Param("roleId") Long roleId);

    int assignPermissionByCode(
            @Param("roleId") Long roleId,
            @Param("permissionCode") String permissionCode
    );
}
