package com.k12.platform.common.security;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
@EnableConfigurationProperties(K12SecurityProperties.class)
public class K12ServletSecurityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, K12SecurityProperties properties) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .formLogin(formLogin -> formLogin.disable())
                .httpBasic(Customizer.withDefaults())
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(properties.getPermitPaths().toArray(String[]::new)).permitAll()
                        .anyRequest().authenticated()
                )
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public UserDetailsService userDetailsService(K12SecurityProperties properties, PasswordEncoder passwordEncoder) {
        K12SecurityProperties.User securityUser = properties.getUser();
        return new InMemoryUserDetailsManager(User.withUsername(securityUser.getName())
                .password(passwordEncoder.encode(securityUser.getPassword()))
                .roles(securityUser.getRoles().toArray(String[]::new))
                .build());
    }

    @Bean
    @ConditionalOnMissingBean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
