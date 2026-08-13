package com.k12.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/*
 * Spring Security 的异常发生在 Controller 之前，普通全局异常处理器接不到。
 * 因此安全过滤链使用这个工具，统一输出 ApiResponse JSON。
 */
public final class K12SecurityErrorWriter {

    private K12SecurityErrorWriter() {
    }

    public static void write(
            HttpServletResponse response,
            ObjectMapper objectMapper,
            int status,
            String message
    ) throws IOException {
        /* Filter 发生在 Controller 之前，只能直接操作 HttpServletResponse 输出 JSON。 */
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.fail(status, message));
    }
}
