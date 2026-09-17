package com.k12.platform.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12GatewayServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12GatewayServiceApplication.class, args);
    }
}
