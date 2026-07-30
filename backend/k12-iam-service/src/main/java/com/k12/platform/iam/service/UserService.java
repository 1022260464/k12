package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.UserRequest;
import com.k12.platform.iam.dto.UserResponse;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.UserAccount;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public List<UserResponse> listUsers() {
        return userMapper.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<UserResponse> getUser(Long id) {
        return userMapper.findById(id).map(this::toResponse);
    }

    public UserResponse createUser(UserRequest request) {
        UserAccount user = new UserAccount(
                null,
                request.username(),
                request.nickname(),
                request.email(),
                request.roleCode(),
                "ENABLED",
                Instant.now()
        );
        return toResponse(userMapper.insert(user));
    }

    public Optional<UserResponse> updateUser(Long id, UserRequest request) {
        if (!userMapper.existsById(id)) {
            return Optional.empty();
        }

        UserAccount user = new UserAccount(
                id,
                request.username(),
                request.nickname(),
                request.email(),
                request.roleCode(),
                "ENABLED",
                Instant.now()
        );
        return Optional.of(toResponse(userMapper.update(user)));
    }

    public boolean deleteUser(Long id) {
        return userMapper.deleteById(id);
    }

    private UserResponse toResponse(UserAccount user) {
        return new UserResponse(
                user.id(),
                user.username(),
                user.nickname(),
                user.email(),
                user.roleCode(),
                user.status(),
                user.updatedTime()
        );
    }
}
