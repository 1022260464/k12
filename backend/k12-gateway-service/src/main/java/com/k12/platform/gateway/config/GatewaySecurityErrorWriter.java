package com.k12.platform.gateway.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/* WebFlux 安全异常统一转换成 ApiResponse JSON。 */
public final class GatewaySecurityErrorWriter {

    private GatewaySecurityErrorWriter() {
    }

    public static Mono<Void> write(
            ServerWebExchange exchange,
            ObjectMapper objectMapper,
            HttpStatus status,
            String message
    ) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(ApiResponse.fail(status.value(), message));
            DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
            return exchange.getResponse().writeWith(Mono.just(buffer));
        } catch (JsonProcessingException exception) {
            return exchange.getResponse().setComplete();
        }
    }
}
