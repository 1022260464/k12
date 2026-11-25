#!/usr/bin/env bash
# K12 平台一键部署脚本（基础设施 -> 数据库验证 -> 应用构建启动 -> 验收）
# 用法: 在 deploy/server 目录下执行  bash deploy-all.sh
set -euo pipefail
cd "$(dirname "$0")"

log()  { printf '\n\033[1;36m[部署] %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m[失败] %s\033[0m\n' "$*" >&2; exit 1; }

log "0/6 预检查"
command -v docker >/dev/null || fail "未安装 docker"
docker compose version >/dev/null 2>&1 || fail "未安装 docker compose plugin"
[ -f .env ] || fail "缺少 .env 文件（请先 cp .env.example .env 并填写）"
grep -q '请填写' .env && fail ".env 中仍有『请填写』占位符（PUBLIC_HOST / MINIO_PUBLIC_ENDPOINT），请先编辑 .env"
grep -q '^DASHSCOPE_API_KEY=$' .env && fail ".env 中 DASHSCOPE_API_KEY 为空，请先填写百炼 API Key"

log "1/6 校验 Compose 配置"
docker compose --profile app --profile nacos config --quiet || fail "compose 配置校验未通过"

log "2/6 拉取镜像并启动基础设施"
docker compose pull
docker compose up -d

log "3/6 等待基础设施 healthy（首次初始化建表可能需要几分钟）"
services="mysql postgres redis mongo rabbitmq minio neo4j"
for i in $(seq 1 60); do
  unhealthy=0
  status_line=""
  for s in $services; do
    st=$(docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk -v s="$s" '$1==s{print $2}')
    status_line="$status_line $s=${st:-starting}"
    [ "$st" != "healthy" ] && unhealthy=1
  done
  printf '  [%02d]%s\n' "$i" "$status_line"
  [ "$unhealthy" -eq 0 ] && break
  [ "$i" -eq 60 ] && fail "等待 10 分钟后仍有服务未 healthy，请用 docker compose ps / logs 排查"
  sleep 10
done

log "查看初始化日志（最近 60 行）"
docker compose logs --tail=60 mysql postgres minio-init neo4j-init || true

log "4/6 验证数据库"
docker compose exec -T mysql sh -lc \
  'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD"' \
  < ./sql/mysql/90_verify.sql || fail "数据库验证未通过，请查看上方输出"
echo "数据库验证通过。"
# 提示: 若为旧数据整体迁移，请只导入 data-only 数据，勿重复导入 00_full_schema.sql

log "5/6 构建并启动应用（首次构建下载依赖耗时较长）"
docker compose --profile app build
docker compose --profile app up -d
docker compose --profile app ps

log "6/6 执行验收"
chmod +x scripts/*.sh
./scripts/verify.sh || fail "验收脚本未通过，请查看上方输出"

cat <<'EOF'

============================================================
 部署完成，访问地址:
   学生端   : http://<服务器IP>/
   管理端   : http://<服务器IP>:8088/
   MinIO API: http://<服务器IP>:9000/
 如需演示数据: bash scripts/seed-demo.sh
============================================================
EOF
