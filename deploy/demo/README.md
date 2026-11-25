# K12 平台演示手册（竞赛现场稳定性）

对应《网站改进建议》P1-8：固定演示账号、预置数据、教师端证据、演示路径与恢复手段。

## 1. 固定演示账号

| 端 | 账号 | 密码 | 学段档案 | 用途 |
|---|---|---|---|---|
| 学生端（小学低年级） | `wskid01` | `Passw0rd!123` | PRIMARY_LOWER · 二年级 | 猫课多模态演示链主线；教师端证据对应学生 |
| 学生端（小学高年级） | `wsupper01` | `Passw0rd!123` | PRIMARY_UPPER · 五年级 | 小学高年级课件书架 / 学段差异对比 |
| 学生端（初中） | `wsteen01` | `Passw0rd!123` | JUNIOR_HIGH · 八年级 | 初中课程分组 / 初中课件书架 |
| 学生端（高中） | `e2esenior01` | `Passw0rd!123` | SENIOR_HIGH · 高一 | 高中课件书架 / 冒泡动画 |
| 学生端（通用） | `student002` | `Student002!123` | PRIMARY_LOWER · 三年级 | 5 门课学习记录 / 个性化闭环 |
| 教师端 | `teacher01` | `Passw0rd!123` | ROLE_TEACHER | 教师工作台 / 学生学习证据（已覆盖 wskid01） |
| 管理端 | `admin` | `admin123` | ROLE_ADMIN | 教师端学习证据、课件审核发布 |

> teacher01 的证据权限边界：可看 `wskid01`（修了 `canViewerAccessStudent` 列名 bug，且已把课程 17「人工智能通识 · 正式演示课」teacher 归到 teacher01、wskid01 在该课有 ACTIVE 选课）；未覆盖学生返回 403 属预期。

## 2. 预置数据（每次演示前用 preflight.sh 校验）

- 四学段各 1 份已发布 AI 课件：小水滴的奇妙旅行（低年级）/ 认识太阳系（高年级）/ 从数据到模型（初中）/ 冒泡排序与算法思维（高中）
- `wskid01` 的图像分类小测记录（如 attempt #37：10/30 分 · 答对 1/3 题 · 提示 1 次）——学生端奖励页与管理端「学习证据 → 记录 #37」一一对应
- `wsteen01` / `e2esenior01` 学段画像已生成；知识图谱 438 点 / 1613 边可访问

## 3. 固定演示路径（约 5 分钟）

```text
① 小学低年级（wskid01 无档案 → 现场点「设为小学低年级并开始」）
② #cat-lesson《AI 为什么能认出小猫》：绘本 → 朗读 → 小智讲解
③ 图形化排序任务（4 步拖对）→ 图片分类游戏（用 1 次提示）→ 提交判分
④ 奖励页：徽章 + 「10/30 分 · 答对 1/3 题」+ 掌握度 + 下一步推荐
⑤ 学习进度页：个性化闭环（画像→记录→掌握度→推荐理由→下一步）
⑥ 课程页：同一主题·四学段进阶 + 知识地图（难度/前置/掌握状态）
⑦ 管理端 admin：学习证据 → 选「工作台测试小学生(wskid01)」→ 记录 #37 与 ④ 逐字对应
⑧ 高中（e2esenior01）：问问小智「用动画给我演示冒泡排序」→ 排序动画播放
```

## 4. 脚本

| 脚本 | 作用 | 用法 |
|---|---|---|
| `preflight.sh` | 演示就绪预检：服务端口 / 四学段课件 / 演示账号 / 证据对应 / 知识图谱 | `bash deploy/demo/preflight.sh` |
| `e2e-demochain.py` | ①-④ + ⑧ 全链路自动化走查（Playwright，产生真实判分记录） | `python3 deploy/demo/e2e-demochain.py` |
| `e2e-teacher-evidence.py` | ⑦ 教师端证据页自动化校验（8 项一一对应检查） | `python3 deploy/demo/e2e-teacher-evidence.py` |

依赖：本机 Playwright + chromium-headless-shell（`/home/knodo/.cache/ms-playwright/`），脚本会自动剥离代理环境变量。

## 5. 数据坏了怎么恢复

1. **判分记录丢失 / 想重新生成**：跑 `e2e-demochain.py`，会以真实学生身份重新走一遍猫课链并在库中落新记录（教师端表会自动出现新「记录 #N」）。
2. **课件被误删 / 学段错位**：管理端「AI 课件」重新生成并发布（学段要对齐：冒泡排序=高中，从数据到模型=初中）。
3. **服务未起**：`bash /opt/k12/start-all.sh`，等 6 个端口（8080-8084/8090）就绪后再跑 preflight。
4. **浏览器全崩**：先查 cgroup 内存 `cat /sys/fs/cgroup/memory/memory.usage_in_bytes`（>3.9GB 即 OOM，可临时停 MinIO 释放内存）。

## 6. 现场注意事项

- 服务器上 curl 本地接口**必须带 `--noproxy '*'`**（沙箱代理会劫持 127.0.0.1 请求返回假 401）。
- 演示机浏览器提前登录好 wskid01 / admin 两个标签页，避免现场输密码。
