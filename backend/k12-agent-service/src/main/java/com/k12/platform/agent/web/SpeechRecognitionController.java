package com.k12.platform.agent.web;

import com.k12.platform.agent.service.SpeechRecognitionService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Base64;

@Validated
@RestController
@RequestMapping("/api/v1/agents/speech")
public class SpeechRecognitionController {
    private final SpeechRecognitionService service;

    public SpeechRecognitionController(SpeechRecognitionService service) {
        this.service = service;
    }

    @PostMapping("/recognize")
    public ApiResponse<TranscriptionResponse> recognize(@Valid @RequestBody RecognitionRequest request) {
        SpeechRecognitionService.Transcript transcript = service.recognize(decode(request.audioBase64()));
        return ApiResponse.ok(new TranscriptionResponse(transcript.text(), transcript.model()));
    }

    private byte[] decode(String rawBase64) {
        String payload = rawBase64.trim();
        // 兼容浏览器直接上传 data URL 的情况。
        if (payload.startsWith("data:")) {
            int separator = payload.indexOf(',');
            if (separator >= 0) {
                payload = payload.substring(separator + 1);
            }
        }
        try {
            return Base64.getMimeDecoder().decode(payload);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("录音数据格式不正确");
        }
    }

    public record RecognitionRequest(
            @NotBlank @Size(max = 7_000_000) String audioBase64,
            @Size(max = 100) String contentType) {
    }

    public record TranscriptionResponse(String text, String model) {
    }
}
