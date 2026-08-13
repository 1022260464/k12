package com.k12.platform.common.security;

/*
 * 平台功能权限常量。
 *
 * Java 注解要求使用编译期常量，因此这里统一维护权限码，避免各模块手写字符串。
 * SQL 中 sys_permission.permission_code 必须与这些值一致。
 */
public final class K12Authorities {

    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    public static final String USER_READ = "user:read";
    public static final String USER_CREATE = "user:create";
    public static final String USER_UPDATE = "user:update";
    public static final String USER_DELETE = "user:delete";

    public static final String ROLE_READ = "role:read";
    public static final String ROLE_UPDATE = "role:update";

    public static final String COURSE_READ = "course:read";
    public static final String COURSE_CREATE = "course:create";
    public static final String COURSE_UPDATE = "course:update";
    public static final String COURSE_DELETE = "course:delete";

    public static final String AGENT_READ = "agent:read";
    public static final String AGENT_CREATE = "agent:create";
    public static final String AGENT_UPDATE = "agent:update";
    public static final String AGENT_DELETE = "agent:delete";

    public static final String HOMEWORK_READ = "homework:read";
    public static final String HOMEWORK_CREATE = "homework:create";
    public static final String HOMEWORK_UPDATE = "homework:update";
    public static final String HOMEWORK_DELETE = "homework:delete";

    private K12Authorities() {
    }
}
