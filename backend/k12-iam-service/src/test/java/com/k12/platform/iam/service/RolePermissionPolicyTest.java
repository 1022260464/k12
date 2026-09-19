package com.k12.platform.iam.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("角色权限安全白名单")
class RolePermissionPolicyTest {

    @Test
    @DisplayName("允许在白名单内增删教师只读类权限，并保留锁定权限")
    void shouldMergeTeacherSafePermissions() {
        List<String> current = List.of(
                "course:read", "course:create", "course:update", "course:delete",
                "homework:read", "homework:grade", "agent:read", "agent:invoke"
        );
        List<String> requested = List.of(
                "course:read", "course:create", "course:update", "course:delete",
                "homework:grade", "agent:read"
        );

        List<String> merged = RolePermissionPolicy.mergeOrReject("ROLE_TEACHER", current, requested);

        assertThat(merged).containsExactlyInAnyOrder(
                "course:read", "course:create", "course:update", "course:delete",
                "homework:grade", "agent:read"
        );
        assertThat(merged).doesNotContain("homework:read", "agent:invoke");
    }

    @Test
    @DisplayName("拒绝移除锁定的高风险权限")
    void shouldRejectRemovingLockedPermission() {
        List<String> current = List.of("course:create", "course:read", "user:read");
        List<String> requested = List.of("course:read");

        assertThatThrownBy(() -> RolePermissionPolicy.mergeOrReject("ROLE_TEACHER", current, requested))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Locked permissions cannot be removed")
                .hasMessageContaining("course:create")
                .hasMessageContaining("user:read");
    }

    @Test
    @DisplayName("拒绝通过接口授予高风险权限")
    void shouldRejectGrantingHighRiskPermission() {
        List<String> current = List.of("course:read", "agent:invoke");
        List<String> requested = List.of("course:read", "agent:invoke", "user:create");

        assertThatThrownBy(() -> RolePermissionPolicy.mergeOrReject("ROLE_STUDENT", current, requested))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("High-risk permissions cannot be granted")
                .hasMessageContaining("user:create");
    }

    @Test
    @DisplayName("管理员角色权限不可修改")
    void shouldRejectAdminRoleMutation() {
        assertThatThrownBy(() -> RolePermissionPolicy.mergeOrReject(
                "ROLE_ADMIN",
                List.of("user:read"),
                List.of("user:read")
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ROLE_ADMIN");
    }
}
