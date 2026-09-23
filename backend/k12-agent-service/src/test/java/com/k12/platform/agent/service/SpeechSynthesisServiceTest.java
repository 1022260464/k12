package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeSpeechRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SpeechSynthesisServiceTest {
    @Mock private AgentRuntimeClient runtimeClient;

    @Test
    void normalizesTextAndAcceptsBoundedAudio() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.valueOf("audio/mpeg"));
        headers.set("X-Speech-Model", "cosyvoice");
        when(runtimeClient.synthesizeSpeech(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new ResponseEntity<>(new byte[]{1, 2, 3}, headers, HttpStatus.OK));
        SpeechSynthesisService service = new SpeechSynthesisService(runtimeClient);

        var result = service.synthesize("  你好\n 小智  ");

        ArgumentCaptor<RuntimeSpeechRequest> request = ArgumentCaptor.forClass(RuntimeSpeechRequest.class);
        verify(runtimeClient).synthesizeSpeech(request.capture());
        assertThat(request.getValue().text()).isEqualTo("你好 小智");
        assertThat(result.model()).isEqualTo("cosyvoice");
        assertThat(result.content()).containsExactly(1, 2, 3);
    }

    @Test
    void rejectsBlankTextAndNonAudioResponse() {
        SpeechSynthesisService service = new SpeechSynthesisService(runtimeClient);
        assertThatThrownBy(() -> service.synthesize("  ")).isInstanceOf(IllegalArgumentException.class);

        when(runtimeClient.synthesizeSpeech(org.mockito.ArgumentMatchers.any()))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(new byte[]{1}));
        assertThatThrownBy(() -> service.synthesize("你好"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
