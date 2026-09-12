package com.k12.platform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.iam.dto.LearningProfileRequest;
import com.k12.platform.iam.dto.LearningProfileResponse;
import com.k12.platform.iam.mapper.LearningProfileMapper;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.LearningProfile;
import com.k12.platform.iam.model.SysUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class LearningProfileService {

    private static final Map<String, GradeRange> STAGE_GRADE_RANGES = Map.of(
            "PRIMARY_LOWER", new GradeRange(1, 3),
            "PRIMARY_UPPER", new GradeRange(4, 6),
            "JUNIOR_HIGH", new GradeRange(7, 9),
            "SENIOR_HIGH", new GradeRange(10, 12)
    );

    private final LearningProfileMapper learningProfileMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public LearningProfileService(
            LearningProfileMapper learningProfileMapper,
            UserMapper userMapper,
            ObjectMapper objectMapper
    ) {
        this.learningProfileMapper = learningProfileMapper;
        this.userMapper = userMapper;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.LEARNING_PROFILE_READ + "')")
    public LearningProfileResponse getCurrentProfile() {
        Long userId = requireActiveCurrentUser();
        LearningProfile profile = learningProfileMapper.selectById(userId);
        if (profile == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "学习档案尚未创建");
        }
        return toResponse(profile);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.LEARNING_PROFILE_UPDATE + "')")
    public LearningProfileResponse saveCurrentProfile(LearningProfileRequest request) {
        Long userId = requireActiveCurrentUser();
        String schoolStage = request.schoolStage().trim().toUpperCase();
        validateStageAndGrade(schoolStage, request.grade());

        LearningProfile profile = new LearningProfile();
        profile.setUserId(userId);
        profile.setSchoolStage(schoolStage);
        profile.setGrade(request.grade());
        profile.setTextbook(trimToNull(request.textbook()));
        profile.setInterestsJson(writeInterests(request.interests()));
        learningProfileMapper.upsert(profile);

        return toResponse(learningProfileMapper.selectById(userId));
    }

    private Long requireActiveCurrentUser() {
        Long userId = K12SecurityContext.requireUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在或已停用");
        }
        return userId;
    }

    private void validateStageAndGrade(String schoolStage, Integer grade) {
        GradeRange range = STAGE_GRADE_RANGES.get(schoolStage);
        if (range == null) {
            throw new IllegalArgumentException("schoolStage 仅支持 PRIMARY_LOWER、PRIMARY_UPPER、JUNIOR_HIGH、SENIOR_HIGH");
        }
        if (grade < range.minimum() || grade > range.maximum()) {
            throw new IllegalArgumentException("grade 与 schoolStage 不匹配");
        }
    }

    private String writeInterests(List<String> interests) {
        List<String> normalized = interests == null
                ? List.of()
                : interests.stream().map(String::trim).distinct().toList();
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("学习兴趣序列化失败", exception);
        }
    }

    private LearningProfileResponse toResponse(LearningProfile profile) {
        try {
            List<String> interests = objectMapper.readValue(
                    profile.getInterestsJson(),
                    new TypeReference<List<String>>() { }
            );
            return new LearningProfileResponse(
                    profile.getUserId(),
                    profile.getSchoolStage(),
                    profile.getGrade(),
                    profile.getTextbook(),
                    interests,
                    profile.getUpdatedTime()
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库中的学习兴趣 JSON 无法解析", exception);
        }
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private record GradeRange(int minimum, int maximum) {
    }
}
