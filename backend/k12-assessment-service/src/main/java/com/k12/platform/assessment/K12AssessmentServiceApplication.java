package com.k12.platform.assessment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12AssessmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12AssessmentServiceApplication.class, args);
    }
}
