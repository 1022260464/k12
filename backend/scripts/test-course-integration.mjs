import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 真实 HTTP 联调：仅创建临时账号/课程，结束后通过业务 API 退课和逻辑删除。
// 密码和 JWT 仅保存在进程内存，不写入日志或报告；禁止用本脚本压测生产环境。
const base = process.env.K12_TEST_BASE_URL || 'http://127.0.0.1:8080';
const adminName = process.env.K12_TEST_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.K12_TEST_ADMIN_PASSWORD || 'admin123';
const runTag = `it_${Date.now()}_${randomBytes(3).toString('hex')}`;
const report = { runTag, base, startedAt: new Date().toISOString(), checks: [], cleanup: [], resources: {} };
const accounts = [];
const courses = [];
const enrollments = [];
let adminToken;
let currentStep = '初始化';

async function request(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const json = await response.json();
  return { status: response.status, json };
}

async function check(name, method, path, token, body, status = 200, verify = () => {}) {
  currentStep = name;
  const start = Date.now();
  const entry = { name, method, path, passed: false };
  report.checks.push(entry);
  let response;
  try {
    response = await request(method, path, token, body);
  } catch (error) {
    entry.durationMs = Date.now() - start;
    entry.errorType = error.name;
    throw error;
  }
  Object.assign(entry, { status: response.status, code: response.json.code, durationMs: Date.now() - start });
  assert.equal(response.status, status, `${name}: HTTP ${response.status}, expected ${status}`);
  assert.equal(response.json.code, status < 300 ? 200 : status, `${name}: 业务响应 code 不符合约定`);
  verify(response.json.data);
  entry.passed = true;
  console.log(`PASS ${name} (${response.status}, ${entry.durationMs}ms)`);
  return response.json.data;
}

async function account(suffix, roleCode) {
  const username = `${runTag}_${suffix}`;
  const password = randomBytes(24).toString('base64url');
  const data = await check(`创建临时${suffix}账号`, 'POST', '/api/v1/iam/users', adminToken,
    { username, password, nickname: `联调-${suffix}`, roleCode }, 201);
  // 创建后立即登记，后续登录失败也会进入 finally 清理。
  const value = { id: data.id, username };
  accounts.push(value);
  const login = await check(`${suffix}登录`, 'POST', '/api/v1/iam/auth/login', null, { username, password });
  assert.ok(login.accessToken, '登录响应缺少 accessToken');
  value.token = login.accessToken;
  return value;
}

const courseBody = title => ({ title, subject: '数学', gradeLevel: '八年级', description: '临时联调数据' });
const chapterBody = { title: '联调第一章', content: '一次函数 y = kx + b。', sortOrder: 1 };
const prefix = '/api/v1/learning/courses';

async function cleanup(name, method, path, token) {
  try {
    const response = await request(method, path, token);
    const passed = response.status === 200 && response.json.code === 200;
    report.cleanup.push({ name, path, status: response.status, passed });
    console.log(`${passed ? 'CLEAN' : 'CLEAN_FAILED'} ${name} (${response.status})`);
  } catch {
    report.cleanup.push({ name, path, passed: false });
    console.log(`CLEAN_FAILED ${name}`);
  }
}

try {
  await check('网关健康检查', 'GET', '/api/v1/gateway/health');
  await check('IAM 经网关健康检查', 'GET', '/api/v1/iam/health');
  await check('Learning 经网关健康检查', 'GET', '/api/v1/learning/health');
  await check('未登录访问课程被拒绝', 'GET', prefix, null, undefined, 401);
  await check('非法 JWT 被拒绝', 'GET', prefix, 'invalid.jwt.token', undefined, 401);
  const login = await check('管理员登录', 'POST', '/api/v1/iam/auth/login', null,
    { username: adminName, password: adminPassword });
  assert.ok(login.accessToken, '管理员登录响应缺少 accessToken');
  adminToken = login.accessToken;
  // 写入前确认新分页路由和数据库字段已可用，避免旧进程下创建无用数据。
  await check('课程分页与数据库结构预检', 'GET', `${prefix}/page?size=1`, adminToken, undefined, 200,
    data => { assert.equal(data.page, 1); assert.ok(Array.isArray(data.items)); });
  const teacher = await account('teacher', 'ROLE_TEACHER');
  const otherTeacher = await account('other_teacher', 'ROLE_TEACHER');
  const student = await account('student', 'ROLE_STUDENT');
  const otherStudent = await account('other_student', 'ROLE_STUDENT');
  const course = await check('教师创建课程', 'POST', prefix, teacher.token, courseBody(runTag), 201);
  courses.push(course.id);
  assert.equal(course.teacherId, teacher.id, '课程归属不是当前教师');
  const path = `${prefix}/${course.id}`;
  const otherCourse = await check('另一教师创建课程', 'POST', prefix, otherTeacher.token, courseBody(`${runTag}_other`), 201);
  courses.push(otherCourse.id);
  const chapter = await check('教师新增章节', 'POST', `${path}/chapters`, teacher.token, chapterBody, 201);
  const chapterPath = `${path}/chapters/${chapter.id}`;
  await check('课程关键词与 mine 分页', 'GET', `${prefix}/page?mine=true&keyword=${runTag}`, teacher.token, undefined, 200,
    data => assert.deepEqual(data.items.map(item => item.id), [course.id]));
  await check('原课程列表兼容数组', 'GET', prefix, student.token, undefined, 200, data => assert.ok(Array.isArray(data)));
  await check('其他教师不能修改课程', 'PUT', path, otherTeacher.token, courseBody('不得生效'), 403);
  await check('其他教师不能删除课程', 'DELETE', path, otherTeacher.token, undefined, 403);
  await check('学生不能新增章节', 'POST', `${path}/chapters`, student.token, chapterBody, 403);
  await check('未选课不能读取正文', 'GET', chapterPath, student.token, undefined, 403);
  await check('教师修改章节', 'PUT', chapterPath, teacher.token, { ...chapterBody, sortOrder: 2 });
  await check('教师可以清空课程简介', 'PUT', path, teacher.token, { ...courseBody(runTag), description: '' }, 200,
    data => assert.equal(data.description, null));
  const enrollmentPath = `${path}/enrollment`;
  await check('学生首次报名', 'PUT', enrollmentPath, student.token, undefined, 200,
    data => { assert.equal(data.status, 'ACTIVE'); assert.equal(data.userId, student.id); });
  enrollments.push({ path: enrollmentPath, token: student.token });
  await check('重复报名幂等', 'PUT', enrollmentPath, student.token);
  await check('报名状态持久化查询', 'GET', enrollmentPath, student.token, undefined, 200, data => assert.equal(data.status, 'ACTIVE'));
  await check('章节目录不包含正文', 'GET', `${path}/chapters`, student.token, undefined, 200,
    data => { assert.equal(data.length, 1); assert.ok(!Object.hasOwn(data[0], 'content')); });
  await check('已选课学生读取正文', 'GET', chapterPath, student.token, undefined, 200,
    data => assert.equal(data.content, chapterBody.content));
  await check('进度上限校验', 'PUT', `${chapterPath}/progress`, student.token, { progressPercent: 101 }, 400);
  await check('学习进度上报 80', 'PUT', `${chapterPath}/progress`, student.token, { progressPercent: 80 });
  await check('乱序上报 30 不倒退', 'PUT', `${chapterPath}/progress`, student.token, { progressPercent: 30 }, 200,
    data => assert.equal(data.progressPercent, 80));
  await check('独立请求确认进度落库', 'GET', `${path}/progress`, student.token, undefined, 200,
    data => assert.equal(data.progressPercent, 80));
  await check('另一学生报名', 'PUT', enrollmentPath, otherStudent.token);
  enrollments.push({ path: enrollmentPath, token: otherStudent.token });
  await check('学生之间进度隔离', 'GET', `${path}/progress`, otherStudent.token, undefined, 200,
    data => assert.equal(data.progressPercent, 0));
  const otherEnrollmentPath = `${prefix}/${otherCourse.id}/enrollment`;
  await check('学生报名第二门课程', 'PUT', otherEnrollmentPath, student.token);
  enrollments.push({ path: otherEnrollmentPath, token: student.token });
  await check('跨课程伪造章节 ID 被拒绝', 'PUT', `${prefix}/${otherCourse.id}/chapters/${chapter.id}/progress`,
    student.token, { progressPercent: 100 }, 404);
  await check('首次退课', 'DELETE', enrollmentPath, student.token);
  await check('重复退课幂等', 'DELETE', enrollmentPath, student.token);
  await check('退课状态持久化查询', 'GET', enrollmentPath, student.token, undefined, 200, data => assert.equal(data.status, 'WITHDRAWN'));
  await check('退课后正文被拒绝', 'GET', chapterPath, student.token, undefined, 403);
  await check('退课后进度被拒绝', 'GET', `${path}/progress`, student.token, undefined, 403);
  await check('重新报名', 'PUT', enrollmentPath, student.token);
  await check('重新报名保留进度', 'GET', `${path}/progress`, student.token, undefined, 200, data => assert.equal(data.progressPercent, 80));
  await check('完成章节', 'PUT', `${chapterPath}/progress`, student.token, { progressPercent: 100 });
  await check('完成数汇总', 'GET', `${path}/progress`, student.token, undefined, 200,
    data => { assert.equal(data.progressPercent, 100); assert.equal(data.completedChapters, 1); });
  await check('教师删除章节', 'DELETE', chapterPath, teacher.token);
  await check('删除章节后正文不可读', 'GET', chapterPath, student.token, undefined, 404);
  await check('删除章节不再计入进度', 'GET', `${path}/progress`, student.token, undefined, 200,
    data => { assert.equal(data.totalChapters, 0); assert.equal(data.progressPercent, 0); });
} catch (error) {
  // 不打印响应正文或请求头，防止异常把密码、JWT 或内部数据库信息带入报告。
  report.failure = { step: currentStep, type: error.name };
  console.error(`FAIL ${currentStep}: ${error.name}`);
  process.exitCode = 1;
} finally {
  for (const enrollment of enrollments) await cleanup('退出本次测试课程', 'DELETE', enrollment.path, enrollment.token);
  for (const id of courses) await cleanup(`逻辑删除测试课程 ${id}`, 'DELETE', `${prefix}/${id}`, adminToken);
  for (const account of accounts) await cleanup(`逻辑删除测试账号 ${account.username}`, 'DELETE', `/api/v1/iam/users/${account.id}`, adminToken);
  report.resources = { courseIds: courses, users: accounts.map(({ id, username }) => ({ id, username })) };
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
