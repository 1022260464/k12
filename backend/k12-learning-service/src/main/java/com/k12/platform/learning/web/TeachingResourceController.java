package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.TeachingResourceMetadata;
import com.k12.platform.learning.dto.TeachingResourcePage;
import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.dto.TeachingResourceReview;
import com.k12.platform.learning.service.TeachingResourceService;
import com.k12.platform.learning.service.TeachingResourceIndexService;
import com.k12.platform.learning.model.TeachingResourceEvent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/teaching-resources")
public class TeachingResourceController {
    private final TeachingResourceService service;
    private final TeachingResourceIndexService indexService;

    public TeachingResourceController(TeachingResourceService service, TeachingResourceIndexService indexService) {
        this.service = service;
        this.indexService = indexService;
    }

    @GetMapping
    public ApiResponse<TeachingResourcePage> search(@RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "20") int size,
                                                     @RequestParam(required = false) String status,
                                                     @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(service.search(page, size, status, keyword));
    }

    @GetMapping("/published")
    public ApiResponse<TeachingResourcePage> published(@RequestParam(defaultValue = "1") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(service.published(page, size));
    }

    @GetMapping("/published/{id}")
    public ApiResponse<TeachingResourceResponse> publishedDetail(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.getPublished(id));
    }

    @GetMapping("/published/{id}/download-url")
    public ApiResponse<Map<String, String>> publishedDownload(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(Map.of("url", service.publishedDownload(id)));
    }

    @GetMapping("/{id}")
    public ApiResponse<TeachingResourceResponse> get(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.get(id));
    }

    @GetMapping("/{id}/download-url")
    public ApiResponse<Map<String, String>> download(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(Map.of("url", service.download(id)));
    }

    @GetMapping("/{id}/events")
    public ApiResponse<List<TeachingResourceEvent>> history(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.history(id));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TeachingResourceResponse>> upload(
            @Valid @RequestPart("metadata") TeachingResourceMetadata metadata,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.upload(metadata, file)));
    }

    @PutMapping("/{id}")
    public ApiResponse<TeachingResourceResponse> update(@PathVariable("id") @Positive long id,
                                                         @Valid @RequestBody TeachingResourceMetadata metadata) {
        return ApiResponse.ok(service.update(id, metadata));
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<TeachingResourceResponse> submit(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.submit(id));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<TeachingResourceResponse> approve(@PathVariable("id") @Positive long id,
                                                          @Valid @RequestBody TeachingResourceReview request) {
        return ApiResponse.ok(service.review(id, true, request.note()));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<TeachingResourceResponse> reject(@PathVariable("id") @Positive long id,
                                                         @Valid @RequestBody TeachingResourceReview request) {
        return ApiResponse.ok(service.review(id, false, request.note()));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<TeachingResourceResponse> publish(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.publish(id));
    }

    @PostMapping("/{id}/withdraw")
    public ApiResponse<TeachingResourceResponse> withdraw(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(indexService.withdraw(id));
    }

    @PostMapping("/{id}/index")
    public ResponseEntity<ApiResponse<TeachingResourceResponse>> index(@PathVariable("id") @Positive long id) {
        return ResponseEntity.accepted().body(ApiResponse.ok(indexService.index(id)));
    }

    @PostMapping("/{id}/sync-graph")
    public ApiResponse<TeachingResourceResponse> syncGraph(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(indexService.syncGraph(id));
    }

    @PostMapping("/{id}/reopen")
    public ApiResponse<TeachingResourceResponse> reopen(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.reopen(id));
    }
}
