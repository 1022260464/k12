#!/usr/bin/env bash
# 演示就绪预检（P1-8）：竞赛/演示前跑一遍，全部 PASS 即可开场。
# 用法: bash deploy/demo/preflight.sh
set -u
BASE="${K12_BASE:-http://127.0.0.1}"
PASS=0; FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
login() { # login <user> <password> -> accessToken or empty
  curl -s --noproxy '*' --max-time 10 -X POST "$BASE/api/v1/iam/auth/login" \
    -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c 'import sys,json
try: print(json.load(sys.stdin)["data"]["accessToken"])
except Exception: print("")' 2>/dev/null
}

echo "== 1. 服务端口 =="
for port in 80 8080 8081 8082 8083 8084 8090; do
  if ss -ltn | grep -q ":$port "; then ok "端口 $port 在监听"; else bad "端口 $port 未监听"; fi
done

echo "== 2. 四学段已发布课件 =="
COURSEWARES=$(curl -s --noproxy '*' --max-time 10 "$BASE/api/v1/agents/courseware/published")
for pair in "lower_primary:小水滴" "upper_primary:太阳系" "middle_school:从数据到模型" "high_school:冒泡排序"; do
  stage="${pair%%:*}"; kw="${pair#*:}"
  if echo "$COURSEWARES" | python3 -c "import sys,json;d=json.load(sys.stdin);items=d.get('data') if isinstance(d.get('data'),list) else (d.get('data') or {}).get('items',[]);exit(0 if any('$stage'==(i.get('stage') or '') and '$kw' in (i.get('title') or '') for i in items) else 1)" 2>/dev/null;
  then ok "$stage 《…$kw…》已发布"; else bad "$stage 缺少《…$kw…》"; fi
done

echo "== 3. 固定演示账号可登录 =="
declare -A ACCOUNTS=( [wskid01]="Passw0rd!123" [wsteen01]="Passw0rd!123" [e2esenior01]="Passw0rd!123" [student002]="Student002!123" [admin]="admin123" )
for user in wskid01 wsteen01 e2esenior01 student002 admin; do
  token=$(login "$user" "${ACCOUNTS[$user]}")
  [ -n "$token" ] && ok "$user 登录正常" || bad "$user 登录失败"
  [ "$user" = "admin" ] && ADMIN_TOKEN="$token"
done

echo "== 4. 预置学习记录 + 教师端证据对应 =="
EV=$(curl -s --noproxy '*' --max-time 10 "$BASE/api/v1/assessments/practice-attempts/students/69/evidence?limit=30" -H "Authorization: Bearer ${ADMIN_TOKEN:-}")
if echo "$EV" | python3 -c 'import sys,json
d=json.load(sys.stdin)["data"]
rows=[a for a in d.get("recentAttempts",[]) if a.get("topic","").startswith("图像分类")]
exit(0 if rows and rows[0].get("score")==10 and rows[0].get("totalQuestions")==3 else 1)' 2>/dev/null;
then ok "wskid01 图像分类记录在库，教师端证据可见（10/30·1/3）"; else bad "wskid01 图像分类记录缺失（跑 e2e-demochain.py 重新生成）"; fi
MST=$(curl -s --noproxy '*' --max-time 10 "$BASE/api/v1/assessments/practice-attempts/me/mastery" -H "Authorization: Bearer $(login wskid01 Passw0rd!123)")
echo "$MST" | python3 -c 'import sys,json
rows=json.load(sys.stdin)["data"]
exit(0 if any(r.get("topic")=="图像分类" for r in rows) else 1)' 2>/dev/null \
  && ok "学生端掌握度同源可见（图像分类）" || bad "学生端掌握度缺失"

echo "== 5. 学段画像与知识图谱 =="
for user in wsteen01 e2esenior01; do
  token=$(login "$user" "Passw0rd!123")
  PROF=$(curl -s --noproxy '*' --max-time 10 "$BASE/api/v1/iam/users/me/learning-profile" -H "Authorization: Bearer $token" 2>/dev/null)
  if echo "$PROF" | grep -q "schoolStage"; then ok "$user 学段画像已生成"; else bad "$user 学段画像缺失"; fi
done
KG=$(curl -s --noproxy '*' --max-time 15 "$BASE/api/v1/learning/knowledge-graph/overview" -H "Authorization: Bearer $(login wskid01 Passw0rd!123)")
echo "$KG" | python3 -c 'import sys,json
d=json.load(sys.stdin)["data"]
exit(0 if len(d.get("points",[]))>300 else 1)' 2>/dev/null \
  && ok "知识图谱可访问（400+ 点）" || bad "知识图谱不可访问"

echo
echo "结果: $PASS 通过 / $FAIL 未通过"
[ "$FAIL" -eq 0 ] && echo "🎉 演示就绪" || echo "⚠️ 请先修复以上 ❌ 项（恢复手段见 deploy/demo/README.md 第 5 节）"
exit "$FAIL"
