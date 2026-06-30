package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.model.ServiceDescriptor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/learning")
public class LearningHealthController {

    @GetMapping("/health")
    public ApiResponse<ServiceDescriptor> health() {
        return ApiResponse.ok(new ServiceDescriptor(
                "learning",
                "K12 Learning Service",
                "课程、班级、知识点、学习任务等核心教学资源域。",
                List.of("course", "classroom", "knowledge-point", "learning-task")
        ));
    }
}
