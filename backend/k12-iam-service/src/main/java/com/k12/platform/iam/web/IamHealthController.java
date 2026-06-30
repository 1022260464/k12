package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.model.ServiceDescriptor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/iam")
public class IamHealthController {

    @GetMapping("/health")
    public ApiResponse<ServiceDescriptor> health() {
        return ApiResponse.ok(new ServiceDescriptor(
                "iam",
                "K12 IAM Service",
                "学生、教师、家长、管理员等账号身份与权限域。",
                List.of("user-profile", "role-permission", "tenant-school")
        ));
    }
}
