package com.k12.platform.agent.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.model.AgentCourseware;
import com.k12.platform.agent.service.CoursewareService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/agents/courseware")
public class CoursewareController {
    private final CoursewareService service;
    private final ObjectMapper objectMapper;

    public CoursewareController(CoursewareService service, ObjectMapper objectMapper) {
        this.service = service;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<CoursewareView>> generate(@Valid @RequestBody GenerateRequest request) {
        AgentCourseware entity = service.generate(
                request.topic(), request.stage(), request.slideCount(), request.topicCode());
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/agents/courseware/{id}")
                .buildAndExpand(entity.getCoursewareId())
                .toUri();
        return ResponseEntity.created(location).body(ApiResponse.ok(toDetailed(entity)));
    }

    @PostMapping("/{coursewareId}/publish")
    public ApiResponse<CoursewareView> publish(@PathVariable String coursewareId) {
        return ApiResponse.ok(toDetailed(service.publish(coursewareId, true)));
    }

    @PostMapping("/{coursewareId}/unpublish")
    public ApiResponse<CoursewareView> unpublish(@PathVariable String coursewareId) {
        return ApiResponse.ok(toDetailed(service.publish(coursewareId, false)));
    }

    @GetMapping
    public ApiResponse<List<CoursewareView>> listAll() {
        return ApiResponse.ok(service.listAll().stream().map(this::toDetailed).toList());
    }

    @GetMapping("/published")
    public ApiResponse<List<CoursewareView>> listPublished() {
        return ApiResponse.ok(service.listPublished().stream().map(this::toSummary).toList());
    }

    @GetMapping("/published/{coursewareId}")
    public ApiResponse<CoursewareView> getPublished(@PathVariable String coursewareId) {
        return ApiResponse.ok(toDetailed(service.getPublished(coursewareId)));
    }

    /** 学生端列表不带正文，避免一次性下发全部课件内容。 */
    private CoursewareView toSummary(AgentCourseware entity) {
        return new CoursewareView(entity.getCoursewareId(), entity.getTitle(), entity.getStage(),
                entity.getTopicCode(), entity.getSlideCount(), entity.getStatus(), null,
                entity.getPublishTime(), entity.getCreatedTime(), null);
    }

    private CoursewareView toDetailed(AgentCourseware entity) {
        return new CoursewareView(entity.getCoursewareId(), entity.getTitle(), entity.getStage(),
                entity.getTopicCode(), entity.getSlideCount(), entity.getStatus(), entity.getCreatedBy(),
                entity.getPublishTime(), entity.getCreatedTime(), parse(entity));
    }

    private JsonNode parse(AgentCourseware entity) {
        try {
            return objectMapper.readTree(entity.getDocumentJson());
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "课件数据已损坏");
        }
    }

    public record GenerateRequest(
            @NotBlank @Size(max = 200) String topic,
            @Size(max = 32) String stage,
            @Min(4) @Max(10) Integer slideCount,
            @Size(max = 120) String topicCode) {
    }

    public record CoursewareView(
            String coursewareId,
            String title,
            String stage,
            String topicCode,
            Integer slideCount,
            String status,
            String createdBy,
            Instant publishTime,
            Instant createdTime,
            JsonNode document) {
    }
}
