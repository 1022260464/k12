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

## 2. 权限编码规则

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

## 3. 新增接口的标准写法

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

## 4. 功能权限和数据权限不同

`@PreAuthorize("hasAuthority('homework:read')")` 只能说明用户有“查看作业”功能，不能说明他能查看所有人的作业。

学生只能看自己的数据时，要读取 JWT 中的 `userId`：

```
Long studentId = K12SecurityContext.requireUserId();
return homeworkMapper.findByStudentId(studentId);
```

SQL 必须增加数据范围条件：

```sql
WHERE student_id = #{studentId}
```

不要接受前端传来的 `studentId` 后直接信任它，否则学生可以修改参数查看其他人的数据。

教师通常还需要按 `teacher_id`、`class_id` 或 `school_id` 限制数据范围；管理员才可以读取全量数据。

## 5. 匿名接口

匿名接口必须同时在 Gateway 和 common Servlet 安全配置中明确 `permitAll`。

当前只允许：

- 健康检查。
- 登录。
- 学生注册。

不要把普通业务接口加入 `permitAll`。如果确实需要公开资源，单独定义只读 DTO，避免返回内部字段。

## 6. 401 和 403

- `401 Unauthorized`：没有 JWT、JWT 过期、签名错误或签发方错误。
- `403 Forbidden`：JWT 有效，但没有接口要求的角色或权限。

两者都会返回统一 `ApiResponse` JSON。前端收到 401 应清除登录状态，收到 403 应提示无权限，不应跳转登录。

## 7. JWT 注意事项

- JWT 不保存密码和密码哈希。
- 当前 JWT 保存 `userId`、用户名和 authorities。
- Gateway 和下游服务都会拒绝缺少 `userId`、用户名或 authorities 的令牌。
- 当前访问令牌有效期为 30 分钟。
- 修改角色权限或禁用账号后，旧 JWT 最长仍可使用到过期，因此修改权限后应重新登录。
- 需要立即踢下线时，再引入 Redis 令牌黑名单或用户 tokenVersion。
- `prod` / `production` 环境禁止使用默认开发密钥，必须配置至少 32 字节的 `K12_JWT_SECRET`。
- 所有服务必须使用相同 issuer 和 secret。

## 8. Apifox 测试顺序

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

## 9. 上线前检查

- 使用 HTTPS，不允许明文传输 JWT。
- 修改默认 JWT 密钥。
- 数据库账号使用最小权限，不使用 root 运行服务。
- 不在日志中打印密码、完整 JWT、密码哈希和敏感个人信息。
- 对登录、注册、短信和 AI 调用增加限流。
- 对管理员权限修改、用户删除等操作增加审计日志。
- 对文件上传校验类型、大小和存储路径。
