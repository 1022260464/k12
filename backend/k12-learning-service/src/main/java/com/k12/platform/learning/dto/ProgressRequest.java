package com.k12.platform.learning.dto;

import jakarta.validation.constraints.*;

/** 进度为累计百分比，重复或乱序上报不能让已保存进度倒退。 */
public record ProgressRequest(@NotNull @Min(0) @Max(100) Integer progressPercent) {
}

