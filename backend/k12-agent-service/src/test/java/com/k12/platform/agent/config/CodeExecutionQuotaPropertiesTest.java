package com.k12.platform.agent.config;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CodeExecutionQuotaPropertiesTest {

    @Test
    void dailyLimitDefaultsToFiveAndRejectsOutOfRangeValues() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            CodeExecutionQuotaProperties properties = new CodeExecutionQuotaProperties();
            assertThat(properties.getDailyLimit()).isEqualTo(5);

            properties.setDailyLimit(0);
            assertThat(validator.validate(properties)).isNotEmpty();
            properties.setDailyLimit(51);
            assertThat(validator.validate(properties)).isNotEmpty();
            properties.setDailyLimit(1);
            assertThat(validator.validate(properties)).isEmpty();
            properties.setDailyLimit(50);
            assertThat(validator.validate(properties)).isEmpty();
        }
    }
}
