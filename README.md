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

## 后端安全配置

后端统一接入 Spring Security。公共依赖放在 `backend/pom.xml`，Servlet 服务的通用安全配置放在 `k12-common` 并通过 Spring Boot AutoConfiguration 自动加载；网关服务是 WebFlux 栈，安全配置保留在 `k12-gateway-service`。

默认放行 `/actuator/health`、`/actuator/info` 和各服务健康检查接口，其他接口默认使用 HTTP Basic 认证。开发默认账号为 `admin` / `admin123`，可通过 `k12.security.user.*` 覆盖。

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

## Git 分支与推送规范

### 分支命名

建议使用 `类型/范围-简短描述` 的格式，全部使用小写字母、数字和连字符。

```text
feature/backend-agent-orchestration
feature/frontend-course-dashboard
fix/iam-login-validation
refactor/backend-module-structure
docs/readme-git-workflow
chore/update-dependencies
```

常用类型说明：

- `feature/`：新增业务功能或页面。
- `fix/`：修复缺陷。
- `refactor/`：重构代码，不改变外部行为。
- `docs/`：文档调整。
- `chore/`：依赖、脚本、配置、构建等工程维护。
- `test/`：测试补充或测试结构调整。

### 提交规范

提交信息建议使用 `type(scope): summary` 格式，summary 使用简洁中文或英文说明本次变更。

```text
feat(agent): 初始化智能体服务健康检查接口
fix(frontend): 修复课程卡片状态展示
refactor(backend): 拆分 Maven 多模块结构
docs(root): 补充项目启动说明
chore(git): 更新忽略规则
```

提交时尽量保持单次提交聚焦一个主题，避免把前端样式、后端接口、依赖升级和格式化混在同一个提交里。

### 推送前检查

推送前建议至少完成以下检查：

```bash
git status
```

- 确认没有误提交 `node_modules/`、`dist/`、`target/`、`.env`、IDE 工作区文件等本地产物。
- 前端改动建议执行 `npm run build`。
- 后端改动建议执行 `mvn clean test` 或至少对受影响模块执行 `mvn -pl <module> -am test`。
- 如果当前机器未安装 Maven，应在提交说明或 PR 描述中注明后端编译未本地验证。

### 推送流程

```bash
git checkout -b feature/backend-agent-orchestration
git add <changed-files>
git commit -m "feat(agent): 初始化智能体编排模块"
git push -u origin feature/backend-agent-orchestration
```

多人协作时，不建议直接向 `main` 或 `master` 推送业务代码。功能分支推送后通过 Pull Request 合并，合并前至少确认代码能构建、README 或配置变更已同步说明。

### 合并与发布

- `main` / `master` 保持可运行状态，只接收经过评审或自检通过的变更。
- 长期开发功能从主分支拉出独立分支，定期同步主分支，减少最终合并冲突。
- 合并优先使用 squash merge 或普通 merge，按团队习惯统一；避免无意义的临时提交污染主分支历史。
- 发布节点建议打 tag，例如 `v0.1.0`、`v0.2.0-agent-preview`。

## 后续建议

1. 为后端补充 Maven Wrapper，降低本地环境依赖。
2. 引入统一异常处理、请求追踪 ID、日志规范和基础鉴权。
3. 明确数据库选型和各服务的数据归属，避免一开始就共享表结构。
4. 为智能体服务补充对话、工具、策略、任务编排等领域模型。
5. 添加基础 CI，至少覆盖前端构建和后端 `mvn test`。


