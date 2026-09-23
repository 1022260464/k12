package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionCreateRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionDuplicateRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionOrderRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionTemplateResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionUpdateRequest;
import com.k12.platform.learning.service.VisualProgrammingMissionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 图形化编程关卡管理端接口，仅 ROLE_ADMIN。 */
@Validated
@RestController
@RequestMapping("/api/v1/learning/visual-programming/admin")
public class VisualProgrammingMissionAdminController {
    private final VisualProgrammingMissionService service;

    public VisualProgrammingMissionAdminController(VisualProgrammingMissionService service) {
        this.service = service;
    }

    @GetMapping("/templates")
    public ApiResponse<List<VisualProgrammingMissionTemplateResponse>> templates() {
        return ApiResponse.ok(service.listTemplates());
    }

    @GetMapping("/missions")
    public ApiResponse<List<VisualProgrammingMissionResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String templateCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String stageCode) {
        return ApiResponse.ok(service.listAdmin(status, templateCode, keyword, stageCode));
    }

    @GetMapping("/missions/{id}")
    public ApiResponse<VisualProgrammingMissionResponse> get(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.getAdmin(id));
    }

    @PostMapping("/missions")
    public ApiResponse<VisualProgrammingMissionResponse> create(
            @Valid @RequestBody VisualProgrammingMissionCreateRequest request) {
        return ApiResponse.ok(service.create(request));
    }

    @PutMapping("/missions/{id}")
    public ApiResponse<VisualProgrammingMissionResponse> update(
            @PathVariable("id") @Positive long id,
            @Valid @RequestBody VisualProgrammingMissionUpdateRequest request) {
        return ApiResponse.ok(service.update(id, request));
    }

    @PostMapping("/missions/{id}/duplicate")
    public ApiResponse<VisualProgrammingMissionResponse> duplicate(
            @PathVariable("id") @Positive long id,
            @Valid @RequestBody VisualProgrammingMissionDuplicateRequest request) {
        return ApiResponse.ok(service.duplicate(id, request));
    }

    @PostMapping("/missions/{id}/publish")
    public ApiResponse<VisualProgrammingMissionResponse> publish(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.publish(id));
    }

    @PostMapping("/missions/{id}/offline")
    public ApiResponse<VisualProgrammingMissionResponse> offline(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.offline(id));
    }

    @PutMapping("/missions/order")
    public ApiResponse<Void> reorder(@Valid @RequestBody VisualProgrammingMissionOrderRequest request) {
        service.reorder(request);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/missions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") @Positive long id) {
        service.delete(id);
    }
}
