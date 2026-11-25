package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeSpeechRecognitionResponse;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import feign.FeignException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 学生端语音识别代理。
 *
 * 低年级学生说不方便打字的话；音频只在家长/学生主动录音时上传，这里限制大小避免误触产生不受控的付费调用。
 */
@Service
public class SpeechRecognitionService {
    static final int MAX_AUDIO_BYTES = 5 * 1024 * 1024;

    private static final Pattern MESSAGE_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");

    private final AgentRuntimeClient runtimeClient;

    public SpeechRecognitionService(AgentRuntimeClient runtimeClient) {
        this.runtimeClient = runtimeClient;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public Transcript recognize(byte[] audio) {
        if (audio == null || audio.length == 0) {
            throw new IllegalArgumentException("没有收到录音，请再试一次");
        }
        if (audio.length > MAX_AUDIO_BYTES) {
            throw new IllegalArgumentException("单次录音不能超过 5MB");
        }
        ApiResponse<RuntimeSpeechRecognitionResponse> response;
        try {
            response = runtimeClient.recognizeSpeech(audio);
        } catch (FeignException.ServiceUnavailable exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "语音识别尚未启用");
        } catch (FeignException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, upstreamMessage(exception));
        }
        RuntimeSpeechRecognitionResponse data = response == null ? null : response.data();
        if (response == null || response.code() != 200 || data == null
                || data.text() == null || data.text().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "语音识别没有听清，请再试一次");
        }
        return new Transcript(data.text().trim(), data.model());
    }

    /** Runtime 4xx 会带可读的失败原因（如音频格式不支持），透传给学生端。 */
    private String upstreamMessage(FeignException exception) {
        if (exception.status() == 422) {
            Matcher matcher = MESSAGE_PATTERN.matcher(exception.contentUTF8());
            if (matcher.find()) {
                return matcher.group(1);
            }
        }
        return "语音识别服务暂时不可用";
    }

    public record Transcript(String text, String model) {
    }
}
