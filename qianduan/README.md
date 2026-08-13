# K12 前端工程

前端使用 pnpm workspace 管理两个独立的 React + Vite 应用：

```text
qianduan/
├── user-app/   # 学生/教师使用的用户端，开发端口 5173
└── admin-app/  # 平台管理员使用的管理端，开发端口 5174
```

两个应用都通过 Vite 代理访问 `http://localhost:8080`，浏览器只需要面对
Gateway，不直接访问 8081-8084 的后端微服务端口。

## 启动

在 `qianduan` 目录执行：

```bash
pnpm install
pnpm dev:user
pnpm dev:admin
```

也可以进入某个应用目录单独执行 `pnpm dev`。

## 构建

```bash
pnpm build
```

该命令会依次构建 `user-app` 和 `admin-app`。

## 登录与权限

- 用户端支持登录和学生公开注册，注册账号固定获得 `ROLE_STUDENT`。
- 管理端仅允许带有 `ROLE_ADMIN` 的账号进入。
- 登录接口返回 JWT，前端通过 `Authorization: Bearer <token>` 调用受保护接口。
- 管理端提供用户 CRUD、角色分配和角色权限维护。
- JWT 当前保存在 `sessionStorage`，关闭标签页后自动清除。生产环境建议进一步采用短期访问令牌配合 HttpOnly Refresh Token。
