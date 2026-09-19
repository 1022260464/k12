package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.iam.dto.SelfProfileResponse;
import com.k12.platform.iam.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/iam")
public class IamProfileController {

    private final UserService userService;

    public IamProfileController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 当前登录用户摘要：含学习档案号（userId）、昵称与头像。
     */
    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> me(Authentication authentication) {
        List<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        SelfProfileResponse profile = userService.getOwnProfile();
        return ApiResponse.ok(new CurrentUserResponse(
                profile.userId() != null ? profile.userId() : K12SecurityContext.requireUserId(),
                profile.username() != null ? profile.username() : authentication.getName(),
                profile.nickname(),
                profile.email(),
                profile.avatarUrl(),
                authorities
        ));
    }

    public record CurrentUserResponse(
            Long userId,
            String username,
            String nickname,
            String email,
            String avatarUrl,
            List<String> authorities
    ) {
    }
}
