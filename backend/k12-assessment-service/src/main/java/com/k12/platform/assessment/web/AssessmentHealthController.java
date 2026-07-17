package com.k12.platform.assessment.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.model.ServiceDescriptor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assessments")
public class AssessmentHealthController {


    @GetMapping("/health")
    public ApiResponse<ServiceDescriptor> health() {
        return ApiResponse.ok(new ServiceDescriptor(
                "assessment",
                "K12 Assessment Service",
                "作业、测验、诊断报告、学习效果评价和错题归因域。",
                List.of("homework", "quiz", "diagnosis", "learning-evaluation")
        ));
    }

}
