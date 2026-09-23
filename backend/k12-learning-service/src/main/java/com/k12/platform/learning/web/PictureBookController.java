package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.PictureBookResponse;
import com.k12.platform.learning.service.PictureBookService;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/picture-books")
public class PictureBookController {
    private final PictureBookService service;

    public PictureBookController(PictureBookService service) {
        this.service = service;
    }

    @GetMapping("/published")
    public ApiResponse<List<PictureBookResponse>> list() {
        return ApiResponse.ok(service.listPublished());
    }

    @GetMapping("/published/{bookCode}")
    public ApiResponse<PictureBookResponse> get(
            @PathVariable("bookCode") @Pattern(regexp = "[a-z0-9-]{1,64}") String bookCode) {
        return ApiResponse.ok(service.getPublished(bookCode));
    }
}
