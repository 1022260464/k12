package com.k12.platform.iam.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/*
 * IAM service database-backed user loader.
 *
 * Spring Security calls loadUserByUsername when a request uses HTTP Basic.
 * This service reads the user and roles from k12_auth instead of using the
 * default in-memory admin account from k12-common.
 */
@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseUserDetailsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        DbUser dbUser = findUser(username);
        List<String> roleCodes = findRoleCodes(dbUser.id());

        return User.withUsername(dbUser.username())
                /*
                 * password_hash already stores the BCrypt value from sys_user.
                 * Do not encode it again here.
                 */
                .password(dbUser.passwordHash())
                .authorities(roleCodes.toArray(String[]::new))
                .disabled(dbUser.status() == 0)
                .accountLocked(dbUser.status() == 2)
                .build();
    }

    private DbUser findUser(String username) {
        List<DbUser> users = jdbcTemplate.query(
                """
                SELECT id, username, password_hash, status
                FROM sys_user
                WHERE username = ?
                  AND deleted = 0
                """,
                (rs, rowNum) -> new DbUser(
                        rs.getLong("id"),
                        rs.getString("username"),
                        rs.getString("password_hash"),
                        rs.getInt("status")
                ),
                username
        );

        if (users.isEmpty()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }
        return users.get(0);
    }

    private List<String> findRoleCodes(Long userId) {
        return jdbcTemplate.queryForList(
                """
                SELECT r.role_code
                FROM sys_user_role ur
                JOIN sys_role r ON r.id = ur.role_id
                WHERE ur.user_id = ?
                  AND r.status = 1
                """,
                String.class,
                userId
        );
    }

    private record DbUser(Long id, String username, String passwordHash, int status) {
    }
}
