# K12 多智能体教学平台

K12 多智能体教学平台是面向基础教育场景的教学辅助系统。当前仓库包含前端应用和后端微服务骨架，后端已按业务边界做了第一版 Maven 多模块拆分，便于后续接入用户体系、课程资源、智能体编排、测评诊断、网关路由等能力。

## 项目结构

```text
k12/
├── backend/                 # 后端 Maven 多模块工程
│   ├── k12-common/          # 公共响应模型、共享契约和工具
│   ├── k12-gateway-service/ # 统一入口、路由聚合、访问控制预留
│   ├── k12-iam-service/     # 用户、角色、学校租户和权限域
│   ├── k12-learning-service/# 课程、班级、知识点、学习任务域
│   ├── k12-agent-service/   # 多智能体编排、对话上下文、工具调用域
│   └── k12-assessment-service/ # 作业、测评、诊断和学习评价域
└── qianduan/                # 前端 Vite + React 应用
```

## 技术栈

- Frontend: React 19, Vite 6, lucide-react
- Backend: Java 17, Spring Boot 3, Maven 多模块
- Architecture: 前后端分离，后端按微服务边界进行模块化初始化

## 本地启动

### 前端

```bash
cd qianduan
npm install
npm run dev
```

前端开发服务器默认通过 Vite 启动，脚本中绑定 `127.0.0.1`。

### 后端

```bash
cd backend
mvn clean package
mvn -pl k12-agent-service -am spring-boot:run
```

> 当前机器需要先安装 Maven，或后续补充 Maven Wrapper 后使用 `./mvnw` / `mvnw.cmd`。

## 后端服务划分

| Module | Port | Responsibility |
| --- | ---: | --- |
| `k12-common` | - | 公共响应模型、共享契约和轻量工具。 |
| `k12-gateway-service` | 8080 | 平台统一入口、路由聚合、跨服务访问控制预留。 |
| `k12-iam-service` | 8081 | 学生、教师、家长、管理员等账号身份与权限域。 |
| `k12-learning-service` | 8082 | 课程、班级、知识点、学习任务等核心教学资源域。 |
| `k12-agent-service` | 8083 | 多智能体教学编排、对话上下文、工具调用和教学策略域。 |
| `k12-assessment-service` | 8084 | 作业、测验、诊断报告、学习效果评价和错题归因域。 |

## 健康检查接口

```text
GET http://localhost:8080/api/v1/gateway/health
GET http://localhost:8081/api/v1/iam/health
GET http://localhost:8082/api/v1/learning/health
GET http://localhost:8083/api/v1/agents/health
GET http://localhost:8084/api/v1/assessments/health
```

## 开发约定

- 前端依赖、构建产物和缓存目录不提交到 Git，例如 `node_modules/`、`dist/`、`.npm-cache/`。
- 后端公共模型优先放入 `k12-common`，业务代码按服务边界放入对应模块。
- 新增服务时，优先在 `backend/pom.xml` 声明模块，并保持独立的 `application.yml`、启动类和健康检查接口。
- 涉及跨服务调用、注册发现、配置中心、数据库和消息队列时，先在 README 或设计文档中说明边界，再落代码。

## 后续建议

1. 为后端补充 Maven Wrapper，降低本地环境依赖。
2. 引入统一异常处理、请求追踪 ID、日志规范和基础鉴权。
3. 明确数据库选型和各服务的数据归属，避免一开始就共享表结构。
4. 为智能体服务补充对话、工具、策略、任务编排等领域模型。
5. 添加基础 CI，至少覆盖前端构建和后端 `mvn test`。
