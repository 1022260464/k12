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
