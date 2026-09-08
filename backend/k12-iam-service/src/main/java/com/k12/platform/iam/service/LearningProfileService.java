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

@Service
public class LearningProfileService {
    private final LearningProfileMapper profileMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    public LearningProfileService(LearningProfileMapper profileMapper, UserMapper userMapper, ObjectMapper objectMapper) {
        this.profileMapper = profileMapper;
        this.userMapper = userMapper;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.LEARNING_PROFILE_READ + "')")
    public LearningProfileResponse getMine() {
        Long userId = activeUserId();
        LearningProfile profile = profileMapper.selectById(userId);
        if (profile == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "尚未设置学习档案");
        return response(profile);
    }

    @Transactional
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.LEARNING_PROFILE_UPDATE + "')")
    public LearningProfileResponse updateMine(LearningProfileRequest request) {
        Long userId = activeUserId();
        int min = switch (request.schoolStage()) {
            case "PRIMARY_LOWER" -> 1;
            case "PRIMARY_UPPER" -> 4;
            case "JUNIOR_HIGH" -> 7;
            case "SENIOR_HIGH" -> 10;
            default -> throw new IllegalArgumentException("未知学段");
        };
        if (request.grade() == null || request.grade() < min || request.grade() > min + 2) {
            throw new IllegalArgumentException("年级与学段不匹配，年级使用 1 至 12");
        }
        LearningProfile profile = new LearningProfile();
        profile.setUserId(userId);
        profile.setSchoolStage(request.schoolStage());
        profile.setGrade(request.grade());
        profile.setTextbook(request.textbook());
        try {
            profile.setInterests(objectMapper.writeValueAsString(request.interests().stream().map(String::trim).distinct().toList()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot serialize learning interests", exception);
        }
        profileMapper.upsert(profile);
        return response(profileMapper.selectById(userId));
    }

    private Long activeUserId() {
        Long userId = K12SecurityContext.requireUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null || !Integer.valueOf(1).equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号不存在或已停用");
        }
        return userId;
    }

    private LearningProfileResponse response(LearningProfile profile) {
        try {
            List<String> interests = objectMapper.readValue(profile.getInterests(), new TypeReference<List<String>>() {});
            return new LearningProfileResponse(profile.getUserId(), profile.getSchoolStage(), profile.getGrade(),
                    profile.getTextbook(), interests, profile.getUpdatedTime());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Invalid stored learning interests", exception);
        }
    }
}
