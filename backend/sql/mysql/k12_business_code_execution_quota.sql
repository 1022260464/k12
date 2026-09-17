-- 在 k12_business 上执行；重复执行不会清空已有用量。
CREATE TABLE IF NOT EXISTS k12_business.code_execution_quota (
    user_id BIGINT UNSIGNED NOT NULL COMMENT '对应 k12_auth.sys_user.id',
    quota_date DATE NOT NULL COMMENT 'Asia/Shanghai 自然日',
    used_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当天已受理的代码执行次数',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, quota_date)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户代码执行日配额';
