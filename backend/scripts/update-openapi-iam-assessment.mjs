import fs from "node:fs";

const file = new URL("../openapi/k12-api-openapi.json", import.meta.url);
const api = JSON.parse(fs.readFileSync(file, "utf8"));
const iamTag = ["01-用户与权限服务"];
const assessmentTag = ["07-作业与批改服务"];
const id = { $ref: "#/components/parameters/Id" };
const response = (schema, description = "操作成功") => ({
  "200": { description, content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } } },
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" }
});
const body = schema => ({ required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } } });

api.info.version = "0.2.0";
api.info.description = "K12 多智能体教学平台可调用接口。包含 IAM 账号安全、课程、智能体、结构化作业题目、答题与批改，统一通过 Gateway 和 JWT 鉴权。";

api.paths["/api/v1/iam/auth/token-state"] = {
  get: { tags: iamTag, summary: "校验当前 JWT 状态", operationId: "validateTokenState",
    description: "业务服务内部调用；JWT 的 authVersion 必须与数据库一致。", responses: response("BooleanApiResponse") }
};
api.paths["/api/v1/iam/users/me/password"] = {
  put: { tags: iamTag, summary: "修改我的密码", operationId: "changeOwnPassword",
    description: "校验当前密码后更新 BCrypt 哈希，并使当前 JWT 失效。", requestBody: body("ChangePasswordRequest"), responses: response("EmptyApiResponse") }
};
api.paths["/api/v1/iam/users/{id}/password"] = {
  put: { tags: iamTag, summary: "管理员重置用户密码", operationId: "resetUserPassword",
    description: "仅 ROLE_ADMIN；重置后目标用户的旧 JWT 失效。", parameters: [id], requestBody: body("ResetPasswordRequest"), responses: response("EmptyApiResponse") }
};
api.paths["/api/v1/iam/users/{id}/status"] = {
  put: { tags: iamTag, summary: "更新用户状态", operationId: "updateUserStatus",
    description: "仅 ROLE_ADMIN；支持 ENABLED、DISABLED、LOCKED。", parameters: [id], requestBody: body("UpdateUserStatusRequest"), responses: response("EmptyApiResponse") }
};
const auditParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "size", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }
];
api.paths["/api/v1/iam/audits/logins"] = {
  get: { tags: iamTag, summary: "分页查询登录审计", operationId: "listLoginAudits",
    description: "仅 ROLE_ADMIN，不包含密码和 JWT。", parameters: auditParams, responses: response("LoginAuditPageApiResponse") }
};
api.paths["/api/v1/iam/audits/operations"] = {
  get: { tags: iamTag, summary: "分页查询管理操作审计", operationId: "listOperationAudits",
    description: "仅 ROLE_ADMIN。", parameters: auditParams, responses: response("OperationAuditPageApiResponse") }
};

api.paths["/api/v1/assessments/homeworks/{id}/questions"] = {
  get: { tags: assessmentTag, summary: "查询作业题目", operationId: "listHomeworkQuestions",
    description: "发布期间学生响应不包含标准答案；教师、管理员或作业关闭后可见。", parameters: [id], responses: response("HomeworkQuestionListApiResponse") },
  post: { tags: assessmentTag, summary: "新增作业题目", operationId: "createHomeworkQuestion",
    description: "仅草稿可新增，题目总分不能超过 100。", parameters: [id], requestBody: body("HomeworkQuestionRequest"),
    responses: { ...response("HomeworkQuestionApiResponse"), "201": response("HomeworkQuestionApiResponse")["200"] } }
};
api.paths["/api/v1/assessments/homeworks/{id}/questions/{questionId}"] = {
  put: { tags: assessmentTag, summary: "更新作业题目", operationId: "updateHomeworkQuestion", parameters: [id,
      { name: "questionId", in: "path", required: true, schema: { type: "integer", format: "int64" } }],
    requestBody: body("HomeworkQuestionRequest"), responses: response("HomeworkQuestionApiResponse") },
  delete: { tags: assessmentTag, summary: "删除作业题目", operationId: "deleteHomeworkQuestion", parameters: [id,
      { name: "questionId", in: "path", required: true, schema: { type: "integer", format: "int64" } }],
    responses: response("EmptyApiResponse") }
};
api.paths["/api/v1/assessments/homeworks/{id}/submissions/me/detail"] = {
  get: { tags: assessmentTag, summary: "查询我的逐题答题详情", operationId: "getMySubmissionDetail",
    parameters: [id], responses: response("SubmissionDetailApiResponse") }
};
api.paths["/api/v1/assessments/homeworks/{id}/submissions/{studentId}/detail"] = {
  get: { tags: assessmentTag, summary: "教师查询学生逐题答题详情", operationId: "getStudentSubmissionDetail",
    parameters: [id, { name: "studentId", in: "path", required: true, schema: { type: "integer", format: "int64" } }],
    responses: response("SubmissionDetailApiResponse") }
};
api.paths["/api/v1/assessments/homeworks/{id}/submissions/{studentId}/answers/{questionId}/grade"] = {
  put: { tags: assessmentTag, summary: "教师逐题批改", operationId: "gradeSubmissionAnswer",
    description: "AI 结果只能作为建议；此接口确认最终分数，并使用 expectedSubmissionVersion 防止并发覆盖。",
    parameters: [id,
      { name: "studentId", in: "path", required: true, schema: { type: "integer", format: "int64" } },
      { name: "questionId", in: "path", required: true, schema: { type: "integer", format: "int64" } }],
    requestBody: body("SubmissionAnswerGradeRequest"), responses: response("SubmissionDetailApiResponse") }
};

const schemas = api.components.schemas;
schemas.BooleanApiResponse = { allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { type: "boolean" } } }] };
schemas.EmptyApiResponse = { allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { nullable: true } } }] };
schemas.ChangePasswordRequest = { type: "object", required: ["currentPassword", "newPassword"], properties: {
  currentPassword: { type: "string", maxLength: 72 }, newPassword: { type: "string", minLength: 8, maxLength: 72 } } };
schemas.ResetPasswordRequest = { type: "object", required: ["newPassword"], properties: { newPassword: { type: "string", minLength: 8, maxLength: 72 } } };
schemas.UpdateUserStatusRequest = { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ENABLED", "DISABLED", "LOCKED"] } } };
schemas.LoginAudit = { type: "object", properties: { id: { type: "integer", format: "int64" }, userId: { type: "integer", format: "int64", nullable: true }, username: { type: "string" }, success: { type: "boolean" }, failureReason: { type: "string", nullable: true }, clientIp: { type: "string", nullable: true }, userAgent: { type: "string", nullable: true }, createdTime: { type: "string", format: "date-time" } } };
schemas.OperationAudit = { type: "object", properties: { id: { type: "integer", format: "int64" }, operatorUserId: { type: "integer", format: "int64", nullable: true }, action: { type: "string" }, targetType: { type: "string" }, targetId: { type: "string", nullable: true }, detail: { type: "string", nullable: true }, createdTime: { type: "string", format: "date-time" } } };
const auditPage = item => ({ allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { type: "object", properties: { items: { type: "array", items: { $ref: `#/components/schemas/${item}` } }, page: { type: "integer" }, size: { type: "integer" }, total: { type: "integer", format: "int64" } } } } }] });
schemas.LoginAuditPageApiResponse = auditPage("LoginAudit");
schemas.OperationAuditPageApiResponse = auditPage("OperationAudit");
schemas.QuestionOptionRequest = { type: "object", required: ["key", "content", "sortOrder"], properties: { key: { type: "string", pattern: "^[A-Z0-9]{1,8}$" }, content: { type: "string", maxLength: 1000 }, sortOrder: { type: "integer" } } };
schemas.HomeworkQuestionRequest = { type: "object", required: ["type", "stem", "score", "sortOrder"], properties: {
  type: { type: "string", enum: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] },
  stem: { type: "string", maxLength: 4000 }, score: { type: "number", minimum: 0.01, maximum: 100 }, sortOrder: { type: "integer" },
  options: { type: "array", maxItems: 20, items: { $ref: "#/components/schemas/QuestionOptionRequest" } },
  correctAnswers: { type: "array", maxItems: 20, items: { type: "string" } }, referenceAnswer: { type: "string", maxLength: 5000 }, analysis: { type: "string", maxLength: 5000 } } };
schemas.QuestionOption = { type: "object", properties: { id: { type: "integer", format: "int64" }, key: { type: "string" }, content: { type: "string" }, sortOrder: { type: "integer" } } };
schemas.HomeworkQuestion = { type: "object", properties: { id: { type: "integer", format: "int64" }, homeworkId: { type: "integer", format: "int64" }, type: { type: "string" }, stem: { type: "string" }, score: { type: "number" }, sortOrder: { type: "integer" }, options: { type: "array", items: { $ref: "#/components/schemas/QuestionOption" } }, correctAnswers: { type: "array", items: { type: "string" } }, referenceAnswer: { type: "string", nullable: true }, analysis: { type: "string", nullable: true }, answerVisible: { type: "boolean" } } };
schemas.HomeworkQuestionApiResponse = { allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { $ref: "#/components/schemas/HomeworkQuestion" } } }] };
schemas.HomeworkQuestionListApiResponse = { allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/HomeworkQuestion" } } } }] };
schemas.SubmissionAnswerRequest = { type: "object", required: ["questionId"], properties: { questionId: { type: "integer", format: "int64" }, selectedAnswers: { type: "array", maxItems: 20, items: { type: "string", maxLength: 64 } }, answerText: { type: "string", maxLength: 10000, nullable: true } } };
schemas.HomeworkSubmitRequest = { type: "object", description: "answerContent 和 answers 至少填写一项；作业有结构化题目时必须提交全部 answers。", properties: { answerContent: { type: "string", maxLength: 5000 }, answers: { type: "array", maxItems: 200, items: { $ref: "#/components/schemas/SubmissionAnswerRequest" } } } };
schemas.SubmissionAnswerGradeRequest = { type: "object", required: ["score", "expectedSubmissionVersion"], properties: { score: { type: "number", minimum: 0 }, feedback: { type: "string", maxLength: 2000 }, expectedSubmissionVersion: { type: "integer", minimum: 0 } } };
schemas.SubmissionAnswer = { type: "object", properties: { questionId: { type: "integer", format: "int64" }, questionType: { type: "string" }, stem: { type: "string" }, maxScore: { type: "number" }, selectedAnswers: { type: "array", items: { type: "string" } }, answerText: { type: "string", nullable: true }, autoScore: { type: "number", nullable: true }, manualScore: { type: "number", nullable: true }, finalScore: { type: "number", nullable: true }, gradingStatus: { type: "string", enum: ["AUTO_GRADED", "PENDING_REVIEW", "MANUAL_GRADED"] }, feedback: { type: "string", nullable: true } } };
schemas.SubmissionDetail = { type: "object", properties: { submission: { $ref: "#/components/schemas/HomeworkSubmission" }, answers: { type: "array", items: { $ref: "#/components/schemas/SubmissionAnswer" } } } };
schemas.SubmissionDetailApiResponse = { allOf: [{ $ref: "#/components/schemas/ApiResponseBase" }, { type: "object", properties: { data: { $ref: "#/components/schemas/SubmissionDetail" } } }] };
if (schemas.HomeworkSubmission?.properties?.status) {
  schemas.HomeworkSubmission.properties.status.enum = ["SUBMITTED", "PENDING_GRADING", "GRADED"];
}

fs.writeFileSync(file, JSON.stringify(api, null, 2) + "\n", "utf8");
