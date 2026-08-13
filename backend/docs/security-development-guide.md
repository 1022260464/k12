# K12 接口安全开发规范

本文用于后续新增 Controller、Service、Mapper 时直接检查，不需要重新设计认证框架。

## 1. 当前安全链路

```text
前端登录
  -> Gateway 转发登录请求
  -> IAM 查询 sys_user / sys_role / sys_permission
  -> BCrypt 校验密码
  -> IAM 签发 30 分钟 JWT
  -> 前端携带 Authorization: Bearer <token>
  -> Gateway 校验签名、签发方、过期时间和功能权限
  -> 下游服务再次校验 JWT
  -> Service 的 @PreAuthorize 再次校验功能权限
  -> Mapper 按当前 userId 实现数据权限
```

Gateway 是第一道防线，下游服务验证和 Service 注解不能省略。否则绕过 Gateway 直连服务端口时可能失去保护。

## 2. 先区分认证和授权

Spring Security 中最容易混淆的是这两个概念：

- 认证（Authentication）：确认“你是谁”，例如用户名和密码是否正确、JWT 是否有效。
- 授权（Authorization）：确认“你能做什么”，例如是否拥有 `course:create`。

本项目的认证分为两个阶段：

1. 首次登录时，IAM 查询数据库并用 BCrypt 校验密码。
2. 后续请求不再重复传密码，而是由 Gateway 和业务服务验证 JWT。

授权也分为两个阶段：

1. Gateway 根据请求路径、HTTP 方法和 JWT 权限做第一轮校验。
2. Service 的 `@PreAuthorize` 在方法执行前做第二轮校验。

因此，`permitAll` 只表示“允许匿名请求进入这个接口”，不表示登录自动成功。登录接口仍会在
`AuthenticationService` 中校验用户名和密码。

## 3. 登录和 JWT 签发代码

### 3.1 AuthenticationController

`POST /api/v1/iam/auth/login` 的 HTTP 入口。它负责接收 JSON、触发参数校验和包装响应，不直接查数据库。

### 3.2 UserAuthenticationService

通过 `UserMapper` 查询：

- `sys_user` 中的用户 ID、用户名、密码哈希和账号状态。
- `sys_role` 中的角色，例如 `ROLE_ADMIN`。
- `sys_permission` 中的权限，例如 `course:read`。

角色和权限会合并为 authorities。authorities 可以理解为“当前用户拥有的全部通行证”。

### 3.3 AuthenticationService

核心步骤：

```text
查询用户 -> BCrypt.matches(明文密码, 数据库哈希) -> 检查账号状态 -> 检查有效角色 -> 签发 JWT
```

数据库永远只保存 BCrypt 哈希。验证密码应该使用：

```java
passwordEncoder.matches(rawPassword, passwordHash)
```

不能把明文密码再次 `encode()` 后比较字符串，因为 BCrypt 每次编码都会生成不同盐值。

### 3.4 JwtTokenService

生成的 JWT 主要包含：

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `iss` | 签发者 | `k12-platform` |
| `iat` | 签发时间 | Unix 时间 |
| `exp` | 过期时间 | 当前时间加 30 分钟 |
| `sub` | 用户名 | `admin` |
| `userId` | 数据库用户 ID | `1` |
| `authorities` | 角色和功能权限 | `ROLE_ADMIN`, `course:read` |

JWT 载荷只是 Base64URL 编码，不是加密，客户端可以看到内容。因此不能把密码、密码哈希、身份证号等敏感数据放入 JWT。

HS256 使用同一个密钥签名和验签：IAM 使用 `JwtEncoder` 签名，Gateway 和业务服务使用 `JwtDecoder` 验签。
签名的作用是防篡改，不是隐藏载荷。

## 4. 后续请求如何验证 JWT

前端请求头：

```http
Authorization: Bearer <accessToken>
```

Spring Security 资源服务器会自动完成：

1. 从 `Authorization` 请求头提取 Token。
2. 使用共享密钥验证 HS256 签名。
3. 校验 `exp`、`iss`。
4. 调用 `K12JwtClaimsValidator` 校验 `userId`、`sub`、`authorities`。
5. 把 JWT 转换成 `Authentication`。
6. 将 `Authentication` 放入当前请求的 `SecurityContextHolder`。

`JwtGrantedAuthoritiesConverter` 被配置为读取 `authorities` claim，并关闭默认 `SCOPE_` 前缀。因此：

```text
JWT 中 course:read
        ↓
GrantedAuthority("course:read")
        ↓
hasAuthority("course:read") 可以匹配
```

Gateway 是 WebFlux，使用 `ServerHttpSecurity` 和 `ReactiveJwtDecoder`；普通业务服务是 Servlet，使用
`HttpSecurity` 和 `JwtDecoder`。两者不是两套业务认证，只是底层 Web 技术栈不同。

## 5. SecurityFilterChain 关键规则

```java
.requestMatchers("/api/v1/iam/auth/login").permitAll()
.requestMatchers(HttpMethod.GET, "/api/v1/iam/users/**")
    .hasAnyAuthority("ROLE_ADMIN", "user:read")
.anyRequest().authenticated()
```

分别表示：

- `permitAll()`：无需 JWT，但接口内部仍可以自行校验账号密码。
- `hasAnyAuthority(A, B)`：拥有 A 或 B 任意一个即可。
- `authenticated()`：只要求登录，不要求某个具体权限。
- `anyRequest()`：兜底规则，新接口没有显式配置时仍不能匿名访问。

当前项目无服务器 Session，每次请求都独立验证 JWT，因此配置为 `STATELESS`。表单登录和 HTTP Basic 已关闭。

## 6. 方法权限 @PreAuthorize

`@EnableMethodSecurity` 开启方法权限。没有它，`@PreAuthorize` 只是一个不会执行的普通注解。

```java
@PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:create')")
public CourseResponse createCourse(CourseRequest request) {
    // 只有表达式结果为 true 才会执行这里
}
```

权限优先放在 Service，而不是只放 Controller，因为 Service 未来还可能被其他 Controller、消息消费者或内部入口调用。

注意 Spring AOP 的限制：同一个对象内部使用 `this.someMethod()` 调用另一个带 `@PreAuthorize` 的方法时，不会经过代理，注解不会再次执行。因此公开注册和管理端创建用户共用的是私有基础逻辑，而不是依赖内部调用绕过权限。

## 7. Authentication 和 SecurityContextHolder

JWT 验证成功后，可以通过 Spring 注入：

```java
public ApiResponse<?> me(Authentication authentication) {
    String username = authentication.getName();
    Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();
}
```

也可以使用项目工具类：

```java
Long userId = K12SecurityContext.requireUserId();
String username = K12SecurityContext.currentUsername().orElseThrow();
```

`SecurityContextHolder` 默认保存的是当前请求线程的认证信息。不要把其中的 `Authentication` 缓存到静态变量或跨请求共享。

## 8. 401、403 和异常处理

- `401 Unauthorized`：没有 JWT、JWT 过期、签名错误、issuer 错误或必要 claim 缺失。
- `403 Forbidden`：JWT 有效，但 URL 规则或 `@PreAuthorize` 判断权限不足。

安全过滤器发生在 Controller 之前，普通 Controller 异常处理器接不到，因此：

- Servlet 使用 `K12SecurityErrorWriter` 直接写 `HttpServletResponse`。
- Gateway WebFlux 使用 `GatewaySecurityErrorWriter` 写响应式 `DataBuffer`。
- Service 方法权限异常由 `K12MethodSecurityExceptionHandler` 统一处理。

三处都返回相同的 `ApiResponse` JSON，并在控制台使用 `log.info` 记录拒绝原因。

## 9. 权限编码规则

统一使用：

```text
资源:动作
```

标准动作优先使用：

```text
read
create
update
delete
```

示例：

```text
course:read
course:create
homework:update
user:delete
```

特殊业务动作可以使用明确动词，例如：

```text
homework:submit
homework:grade
agent:execute
file:download
```

不要用 `permission1`、`manage` 这类范围不明确的编码。

## 10. 新增接口的标准写法

Controller 只负责 HTTP 参数和响应，权限注解优先放在 Service：

```java
@Service
public class CourseService {

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public CourseResponse getCourse(Long id) {
        // 查询业务
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:create')")
    public CourseResponse createCourse(CourseRequest request) {
        // 创建业务
    }
}
```

这样即使未来增加另一个 Controller、消息消费者或内部调用入口，Service 仍有权限保护。

每增加一种新权限，还必须同步：

1. `k12_auth.sys_permission`。
2. `sys_role_permission` 默认角色授权。
3. Gateway 的路径和 HTTP 方法规则。
4. Service 方法的 `@PreAuthorize`。
5. OpenAPI 文档中的 `401`、`403` 响应说明。
6. 管理员、教师、学生三类测试。

## 11. 功能权限和数据权限不同

`@PreAuthorize("hasAuthority('homework:read')")` 只能说明用户有“查看作业”功能，不能说明他能查看所有人的作业。

学生只能看自己的数据时，要读取 JWT 中的 `userId`：

```java
Long studentId = K12SecurityContext.requireUserId();
return homeworkMapper.findByStudentId(studentId);
```

SQL 必须增加数据范围条件：

```sql
WHERE student_id = #{studentId}
```

不要接受前端传来的 `studentId` 后直接信任它，否则学生可以修改参数查看其他人的数据。

教师通常还需要按 `teacher_id`、`class_id` 或 `school_id` 限制数据范围；管理员才可以读取全量数据。

## 12. 匿名接口

匿名接口必须同时在 Gateway 和 common Servlet 安全配置中明确 `permitAll`。

当前只允许：

- 健康检查。
- 登录。
- 学生注册。

不要把普通业务接口加入 `permitAll`。如果确实需要公开资源，单独定义只读 DTO，避免返回内部字段。

## 13. 401 和 403 快速判断

- `401 Unauthorized`：没有 JWT、JWT 过期、签名错误或签发方错误。
- `403 Forbidden`：JWT 有效，但没有接口要求的角色或权限。

两者都会返回统一 `ApiResponse` JSON。前端收到 401 应清除登录状态，收到 403 应提示无权限，不应跳转登录。

## 14. JWT 注意事项

- JWT 不保存密码和密码哈希。
- 当前 JWT 保存 `userId`、用户名和 authorities。
- Gateway 和下游服务都会拒绝缺少 `userId`、用户名或 authorities 的令牌。
- 当前访问令牌有效期为 30 分钟。
- 修改角色权限或禁用账号后，旧 JWT 最长仍可使用到过期，因此修改权限后应重新登录。
- 需要立即踢下线时，再引入 Redis 令牌黑名单或用户 tokenVersion。
- `prod` / `production` 环境禁止使用默认开发密钥，必须配置至少 32 字节的 `K12_JWT_SECRET`。
- 所有服务必须使用相同 issuer 和 secret。

## 15. Apifox 测试顺序

1. 调用 `POST /api/v1/iam/auth/login`。
2. 复制响应中的 `data.accessToken`。
3. 在 Apifox 项目认证中选择 Bearer Token。
4. 粘贴 token，不需要手写 `Bearer ` 前缀时以 Apifox 输入框说明为准。
5. 分别使用管理员、教师、学生账号测试同一接口。

预期示例：

| 接口 | 管理员 | 教师 | 学生 |
| --- | --- | --- | --- |
| `GET /api/v1/learning/courses` | 200 | 200 | 200 |
| `POST /api/v1/learning/courses` | 201 | 201 | 403 |
| `POST /api/v1/agents` | 201 | 403 | 403 |
| `GET /api/v1/iam/users` | 200 | 403 | 403 |

## 16. 上线前检查

- 使用 HTTPS，不允许明文传输 JWT。
- 修改默认 JWT 密钥。
- 数据库账号使用最小权限，不使用 root 运行服务。
- 不在日志中打印密码、完整 JWT、密码哈希和敏感个人信息。
- 对登录、注册、短信和 AI 调用增加限流。
- 对管理员权限修改、用户删除等操作增加审计日志。
- 对文件上传校验类型、大小和存储路径。
