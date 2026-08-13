package com.k12.platform.iam.service;

import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.AuthUser;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Stream;

/*
 * IAM 登录认证业务层。
 *
 * 这里负责组织 JWT 登录需要的认证数据：
 * 1. 查询用户密码哈希和状态。
 * 2. 查询角色编码。
 * 3. 查询权限编码。
 * 4. 合并成 Spring Security 能识别的 authorities。
 */
@Service
public class UserAuthenticationService {

    private final UserMapper userMapper;

    public UserAuthenticationService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public AuthenticatedUser loadByUsername(String username) {
        /*
         * 认证第一步：按用户名查 sys_user。
         * 找不到用户时抛 UsernameNotFoundException，
         * Spring Security 会把它当成认证失败处理。
         */
        AuthUser user = userMapper.findAuthUserByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        /*
         * 认证第二步：查询角色和权限。
         *
         * roleCodes 示例：ROLE_ADMIN
         * permissionCodes 示例：course:update
         *
         * 两者都会放进 authorities，后续既可以按角色判断，
         * 也可以按具体权限码判断。
         */
        List<String> roleCodes = userMapper.findRoleCodesByUserId(user.getId());
        List<String> permissionCodes = userMapper.findPermissionCodesByUserId(user.getId());
        List<String> authorities = Stream.concat(roleCodes.stream(), permissionCodes.stream())
                .distinct()
                .toList();

        return new AuthenticatedUser(
                user.getId(),
                user.getUsername(),
                user.getPasswordHash(),
                user.getStatus(),
                authorities
        );
    }

    /*
     * 认证链路内部使用的用户对象。
     *
     * passwordHash 是数据库里已经保存好的 BCrypt 密码哈希，
     * 不能在这里再次加密。
     */
    public record AuthenticatedUser(
            Long id,
            String username,
            String passwordHash,
            int status,
            List<String> authorities
    ) {
    }
}
