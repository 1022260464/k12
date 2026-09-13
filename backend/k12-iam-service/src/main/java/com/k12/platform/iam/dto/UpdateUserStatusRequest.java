package com.k12.platform.iam.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(@NotNull UserStatus status) {
    public enum UserStatus {
        ENABLED(1), DISABLED(0), LOCKED(2);

        private final int databaseValue;

        UserStatus(int databaseValue) {
            this.databaseValue = databaseValue;
        }

        public int databaseValue() {
            return databaseValue;
        }
    }
}
