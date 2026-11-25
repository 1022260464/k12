# K12 server deployment

This directory contains the production-style Docker Compose stack for moving the
application and its infrastructure to one Linux server.

Start here: [server-migration-deployment.md](../../docs/server-migration-deployment.md).

```bash
cp .env.example .env
chmod 600 .env
# Fill every change_me value and DASHSCOPE_API_KEY first.

# Infrastructure only. Fresh MySQL/PostgreSQL volumes are initialized automatically.
docker compose up -d

# Agent traces are written to ./logs/agent-traces as daily JSONL files.
# MongoDB is not part of the default stack.

# Build and start all application containers.
docker compose --profile app up -d --build

chmod +x scripts/*.sh
./scripts/verify.sh
```

Optional Nacos:

```bash
docker compose --profile nacos up -d nacos
```

Optional legacy MongoDB trace backend:

```bash
docker compose --profile legacy-mongodb up -d mongodb
```

Do not commit `.env`, database dumps, MinIO objects, or TLS private keys.

