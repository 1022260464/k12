import { ArrowLeft, Camera, LoaderCircle, Save, UserRound } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { profileApi } from "../api/client.js";

const stages = [
  ["PRIMARY_LOWER", "小学低年级"],
  ["PRIMARY_UPPER", "小学高年级"],
  ["JUNIOR_HIGH", "初中"],
  ["SENIOR_HIGH", "高中"],
];

const emptyLearning = { schoolStage: "JUNIOR_HIGH", grade: 7, textbook: "", interests: "" };

export function ProfileSettingsPage({ session, requireLogin, navigate, onProfileUpdated }) {
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({ nickname: "", email: "", ...emptyLearning });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileId = useId();

  useEffect(() => {
    if (!session) {
      setAccount(null);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([profileApi.getSelf(), profileApi.getLearningProfile().catch(() => null)])
      .then(([self, learning]) => {
        if (!alive) return;
        setAccount(self);
        setForm({
          nickname: self.nickname || "",
          email: self.email || "",
          schoolStage: learning?.schoolStage || emptyLearning.schoolStage,
          grade: learning?.grade ?? emptyLearning.grade,
          textbook: learning?.textbook || "",
          interests: Array.isArray(learning?.interests) ? learning.interests.join("、") : "",
        });
        onProfileUpdated?.(self);
      })
      .catch((requestError) => {
        if (alive) setError(requestError.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [session]);

  if (!session) {
    return (
      <div className="page inner-page">
        <section className="empty-state">
          <UserRound size={28} />
          <h2>登录后管理个人中心</h2>
          <p>可设置头像、学习档案号相关资料、学段年级，以及密码。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      </div>
    );
  }

  async function saveAll(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const [self] = await Promise.all([
        profileApi.updateSelf({
          nickname: form.nickname.trim(),
          email: form.email.trim() || null,
        }),
        profileApi.updateLearningProfile({
          schoolStage: form.schoolStage,
          grade: Number(form.grade),
          textbook: form.textbook.trim() || null,
          interests: form.interests.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
        }),
      ]);
      setAccount(self);
      onProfileUpdated?.(self);
      setMessage("已保存");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const data = await profileApi.uploadAvatar(file);
      setAccount(data);
      onProfileUpdated?.(data);
      setMessage("头像已更新");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setChangingPassword(true);
    setError("");
    setMessage("");
    try {
      await profileApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPassword(false);
      setMessage("密码已更新");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChangingPassword(false);
    }
  }

  const displayName = account?.nickname || account?.username || "同学";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="page inner-page settings-page">
      <button className="text-button detail-back" type="button" onClick={() => navigate("home")}>
        <ArrowLeft size={16} />返回首页
      </button>

      <header className="page-title">
        <p className="eyebrow">个人中心</p>
        <h1>账号与学习档案</h1>
        <p>在这里维护头像、昵称、学段年级等学习档案；学习报告页只负责展示进度与成绩。</p>
      </header>

      {error && <p className="page-error" role="alert">{error}</p>}
      {message && <p className="settings-toast" role="status">{message}</p>}

      {loading ? (
        <div className="loading-state"><LoaderCircle size={22} />正在加载个人资料</div>
      ) : (
        <section className="settings-panel">
          <div className="settings-identity">
            <div className="settings-avatar">
              {account?.avatarUrl
                ? <img src={account.avatarUrl} alt="" />
                : <span>{initial}</span>}
              <label htmlFor={fileId} className="settings-avatar-btn">
                <Camera size={14} />
                {uploading ? "上传中" : "更换"}
                <input
                  id={fileId}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  hidden
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) uploadAvatar(file);
                  }}
                />
              </label>
            </div>
            <div className="settings-identity-copy">
              <strong>{displayName}</strong>
              <p>用户名 {account?.username || "—"}</p>
              <dl>
                <div>
                  <dt>学习档案号</dt>
                  <dd>{account?.userId ?? "—"}</dd>
                </div>
              </dl>
              <small>学习档案号即用户 ID，与课程进度、作业提交绑定，不可修改。</small>
            </div>
          </div>

          <form className="settings-form" onSubmit={saveAll}>
            <fieldset>
              <legend>基本资料</legend>
              <div className="settings-grid">
                <label>昵称
                  <input
                    value={form.nickname}
                    maxLength={64}
                    onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                    required
                  />
                </label>
                <label>邮箱
                  <input
                    type="email"
                    value={form.email}
                    maxLength={128}
                    placeholder="选填"
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>学习档案</legend>
              <div className="settings-grid">
                <label>学段
                  <select
                    value={form.schoolStage}
                    onChange={(event) => setForm({ ...form, schoolStage: event.target.value })}
                  >
                    {stages.map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>年级
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={form.grade}
                    onChange={(event) => setForm({ ...form, grade: event.target.value })}
                    required
                  />
                </label>
                <label>教材
                  <input
                    value={form.textbook}
                    maxLength={128}
                    placeholder="例如：人教版"
                    onChange={(event) => setForm({ ...form, textbook: event.target.value })}
                  />
                </label>
                <label>兴趣
                  <input
                    value={form.interests}
                    placeholder="用顿号分隔，例如：编程、数学"
                    onChange={(event) => setForm({ ...form, interests: event.target.value })}
                  />
                </label>
              </div>
            </fieldset>

            <div className="settings-actions">
              <button className="button primary" type="submit" disabled={saving}>
                <Save size={16} />{saving ? "保存中…" : "保存全部"}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "收起密码修改" : "修改登录密码"}
              </button>
            </div>
          </form>

          {showPassword && (
            <form className="settings-form settings-password" onSubmit={changePassword}>
              <fieldset>
                <legend>修改密码</legend>
                <div className="settings-grid">
                  <label>当前密码
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                      required
                    />
                  </label>
                  <label>新密码
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                      required
                    />
                  </label>
                  <label>确认新密码
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                      required
                    />
                  </label>
                </div>
              </fieldset>
              <div className="settings-actions">
                <button className="button secondary" type="submit" disabled={changingPassword}>
                  {changingPassword ? "提交中…" : "更新密码"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
