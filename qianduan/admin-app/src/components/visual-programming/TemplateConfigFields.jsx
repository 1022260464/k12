import { templateByCode } from "../../data/visualMissionTemplates.js";

export function TemplateConfigFields({ templateCode, config, onChange, disabled = false }) {
  const template = templateByCode(templateCode);
  const value = config || {};

  function update(key, next) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="vp-config-fields">
      <div className="vp-config-banner">
        <strong>{template.name}</strong>
        <p>{template.summary}。参数只影响后续提交评分，不会重算学生历史最好成绩。</p>
      </div>
      <div className="vp-config-grid">
        {template.fields.map((field) => (
          <label key={field.key} className={field.type === "boolean" ? "wide check" : ""}>
            <span>{field.label}</span>
            {field.type === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(value[field.key])}
                disabled={disabled}
                onChange={(event) => update(field.key, event.target.checked)}
              />
            ) : field.type === "select" ? (
              <select
                value={value[field.key] ?? field.defaultValue}
                disabled={disabled}
                onChange={(event) => update(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "number" ? (
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={value[field.key] ?? field.defaultValue}
                disabled={disabled}
                onChange={(event) => update(field.key, Number(event.target.value))}
              />
            ) : field.type === "csv" ? (
              <input
                value={Array.isArray(value[field.key]) ? value[field.key].join(",") : (value[field.key] || "")}
                disabled={disabled}
                onChange={(event) => update(
                  field.key,
                  event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
                )}
              />
            ) : (
              <input
                value={value[field.key] ?? ""}
                disabled={disabled}
                maxLength={64}
                onChange={(event) => update(field.key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <details className="vp-json-view">
        <summary>高级查看 JSON（只读）</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    </div>
  );
}
