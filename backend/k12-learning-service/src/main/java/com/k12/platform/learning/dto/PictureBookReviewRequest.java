package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Size;

public record PictureBookReviewRequest(@Size(max = 1000) String note) {
}
