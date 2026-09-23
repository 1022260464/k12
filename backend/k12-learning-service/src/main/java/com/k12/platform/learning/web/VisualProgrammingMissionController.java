package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionPublishedResponse;
import com.k12.platform.learning.service.VisualProgrammingMissionService;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 学生端已发布关卡查询（可匿名访问）。 */
@Validated
@RestController
@RequestMapping("/api/v1/learning/visual-programming/missions")
public class VisualProgrammingMissionController {
    private final VisualProgrammingMissionService service;

    public VisualProgrammingMissionController(VisualProgrammingMissionService service) {
        this.service = service;
    }

    @GetMapping("/published")
    public ApiResponse<List<VisualProgrammingMissionPublishedResponse>> listPublished() {
        return ApiResponse.ok(service.listPublished());
    }

    @GetMapping("/published/{missionCode}")
    public ApiResponse<VisualProgrammingMissionPublishedResponse> getPublished(
            @PathVariable("missionCode") @Pattern(regexp = "[a-z0-9-]{1,64}") String missionCode) {
        return ApiResponse.ok(service.getPublished(missionCode));
    }
}
