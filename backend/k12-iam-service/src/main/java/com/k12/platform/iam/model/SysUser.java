package com.k12.platform.iam.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/*
 * sys_user 表实体。
 *
 * 这个类用于 MyBatis-Plus 单表 CRUD。
 * 不直接作为接口响应返回，因为里面包含 passwordHash 等敏感字段。
 */
@Getter
@Setter
@TableName("sys_user")
public class SysUser {

    /*
     * sys_user.id 是 MySQL 自增主键。
     * IdType.AUTO 表示插入后由数据库生成 ID，并回填到实体对象。
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String passwordHash;
    private String nickname;
    private String email;
    private Integer status;
    private Integer failedLoginCount;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Instant lockedUntil;
    private Long authVersion;
    private Instant lastLoginTime;
    private Instant updatedTime;

    /*
     * 逻辑删除字段。
     * deleteById 时 MyBatis-Plus 会把 deleted 从 0 改成 1，
     * 而不是直接 DELETE 物理删除数据。
     */
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
