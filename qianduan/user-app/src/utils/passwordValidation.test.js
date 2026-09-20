import assert from "node:assert/strict";
import test from "node:test";

import { validateRegisterForm, mapUniqueIdentityError } from "./passwordValidation.js";

const validForm = {
  username: "student01",
  password: "student123",
  nickname: "小明",
  email: "",
};

test("注册允许正常昵称中的引号和反斜杠", () => {
  assert.equal(validateRegisterForm({ ...validForm, nickname: "O'Connor\\一班" }), "");
});

test("注册拒绝昵称中的控制字符", () => {
  assert.equal(validateRegisterForm({ ...validForm, nickname: "小明\n同学" }), "昵称不能包含控制字符");
});

test("注册允许不填写邮箱", () => {
  assert.equal(validateRegisterForm(validForm), "");
});

test("唯一冲突映射到对应用户名字段", () => {
  const mapped = mapUniqueIdentityError("用户名已存在");
  assert.equal(mapped.fields.username, "用户名已存在，请更换");
  assert.equal(mapped.form, "");
});

test("唯一冲突映射到对应邮箱字段", () => {
  const mapped = mapUniqueIdentityError("邮箱已被使用");
  assert.equal(mapped.fields.email, "邮箱已被使用，请更换或留空");
  assert.equal(mapped.form, "");
});

test("用户名与邮箱同时冲突时一并映射", () => {
  const mapped = mapUniqueIdentityError("用户名已存在；邮箱已被使用");
  assert.equal(mapped.fields.username, "用户名已存在，请更换");
  assert.equal(mapped.fields.email, "邮箱已被使用，请更换或留空");
  assert.equal(mapped.form, "");
});
