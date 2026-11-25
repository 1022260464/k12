package com.k12.platform.agent.client.dto;

/** Python Runtime 语音识别返回的转写结果。 */
public record RuntimeSpeechRecognitionResponse(String text, String model) {
}
