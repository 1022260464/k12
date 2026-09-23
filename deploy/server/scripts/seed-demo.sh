#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

run_sql() {
  local file="$1"
  echo "==> applying ${file}"
  docker compose exec -T mysql sh -lc \
    'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD"' \
    < "../../backend/sql/mysql/${file}"
}

run_sql k12_ai_literacy_representative_courses_seed.sql
run_sql k12_business_course_media_seed.sql
run_sql k12_business_lower_primary_tutor.sql
run_sql k12_formal_demo_ai_literacy.sql

echo "Demo seed finished. The representative-course scripts only write data when their configured"
echo "teacher/student usernames exist. Review the SQL usernames, accounts and publication status."
