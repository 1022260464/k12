package com.k12.platform.common.contract.iam;

import java.util.List;

/* Assessment 调用 IAM 批量校验作业接收人时使用的跨服务请求契约。 */
public record StudentValidationRequest(List<Long> userIds) {
}
