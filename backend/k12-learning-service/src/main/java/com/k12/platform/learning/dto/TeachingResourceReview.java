package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Size;

public record TeachingResourceReview(@Size(max = 500) String note) {
}
