package com.k12.platform.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** 业务服务使用的远程 JWT 状态校验器。 */
public class K12RemoteTokenStateValidator implements K12TokenStateValidator {

    private final RestClient restClient;
    private final String endpoint;

    public K12RemoteTokenStateValidator(K12TokenStateProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.getConnectTimeoutMillis());
        requestFactory.setReadTimeout(properties.getReadTimeoutMillis());
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
        this.endpoint = properties.getEndpoint();
    }

    @Override
    public ValidationResult validate(Jwt jwt, HttpServletRequest request) {
        try {
            restClient.get()
                    .uri(endpoint)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.getTokenValue())
                    .retrieve()
                    .toBodilessEntity();
            return ValidationResult.VALID;
        } catch (HttpClientErrorException exception) {
            if (exception.getStatusCode() == HttpStatus.UNAUTHORIZED
                    || exception.getStatusCode() == HttpStatus.FORBIDDEN) {
                return ValidationResult.INVALID;
            }
            return ValidationResult.UNAVAILABLE;
        } catch (RestClientException exception) {
            return ValidationResult.UNAVAILABLE;
        }
    }
}
