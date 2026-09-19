package com.k12.platform.iam.service;

import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.iam.config.IamBehaviorProperties;
import com.k12.platform.iam.dto.AccountBehaviorResponse;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.SysUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;

/**
 * 教学助手无关提问的账号级惩戒：
 * 无关满 N 次 → 异常行为 +1，临时封禁；
 * 异常满 M 次 → 永久封禁（status=LOCKED）。
 */
@Service
public class AccountBehaviorService {

    private final UserMapper userMapper;
    private final OperationAuditService operationAuditService;
    private final IamBehaviorProperties properties;

    public AccountBehaviorService(
            UserMapper userMapper,
            OperationAuditService operationAuditService,
            IamBehaviorProperties properties
    ) {
        this.userMapper = userMapper;
        this.operationAuditService = operationAuditService;
        this.properties = properties;
    }

    public AccountBehaviorResponse getCurrentBehavior() {
        Long userId = K12SecurityContext.requireUserId();
        SysUser user = requireUser(userId);
        return toResponse(user, null);
    }

    @Transactional
    public AccountBehaviorResponse recordOffTopicStrike() {
        Long userId = K12SecurityContext.requireUserId();
        SysUser user = userMapper.findSecurityUserForUpdate(userId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        if (isPermanentlyBanned(user)) {
            return toResponse(user, "账号因异常行为过多已被封禁，请联系管理员。");
        }
        if (isTemporarilyLocked(user)) {
            return toResponse(user, tempLockMessage(user.getLockedUntil()));
        }

        int offTopicLimit = Math.max(1, properties.getOffTopicLimit());
        int abnormalLimit = Math.max(1, properties.getAbnormalBehaviorLimit());
        Duration banDuration = properties.getTempBanDuration() == null || properties.getTempBanDuration().isNegative()
                || properties.getTempBanDuration().isZero()
                ? Duration.ofHours(2)
                : properties.getTempBanDuration();

        int strikes = defaultZero(user.getOffTopicStrikeCount()) + 1;
        user.setOffTopicStrikeCount(strikes);
        String message;

        if (strikes >= offTopicLimit) {
            int abnormal = defaultZero(user.getAbnormalBehaviorCount()) + 1;
            user.setAbnormalBehaviorCount(abnormal);
            user.setOffTopicStrikeCount(0);
            user.setAuthVersion(nextAuthVersion(user.getAuthVersion()));

            if (abnormal >= abnormalLimit) {
                user.setStatus(2);
                user.setLockedUntil(null);
                message = "**账号异常行为已达 " + abnormalLimit
                        + " 次，账号已被永久封禁。**请联系管理员处理。";
                operationAuditService.record("ACCOUNT_PERMANENT_BAN", "USER", userId,
                        "abnormalBehaviorCount=" + abnormal);
            } else {
                Instant until = Instant.now().plus(banDuration);
                user.setLockedUntil(until);
                message = "**无关提问已达 " + offTopicLimit + "/" + offTopicLimit
                        + "。**账号异常行为 +1（当前 "
                        + abnormal + "/" + abnormalLimit
                        + "），**已临时封禁 " + formatDuration(banDuration)
                        + "。**\n\n"
                        + "解封后请围绕课程提问，例如：「什么是提示词？」「推荐提示词相关课程」。";
                operationAuditService.record("ACCOUNT_TEMP_BAN", "USER", userId,
                        "abnormalBehaviorCount=" + abnormal + ",lockedUntil=" + until);
            }
        } else {
            int remaining = Math.max(offTopicLimit - strikes, 1);
            message = "这个问题看起来与当前学习关系不大，我先不按闲聊作答。"
                    + "**（无关提问 " + strikes + "/" + offTopicLimit + "）**\n\n"
                    + "我是 AI 素养学习助手，更适合回答课程相关问题。你可以试试：\n"
                    + "- 「什么是提示词？」\n"
                    + "- 「为什么大模型会出现幻觉？」\n"
                    + "- 「推荐提示词相关课程」\n"
                    + "- 「冒泡排序是怎么比较的？」\n\n"
                    + "**再发送 " + remaining + " 次无关内容，账号将被临时封禁；"
                    + "反复违规累计异常行为达到上限后可能永久封禁。新开会话也不会清零计数。**";
            operationAuditService.record("OFF_TOPIC_STRIKE", "USER", userId,
                    "offTopicStrikeCount=" + strikes);
        }

        user.setUpdatedTime(Instant.now());
        userMapper.updateById(user);
        return toResponse(user, message);
    }

    private AccountBehaviorResponse toResponse(SysUser user, String message) {
        boolean permanent = isPermanentlyBanned(user);
        boolean temporary = !permanent && isTemporarilyLocked(user);
        String resolved = message;
        if (resolved == null) {
            if (permanent) {
                resolved = "账号因异常行为过多已被封禁，请联系管理员。";
            } else if (temporary) {
                resolved = tempLockMessage(user.getLockedUntil());
            } else {
                resolved = "";
            }
        }
        return new AccountBehaviorResponse(
                defaultZero(user.getOffTopicStrikeCount()),
                Math.max(1, properties.getOffTopicLimit()),
                defaultZero(user.getAbnormalBehaviorCount()),
                Math.max(1, properties.getAbnormalBehaviorLimit()),
                user.getLockedUntil(),
                temporary,
                permanent,
                resolved
        );
    }

    private SysUser requireUser(Long userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || (user.getDeleted() != null && user.getDeleted() == 1)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private boolean isPermanentlyBanned(SysUser user) {
        return user.getStatus() != null && user.getStatus() == 2;
    }

    private boolean isTemporarilyLocked(SysUser user) {
        return user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now());
    }

    private String tempLockMessage(Instant lockedUntil) {
        return "账号因多次无关提问已被临时封禁至 "
                + (lockedUntil == null ? "稍后" : lockedUntil.toString())
                + "。新开会话无效，请到期后再登录学习。";
    }

    private String formatDuration(Duration duration) {
        long seconds = duration.getSeconds();
        if (seconds % 3600 == 0 && seconds >= 3600) {
            return (seconds / 3600) + " 小时";
        }
        if (seconds % 60 == 0 && seconds >= 60) {
            return (seconds / 60) + " 分钟";
        }
        return seconds + " 秒";
    }

    private int defaultZero(Integer value) {
        return value == null ? 0 : value;
    }

    private long nextAuthVersion(Long current) {
        return current == null || current < 1 ? 2L : current + 1L;
    }
}
