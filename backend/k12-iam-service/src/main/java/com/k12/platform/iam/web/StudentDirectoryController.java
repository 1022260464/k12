package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.contract.iam.StudentValidationRequest;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import com.k12.platform.iam.service.StudentDirectoryService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import com.k12.platform.iam.dto.StudentDirectoryEntry;
import java.util.List;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/users/students")
public class StudentDirectoryController {

    private final StudentDirectoryService studentDirectoryService;

    public StudentDirectoryController(StudentDirectoryService studentDirectoryService) {
        this.studentDirectoryService = studentDirectoryService;
    }

    @GetMapping
    public ApiResponse<List<StudentDirectoryEntry>> listActiveStudents() {
        return ApiResponse.ok(studentDirectoryService.listActiveStudents());
    }

    @PostMapping("/validate")
    public ApiResponse<StudentValidationResponse> validateStudents(
            @RequestBody StudentValidationRequest request
    ) {
        return ApiResponse.ok(studentDirectoryService.validateStudents(request));
    }
}
