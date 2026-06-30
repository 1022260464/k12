package com.k12.platform.agent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12AgentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12AgentServiceApplication.class, args);
    }
}
