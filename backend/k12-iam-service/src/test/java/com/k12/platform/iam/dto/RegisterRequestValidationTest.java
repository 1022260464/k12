package com.k12.platform.iam.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegisterRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsOptionalEmailAndNormalNicknamePunctuation() {
        RegisterRequest request = new RegisterRequest(
                "student01",
                "student123",
                "O'Connor\\一班",
                null
        );

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsControlCharactersInNickname() {
        RegisterRequest request = new RegisterRequest(
                "student01",
                "student123",
                "小明\n同学",
                null
        );

        assertFalse(validator.validate(request).isEmpty());
    }
}
