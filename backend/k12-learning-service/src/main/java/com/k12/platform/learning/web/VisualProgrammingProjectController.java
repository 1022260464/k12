package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.VisualProgrammingProjectRequest;
import com.k12.platform.learning.dto.VisualProgrammingProjectResponse;
import com.k12.platform.learning.service.VisualProgrammingProjectService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/visual-programming/projects")
public class VisualProgrammingProjectController {
    private final VisualProgrammingProjectService service;

    public VisualProgrammingProjectController(VisualProgrammingProjectService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public ApiResponse<List<VisualProgrammingProjectResponse>> listMine() {
        return ApiResponse.ok(service.listMine());
    }

    @PutMapping("/{missionCode}")
    public ApiResponse<VisualProgrammingProjectResponse> save(
            @PathVariable("missionCode") @Pattern(regexp = "[a-z0-9-]{1,64}") String missionCode,
            @Valid @RequestBody VisualProgrammingProjectRequest request) {
        return ApiResponse.ok(service.save(missionCode, request));
    }
}

