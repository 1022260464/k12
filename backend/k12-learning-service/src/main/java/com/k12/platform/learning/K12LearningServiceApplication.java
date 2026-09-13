package com.k12.platform.learning;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@EnableFeignClients(basePackages = "com.k12.platform")
@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12LearningServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12LearningServiceApplication.class, args);
    }
}
