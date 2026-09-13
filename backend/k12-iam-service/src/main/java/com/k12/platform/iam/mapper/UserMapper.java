package com.k12.platform.iam.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.iam.model.AuthUser;
import com.k12.platform.iam.model.SysUser;
import com.k12.platform.iam.model.UserAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/*
 * IAM 用户数据访问层。
 *
 * 这里故意把单表 CRUD 和复杂 RBAC 查询放在同一个 Mapper 入口：
 * 1. sys_user 单表增删改查使用 MyBatis-Plus BaseMapper。
 * 2. 用户列表、登录认证、角色权限查询需要关联多张表，使用 MyBatis XML。
 *
 * 这样 Service 层只依赖 Mapper，不直接写 SQL，也不再混用 JdbcTemplate。
 */
@Mapper
public interface UserMapper extends BaseMapper<SysUser> {

    /*
     * 查询用户列表展示数据。
     *
     * sys_user 是用户主表，sys_user_role/sys_role 是角色关系。
     * GROUP_CONCAT 用来把同一个用户的多个角色合并到 roleCode 字段，
     * 避免一个用户因为多个角色在列表里出现多行。
     */
    List<UserAccount> findAllAccounts();

    /*
     * 查询单个用户详情。
     *
     * 返回 UserAccount 是为了给接口展示使用，不直接返回 SysUser。
     * 这样不会把 password_hash 等敏感字段暴露给 Controller。
     */
    UserAccount findAccountById(@Param("id") Long id);

    /*
     * 登录认证专用查询。
     *
     * Spring Security 校验密码只需要用户名、密码哈希、账号状态。
     * 这里不查询昵称、邮箱等展示字段，避免认证链路携带无关数据。
     */
    AuthUser findAuthUserByUsername(@Param("username") String username);

    /** 加行锁读取安全字段，防止并发登录丢失失败次数。 */
    SysUser findSecurityUserForUpdate(@Param("id") Long id);

    /** 令牌中的 authVersion 必须和数据库一致，且账号仍处于启用状态。 */
    boolean isTokenStateValid(@Param("userId") Long userId, @Param("authVersion") Long authVersion);

    /*
     * 查询用户拥有的角色编码。
     *
     * Spring Security 识别角色时通常使用 ROLE_ 前缀，
     * 例如 ROLE_ADMIN、ROLE_TEACHER。
     */
    List<String> findRoleCodesByUserId(@Param("userId") Long userId);

    /*
     * 查询用户拥有的权限编码。
     *
     * Service 层可使用 @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
     * 时，就会依赖这些 permission_code。
     */
    List<String> findPermissionCodesByUserId(@Param("userId") Long userId);

    /*
     * 删除用户的角色绑定关系。
     *
     * 更新用户角色时先删旧关系，再插入新关系。
     * 删除用户时也会清理关系表，避免留下无效绑定。
     */
    int deleteUserRoles(@Param("userId") Long userId);

    /*
     * 根据角色编码给用户绑定角色。
     *
     * roleCode 不直接当 role_id 使用，而是先查 sys_role，
     * 这样前端和接口只需要传 ROLE_ADMIN 这类稳定编码。
     *
     * NOT EXISTS 用来避免重复插入同一个用户角色关系。
     */
    int assignRoleByCode(@Param("userId") Long userId, @Param("roleCode") String roleCode);

    /* 批量返回处于启用状态且拥有 ROLE_STUDENT 的用户 ID。 */
    List<Long> findActiveStudentIds(@Param("userIds") List<Long> userIds);
}
