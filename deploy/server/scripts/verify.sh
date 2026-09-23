#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> compose status"
docker compose --profile app ps

echo "==> MySQL schema"
docker compose exec -T mysql sh -lc \
  'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD"' \
  < ./sql/mysql/90_verify.sql

echo "==> PostgreSQL pgvector"
docker compose exec -T postgres sh -lc '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT extname FROM pg_extension WHERE extname='\''vector'\'';" \
    -c "SELECT COUNT(*) AS knowledge_document_count FROM k12_rag.knowledge_document;"
'

echo "==> service health"
docker compose exec -T gateway curl --fail --silent --show-error \
  http://127.0.0.1:8080/actuator/health
echo
docker compose exec -T web wget --quiet --output-document=/dev/null \
  http://127.0.0.1/
docker compose exec -T web wget --quiet --output-document=/dev/null \
  http://127.0.0.1:8088/
echo "All deployment checks passed."
