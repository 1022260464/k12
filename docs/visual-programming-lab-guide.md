# AI 积木实验室实施与验收说明

> 完成阶段：P1 小学高年级与图形化编程  
> 页面地址：`http://127.0.0.1:5173/#visual-code-lab`

管理端动态配置改造方案见：`docs/visual-programming-admin-authoring-plan.md`。

## 1. 已实现范围

- Blockly 图形化工作区与中文工具箱；
- 数据标注、分类预测、循环行动、预测置信度、校园 AI 巡检、数据均衡与公平、知识闯关、
  顺序故事绘本八个 AI 通识关卡；
- 每关包含情境故事、三步学习路线、知识概念、提示、通关徽章和课后反思；
- 受限指令编译和浏览器教学舞台，不使用 `eval` 或 `new Function`；
- 自动保存 Blockly JSON，本地服务异常时仍可继续操作；
- 每个账号按关卡保存工作区、最好星级、完成状态和尝试次数；
- Java 服务端重新解析工作区并评分，不接受前端直接提交星级；
- 完成度、星级、分项检查和 Python 实验跳转；
- Blockly 页面懒加载，不进入首页主包。

本阶段实现的是“Scratch 风格 AI 图形化编程”，不是完整 Scratch 编辑器。初高中 Python 实验
继续使用原有 `#code-lab` 和腾讯云代码沙箱。

## 2. 运行结构

```text
React VisualCodeLabPage
  -> BlocklyWorkspace 保存 JSON
  -> 白名单编译器生成标注、预测、判断、循环、均衡检查、答题、场景切换等受限指令
  -> MissionStage 在浏览器中执行教学动画
  -> PUT /api/v1/learning/visual-programming/projects/{missionCode}
  -> Learning Service 重新解析 Blockly JSON 并评分
  -> MySQL 保存工作区、星级和完成状态
```

## 3. 数据库升级

在 `k12_business` 执行：

```text
backend/sql/mysql/k12_business_visual_programming.sql
backend/sql/mysql/k12_business_visual_programming_mission_upgrade.sql
```

第一条创建学生项目表，第二条创建关卡定义并写入 8 个种子关卡。已有五关环境改为执行
`backend/sql/mysql/k12_business_visual_programming_templates_v2_upgrade.sql`。不要执行到 `k12_auth`。

执行后检查：

```sql
SHOW TABLES FROM k12_business LIKE 'learning_visual_programming_project';

SELECT student_user_id, mission_code, status, best_stars, attempt_count, updated_time
FROM k12_business.learning_visual_programming_project
ORDER BY updated_time DESC;
```

## 4. 服务启动

1. 执行数据库升级脚本。
2. 重启 `K12LearningServiceApplication`，加载新增 Controller、Service 和 Mapper。
3. Gateway 保持运行。
4. 前端运行 `pnpm --filter @k12/user-app dev`。
5. 学生登录后打开“AI 实验室”。

如果数据库脚本未执行或 Learning Service 未重启，前端会显示“本机保存模式”；积木仍可运行，
但账号进度不会跨设备同步。

## 5. 接口

### 查询当前学生进度

```http
GET /api/v1/learning/visual-programming/projects/me
Authorization: Bearer <JWT>
```

### 保存并由服务端评分

```http
PUT /api/v1/learning/visual-programming/projects/label-training-data
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "workspace": {
    "blocks": {
      "languageVersion": 0,
      "blocks": []
    }
  }
}
```

支持的关卡编码：

- `label-training-data`
- `predict-and-decide`
- `repeat-a-route`
- `confidence-gate`
- `campus-ai-patrol`

## 6. 人工验收

### 第一关

1. 连接四个“给图片贴标签”积木。
2. 猫图选择“猫”，狗图选择“狗”。
3. 最后连接“训练图片分类器”。
4. 点击“运行积木”。
5. 期望获得 3 颗星，刷新页面后积木仍存在。

### 第二关

1. 连接“训练图片分类器”。
2. 连接“预测神秘图片”。
3. 连接“如果”，条件使用“预测结果是猫”。
4. 在条件内部放入“说”，内容包含“猫”。
5. 期望获得 3 颗星。

### 第三关

1. 使用“重复 4 次”。
2. 循环内放入“机器人前进 2 步”。
3. 循环后连接“说任务完成”。
4. 期望机器人到达数据站并获得 3 颗星。

### 第四关

1. 连接“训练图片分类器”和“预测神秘图片”。
2. 连接“如果”，条件使用“预测置信度至少 80%”。
3. 在条件内部放入“说”，内容填写“我很有把握”。
4. 期望舞台显示预测置信度并获得“谨慎判断员”徽章。

### 第五关

1. 训练后选择预测“校园小狗”。
2. 使用“如果预测结果是狗”。
3. 在条件内部放入“重复 4 次”，循环内前进 2 步。
4. 循环后连接“说巡检完成”。
5. 期望完成感知、判断、行动流程并获得“AI 巡检队长”徽章。

### 跨设备同步

1. 完成任意关卡，确认页面显示“账号进度已同步”。
2. 在另一个浏览器使用同一学生账号登录。
3. 打开 AI 实验室，期望恢复工作区和最好星级。

## 7. 安全限制

- 只编译白名单积木；
- 一个任务只允许一个开始积木；
- 最多编译 80 条指令；
- 循环限制为 1 至 10 次；
- 置信度阈值限制为 50% 至 100%；
- 文本限制为 40 字；
- 工作区 JSON 最大约 100 KB；
- 最终星级由服务端解析工作区后计算；
- 不执行任意 JavaScript、HTML 或系统命令。

## 8. 后续扩展

- 把图形化任务绑定到正式课程小节和知识点；
- 完成关卡后同步形成性掌握度；
- 教师端增加任务编排、积木白名单和学段预览；
- 增加图像偏差、推荐系统、感知-判断-行动等 AI 任务；
- 为初中提供“积木转 Python”对照，但生成代码仍经现有沙箱执行。
