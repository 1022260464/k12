import { ArrowRight } from "lucide-react";

/**
 * 未登录占位统一升级为「登录价值展示」：讲清登录后能得到什么，
 * 替代过去"一句话 + 按钮"的空泛占位。features: [{ icon, title, text }]。
 * children 可放页面专属的预览内容（如热门问题、示例卡片）。
 */
export function AuthGateShowcase({
  icon: Icon,
  title,
  description,
  features = [],
  cta = "立即登录",
  onLogin,
  footnote,
  children,
}) {
  return (
    <section className="auth-gate">
      <div className="auth-gate-intro">
        {Icon && <span className="auth-gate-icon"><Icon size={24} /></span>}
        <div className="auth-gate-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="button primary" type="button" onClick={onLogin}>{cta}<ArrowRight size={16} /></button>
      </div>
      {features.length > 0 && (
        <div className="auth-gate-features">
          {features.map(({ icon: FeatureIcon, title: featureTitle, text }) => (
            <article key={featureTitle}>
              {FeatureIcon && <FeatureIcon size={17} />}
              <strong>{featureTitle}</strong>
              <span>{text}</span>
            </article>
          ))}
        </div>
      )}
      {children}
      {footnote && <p className="auth-gate-footnote">{footnote}</p>}
    </section>
  );
}
