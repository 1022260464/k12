package com.k12.platform.iam.service;

import com.k12.platform.common.contract.iam.StudentValidationRequest;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.dto.StudentDirectoryEntry;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class StudentDirectoryService {

    private static final int MAX_BATCH_SIZE = 500;

    private final UserMapper userMapper;

    public StudentDirectoryService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public List<StudentDirectoryEntry> listActiveStudents() {
        return userMapper.findActiveStudents();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.HOMEWORK_UPDATE + "')")
    public StudentValidationResponse validateStudents(StudentValidationRequest request) {
        if (request == null || request.userIds() == null || request.userIds().isEmpty()) {
            throw new IllegalArgumentException("userIds 不能为空");
        }
        if (request.userIds().size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("一次最多校验 500 个学生账号");
        }
        if (request.userIds().stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("userIds 只能包含正整数");
        }

        List<Long> requestedIds = new LinkedHashSet<>(request.userIds()).stream().toList();
        List<Long> validIds = userMapper.findActiveStudentIds(requestedIds);
        Set<Long> validSet = Set.copyOf(validIds);
        List<Long> invalidIds = requestedIds.stream().filter(id -> !validSet.contains(id)).toList();
        return new StudentValidationResponse(validIds, invalidIds);
    }
}
