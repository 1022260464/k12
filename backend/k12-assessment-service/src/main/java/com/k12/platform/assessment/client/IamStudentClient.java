package com.k12.platform.assessment.client;

import com.k12.platform.assessment.config.IamFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.contract.iam.StudentValidationRequest;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(
        name = "k12-iam-service",
        url = "${k12.clients.iam-url:http://localhost:8081}",
        configuration = IamFeignConfiguration.class
)
public interface IamStudentClient {

    @PostMapping("/api/v1/iam/users/students/validate")
    ApiResponse<StudentValidationResponse> validateStudents(@RequestBody StudentValidationRequest request);
}
