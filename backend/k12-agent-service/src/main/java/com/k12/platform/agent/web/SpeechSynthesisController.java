package com.k12.platform.agent.web;

import com.k12.platform.agent.service.SpeechSynthesisService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/agents/speech")
public class SpeechSynthesisController {
    private final SpeechSynthesisService service;

    public SpeechSynthesisController(SpeechSynthesisService service) {
        this.service = service;
    }

    @PostMapping("/synthesize")
    public ResponseEntity<byte[]> synthesize(@Valid @RequestBody SpeechRequest request) {
        SpeechSynthesisService.SpeechAudio audio = service.synthesize(request.text());
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .contentType(audio.contentType())
                .contentLength(audio.content().length)
                .cacheControl(CacheControl.noStore());
        if (audio.model() != null) response.header("X-Speech-Model", audio.model());
        if (audio.voice() != null) response.header("X-Speech-Voice", audio.voice());
        response.header(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION);
        return response.body(audio.content());
    }

    public record SpeechRequest(@NotBlank @Size(max = 1_000) String text) {
    }
}
