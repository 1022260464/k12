package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/iam")
public class IamProfileController {

    /*
     * Protected test endpoint.
     *
     * /api/v1/iam/health is public, so it cannot verify database login.
     * This endpoint requires authentication and returns the logged-in user.
     */
    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> me(Authentication authentication) {
        List<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        return ApiResponse.ok(new CurrentUserResponse(
                K12SecurityContext.requireUserId(),
                authentication.getName(),
                authorities
        ));
    }

    public record CurrentUserResponse(Long userId, String username, List<String> authorities) {
    }
}
