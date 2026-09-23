# K12 平台新服务器整体迁移与部署手册

本文用于把 K12 平台应用和基础设施整体迁移到一台新的 Linux 服务器。对应部署文件位于
[`deploy/server`](../deploy/server/README.md)。文档默认服务器安装 Docker Engine 与 Docker Compose
Plugin，应用通过容器运行，不要求服务器安装 JDK、Maven、Node.js、Python 或 uv。

## 1. 部署范围

默认基础设施：

| 组件 | 容器用途 | 数据卷 | 默认暴露方式 |
| --- | --- | --- | --- |
| MySQL 8 | `k12_auth`、`k12_business` | `mysql-data` | 仅 `127.0.0.1:3306` |
| PostgreSQL + pgvector | RAG 文档和向量片段 | `postgres-data` | 仅 `127.0.0.1:5432` |
| Redis | 排行榜、热点数据、RAG 缓存 | `redis-data` | 仅 `127.0.0.1:6379` |
| MongoDB | Agent 执行轨迹 | `mongodb-data` | 仅 `127.0.0.1:27017` |
| RabbitMQ | Agent/代码执行异步队列 | `rabbitmq-data` | 仅本机 5672/15672 |
| MinIO | 课程、绘本、附件和 Agent 产物 | `minio-data` | S3 API 9000；控制台仅本机 9001 |
| Neo4j | 知识点和先修关系 | `neo4j-data` | 仅本机 7474/7687 |
| Nacos | 可选注册与配置中心 | 当前独立 profile | 仅本机 8848/9848 |

应用容器：Gateway、IAM、Learning、Assessment、Agent Service、Python Runtime、Python Worker、
学生端和管理端。学生端默认端口 80，管理端默认端口 8088。浏览器只访问前端，前端 Nginx 将
`/api/**` 转发给内部 Gateway。

Piston 不在默认栈中。腾讯云沙箱是主执行器；若需要离线保底，再按
[`deploy/piston/README.md`](../deploy/piston/README.md) 单独部署，避免常规服务器承担特权容器和多语言
运行时开销。

## 2. 服务器规格

完整单机栈建议：

| 项目 | 最低演示配置 | 推荐配置 |
| --- | ---: | ---: |
| CPU | 4 核 | 8 核 |
| 内存 | 8 GB | 12–16 GB |
| 系统盘 | 80 GB SSD | 150 GB SSD |
| Swap | 2 GB | 4 GB |

4 GB 服务器不适合同时运行全套数据库、5 个 JVM、两个 Python 进程和构建任务。若新服务器仍只有
约 4 GB，请至少将 MySQL、PostgreSQL、MinIO 放到独立服务器或云服务，并关闭 MongoDB、Nacos；
不要依靠频繁 OOM 重启维持演示。

## 3. 文件和端口准备

在新服务器上：

```bash
sudo mkdir -p /opt/k12
sudo chown "$USER":"$USER" /opt/k12
cd /opt/k12
git clone <项目仓库地址> app
cd app/deploy/server
cp .env.example .env
chmod 600 .env
```

必须修改 `.env` 中全部 `change_me`，并填写：

- `MINIO_PUBLIC_ENDPOINT`：浏览器能够访问的 MinIO S3 API 地址；
- `DASHSCOPE_API_KEY`：百炼 API Key；
- `K12_JWT_SECRET`：至少 48 个随机字符；
- `K12_AGENT_INTERNAL_API_KEY`：Java 与 Python 共用的内部密钥；
- MySQL、PostgreSQL、Redis、MongoDB、RabbitMQ、MinIO、Neo4j 密码；
- 腾讯云沙箱启用时填写 `E2B_DOMAIN`、`E2B_API_KEY`。

可用以下方式生成 URL 安全的随机值：

```bash
openssl rand -hex 32
```

密码用于连接 URL 时不要直接使用 `@`、`:`、`/`、`#` 等字符；否则必须 URL 编码。

防火墙仅需要开放：

- `80/443`：学生端；
- 管理端域名对应的 `443`，或临时开放 `8088` 并限制来源 IP；
- `9000`：仅在浏览器直接访问 MinIO 预签名 URL 时开放。

3306、5432、6379、27017、5672、7474、7687、8848、9001、15672 不应直接暴露公网。运维访问使用：

```bash
ssh -L 15672:127.0.0.1:15672 -L 9001:127.0.0.1:9001 user@server
```

## 4. 数据库建表脚本

### 4.1 MySQL 全新建库

总入口为 [`00_full_schema.sql`](../deploy/server/sql/mysql/00_full_schema.sql)。它按当前代码需要依次建立：

1. IAM 用户、角色、权限、学习档案和审计表；
2. 课程、章节、小节、课程活动和学习进度；
3. 作业、题目、附件、提交和批改历史；
4. Agent 配置、运行记录和产物；
5. 教学资料审核、绑定和索引状态；
6. 互动绘本；
7. AI 小测过程数据、掌握度和提示/错误证据；
8. 图形化编程项目、八类任务模板；
9. 代码执行配额。

该入口只挂载到 MySQL 官方镜像的 `/docker-entrypoint-initdb.d`，因此**仅在 MySQL 数据卷首次创建且
为空时执行一次**。不要对已经运行的旧库再次执行它。

### 4.2 PostgreSQL/pgvector

全新 PostgreSQL 数据卷会自动执行
[`001_init_pgvector.sql`](../ai-services/k12-agent-runtime/sql/001_init_pgvector.sql)，创建 `vector` 扩展、
`k12_rag.knowledge_document`、`k12_rag.knowledge_chunk` 和 HNSW 索引。

### 4.3 MongoDB、MinIO、Neo4j

- MongoDB 首次启动建立 `k12_agent` 应用用户；
- MinIO 初始化容器建立 `k12-agent-artifacts` 和 `k12-user-avatars` 私有桶；
- Neo4j 初始化容器执行约束、AI 通识知识点和先修关系 Cypher；
- Redis 和 RabbitMQ 不保存业务真相，不需要建表脚本。

## 5. 两种部署路径

### 5.1 路径 A：全新演示环境

启动基础设施：

```bash
cd /opt/k12/app/deploy/server
docker compose pull
docker compose up -d
docker compose ps
```

首次初始化完成后可写入演示数据：

```bash
chmod +x scripts/*.sh
./scripts/seed-demo.sh
```

代表课程脚本目前按已审核演示账号名查找教师和学生。全新环境需要先创建这些账号，或修改 SQL 顶部的
`@teacher_username`、`@student_username` 后再运行。找不到账号时脚本会跳过相关课程。演示脚本只用于
新演示环境；正式迁移已有数据时不要执行，以免与现有课程和账号产生混淆。

### 5.2 路径 B：迁移已有环境

迁移前进入维护窗口：停止前端写操作，等待 RabbitMQ 任务完成，停止旧环境 Python Worker 和 Java
Agent Service，再导出数据。Redis 缓存和 RabbitMQ 队列消息不迁移。

#### MySQL

从旧服务器导出**数据，不导出建表语句**：

```bash
mysqldump -h OLD_HOST -P 3306 -u root -p \
  --single-transaction --quick --hex-blob --no-tablespaces \
  --set-gtid-purged=OFF --no-create-info --skip-triggers \
  --databases k12_auth k12_business > k12-mysql-data.sql
```

先让新 MySQL 自动完成当前版本建表，再导入数据：

```bash
docker compose up -d mysql
docker compose exec -T mysql sh -lc \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < /path/to/k12-mysql-data.sql
```

数据导入使用当前仓库结构，因此不会重复执行 `ADD COLUMN`，也不会再出现
`Duplicate column name 'knowledge_code'`、`Duplicate column name 'hint_count'`。如果旧库结构比当前代码
更旧，应先在旧环境按原升级说明升级并备份，再做数据导出。

#### PostgreSQL/pgvector

```bash
pg_dump -h OLD_HOST -p 5432 -U postgres -d OLD_RAG_DB \
  --data-only --format=custom --file=k12-rag-data.dump

docker compose up -d postgres
docker cp k12-rag-data.dump "$(docker compose ps -q postgres)":/tmp/k12-rag-data.dump
docker compose exec -T postgres pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --disable-triggers \
  /tmp/k12-rag-data.dump
```

若旧向量维度不是 1024，不能直接导入。应只迁移 MinIO 原始资料，随后在管理端执行“重新索引”。

#### MongoDB

```bash
mongodump --uri="mongodb://OLD_USER:OLD_PASSWORD@OLD_HOST:27017/k12_agent?authSource=admin" \
  --archive=k12-agent.archive --gzip

docker compose up -d mongodb
docker cp k12-agent.archive "$(docker compose ps -q mongodb)":/tmp/k12-agent.archive
docker compose exec -T mongodb mongorestore \
  --uri="mongodb://$MONGO_APP_USERNAME:$MONGO_APP_PASSWORD@127.0.0.1:27017/$MONGO_DATABASE?authSource=$MONGO_DATABASE" \
  --archive=/tmp/k12-agent.archive --gzip --drop
```

MongoDB 轨迹不是业务真相。演示时间紧时可以不迁移，只保留旧备份。

#### MinIO

先启动新 MinIO，然后在装有 `mc` 的机器上执行：

```bash
mc alias set old http://OLD_HOST:9000 OLD_ACCESS_KEY OLD_SECRET_KEY
mc alias set new http://NEW_HOST:9000 NEW_ACCESS_KEY NEW_SECRET_KEY
mc mirror --overwrite --remove old/k12-agent-artifacts new/k12-agent-artifacts
mc mirror --overwrite --remove old/k12-user-avatars new/k12-user-avatars
```

迁移完成后抽查课程封面、绘本图片、资料附件和作业附件。`MINIO_PUBLIC_ENDPOINT` 必须是浏览器可达的
新地址，否则接口能上传但前端图片仍会超时。

#### Neo4j

当前知识图谱可以由仓库知识目录和数据库绑定关系重建，推荐在新环境重新执行初始化 Cypher，再由管理端
执行“目录同步”和资料“同步到图谱”。这比迁移历史脏节点更稳定。

如必须保留人工编辑节点，应在维护窗口使用同版本 Neo4j 的 `neo4j-admin database dump/load`。dump 时
数据库必须停止写入，目标 Neo4j 版本不得低于源版本；完成后再启动 Learning Service。

#### Redis、RabbitMQ、Nacos

- Redis：不迁移，启动后由服务自动重建缓存；
- RabbitMQ：先排空旧队列，不迁移消息；应用启动会声明交换机和队列；
- Nacos：当前默认关闭。若旧环境已实际使用，先从旧 Nacos 导出配置，再启动 `nacos` profile 导入；
  不要把数据库密码重新写回 Git。

## 6. 构建并启动应用

基础设施与数据准备完成后：

```bash
docker compose --profile app build
docker compose --profile app up -d
docker compose --profile app ps
docker compose --profile app logs -f --tail=200 gateway agent-runtime agent-worker
```

首次构建需要下载 Maven、pnpm、Python 和模型依赖，耗时较长且需要足够磁盘。后续代码更新：

```bash
git pull
docker compose --profile app build
docker compose --profile app up -d --remove-orphans
```

Nacos 非当前主链路，默认不开：

```bash
docker compose --profile nacos up -d nacos
```

只有在 `.env` 把 `NACOS_DISCOVERY_ENABLED` / `NACOS_CONFIG_ENABLED` 改为 `true` 并完成配置迁移后，
Java 服务才会使用 Nacos。

## 7. HTTPS 和域名

Compose 内置 Nginx 只负责静态文件与 `/api` 反向代理。正式公网部署应在宿主机宝塔、Caddy 或独立
Nginx 上终止 HTTPS：

| 域名示例 | 上游 |
| --- | --- |
| `learn.example.com` | `127.0.0.1:80` |
| `admin.example.com` | `127.0.0.1:8088` |
| `files.example.com` | `127.0.0.1:9000` |

使用 MinIO 域名时把 `.env` 设置为 `MINIO_PUBLIC_ENDPOINT=https://files.example.com`，然后重启 IAM、
Learning、Assessment 和 Python Runtime。S3 预签名 URL 对 Host 敏感，代理必须保留原始 Host，不能随意
增加 `/minio` 路径前缀。

## 8. 验收

```bash
chmod +x scripts/*.sh
./scripts/verify.sh
```

脚本检查 Compose 状态、MySQL 表和关键字段、pgvector 扩展、Gateway 与两个前端。随后人工验证：

1. 学生端登录、课程、绘本、作业、AI 对话、语音；
2. 运行一次同步 Agent 和一次 RabbitMQ 异步 Agent；
3. 执行一次腾讯云代码沙箱；
4. 管理端上传资料，审核、发布、入库并执行“检索试测”；
5. 管理端上传图片，确认返回的新 MinIO 预签名地址可在浏览器打开；
6. 小学闭环、初高中课程和个性化推荐各回归一次。

旧资料迁移后必须执行“重新索引”，才能获得新版页码、幻灯片号、段落号和混合检索元数据。

## 9. 备份和回滚

上线前保留旧服务器至少 7 天，不立即删除原数据。每天备份：

- MySQL：`mysqldump --single-transaction`；
- PostgreSQL：`pg_dump --format=custom`；
- MongoDB：`mongodump --archive --gzip`；
- MinIO：`mc mirror` 到另一块磁盘或对象存储；
- Neo4j：定期 database dump，或确保能够从目录和绑定关系重建；
- `.env`：加密保存，不放 Git。

回滚时停止新环境写入，切回旧域名解析/反向代理，再把维护窗口之后产生的必要数据单独核对。不要在两个
环境同时接受写入，否则用户、作业状态和对象文件会产生不可自动合并的分叉。
