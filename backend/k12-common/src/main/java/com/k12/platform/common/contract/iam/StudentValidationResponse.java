package com.k12.platform.common.contract.iam;

import java.util.List;

/* invalidUserIds 非空时，Assessment 不允许保存作业接收人。 */
public record StudentValidationResponse(List<Long> validStudentIds, List<Long> invalidUserIds) {
}
