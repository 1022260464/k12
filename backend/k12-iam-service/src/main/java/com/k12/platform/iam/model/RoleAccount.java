package com.k12.platform.iam.model;

import lombok.Getter;
import lombok.Setter;

/* MyBatis 多表查询模型，用于组合角色和权限编码。 */
@Getter
@Setter
public class RoleAccount {
    private Long id;
    private String name;
    private String code;
    private String description;
    private String permissionCodes;
}
