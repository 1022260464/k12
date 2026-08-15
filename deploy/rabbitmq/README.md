# K12 本地 RabbitMQ

该 Compose 仅用于本地开发和比赛演示。AMQP 与管理控制台端口只绑定到
`127.0.0.1`，其他电脑不能直接访问。

## 启动

在 PowerShell 中执行：

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\rabbitmq
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

首次启动需要下载 RabbitMQ 官方镜像。容器健康状态变为 `healthy` 后即可使用。

## 访问

- AMQP：`127.0.0.1:5672`
- 管理控制台：<http://127.0.0.1:15672>
- 默认用户名：`k12`
- 默认密码：`k12_dev_only_change_me`
- 默认虚拟主机：`k12`

Java 和 Python 后续统一使用以下连接参数：

```text
RABBITMQ_HOST=127.0.0.1
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=k12
RABBITMQ_PASSWORD=k12_dev_only_change_me
RABBITMQ_VIRTUAL_HOST=k12
```

这些账号只允许用于本地开发。部署到共享服务器前必须修改密码，并重新评估端口暴露策略。

## 查看日志

```powershell
docker compose logs -f rabbitmq
```

## 停止

停止容器但保留消息数据：

```powershell
docker compose down
```

删除容器和本地消息数据：

```powershell
docker compose down -v
```

`down -v` 会永久删除 `k12-rabbitmq-data` 数据卷，只能在确认不需要现有消息后执行。
