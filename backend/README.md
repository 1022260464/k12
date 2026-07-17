# K12 Platform Backend

K12 多智能体教学平台后端初始化为 Maven 多模块工程。当前拆分以业务边界为主，先保持轻量 Spring Boot 服务形态，便于后续接入注册中心、配置中心、网关路由、数据库和消息队列。

## Modules

| Module | Port | Responsibility |
| --- | ---: | --- |
| `k12-common` | - | 公共响应模型、共享契约和轻量工具。 |
| `k12-gateway-service` | 8080 | 平台统一入口、路由聚合、跨服务访问控制预留。 |
| `k12-iam-service` | 8081 | 学生、教师、家长、管理员等账号身份与权限域。 |
| `k12-learning-service` | 8082 | 课程、班级、知识点、学习任务等核心教学资源域。 |
| `k12-agent-service` | 8083 | 多智能体教学编排、对话上下文、工具调用和教学策略域。 |
| `k12-assessment-service` | 8084 | 作业、测验、诊断报告、学习效果评价和错题归因域。 |

## Microservice dependencies

父工程 `pom.xml` 统一管理 Spring Boot、Spring Cloud、Spring Cloud Alibaba 版本：

| Dependency BOM | Version |
| --- | --- |
| `spring-boot-dependencies` | `3.3.5` |
| `spring-cloud-dependencies` | `2023.0.3` |
| `spring-cloud-alibaba-dependencies` | `2023.0.3.4` |

各业务服务已接入 Spring Cloud Alibaba Nacos Discovery / Config，默认通过环境变量关闭，避免本地未启动 Nacos 时影响服务启动。

```bash
# 启用 Nacos 注册发现和配置中心
set NACOS_DISCOVERY_ENABLED=true
set NACOS_CONFIG_ENABLED=true
set NACOS_SERVER_ADDR=127.0.0.1:8848
```

服务间调用预留 Spring Cloud OpenFeign，负载均衡使用 Spring Cloud LoadBalancer。网关模块使用 Spring Cloud Gateway 作为后续统一入口基础。

## Security

后端已统一接入 Spring Security。通用依赖放在父工程 `backend/pom.xml`，Servlet 服务的默认安全配置放在 `k12-common` 并通过 Spring Boot AutoConfiguration 自动生效；`k12-gateway-service` 使用 Spring Cloud Gateway，对应 WebFlux Security 配置保留在网关模块内。

默认规则：

- 放行健康检查与基础信息接口：`/actuator/health`、`/actuator/info`、各业务服务 `/api/v1/*/health`。
- 其他接口默认需要 HTTP Basic 认证。
- 默认开发账号为 `admin` / `admin123`，可通过配置覆盖。

```yaml
k12:
  security:
    user:
      name: admin
      password: admin123
      roles:
        - ADMIN
    permit-paths:
      - /actuator/health
      - /actuator/info
      - /api/v1/gateway/health
      - /api/v1/iam/health
      - /api/v1/learning/health
      - /api/v1/agents/health
      - /api/v1/assessments/health
```

## IAM database

IAM 权限库使用独立 MySQL 数据库 `k12_auth`，不要和 Nacos 的 `nacos_config` 混用。初始化脚本位于：

```text
backend/sql/mysql/k12_auth_init.sql
```

默认连接配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://${K12_AUTH_DB_HOST:127.0.0.1}:${K12_AUTH_DB_PORT:3306}/${K12_AUTH_DB_NAME:k12_auth}
    username: ${K12_AUTH_DB_USERNAME:k12}
    password: ${K12_AUTH_DB_PASSWORD:K12@123456}
```

执行脚本需要使用有建库和授权权限的 MySQL 账号，例如 root：

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p < backend/sql/mysql/k12_auth_init.sql
```

`k12-iam-service` 已定义数据库版 `UserDetailsService`，登录时会读取 `sys_user.password_hash` 和用户绑定的 `sys_role.role_code`。可用受保护接口验证：

```bash
curl -u admin:admin123 http://localhost:8081/api/v1/iam/me
```

## Common commands

```bash
mvn clean package
mvn -pl k12-agent-service -am spring-boot:run
```

## Health endpoints

```text
GET http://localhost:8080/api/v1/gateway/health
GET http://localhost:8081/api/v1/iam/health
GET http://localhost:8082/api/v1/learning/health
GET http://localhost:8083/api/v1/agents/health
GET http://localhost:8084/api/v1/assessments/health
```
