package com.k12.platform.agent.client.dto;

import java.util.List;

/**
 * Java 调用 Python 沙箱使用的内部请求。
 *
 * @param code           需要在隔离沙箱中运行的 Python 代码
 * @param timeoutSeconds 最长执行时间，由 Python Runtime 再次校验为 1 到 30 秒
 * @param packages       预留依赖字段；当前必须为空，禁止用户运行时安装依赖
 */
public record RuntimeCodeExecutionRequest(
        String code,
        int timeoutSeconds,
        List<String> packages
) {
    /** 创建一个不安装额外依赖的安全默认请求。 */
    public static RuntimeCodeExecutionRequest of(String code, int timeoutSeconds) {
        return new RuntimeCodeExecutionRequest(code, timeoutSeconds, List.of());
    }
}
