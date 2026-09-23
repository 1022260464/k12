package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeSpeechRequest;
import com.k12.platform.common.security.K12Authorities;
import feign.FeignException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 学生端云语音代理。
 *
 * 语音只在学生明确点击朗读时生成；这里限制文本和音频大小，避免误触导致不受控的付费调用。
 */
@Service
public class SpeechSynthesisService {
    static final int MAX_TEXT_CHARS = 1_000;
    static final int MAX_AUDIO_BYTES = 5 * 1024 * 1024;

    private final AgentRuntimeClient runtimeClient;

    public SpeechSynthesisService(AgentRuntimeClient runtimeClient) {
        this.runtimeClient = runtimeClient;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public SpeechAudio synthesize(String rawText) {
        String text = normalize(rawText);
        ResponseEntity<byte[]> response;
        try {
            response = runtimeClient.synthesizeSpeech(new RuntimeSpeechRequest(text));
        } catch (FeignException.ServiceUnavailable exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "云语音尚未启用");
        } catch (FeignException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云语音服务暂时不可用");
        }
        byte[] content = response == null ? null : response.getBody();
        MediaType contentType = response == null ? null : response.getHeaders().getContentType();
        if (response == null || !response.getStatusCode().is2xxSuccessful()
                || content == null || content.length == 0 || content.length > MAX_AUDIO_BYTES
                || contentType == null || !"audio".equalsIgnoreCase(contentType.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "云语音返回了无效音频");
        }
        return new SpeechAudio(content, contentType, first(response.getHeaders(), "X-Speech-Model"),
                first(response.getHeaders(), "X-Speech-Voice"));
    }

    private String normalize(String rawText) {
        if (rawText == null) {
            throw new IllegalArgumentException("朗读文字不能为空");
        }
        String text = rawText.replaceAll("\\s+", " ").trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("朗读文字不能为空");
        }
        if (text.length() > MAX_TEXT_CHARS) {
            throw new IllegalArgumentException("单次朗读文字不能超过 " + MAX_TEXT_CHARS + " 个字符");
        }
        return text;
    }

    private String first(HttpHeaders headers, String name) {
        List<String> values = headers.get(name);
        return values == null || values.isEmpty() ? null : values.get(0);
    }

    public record SpeechAudio(byte[] content, MediaType contentType, String model, String voice) {
    }
}
