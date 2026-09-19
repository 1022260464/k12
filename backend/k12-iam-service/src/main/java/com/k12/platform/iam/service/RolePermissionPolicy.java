package com.k12.platform.iam.service;

import com.k12.platform.common.security.K12Authorities;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 角色权限安全策略：仅允许调整少量业务只读/调用类权限，
 * 账号治理、角色配置、智能体管理、删除类等高风险权限一律锁定。
 */
final class RolePermissionPolicy {

    static final String ROLE_TEACHER = "ROLE_TEACHER";
    static final String ROLE_STUDENT = "ROLE_STUDENT";

    /** 允许通过管理端调整的权限（按角色白名单）。 */
    private static final Map<String, Set<String>> SAFE_EDITABLE = Map.of(
            ROLE_TEACHER, Set.of(
                    K12Authorities.COURSE_READ,
                    K12Authorities.HOMEWORK_READ,
                    K12Authorities.AGENT_READ,
                    K12Authorities.AGENT_INVOKE
            ),
            ROLE_STUDENT, Set.of(
                    K12Authorities.COURSE_READ,
                    K12Authorities.HOMEWORK_READ,
                    K12Authorities.HOMEWORK_SUBMIT,
                    K12Authorities.AGENT_READ,
                    K12Authorities.AGENT_INVOKE,
                    K12Authorities.LEARNING_PROFILE_READ,
                    K12Authorities.LEARNING_PROFILE_UPDATE
            )
    );

    private RolePermissionPolicy() {
    }

    static boolean isMutableRole(String roleCode) {
        return SAFE_EDITABLE.containsKey(roleCode);
    }

    static Set<String> safeEditable(String roleCode) {
        return SAFE_EDITABLE.getOrDefault(roleCode, Set.of());
    }

    /**
     * 合并权限：锁定部分保持现状，仅白名单内权限可按请求变化。
     * 若请求试图增删锁定权限，则拒绝。
     */
    static List<String> mergeOrReject(String roleCode, List<String> currentCodes, List<String> requestedCodes) {
        if (K12Authorities.ROLE_ADMIN.equals(roleCode)) {
            throw new IllegalArgumentException("ROLE_ADMIN permissions cannot be modified");
        }
        if (!isMutableRole(roleCode)) {
            throw new IllegalArgumentException("Role permissions are locked: " + roleCode);
        }

        Set<String> current = normalize(currentCodes);
        Set<String> requested = normalize(requestedCodes);
        Set<String> safe = safeEditable(roleCode);

        Set<String> locked = current.stream()
                .filter(code -> !safe.contains(code))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<String> missingLocked = locked.stream()
                .filter(code -> !requested.contains(code))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!missingLocked.isEmpty()) {
            throw new IllegalArgumentException(
                    "Locked permissions cannot be removed: " + String.join(", ", missingLocked));
        }

        Set<String> illegalAdds = requested.stream()
                .filter(code -> !safe.contains(code) && !current.contains(code))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!illegalAdds.isEmpty()) {
            throw new IllegalArgumentException(
                    "High-risk permissions cannot be granted via UI: " + String.join(", ", illegalAdds));
        }

        Set<String> merged = new LinkedHashSet<>(locked);
        requested.stream().filter(safe::contains).forEach(merged::add);
        return List.copyOf(merged);
    }

    private static Set<String> normalize(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return Set.of();
        }
        return codes.stream()
                .filter(code -> code != null && !code.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
