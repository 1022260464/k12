package com.k12.platform.agent.web;

import com.k12.platform.agent.service.SpeechSynthesisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SpeechSynthesisControllerTest {
    @Mock private SpeechSynthesisService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SpeechSynthesisController(service))
                .setControllerAdvice(new AgentExceptionHandler())
                .build();
    }

    @Test
    void returnsAudioWithoutExposingRuntimeCredentials() throws Exception {
        when(service.synthesize("你好，小智")).thenReturn(new SpeechSynthesisService.SpeechAudio(
                new byte[]{1, 2, 3}, MediaType.valueOf("audio/mpeg"), "cosyvoice", "longanyang"));

        mockMvc.perform(post("/api/v1/agents/speech/synthesize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"你好，小智\"}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("audio/mpeg"))
                .andExpect(content().bytes(new byte[]{1, 2, 3}))
                .andExpect(header().string("X-Speech-Model", "cosyvoice"))
                .andExpect(header().doesNotExist("X-Internal-Api-Key"));
    }

    @Test
    void rejectsBlankTextBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/v1/agents/speech/synthesize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }
}
