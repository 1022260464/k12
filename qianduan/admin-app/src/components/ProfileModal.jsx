import { Camera, LoaderCircle, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { profileApi } from "../api/client.js";
import { ChangePasswordModal } from "./ChangePasswordModal.jsx";
import { Modal } from "./Modal.jsx";

export function ProfileModal({ session, isAdmin, notify, onClose, onProfileUpdated }) {
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({ nickname: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [error, setError] = useState("");
  const fileId = useId();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    profileApi.getSelf()
      .then((self) => {
        if (!alive) return;
        setAccount(self);
        setForm({ nickname: self.nickname || "", email: self.email || "" });
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

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const self = await profileApi.updateSelf({
        nickname: form.nickname.trim(),
        email: form.email.trim() || null,
      });
      setAccount(self);
      onProfileUpdated?.(self);
      notify?.("个人资料已保存");
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = await profileApi.uploadAvatar(file);
      setAccount(data);
      onProfileUpdated?.(data);
      notify?.("头像已更新");
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "error");
    } finally {
      setUploading(false);
    }
  }

  const displayName = account?.nickname || account?.username || session?.username || "用户";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <>
      <Modal
        title="个人中心"
        description="维护头像、昵称、邮箱和登录密码。"
        onClose={onClose}
        width={640}
        className="profile-modal"
      >
        <div className="profile-modal-body">
          {error && <p className="form-error" role="alert">{error}</p>}

          {loading ? (
            <div className="loading-state"><LoaderCircle size={22} />正在加载个人资料</div>
          ) : (
            <div className="profile-panel profile-modal-panel">
              <div className="profile-identity">
                <div className="profile-avatar">
                  {account?.avatarUrl
                    ? <img src={account.avatarUrl} alt="" />
                    : <span>{initial}</span>}
                  <label htmlFor={fileId} className="profile-avatar-btn">
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
                <div className="profile-identity-copy">
                  <strong>{displayName}</strong>
                  <p>用户名 {account?.username || session?.username || "—"}</p>
                  <small>{isAdmin ? "系统管理员" : "教师"} · 编号 {account?.userId ?? account?.id ?? "—"}</small>
                </div>
              </div>

              <form className="entity-form profile-form" onSubmit={saveProfile}>
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
                <div className="form-actions profile-actions">
                  <button className="button primary" type="submit" disabled={saving}>
                    <Save size={16} />{saving ? "保存中…" : "保存资料"}
                  </button>
                  <button className="button ghost" type="button" onClick={() => setShowPasswordModal(true)}>
                    修改登录密码
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Modal>
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          notify={notify}
        />
      )}
    </>
  );
}
