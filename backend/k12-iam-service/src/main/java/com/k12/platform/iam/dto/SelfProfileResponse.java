package com.k12.platform.iam.dto;

/** 当前登录用户的个人资料（不含密码）。 */
public record SelfProfileResponse(
        Long userId,
        String username,
        String nickname,
        String email,
        String avatarUrl,
        String avatarObjectKey
) {
}
