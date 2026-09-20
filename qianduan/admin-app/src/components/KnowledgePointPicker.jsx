import { Check, ChevronDown, Maximize2, Pin, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal.jsx";

const STAGE_SHORT = {
  PRIMARY_UPPER: "小学高",
  LOW_PRIMARY: "小学低",
  HIGH_PRIMARY: "小学高",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
  小学低年级: "小学低",
  小学高年级: "小学高",
  初中: "初中",
  高中: "高中",
};

function pointStageShort(point) {
  if (Array.isArray(point?.stages) && point.stages.length) {
    return point.stages
      .map((item) => STAGE_SHORT[item] || item)
      .filter(Boolean)
      .join("·");
  }
  if (!point?.stage) return "";
  return String(point.stage)
    .split(/[、,/|;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => STAGE_SHORT[item] || item)
    .join("·");
}

/**
 * 知识点挂载选择器：按大类分组、勾选置顶、放大面板。
 * mode=multi 用于章节 COVERS；mode=single 用于资料主知识点。
 * layout=cards 卡片网格；layout=accordion 分类可折叠 + 小勾选框。
 */
export function KnowledgePointPicker({
  points = [],
  selectedCodes = [],
  onChange,
  mode = "multi",
  aiSuggestedCodes = [],
  filterPlaceholder = "搜索大类或主题名称",
  emptyText = "暂无知识点目录",
  readOnly = false,
  layout = "cards",
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const aiSet = useMemo(() => new Set(aiSuggestedCodes), [aiSuggestedCodes]);
  const isAccordion = layout === "accordion";

  const ordered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matched = !q
      ? points
      : points.filter((point) =>
        `${point.categoryTitle || ""} ${point.title || ""} ${point.code || ""}`
          .toLowerCase()
          .includes(q));

    const rank = (point) => {
      const code = point.code;
      if (selectedSet.has(code)) return 0;
      if (aiSet.has(code)) return 1;
      return 2;
    };
    return [...matched].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      const ca = a.categoryTitle || "";
      const cb = b.categoryTitle || "";
      if (ca !== cb) return ca.localeCompare(cb, "zh");
      return String(a.title || a.code).localeCompare(String(b.title || b.code), "zh");
    });
  }, [points, filter, selectedSet, aiSet]);

  const categoryStats = useMemo(() => {
    const map = new Map();
    for (const point of points) {
      const key = point.categoryTitle || point.categoryCode || "未分类";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh"));
  }, [points]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const point of ordered) {
      const key = point.categoryTitle || point.categoryCode || "未分类";
      if (!isAccordion && activeCategory !== "全部" && key !== activeCategory) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(point);
    }
    return [...map.entries()];
  }, [ordered, activeCategory, isAccordion]);

  const selectedPoints = useMemo(
    () => selectedCodes
      .map((code) => points.find((point) => point.code === code))
      .filter(Boolean),
    [selectedCodes, points],
  );

  // 搜索时自动展开有结果的分类；AI 建议到来时展开相关分类
  useEffect(() => {
    if (!isAccordion) return;
    const next = new Set();
    if (filter.trim()) {
      groups.forEach(([category]) => next.add(category));
    } else {
      for (const point of points) {
        if (selectedSet.has(point.code) || aiSet.has(point.code)) {
          next.add(point.categoryTitle || point.categoryCode || "未分类");
        }
      }
    }
    if (next.size) {
      setOpenCategories((current) => {
        const merged = new Set(current);
        next.forEach((key) => merged.add(key));
        return merged;
      });
    }
  }, [isAccordion, filter, aiSuggestedCodes, groups, points, selectedSet, aiSet]);

  function toggle(code) {
    if (readOnly) return;
    if (mode === "single") {
      onChange?.(selectedCodes.includes(code) ? [] : [code]);
      return;
    }
    if (selectedCodes.includes(code)) {
      onChange?.(selectedCodes.filter((item) => item !== code));
    } else {
      onChange?.([code, ...selectedCodes.filter((item) => item !== code)]);
    }
  }

  function removeSelected(code) {
    if (readOnly) return;
    onChange?.((selectedCodes || []).filter((item) => item !== code));
  }

  function pinSelectedToFront() {
    if (readOnly || mode !== "multi" || !selectedCodes.length) return;
    onChange?.([...selectedCodes]);
  }

  function toggleCategoryFold(category) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function renderPointCard(point) {
    const checked = selectedSet.has(point.code);
    const aiHit = aiSet.has(point.code);
    const stage = pointStageShort(point);
    return (
      <label
        key={point.code}
        className={`kp-card${checked ? " is-checked" : ""}${aiHit ? " is-ai" : ""}`}
      >
        <input
          type={mode === "single" ? "radio" : "checkbox"}
          name={mode === "single" ? "knowledge-point-single" : undefined}
          checked={checked}
          disabled={readOnly}
          onChange={() => toggle(point.code)}
        />
        <span className="kp-card-body">
          <span className="kp-card-title">
            {point.title || point.code}
            {checked ? <Check size={13} className="kp-card-check" /> : null}
            {aiHit ? <em className="knowledge-ai-tag">AI</em> : null}
          </span>
          <span className="kp-card-meta">
            {stage ? <span className="kp-stage">{stage}</span> : null}
            <code>{point.code}</code>
          </span>
        </span>
      </label>
    );
  }

  function renderCheckRow(point) {
    const checked = selectedSet.has(point.code);
    const aiHit = aiSet.has(point.code);
    return (
      <label
        key={point.code}
        className={`kp-check-row${checked ? " is-checked" : ""}${aiHit ? " is-ai" : ""}`}
      >
        <input
          type={mode === "single" ? "radio" : "checkbox"}
          name={mode === "single" ? "knowledge-point-acc" : undefined}
          checked={checked}
          disabled={readOnly}
          onChange={() => toggle(point.code)}
        />
        <span className="kp-check-title">{point.title || point.code}</span>
        {aiHit ? <em className="knowledge-ai-tag">AI</em> : null}
      </label>
    );
  }

  function renderAccordion() {
    if (!points.length) {
      return <p className="binding-empty">{emptyText}</p>;
    }
    const searching = Boolean(filter.trim());
    return (
      <div className="knowledge-picker is-accordion">
        <label className="kp-search">
          <Search size={14} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={filterPlaceholder}
          />
        </label>
        {selectedPoints.length > 0 && (
          <div className="kp-chip-row">
            {selectedPoints.slice(0, 6).map((point) => (
              <button
                key={point.code}
                type="button"
                className="kp-chip"
                title={point.code}
                onClick={() => removeSelected(point.code)}
                disabled={readOnly}
              >
                <span>{point.title || point.code}</span>
                {!readOnly ? <X size={12} /> : null}
              </button>
            ))}
            {selectedPoints.length > 6 && (
              <span className="kp-chip-more">+{selectedPoints.length - 6}</span>
            )}
          </div>
        )}
        <div className="kp-accordion-list">
          {groups.map(([category, items]) => {
            const open = searching || openCategories.has(category);
            const selectedCount = items.filter((item) => selectedSet.has(item.code)).length;
            return (
              <div key={category} className={`kp-acc-block${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="kp-acc-head"
                  aria-expanded={open}
                  onClick={() => toggleCategoryFold(category)}
                >
                  <span className="kp-acc-name">{category}</span>
                  <em className="kp-acc-count">
                    {selectedCount > 0 ? `${selectedCount}/` : ""}{items.length}
                  </em>
                  <ChevronDown size={14} className="kp-acc-chevron" />
                </button>
                {open && (
                  <div className="kp-acc-body">
                    {items.map(renderCheckRow)}
                  </div>
                )}
              </div>
            );
          })}
          {!groups.length && <p className="binding-empty">无匹配知识点</p>}
        </div>
        <p className="binding-hint">已选 {selectedCodes.length} 个 · 点分类名称可展开或收起</p>
      </div>
    );
  }

  function renderCompact() {
    if (!points.length) {
      return <p className="binding-empty">{emptyText}</p>;
    }
    return (
      <div className="knowledge-picker is-compact">
        <div className="knowledge-picker-toolbar">
          <label className="kp-search">
            <Search size={14} />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={filterPlaceholder}
            />
          </label>
          <div className="knowledge-picker-actions">
            {mode === "multi" && (
              <button
                className="button ghost compact"
                type="button"
                title="把已勾选的知识点排到列表最前"
                onClick={pinSelectedToFront}
                disabled={readOnly || !selectedCodes.length}
              >
                <Pin size={14} />勾选置顶
              </button>
            )}
            <button
              className="button ghost compact"
              type="button"
              title="放大选择面板，便于浏览数百个知识点"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 size={14} />放大选择
            </button>
          </div>
        </div>
        {selectedPoints.length > 0 && (
          <div className="kp-chip-row">
            {selectedPoints.slice(0, 8).map((point) => (
              <button
                key={point.code}
                type="button"
                className="kp-chip"
                title={point.code}
                onClick={() => removeSelected(point.code)}
                disabled={readOnly}
              >
                <span>{point.title || point.code}</span>
                {!readOnly ? <X size={12} /> : null}
              </button>
            ))}
            {selectedPoints.length > 8 && (
              <span className="kp-chip-more">+{selectedPoints.length - 8}</span>
            )}
          </div>
        )}
        <div className="knowledge-point-list kp-compact-list">
          {groups.map(([category, items]) => (
            <div className="knowledge-category-block" key={category}>
              <p className="knowledge-category-title">{category}<span>{items.length}</span></p>
              <div className="kp-compact-grid">
                {items.slice(0, filter.trim() ? items.length : 12).map(renderPointCard)}
              </div>
              {!filter.trim() && items.length > 12 && (
                <button
                  type="button"
                  className="kp-more-link"
                  onClick={() => {
                    setActiveCategory(category);
                    setExpanded(true);
                  }}
                >
                  查看该大类全部 {items.length} 个 →
                </button>
              )}
            </div>
          ))}
          {!groups.length && <p className="binding-empty">无匹配知识点</p>}
        </div>
        <p className="binding-hint">
          {mode === "single"
            ? `已选：${selectedPoints[0]?.title || selectedCodes[0] || "未选择"}`
            : `已选 ${selectedCodes.length} 个 · 目录 ${points.length} 个 · 点「放大选择」可按大类浏览全部`}
        </p>
      </div>
    );
  }

  function renderExpanded() {
    return (
      <div className="kp-workspace">
        <aside className="kp-sidebar">
          <p className="kp-sidebar-label">大类</p>
          <button
            type="button"
            className={`kp-cat-btn${activeCategory === "全部" ? " is-active" : ""}`}
            onClick={() => setActiveCategory("全部")}
          >
            <span>全部</span>
            <em>{points.length}</em>
          </button>
          {categoryStats.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={`kp-cat-btn${activeCategory === name ? " is-active" : ""}`}
              onClick={() => setActiveCategory(name)}
            >
              <span>{name}</span>
              <em>{count}</em>
            </button>
          ))}
        </aside>

        <section className="kp-main">
          <div className="kp-main-toolbar">
            <label className="kp-search">
              <Search size={15} />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={filterPlaceholder}
                autoFocus
              />
            </label>
            <div className="knowledge-picker-actions">
              {mode === "multi" && (
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={pinSelectedToFront}
                  disabled={!selectedCodes.length}
                >
                  <Pin size={14} />勾选置顶
                </button>
              )}
            </div>
          </div>

          {selectedPoints.length > 0 && (
            <div className="kp-selected-panel">
              <div className="kp-selected-head">
                <strong>已选 {selectedPoints.length}</strong>
                {mode === "multi" && (
                  <button type="button" className="kp-clear" onClick={() => onChange?.([])} disabled={readOnly}>
                    清空
                  </button>
                )}
              </div>
              <div className="kp-chip-row">
                {selectedPoints.map((point) => (
                  <button
                    key={point.code}
                    type="button"
                    className="kp-chip"
                    title={point.code}
                    onClick={() => removeSelected(point.code)}
                    disabled={readOnly}
                  >
                    <span>{point.title || point.code}</span>
                    {!readOnly ? <X size={12} /> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="kp-scroll">
            {groups.map(([category, items]) => (
              <div className="kp-section" key={category}>
                <header className="kp-section-head">
                  <h3>{category}</h3>
                  <span>{items.length} 个</span>
                </header>
                <div className="kp-grid">
                  {items.map(renderPointCard)}
                </div>
              </div>
            ))}
            {!groups.length && <p className="binding-empty">无匹配知识点，试试换个关键词或大类</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {isAccordion ? renderAccordion() : renderCompact()}
      {!isAccordion && expanded && (
        <Modal
          title="选择知识点"
          description={mode === "single"
            ? "左侧选大类，右侧点选一个主知识点。AI 建议已标黄并靠前。"
            : "左侧选大类，右侧多选。已勾选与 AI 建议靠前；点芯片可取消。"}
          onClose={() => setExpanded(false)}
          width={1080}
          layer={120}
          className="modal-knowledge-picker"
        >
          <div className="kp-modal-shell">
            {renderExpanded()}
            <div className="kp-modal-footer">
              <span className="binding-hint">
                {mode === "single"
                  ? `当前：${selectedPoints[0]?.title || "未选择"}`
                  : `已选 ${selectedCodes.length} / 目录 ${points.length}`}
              </span>
              <button className="button primary" type="button" onClick={() => setExpanded(false)}>
                完成选择
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** AI 建议合并：新建议勾选并排到最前。 */
export function mergeAiSuggestedCodes(currentSelected, suggested) {
  const incoming = (suggested || []).filter(Boolean);
  if (!incoming.length) return { codes: currentSelected || [], pinned: [] };
  const rest = (currentSelected || []).filter((code) => !incoming.includes(code));
  return { codes: [...incoming, ...rest], pinned: incoming };
}

export function AiSuggestButton({ suggesting, onClick, disabled }) {
  return (
    <button
      className="button primary compact"
      type="button"
      disabled={disabled || suggesting}
      title="根据导语/简介自动勾选相关知识点，并置顶显示；不会直接写库"
      onClick={onClick}
    >
      <Sparkles size={15} />{suggesting ? "建议中..." : "AI 建议"}
    </button>
  );
}
