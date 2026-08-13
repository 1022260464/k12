package com.k12.platform.iam.dto;

import java.util.List;

/* 前端登录成功后保存 accessToken，后续请求使用 Bearer Token。 */
public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String username,
        List<String> authorities
) {
}
