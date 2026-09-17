import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 真实 HTTP 联调：验证 JWT 状态校验、RBAC、题目发布、提交和逐题批改。
// 临时密码与 JWT 只存在进程内存中，报告只记录接口状态和测试资源 ID。
const base = process.env.K12_TEST_BASE_URL || 'http://127.0.0.1:8080';
const adminUsername = process.env.K12_TEST_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.K12_TEST_ADMIN_PASSWORD || 'admin123';
const runTag = `security_assessment_${Date.now()}_${randomBytes(3).toString('hex')}`;
const report = { runTag, base, startedAt: new Date().toISOString(), checks: [], cleanup: [], resources: {} };
const accounts = [];
let adminToken;
let homeworkId;
let homeworkStatus;
let currentStep = '初始化';

async function request(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} 返回了非 JSON 响应`);
  }
  return { status: response.status, json };
}

async function check(name, method, path, token, body, expectedStatus = 200, verify = () => {}) {
  currentStep = name;
  const startedAt = Date.now();
  const entry = { name, method, path, passed: false };
  report.checks.push(entry);
  const response = await request(method, path, token, body);
  Object.assign(entry, {
    status: response.status,
    code: response.json.code,
    durationMs: Date.now() - startedAt,
  });
  assert.equal(response.status, expectedStatus, `${name}: HTTP ${response.status}, expected ${expectedStatus}`);
  assert.equal(response.json.code, expectedStatus < 300 ? 200 : expectedStatus,
    `${name}: 业务响应 code 不符合约定`);
  verify(response.json.data);
  entry.passed = true;
  console.log(`PASS ${name} (${response.status}, ${entry.durationMs}ms)`);
  return response.json.data;
}

async function login(name, password, expectedStatus = 200) {
  return check(`${name}登录`, 'POST', '/api/v1/iam/auth/login', null,
    { username: name, password }, expectedStatus);
}

async function createAccount(suffix, roleCode) {
  const username = `${runTag}_${suffix}`;
  const password = randomBytes(24).toString('base64url');
  const user = await check(`创建临时${suffix}账号`, 'POST', '/api/v1/iam/users', adminToken,
    { username, password, nickname: `联调-${suffix}`, email: null, roleCode }, 201);
  const account = { id: user.id, username, password };
  accounts.push(account);
  const token = await login(username, password);
  assert.ok(token.accessToken, `${suffix}登录响应缺少 accessToken`);
  account.token = token.accessToken;
  return account;
}

async function cleanup(name, method, path, token) {
  try {
    const response = await request(method, path, token);
    const passed = response.status === 200 && response.json.code === 200;
    report.cleanup.push({ name, method, path, status: response.status, passed });
    console.log(`${passed ? 'CLEAN' : 'CLEAN_FAILED'} ${name} (${response.status})`);
  } catch (error) {
    report.cleanup.push({ name, method, path, passed: false, errorType: error.name });
    console.log(`CLEAN_FAILED ${name}`);
  }
}

try {
  await check('Gateway 健康检查', 'GET', '/api/v1/gateway/health');
  await check('IAM 经 Gateway 健康检查', 'GET', '/api/v1/iam/health');
  await check('Assessment 经 Gateway 健康检查', 'GET', '/api/v1/assessments/health');
  await check('未登录访问作业被拒绝', 'GET', '/api/v1/assessments/homeworks', null, undefined, 401);

  const adminLogin = await login(adminUsername, adminPassword);
  assert.ok(adminLogin.accessToken, '管理员登录响应缺少 accessToken');
  adminToken = adminLogin.accessToken;
  await check('管理员读取当前身份', 'GET', '/api/v1/iam/me', adminToken);

  const teacher = await createAccount('teacher', 'ROLE_TEACHER');
  const student = await createAccount('student', 'ROLE_STUDENT');

  await check('学生不能创建作业', 'POST', '/api/v1/assessments/homeworks', student.token,
    { courseId: 1, title: runTag, description: '越权检查', status: 'DRAFT' }, 403);

  await check('管理员禁用学生', 'PUT', `/api/v1/iam/users/${student.id}/status`, adminToken,
    { status: 'DISABLED' });
  await check('禁用后旧 JWT 立即失效', 'GET', '/api/v1/iam/me', student.token, undefined, 401);
  await check('管理员重新启用学生', 'PUT', `/api/v1/iam/users/${student.id}/status`, adminToken,
    { status: 'ENABLED' });
  const studentRelogin = await login(student.username, student.password);
  student.token = studentRelogin.accessToken;

  const homework = await check('教师创建草稿作业', 'POST', '/api/v1/assessments/homeworks', teacher.token,
    { courseId: 1, title: runTag, description: '安全与逐题批改真实联调', status: 'DRAFT' }, 201);
  homeworkId = homework.id;
  homeworkStatus = homework.status;

  const choice = await check('教师新增单选题', 'POST',
    `/api/v1/assessments/homeworks/${homeworkId}/questions`, teacher.token, {
      type: 'SINGLE_CHOICE',
      stem: '2 + 2 的结果是？',
      score: 40,
      sortOrder: 1,
      options: [
        { key: 'A', content: '3', sortOrder: 1 },
        { key: 'B', content: '4', sortOrder: 2 },
      ],
      correctAnswers: ['B'],
      referenceAnswer: null,
      analysis: '基础加法。',
    }, 201);

  const shortAnswer = await check('教师新增简答题', 'POST',
    `/api/v1/assessments/homeworks/${homeworkId}/questions`, teacher.token, {
      type: 'SHORT_ANSWER',
      stem: '请简述一次函数的基本形式。',
      score: 60,
      sortOrder: 2,
      options: [],
      correctAnswers: [],
      referenceAnswer: 'y = kx + b，其中 k 不等于 0。',
      analysis: '考查一次函数定义。',
    }, 201);

  await check('教师设置作业接收学生', 'PUT',
    `/api/v1/assessments/homeworks/${homeworkId}/recipients`, teacher.token,
    { studentUserIds: [student.id] }, 200,
    data => assert.deepEqual(data, [student.id]));

  const published = await check('教师发布作业', 'POST',
    `/api/v1/assessments/homeworks/${homeworkId}/publish`, teacher.token);
  homeworkStatus = published.status;

  await check('学生读取题目时标准答案隐藏', 'GET',
    `/api/v1/assessments/homeworks/${homeworkId}/questions`, student.token, undefined, 200, data => {
      assert.equal(data.length, 2);
      assert.ok(data.every(item => item.answerVisible === false));
      assert.ok(data.every(item => item.correctAnswers.length === 0));
      assert.ok(data.every(item => item.referenceAnswer === null));
    });

  const submission = await check('学生提交完整答案', 'POST',
    `/api/v1/assessments/homeworks/${homeworkId}/submit`, student.token, {
      answerContent: '结构化答题联调',
      answers: [
        { questionId: choice.id, selectedAnswers: ['B'], answerText: null },
        { questionId: shortAnswer.id, selectedAnswers: [], answerText: 'y = kx + b，且 k 不等于 0。' },
      ],
    }, 201, data => {
      assert.equal(data.status, 'PENDING_GRADING');
      assert.equal(data.score, null);
    });

  const detail = await check('教师读取逐题提交详情', 'GET',
    `/api/v1/assessments/homeworks/${homeworkId}/submissions/${student.id}/detail`, teacher.token,
    undefined, 200, data => {
      assert.equal(data.submission.id, submission.id);
      assert.equal(data.answers.find(item => item.questionId === choice.id).finalScore, 40);
      assert.equal(data.answers.find(item => item.questionId === shortAnswer.id).gradingStatus, 'PENDING_REVIEW');
    });

  await check('教师批改简答题并汇总总分', 'PUT',
    `/api/v1/assessments/homeworks/${homeworkId}/submissions/${student.id}/answers/${shortAnswer.id}/grade`,
    teacher.token, { score: 55, feedback: '要点完整。', expectedSubmissionVersion: detail.submission.version },
    200, data => {
      assert.equal(data.submission.status, 'GRADED');
      assert.equal(data.submission.score, 95);
      assert.equal(data.submission.version, detail.submission.version + 1);
    });

  await check('学生读取最终成绩', 'GET',
    `/api/v1/assessments/homeworks/${homeworkId}/submissions/me/detail`, student.token,
    undefined, 200, data => assert.equal(data.submission.score, 95));

  const closed = await check('教师关闭作业', 'POST',
    `/api/v1/assessments/homeworks/${homeworkId}/close`, teacher.token);
  homeworkStatus = closed.status;
  await check('作业关闭后学生可查看标准答案', 'GET',
    `/api/v1/assessments/homeworks/${homeworkId}/questions`, student.token, undefined, 200, data => {
      assert.ok(data.every(item => item.answerVisible === true));
      assert.deepEqual(data.find(item => item.id === choice.id).correctAnswers, ['B']);
      assert.ok(data.find(item => item.id === shortAnswer.id).referenceAnswer);
    });

  await check('管理员查询登录审计', 'GET', '/api/v1/iam/audits/logins?page=1&size=20', adminToken,
    undefined, 200, data => assert.ok(data.items.length > 0));
  await check('管理员查询操作审计', 'GET', '/api/v1/iam/audits/operations?page=1&size=20', adminToken,
    undefined, 200, data => assert.ok(data.items.length > 0));
} catch (error) {
  report.failure = { step: currentStep, type: error.name, message: error.message };
  console.error(`FAIL ${currentStep}: ${error.name}: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (homeworkId && homeworkStatus === 'DRAFT') {
    await cleanup(`删除未发布测试作业 ${homeworkId}`, 'DELETE',
      `/api/v1/assessments/homeworks/${homeworkId}`, adminToken);
  }
  for (const account of accounts) {
    await cleanup(`逻辑删除测试账号 ${account.username}`, 'DELETE',
      `/api/v1/iam/users/${account.id}`, adminToken);
  }
  report.resources = {
    homeworkId,
    homeworkStatus,
    users: accounts.map(({ id, username }) => ({ id, username })),
  };
  report.finishedAt = new Date().toISOString();
  report.passed = !report.failure && report.cleanup.every(item => item.passed);
  if (!report.passed) process.exitCode = 1;
  const directory = new URL('../target/integration-reports/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const file = new URL(`${runTag}.json`, directory);
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`REPORT ${file.pathname}`);
  console.log(`RESULT passed=${report.passed}, checks=${report.checks.filter(item => item.passed).length}/${report.checks.length}, cleanup=${report.cleanup.filter(item => item.passed).length}/${report.cleanup.length}`);
}
