package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.PictureBookCreateRequest;
import com.k12.platform.learning.dto.PictureBookResponse;
import com.k12.platform.learning.dto.PictureBookReviewRequest;
import com.k12.platform.learning.dto.PictureBookUpdateRequest;
import com.k12.platform.learning.service.PictureBookService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/picture-books/admin")
public class PictureBookAdminController {
    private final PictureBookService service;

    public PictureBookAdminController(PictureBookService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PictureBookResponse>> list() { return ApiResponse.ok(service.listAdmin()); }

    @GetMapping("/{id}")
    public ApiResponse<PictureBookResponse> get(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.getAdmin(id));
    }

    @PostMapping
    public ApiResponse<PictureBookResponse> create(@Valid @RequestBody PictureBookCreateRequest request) {
        return ApiResponse.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<PictureBookResponse> update(@PathVariable("id") @Positive long id,
                                                   @Valid @RequestBody PictureBookUpdateRequest request) {
        return ApiResponse.ok(service.update(id, request));
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<PictureBookResponse> submit(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.submit(id));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<PictureBookResponse> approve(@PathVariable("id") @Positive long id,
                                                    @Valid @RequestBody PictureBookReviewRequest request) {
        return ApiResponse.ok(service.approve(id, request.note()));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<PictureBookResponse> reject(@PathVariable("id") @Positive long id,
                                                   @Valid @RequestBody PictureBookReviewRequest request) {
        return ApiResponse.ok(service.reject(id, request.note()));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<PictureBookResponse> publish(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.publish(id));
    }

    @PostMapping("/{id}/offline")
    public ApiResponse<PictureBookResponse> offline(@PathVariable("id") @Positive long id) {
        return ApiResponse.ok(service.offline(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") @Positive long id) { service.delete(id); }
}
