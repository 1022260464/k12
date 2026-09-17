package com.k12.platform.agent.service;

import com.k12.platform.agent.config.CodeExecutionQuotaProperties;
import com.k12.platform.agent.mapper.CodeExecutionQuotaMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CodeExecutionQuotaServiceTest {

    @Mock
    private CodeExecutionQuotaMapper mapper;
    private final CodeExecutionQuotaProperties properties = new CodeExecutionQuotaProperties();

    @BeforeEach
    void configureLimit() {
        properties.setDailyLimit(2);
    }

    @Test
    @DisplayName("未启用配额时不访问配额表")
    void disabledQuotaDoesNotTouchDatabase() {
        new CodeExecutionQuotaService(mapper, properties).reserve(42L);

        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("启用配额后按用户和上海自然日原子预占")
    void reservesOneAttempt() {
        properties.setEnabled(true);
        when(mapper.reserve(org.mockito.ArgumentMatchers.eq(42L), any(LocalDate.class),
                org.mockito.ArgumentMatchers.eq(2))).thenReturn(1);

        new CodeExecutionQuotaService(mapper, properties).reserve(42L);

        verify(mapper).ensureDay(org.mockito.ArgumentMatchers.eq(42L), any(LocalDate.class));
        verify(mapper).reserve(org.mockito.ArgumentMatchers.eq(42L), any(LocalDate.class),
                org.mockito.ArgumentMatchers.eq(2));
    }

    @Test
    @DisplayName("达到日上限返回429")
    void exhaustedQuotaIsRejected() {
        properties.setEnabled(true);

        assertThatThrownBy(() -> new CodeExecutionQuotaService(mapper, properties).reserve(42L))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(error.getReason()).isEqualTo("今日代码运行次数已用完");
                });
    }

    @Test
    @DisplayName("数据库不可用时拒绝云执行，不绕过配额")
    void storageFailureFailsClosed() {
        properties.setEnabled(true);
        org.mockito.Mockito.doThrow(new DataAccessResourceFailureException("database unavailable"))
                .when(mapper).ensureDay(org.mockito.ArgumentMatchers.eq(42L), any(LocalDate.class));

        assertThatThrownBy(() -> new CodeExecutionQuotaService(mapper, properties).reserve(42L))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(error.getReason()).doesNotContain("database unavailable");
                });
        verify(mapper, never()).reserve(org.mockito.ArgumentMatchers.anyLong(),
                any(LocalDate.class), org.mockito.ArgumentMatchers.anyInt());
    }
}
