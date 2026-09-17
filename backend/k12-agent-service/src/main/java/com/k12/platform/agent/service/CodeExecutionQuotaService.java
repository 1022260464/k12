package com.k12.platform.agent.service;

import com.k12.platform.agent.config.CodeExecutionQuotaProperties;
import com.k12.platform.agent.mapper.CodeExecutionQuotaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneId;

/** 每次合法提交计一次；失败和取消不退还，避免重复请求消耗云资源。 */
@Service
public class CodeExecutionQuotaService {

    private static final Logger log = LoggerFactory.getLogger(CodeExecutionQuotaService.class);
    private static final ZoneId QUOTA_ZONE = ZoneId.of("Asia/Shanghai");

    private final CodeExecutionQuotaMapper mapper;
    private final CodeExecutionQuotaProperties properties;

    public CodeExecutionQuotaService(CodeExecutionQuotaMapper mapper, CodeExecutionQuotaProperties properties) {
        this.mapper = mapper;
        this.properties = properties;
    }

    public void reserve(Long userId) {
        if (!properties.isEnabled()) {
            return;
        }

        LocalDate today = LocalDate.now(QUOTA_ZONE);
        try {
            mapper.ensureDay(userId, today);
            if (mapper.reserve(userId, today, properties.getDailyLimit()) != 1) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "今日代码运行次数已用完");
            }
        } catch (DataAccessException exception) {
            log.warn("代码执行配额存储不可用，userId={}", userId);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "代码执行配额服务暂不可用");
        }
    }
}
