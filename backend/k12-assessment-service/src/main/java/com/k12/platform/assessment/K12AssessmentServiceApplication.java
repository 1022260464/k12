package com.k12.platform.assessment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

@EnableDiscoveryClient
@EnableFeignClients(basePackages = "com.k12.platform")
@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12AssessmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12AssessmentServiceApplication.class, args);
    }
}
