package com.k12.platform.iam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.k12.platform")
public class K12IamServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(K12IamServiceApplication.class, args);
    }
}
