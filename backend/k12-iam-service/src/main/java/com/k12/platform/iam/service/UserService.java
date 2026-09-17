package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.UserCreateRequest;
import com.k12.platform.iam.dto.UserResponse;
import com.k12.platform.iam.dto.UserUpdateRequest;
import com.k12.platform.iam.dto.RegisterRequest;
import com.k12.platform.iam.dto.ChangePasswordRequest;
import com.k12.platform.iam.dto.ResetPasswordRequest;
import com.k12.platform.iam.dto.UpdateUserStatusRequest;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.SysUser;
import com.k12.platform.iam.model.UserAccount;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.common.security.K12Authorities;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/*
 * IAM 用户管理业务层。
 *
 * Controller 只处理 HTTP 入参和响应；
 * Mapper 只处理数据库访问；
 * 用户创建、更新、删除时的业务编排放在这里。
 */
@Service
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final OperationAuditService operationAuditService;

    public UserService(UserMapper userMapper, PasswordEncoder passwordEncoder,
                       OperationAuditService operationAuditService) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.operationAuditService = operationAuditService;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.USER_READ + "')")
    public List<UserResponse> listUsers() {
        /*
         * 列表接口返回展示模型 UserAccount，不返回 sys_user 表实体。
         * 这样可以避免 password_hash 这类敏感字段进入响应。
         */
        return userMapper.findAllAccounts().stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.USER_READ + "')")
    public Optional<UserResponse> getUser(Long id) {
        return Optional.ofNullable(userMapper.findAccountById(id)).map(this::toResponse);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.USER_CREATE + "')")
    public UserResponse createUser(UserCreateRequest request) {
        validateRoleAssignment(request.roleCode());
        return createUserInternal(request);
    }

    private UserResponse createUserInternal(UserCreateRequest request) {
        /*
         * 创建用户时先写 sys_user。
         *
         * request.password 是前端传来的明文密码，
         * 入库前必须用 BCrypt 变成 password_hash。
         */
        SysUser user = new SysUser();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setNickname(request.nickname());
        user.setEmail(request.email());
        user.setStatus(1);
        user.setDeleted(0);

        userMapper.insert(user);
        /*
         * MyBatis-Plus 插入成功后会把自增主键回填到 user.id。
         * 拿到 user.id 后，再写 sys_user_role 绑定角色。
         */
        assignRole(user.getId(), request.roleCode());
        operationAuditService.record("USER_CREATE", "USER", user.getId(), "role=" + request.roleCode());

        return toResponse(userMapper.findAccountById(user.getId()));
    }

    /*
     * 公开注册只能创建学生账号。
     * roleCode 在服务端固定，不能相信浏览器提交的管理员角色。
     *
     * 这里是公开入口，所以不能添加 @PreAuthorize。
     * 公共和管理端创建分别进入私有创建逻辑，避免依赖“内部调用绕过 AOP”的隐式行为。
     */
    @Transactional
    public UserResponse registerStudent(RegisterRequest request) {
        return createUserInternal(new UserCreateRequest(
                request.username(),
                request.password(),
                request.nickname(),
                request.email(),
                "ROLE_STUDENT"
        ));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.USER_UPDATE + "')")
    public Optional<UserResponse> updateUser(Long id, UserUpdateRequest request) {
        /*
         * 更新用户不强制修改密码。
         * 密码修改后续应该单独做接口，避免普通资料更新误改密码。
         */
        SysUser user = userMapper.findSecurityUserForUpdate(id);
        if (user == null) {
            return Optional.empty();
        }
        validateRoleAssignment(request.roleCode());
        if (id.equals(K12SecurityContext.currentUserId().orElse(null))
                && K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)
                && !"ROLE_ADMIN".equals(request.roleCode())) {
            throw new IllegalArgumentException("不能移除当前登录管理员自己的管理员角色");
        }

        user.setUsername(request.username());
        user.setNickname(request.nickname());
        user.setEmail(request.email());
        user.setAuthVersion(nextAuthVersion(user.getAuthVersion()));

        userMapper.updateById(user);
        /*
         * 当前接口先按单角色处理：
         * 更新时清空旧角色绑定，再绑定请求里的 roleCode。
         * 后续如果支持多角色，可以把 roleCode 改成 roleCodes 列表。
         */
        userMapper.deleteUserRoles(id);
        assignRole(id, request.roleCode());
        operationAuditService.record("USER_UPDATE", "USER", id, "role=" + request.roleCode());

        return Optional.of(toResponse(userMapper.findAccountById(id)));
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.USER_DELETE + "')")
    public boolean deleteUser(Long id) {
        /*
         * SysUser.deleted 配了 @TableLogic，
         * 所以 deleteById 执行的是逻辑删除，不是物理删除 sys_user。
         */
        if (id.equals(K12SecurityContext.currentUserId().orElse(null))) {
            throw new IllegalArgumentException("不能删除当前登录账号");
        }
        int rows = userMapper.deleteById(id);
        if (rows > 0) {
            userMapper.deleteUserRoles(id);
            operationAuditService.record("USER_DELETE", "USER", id, null);
            return true;
        }
        return false;
    }

    @Transactional
    @PreAuthorize("isAuthenticated()")
    public void changeOwnPassword(ChangePasswordRequest request) {
        Long userId = K12SecurityContext.requireUserId();
        SysUser user = requireSecurityUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("当前密码错误");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("新密码不能与当前密码相同");
        }
        updatePassword(user, request.newPassword());
        operationAuditService.record("PASSWORD_CHANGE", "USER", userId, "self=true");
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public void resetPassword(Long userId, ResetPasswordRequest request) {
        SysUser user = requireSecurityUser(userId);
        updatePassword(user, request.newPassword());
        operationAuditService.record("PASSWORD_RESET", "USER", userId, null);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public void updateStatus(Long userId, UpdateUserStatusRequest request) {
        if (userId.equals(K12SecurityContext.currentUserId().orElse(null))) {
            throw new IllegalArgumentException("不能修改当前登录账号自己的状态");
        }
        SysUser user = requireSecurityUser(userId);
        user.setStatus(request.status().databaseValue());
        user.setAuthVersion(nextAuthVersion(user.getAuthVersion()));
        if (request.status() == UpdateUserStatusRequest.UserStatus.ENABLED) {
            user.setFailedLoginCount(0);
            user.setLockedUntil(null);
        }
        userMapper.updateById(user);
        operationAuditService.record("USER_STATUS_UPDATE", "USER", userId,
                "status=" + request.status().name());
    }

    private void updatePassword(SysUser user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setAuthVersion(nextAuthVersion(user.getAuthVersion()));
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userMapper.updateById(user);
    }

    private SysUser requireSecurityUser(Long userId) {
        SysUser user = userMapper.findSecurityUserForUpdate(userId);
        if (user == null) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        return user;
    }

    private long nextAuthVersion(Long current) {
        return current == null ? 2L : current + 1L;
    }

    private void assignRole(Long userId, String roleCode) {
        /*
         * 如果 roleCode 不存在或角色被禁用，Mapper 插入行数为 0。
         * 这里抛异常，让事务回滚，避免出现“用户创建了但没有角色”的半成品数据。
         */
        int rows = userMapper.assignRoleByCode(userId, roleCode);
        if (rows == 0) {
            throw new IllegalArgumentException("Role not found or disabled: " + roleCode);
        }
    }

    private void validateRoleAssignment(String roleCode) {
        /*
         * user:create / user:update 和“授予管理员角色”不是同一层权限。
         * 即使未来把用户维护权限授给教师，也不能让教师创建管理员账号。
         */
        if (K12Authorities.ROLE_ADMIN.equals(roleCode)
                && !K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)) {
            throw new IllegalArgumentException("只有管理员可以分配 ROLE_ADMIN 角色");
        }
    }

    private UserResponse toResponse(UserAccount user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getEmail(),
                user.getRoleCode(),
                user.getStatus(),
                user.getUpdatedTime()
        );
    }
}
