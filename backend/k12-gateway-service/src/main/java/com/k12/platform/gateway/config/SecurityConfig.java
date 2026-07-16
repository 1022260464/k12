package com.k12.platform.gateway.config;

import com.k12.platform.common.security.K12SecurityProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.userdetails.MapReactiveUserDetailsService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
@EnableConfigurationProperties(K12SecurityProperties.class)
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, K12SecurityProperties properties) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .httpBasic(Customizer.withDefaults())
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers(properties.getPermitPaths().toArray(String[]::new)).permitAll()
                        .anyExchange().authenticated()
                )
                .build();
    }

    @Bean
    public MapReactiveUserDetailsService userDetailsService(
            K12SecurityProperties properties,
            PasswordEncoder passwordEncoder
    ) {
        K12SecurityProperties.User securityUser = properties.getUser();
        return new MapReactiveUserDetailsService(User.withUsername(securityUser.getName())
                .password(passwordEncoder.encode(securityUser.getPassword()))
                .roles(securityUser.getRoles().toArray(String[]::new))
                .build());
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
