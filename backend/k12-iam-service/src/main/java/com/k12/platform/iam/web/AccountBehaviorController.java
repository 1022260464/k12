package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.AccountBehaviorResponse;
import com.k12.platform.iam.service.AccountBehaviorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/users/me/behavior")
public class AccountBehaviorController {

    private final AccountBehaviorService accountBehaviorService;

    public AccountBehaviorController(AccountBehaviorService accountBehaviorService) {
        this.accountBehaviorService = accountBehaviorService;
    }

    @GetMapping
    public ApiResponse<AccountBehaviorResponse> getCurrentBehavior() {
        return ApiResponse.ok(accountBehaviorService.getCurrentBehavior());
    }

    @PostMapping("/off-topic")
    public ApiResponse<AccountBehaviorResponse> recordOffTopicStrike() {
        return ApiResponse.ok(accountBehaviorService.recordOffTopicStrike());
    }
}
