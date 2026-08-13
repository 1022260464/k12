package com.k12.platform.common.api;

import java.time.Instant;

public record ApiResponse<T>(int code, String message, T data, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(200, "ok", data, Instant.now());
    }

    public static <T> ApiResponse<T> fail(String message) {
        return fail(500, message);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null, Instant.now());
    }
}
