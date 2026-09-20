import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  GitBranch,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { knowledgeGraphApi, coursesApi } from "../api/client.js";
import {
  KnowledgeForceGraph,
  applyCategoryVisibility,
  buildVisiblePoints,
  describeGraphComposition,
  resolveFocusCategoryKey,
} from "../components/KnowledgeForceGraph.jsx";
import { KnowledgeGraphStats } from "../components/KnowledgeGraphStats.jsx";
import {
  AiSuggestButton,
  KnowledgePointPicker,
  mergeAiSuggestedCodes,
} from "../components/KnowledgePointPicker.jsx";
import { Modal } from "../components/Modal.jsx";
import { readKnowledgeGraphOverviewCache } from "../utils/knowledgeGraphCache.js";

const LOOP_STEPS = [
  {
    key: "ask",
    title: "提问讲解",
    desc: "学生提问后，助教结合已学进度与相关知识点作答",
    ready: (loop) => loop?.graphReady && loop?.hasKnowledgePoints,
  },
  {
    key: "rag",
    title: "资料对照",
    desc: "已入库的教学资料可被引用，回答更贴近课堂内容",
    ready: (loop) => loop?.hasExplains,
  },
  {
    key: "mastery",
    title: "小测掌握度",
    desc: "课堂小测结果会反映到各知识点的掌握情况",
    ready: (loop) => loop?.hasKnowledgePoints,
  },
  {
    key: "nav",
    title: "先修 / 下一知识点",
    desc: "根据先修关系，提示薄弱基础与可继续学习的知识点",
    ready: (loop) => loop?.hasPrerequisiteEdges,
  },
  {
    key: "covers",
    title: "章节覆盖",
    desc: "课程章节绑定知识点后，学生可从课程进入对应内容",
    ready: (loop) => loop?.hasChapterCovers,
  },
];

const FOCUS_MODE_OPTIONS = [
  {
    value: "neighborhood",
    label: "相关范围",
    hint: "当前知识点 + 有连线的相关点",
  },
  {
    value: "sample",
    label: "各类抽样",
    hint: "每个分类各抽几个，看整体",
  },
  {
    value: "all",
    label: "筛选全部",
    hint: "当前学段/分类筛选下的全部点",
  },
];

const STAGE_OPTIONS = [
  { value: "", label: "全部学段" },
  { value: "小学低年级", label: "小学低年级" },
  { value: "小学高年级", label: "小学高年级" },
  { value: "初中", label: "初中" },
  { value: "高中", label: "高中" },
];

/** 节点适用学段（支持多选；兼容旧的单个 stage 字符串）。 */
function pointStages(point) {
  if (Array.isArray(point?.stages) && point.stages.length) {
    return point.stages.map((item) => String(item).trim()).filter(Boolean);
  }
  if (point?.stage) {
    return String(point.stage)
      .split(/[、,/|;；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pointStageLabel(point) {
  return pointStages(point).join("、");
}

function pointMatchesStage(point, filter) {
  if (!filter) return true;
  return pointStages(point).includes(filter);
}

function stagesOverlap(a, b) {
  const left = Array.isArray(a) ? a : pointStages({ stage: a });
  const right = Array.isArray(b) ? b : pointStages({ stage: b, stages: Array.isArray(b) ? b : undefined });
  if (!left.length || !right.length) return false;
  const set = new Set(right);
  return left.some((item) => set.has(item));
}

const RELATION_LABELS = {
  PREREQUISITE_OF: "先修",
  RELATED_TO: "相关拓展",
  COVERS: "章节覆盖",
  EXPLAINS: "资料讲解",
  HAS_CHILD: "同属一类",
};

const RELATION_PRIORITY = {
  PREREQUISITE_OF: 0,
  RELATED_TO: 1,
  HAS_CHILD: 2,
};

function relationLabel(relation) {
  const key = String(relation || "").toUpperCase();
  return RELATION_LABELS[key] || "关联";
}

/**
 * overview 不含 CATEGORY 节点时，用知识点上的 categoryCode → categoryTitle 反查中文名。
 */
function buildCategoryTitleByCode(points) {
  const map = new Map();
  for (const point of points || []) {
    if (point.kind === "CATEGORY" && point.code) {
      map.set(point.code, point.title || point.code);
    }
    if (point.categoryCode) {
      const title = point.categoryTitle || map.get(point.categoryCode);
      if (title) map.set(point.categoryCode, title);
      else if (!map.has(point.categoryCode)) map.set(point.categoryCode, point.categoryCode);
    }
  }
  return map;
}

function isCategoryEntity(code, point, categoryTitleByCode) {
  if (point?.kind === "CATEGORY") return true;
  const value = String(code || "");
  if (value.startsWith("category.")) return true;
  if (!point && categoryTitleByCode.has(value)) return true;
  return false;
}

/** 解析当前选中：知识点或（overview 未下发的）分类节点 */
function resolveSelectedEntity(code, points, categoryTitleByCode) {
  if (!code) return null;
  const found = (points || []).find((point) => point.code === code);
  if (found) {
    return {
      ...found,
      kind: found.kind === "CATEGORY" ? "CATEGORY" : "TOPIC",
      title: found.title || categoryTitleByCode.get(found.code) || found.code,
    };
  }
  if (isCategoryEntity(code, null, categoryTitleByCode)) {
    const title = categoryTitleByCode.get(code) || code;
    return {
      code,
      title,
      kind: "CATEGORY",
      categoryCode: code,
      categoryTitle: title,
      stage: "",
      difficulty: null,
    };
  }
  return null;
}

/**
 * 从 overview.edges 本地推导直接邻居（按 code 去重）。
 * 分类与知识点分开标记；分类优先展示中文名，绝不回退成裸编码（有映射时）。
 */
function buildDirectNeighbors(selectedCode, edges, points, categoryTitleByCode) {
  if (!selectedCode) return [];
  const byCode = new Map((points || []).map((point) => [point.code, point]));
  const map = new Map();

  for (const edge of edges || []) {
    const from = edge.fromCode || edge.from;
    const to = edge.toCode || edge.to;
    const relation = String(edge.relation || "").toUpperCase();
    if (!from || !to || !relation) continue;

    let other = null;
    let direction = null;
    if (from === selectedCode) {
      other = to;
      direction = "OUT";
    } else if (to === selectedCode) {
      other = from;
      direction = "IN";
    } else {
      continue;
    }
    if (!other || other === selectedCode) continue;

    const point = byCode.get(other);
    const category = isCategoryEntity(other, point, categoryTitleByCode);
    const title = point?.title
      || (category ? categoryTitleByCode.get(other) : null)
      || other;
    const existing = map.get(other);
    if (!existing) {
      map.set(other, {
        code: other,
        title,
        kind: category ? "CATEGORY" : "TOPIC",
        relations: [{ relation, direction }],
      });
      continue;
    }
    if ((!existing.title || existing.title === existing.code) && title && title !== other) {
      existing.title = title;
    }
    const duplicated = existing.relations.some(
      (item) => item.relation === relation && item.direction === direction,
    );
    if (!duplicated) {
      existing.relations.push({ relation, direction });
    }
  }

  return [...map.values()].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "CATEGORY" ? -1 : 1;
    const leftRank = Math.min(...left.relations.map((item) => RELATION_PRIORITY[item.relation] ?? 9));
    const rightRank = Math.min(...right.relations.map((item) => RELATION_PRIORITY[item.relation] ?? 9));
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(left.title || left.code).localeCompare(String(right.title || right.code), "zh");
  });
}

function neighborRelationText(row, selectedKind) {
  return (row.relations || []).map((item) => {
    let label = relationLabel(item.relation);
    if (item.relation === "HAS_CHILD") {
      if (row.kind === "CATEGORY") label = "所属分类";
      else if (selectedKind === "CATEGORY") label = "下属知识点";
      else label = "同属一类";
    }
    const dir = item.direction === "OUT" ? "由此出发" : "指向当前";
    return `${label} · ${dir}`;
  }).join("；");
}

function jumpTargetHint(kind) {
  if (kind === "CATEGORY") {
    return "跳转后：单分类展开（以该分类为入口）";
  }
  return "跳转后：知识点聚焦";
}

function courseLabel(chapter) {
  return chapter?.courseTitle || (chapter?.courseId ? `课程 ${chapter.courseId}` : "未命名课程");
}

function chapterLabel(chapter) {
  return chapter?.title || (chapter?.chapterId ? `章节 ${chapter.chapterId}` : "未命名章节");
}

const EMPTY_POINT_FORM = {
  code: "",
  title: "",
  stages: ["初中"],
  difficulty: 2,
  categoryCode: "",
  categoryTitle: "",
  kind: "TOPIC",
  parentCode: "",
  prerequisiteCodes: [],
  relatedCodes: [],
};

/** 从 overview.edges 还原某知识点的先修 / 相关编码（编辑回填） */
function relationCodesFromEdges(code, edges) {
  const prerequisiteCodes = [];
  const relatedCodes = [];
  const seenPrereq = new Set();
  const seenRelated = new Set();
  for (const edge of edges || []) {
    const from = edge.fromCode || edge.from;
    const to = edge.toCode || edge.to;
    const relation = String(edge.relation || "").toUpperCase();
    if (!from || !to || !relation) continue;
    if (relation === "PREREQUISITE_OF" && to === code && from !== code) {
      if (!seenPrereq.has(from)) {
        seenPrereq.add(from);
        prerequisiteCodes.push(from);
      }
    }
    if (relation === "RELATED_TO" && (from === code || to === code)) {
      const other = from === code ? to : from;
      if (other !== code && !seenRelated.has(other)) {
        seenRelated.add(other);
        relatedCodes.push(other);
      }
    }
  }
  return { prerequisiteCodes, relatedCodes };
}

/** 本地即时匹配关联点，不依赖大模型，保证「AI 建议」可点可用。 */
function localSuggestRelationCodes({
  title,
  categoryTitle,
  categoryCode,
  stages,
  points,
  selfCode,
  mode = "related",
  limit = 6,
}) {
  const hay = `${title || ""} ${categoryTitle || ""}`.toLowerCase();
  const self = String(selfCode || "").trim().toLowerCase();
  if (!hay.trim() || !points?.length) return [];
  const formStages = Array.isArray(stages) ? stages : pointStages({ stage: stages });
  const scored = [];
  for (const point of points) {
    if (point.kind === "CATEGORY") continue;
    const code = String(point.code || "");
    if (!code || code.toLowerCase() === self) continue;
    let score = 0;
    const pointTitle = String(point.title || "").toLowerCase();
    const category = String(point.categoryTitle || "").toLowerCase();
    const pointCatCode = String(point.categoryCode || "");
    if (categoryCode && pointCatCode === categoryCode) score += mode === "related" ? 8 : 6;
    if (categoryTitle && category && category === String(categoryTitle).toLowerCase()) score += 3;
    if (formStages.length && stagesOverlap(formStages, pointStages(point))) score += 2;
    if (pointTitle && hay.includes(pointTitle)) score += 10;
    for (const token of pointTitle.split(/[\s/、，,；;：:()（）\[\]|-]+/).filter((t) => t.length >= 2)) {
      if (hay.includes(token)) {
        score += mode === "prerequisite" ? 4 : 3;
        break;
      }
    }
    if (mode === "prerequisite") {
      const diff = Number(point.difficulty);
      if (Number.isFinite(diff) && diff <= 2) score += 2;
      if (/基础|入门|概述|入门|变量|顺序|分支|循环|数据/.test(pointTitle)) score += 3;
    } else if (/拓展|应用|进阶|案例|实践|项目/.test(pointTitle)) {
      score += 2;
    }
    if (score > 0) scored.push({ code, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, limit).map((item) => item.code);
}

/** 关联选择：下拉折叠，展开后可搜索 / 分类勾选 / AI 建议 */
function RelationPickerDropdown({
  label,
  hint,
  points = [],
  selectedCodes = [],
  aiSuggestedCodes = [],
  onChange,
  suggesting = false,
  onSuggest,
  disabled = false,
  filterPlaceholder,
  emptyText,
  open,
  onOpenChange,
  defaultOpen = false,
}) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = typeof open === "boolean" ? open : innerOpen;
  function setOpen(next) {
    if (typeof onOpenChange === "function") onOpenChange(next);
    else setInnerOpen(next);
  }
  const summary = useMemo(() => {
        if (!selectedCodes.length) return "还没选，点这里展开后勾选";
    const titles = selectedCodes
      .map((code) => points.find((point) => point.code === code)?.title || code)
      .filter(Boolean);
    const head = titles.slice(0, 3).join("、");
    return titles.length > 3
      ? `已选 ${selectedCodes.length} 个：${head} 等`
      : `已选 ${selectedCodes.length} 个：${head}`;
  }, [selectedCodes, points]);

  return (
    <div className={`kg-relation-dropdown${isOpen ? " is-open" : ""}`}>
      <div className="kg-relation-toggle-row">
        <button
          type="button"
          className="kg-relation-toggle"
          aria-expanded={isOpen}
          onClick={() => setOpen(!isOpen)}
        >
          <span className="kg-relation-toggle-text">
            <strong>{label}</strong>
            <small>{summary}</small>
          </span>
          <ChevronDown size={16} className="kg-relation-chevron" />
        </button>
        <AiSuggestButton
          suggesting={suggesting}
          onClick={onSuggest}
          disabled={disabled}
        />
      </div>
      {isOpen && (
        <div className="kg-relation-panel">
          <small className="kg-relation-panel-hint">{hint}</small>
          <KnowledgePointPicker
            points={points}
            selectedCodes={selectedCodes}
            aiSuggestedCodes={aiSuggestedCodes}
            onChange={onChange}
            mode="multi"
            layout="accordion"
            filterPlaceholder={filterPlaceholder}
            emptyText={emptyText}
          />
        </div>
      )}
    </div>
  );
}

/** 中文标题 → 编码片段（无拼音库时的可读兜底） */
const TITLE_CODE_KEYWORDS = [
  ["机器学习", "machine_learning"],
  ["生成式", "generative"],
  ["提示词", "prompt"],
  ["计算机", "computing"],
  ["循环", "loop"],
  ["条件", "condition"],
  ["变量", "variable"],
  ["函数", "function"],
  ["算法", "algorithm"],
  ["排序", "sorting"],
  ["搜索", "search"],
  ["列表", "list"],
  ["数组", "array"],
  ["字符串", "string"],
  ["监督", "supervised"],
  ["隐私", "privacy"],
  ["数据", "data"],
  ["编程", "programming"],
  ["程序", "program"],
  ["图像", "image"],
  ["视觉", "vision"],
  ["伦理", "ethics"],
  ["安全", "safety"],
  ["机器人", "robotics"],
  ["测试", "test"],
  ["入门", "intro"],
  ["基础", "basics"],
  ["结构", "structure"],
  ["判断", "branch"],
  ["递归", "recursion"],
  ["网络", "network"],
  ["智能", "ai"],
];

function categoryPrefix(categoryCode) {
  const raw = String(categoryCode || "").trim();
  if (!raw) return "custom";
  return raw.replace(/^category\./, "") || "custom";
}

/** 由标题 + 分类生成可读编码，如 computing.test_loop */
function slugifyPointCode(title, categoryCode) {
  const text = String(title || "").trim();
  const prefix = categoryPrefix(categoryCode);
  const parts = [];
  for (const [zh, en] of TITLE_CODE_KEYWORDS) {
    if (text.includes(zh) && !parts.includes(en)) parts.push(en);
  }
  const asciiTokens = text.toLowerCase().match(/[a-z][a-z0-9_]{1,}/g) || [];
  for (const token of asciiTokens) {
    if (!parts.includes(token)) parts.push(token);
  }
  let slug = parts.slice(0, 4).join("_").replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!slug || slug.length < 2) slug = "topic";
  slug = slug.slice(0, 40);
  return `${prefix}.${slug}`.slice(0, 64);
}

/** 从标题提取用于编码比对的关键词片段（重名/关键词检索走编码） */
function titleCodeTokens(title, categoryCode) {
  const code = slugifyPointCode(title, categoryCode).toLowerCase();
  const slug = code.includes(".") ? code.slice(code.indexOf(".") + 1) : code;
  const tokens = slug.split(/[._-]+/).filter((token) => token.length >= 2);
  return { code, slug, tokens };
}

/**
 * 关键词/编码冲突：精确重名、编码撞车、编码关键词重合。
 * 不含 AI 语义相似。
 */
function findCodeKeywordConflicts({ title, code, categoryCode, points, excludeCode }) {
  const blockers = [];
  const keywordHits = [];
  const self = String(excludeCode || "").trim().toLowerCase();
  const titleNorm = String(title || "").trim().toLowerCase();
  const codeNorm = String(code || "").trim().toLowerCase();
  if (!titleNorm && !codeNorm) return { blockers, keywordHits };

  const { tokens: checkTokens } = titleCodeTokens(title, categoryCode);

  for (const point of points || []) {
    if (!point || point.kind === "CATEGORY") continue;
    const pointCode = String(point.code || "").trim().toLowerCase();
    if (!pointCode || pointCode === self) continue;
    const pointTitle = String(point.title || "").trim().toLowerCase();
    const segs = pointCode.split(/[._-]+/).filter((seg) => seg.length >= 2);

    if (codeNorm && pointCode === codeNorm) {
      blockers.push({
        code: point.code,
        title: point.title || point.code,
        reason: "与已有知识点编码相同",
      });
      continue;
    }
    if (titleNorm && pointTitle === titleNorm) {
      blockers.push({
        code: point.code,
        title: point.title || point.code,
        reason: "与已有知识点名称相同",
      });
      continue;
    }

    const overlap = checkTokens.filter((token) => segs.includes(token));
    const strong = overlap.length >= 2
      || (overlap.length === 1 && overlap[0].length >= 5 && checkTokens.length <= 2);
    if (strong) {
      keywordHits.push({
        code: point.code,
        title: point.title || point.code,
        reason: "名称关键词接近，可能表示同一内容",
      });
    }
  }

  const uniq = (list) => {
    const seen = new Set();
    return list.filter((item) => {
      const key = `${item.code}|${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return { blockers: uniq(blockers), keywordHits: uniq(keywordHits).slice(0, 8) };
}

function verdictLabel(verdict) {
  if (verdict === "KEEP") return "匹配";
  if (verdict === "REVIEW") return "待核";
  if (verdict === "REMOVE") return "不符";
  return verdict || "-";
}

function AlignmentReviewList({ summary, items, onJump }) {
  if (!items?.length) return null;
  return (
    <div className="kg-review-panel">
      {summary ? <p className="kg-review-summary">{summary}</p> : null}
      <ul className="kg-review-list">
        {items.map((item) => (
          <li key={item.code} className={`is-${String(item.verdict || "").toLowerCase()}`}>
            <button type="button" onClick={() => onJump?.(item.code)}>
              <strong>{item.title || item.code}</strong>
              <span>{verdictLabel(item.verdict)}</span>
            </button>
            {item.reason ? <p>{item.reason}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KnowledgeGraphPage({ isAdmin, notify }) {
  const cached = readKnowledgeGraphOverviewCache();
  const [overview, setOverview] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [selectedCode, setSelectedCode] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [reloadingCatalog, setReloadingCatalog] = useState(false);
  const [purgingDirty, setPurgingDirty] = useState(false);
  const [dirtyStatus, setDirtyStatus] = useState(null); // { remainingChapterRefs, remainingDocumentRefs, message, clean }
  const [catalogInfo, setCatalogInfo] = useState(null);
  const [focusMode, setFocusMode] = useState("neighborhood");
  const [stageFilter, setStageFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [pointForm, setPointForm] = useState(EMPTY_POINT_FORM);
  const [pointModal, setPointModal] = useState(null); // 'create' | 'edit' | null
  const [editingOriginalCode, setEditingOriginalCode] = useState("");
  const [savingPoint, setSavingPoint] = useState(false);
  const [deletingPoint, setDeletingPoint] = useState(false);
  const [reviewingChapterKey, setReviewingChapterKey] = useState("");
  const [reviewByChapter, setReviewByChapter] = useState({});
  const [batchReviewing, setBatchReviewing] = useState(false);
  const [boundSearch, setBoundSearch] = useState("");
  const [boundCategoryFilter, setBoundCategoryFilter] = useState("");
  const [boundCollapsedCourses, setBoundCollapsedCourses] = useState(() => new Set());
  const [boundCollapseReady, setBoundCollapseReady] = useState(false);
  const [bindingEdit, setBindingEdit] = useState(null);
  // { chapter, codes, aiSuggestedCodes, saving, suggesting }
  const [aiFixingKey, setAiFixingKey] = useState("");
  const [enabledCategoryKeys, setEnabledCategoryKeys] = useState([]);
  const [graphRedrawKey, setGraphRedrawKey] = useState(0);
  const [aiPrereqCodes, setAiPrereqCodes] = useState([]);
  const [aiRelatedCodes, setAiRelatedCodes] = useState([]);
  const [suggestingPrereq, setSuggestingPrereq] = useState(false);
  const [suggestingRelated, setSuggestingRelated] = useState(false);
  const [relationSuggestNote, setRelationSuggestNote] = useState("");
  const [prereqPickerOpen, setPrereqPickerOpen] = useState(false);
  const [relatedPickerOpen, setRelatedPickerOpen] = useState(false);
  const [titleCheck, setTitleCheck] = useState(null); // { status, blockers, keywordHits, aiHits, checkedTitle }
  const [checkingTitle, setCheckingTitle] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  // { title, description, items?, danger?, confirmLabel?, requirePhrase?, onConfirm }
  const [confirmPhraseInput, setConfirmPhraseInput] = useState("");

  async function load({ force = false, quiet = false } = {}) {
    if (!quiet && (force || !overview)) setLoading(true);
    try {
      const data = await knowledgeGraphApi.overview({ force });
      setOverview(data);
      setSelectedCode((current) => {
        if (current) return current;
        const firstTopic = data.points?.find((point) => point.kind !== "CATEGORY") || data.points?.[0];
        return firstTopic?.code || "";
      });
      if (isAdmin) {
        try {
          setCatalogInfo(await knowledgeGraphApi.catalogInfo());
        } catch {
          setCatalogInfo(null);
        }
        try {
          const dirty = await knowledgeGraphApi.dirtyStatus();
          setDirtyStatus(dirty);
        } catch {
          setDirtyStatus(null);
        }
      }
    } catch (error) {
      notify(error.message, "error");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const catalogBusy = seeding || syncingCatalog || reloadingCatalog || purgingDirty || batchReviewing || Boolean(aiFixingKey);
  const confirmPhraseRequired = Boolean(confirmDialog?.requirePhrase);
  const confirmPhraseOk = !confirmPhraseRequired
    || confirmPhraseInput.trim() === confirmDialog.requirePhrase;

  function openConfirmDialog(next) {
    setConfirmPhraseInput("");
    setConfirmDialog(next);
  }

  function closeConfirmDialog() {
    if (savingPoint || deletingPoint || catalogBusy) return;
    setConfirmPhraseInput("");
    setConfirmDialog(null);
  }

  function catalogSummaryItems() {
    if (!catalogInfo) {
      return [
        { tag: "提示", code: "catalog", title: "当前清单信息未加载", reason: "确认后将按服务端最新状态执行" },
      ];
    }
    return [
      {
        tag: "清单",
        code: `v${catalogInfo.version ?? "—"}`,
        title: `${catalogInfo.topicCount ?? 0} 个知识点 · ${catalogInfo.categoryCount ?? 0} 个分类 · ${catalogInfo.edgeCount ?? 0} 条关系`,
        reason: catalogInfo.resolvedSource || catalogInfo.location || "",
      },
    ];
  }

  function askReloadCatalog() {
    if (!isAdmin || catalogBusy) return;
    openConfirmDialog({
      title: "确认重新读清单？",
      description: "这会从清单文件重新读入系统内存，图上的点先不会改。",
      items: catalogSummaryItems(),
      requirePhrase: "重新读清单",
      confirmLabel: "确认读取",
      onConfirm: async () => {
        closeConfirmDialog();
        await runReloadCatalog();
      },
    });
  }

  function askSyncCatalog() {
    if (!isAdmin || catalogBusy) return;
    openConfirmDialog({
      title: "确认写进图谱？",
      description: "按清单批量更新图谱知识点（先读清单再写入）。清单里有的编号会盖掉页面上改过的同名点，无法撤销。",
      items: catalogSummaryItems(),
      danger: true,
      requirePhrase: "写进图谱",
      confirmLabel: "确认写入",
      onConfirm: async () => {
        closeConfirmDialog();
        await runSyncCatalog();
      },
    });
  }

  function askSeed() {
    if (!isAdmin || catalogBusy) return;
    openConfirmDialog({
      title: "确认一键初始化？",
      description: "将写入基础数据，再按最新清单批量写进图谱。同名点会被覆盖。适合新环境，请确认后再执行。",
      items: catalogSummaryItems(),
      danger: true,
      requirePhrase: "一键初始化",
      confirmLabel: "确认初始化",
      onConfirm: async () => {
        closeConfirmDialog();
        await runSeed();
      },
    });
  }

  function askPurgeDirty() {
    if (!isAdmin || catalogBusy) return;
    openConfirmDialog({
      title: "确认清理图谱脏数据？",
      description: "将从 Neo4j 删除：未发布/已删除课程的章节引用，以及非「已发布且已入库」的资料讲解节点。正式演示节点会保留。未发布课上的绑定也会被清掉，发布前需重新绑定。",
      danger: true,
      requirePhrase: "清理脏数据",
      confirmLabel: "确认清理",
      onConfirm: async () => {
        closeConfirmDialog();
        await runPurgeDirty();
      },
    });
  }

  async function runPurgeDirty() {
    setPurgingDirty(true);
    try {
      const result = await knowledgeGraphApi.purgeDirty();
      setDirtyStatus(result);
      notify(result?.message || `已清理：章节 ${result?.removedChapterRefs ?? 0}，资料 ${result?.removedDocumentRefs ?? 0}`);
      await load({ force: true, quiet: true });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setPurgingDirty(false);
    }
  }

  async function runSeed() {
    setSeeding(true);
    try {
      await knowledgeGraphApi.seed();
      notify("初始化完成：基础数据已写入，知识点已按最新清单更新");
      await load({ force: true, quiet: true });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSeeding(false);
    }
  }

  async function runReloadCatalog() {
    setReloadingCatalog(true);
    try {
      const result = await knowledgeGraphApi.reloadCatalog();
      setCatalogInfo(result?.catalog || null);
      notify(result?.message || "清单已重新读入");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setReloadingCatalog(false);
    }
  }

  async function runSyncCatalog() {
    setSyncingCatalog(true);
    try {
      const result = await knowledgeGraphApi.syncCatalog({ reload: true });
      setCatalogInfo(result?.catalog || null);
      const count = result?.updatedNodes;
      notify(result?.message || (count != null ? `已写入 ${count} 个知识点` : "清单已写进图谱"));
      await load({ force: true, quiet: true });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSyncingCatalog(false);
    }
  }

  function openCreatePoint() {
    setPointForm({
      ...EMPTY_POINT_FORM,
      prerequisiteCodes: [],
      relatedCodes: [],
    });
    setEditingOriginalCode("");
    setAiPrereqCodes([]);
    setAiRelatedCodes([]);
    setRelationSuggestNote("");
    setPrereqPickerOpen(false);
    setRelatedPickerOpen(false);
    setTitleCheck(null);
    setPointModal("create");
  }

  function openEditPoint() {
    if (!selected) return;
    const { prerequisiteCodes, relatedCodes } = relationCodesFromEdges(
      selected.code,
      overview?.edges || [],
    );
    setPointForm({
      code: selected.code || "",
      title: selected.title || "",
      stages: pointStages(selected).length ? pointStages(selected) : ["初中"],
      difficulty: selected.difficulty ?? 2,
      categoryCode: selected.categoryCode || "",
      categoryTitle: selected.categoryTitle || "",
      kind: selected.kind || "TOPIC",
      parentCode: selected.categoryCode || "",
      prerequisiteCodes,
      relatedCodes,
    });
    setEditingOriginalCode(selected.code || "");
    setAiPrereqCodes([]);
    setAiRelatedCodes([]);
    setRelationSuggestNote("");
    setPrereqPickerOpen(Boolean(prerequisiteCodes.length));
    setRelatedPickerOpen(Boolean(relatedCodes.length));
    setTitleCheck(null);
    setPointModal("edit");
  }

  async function validatePointTitle({ withAi = true } = {}) {
    const title = pointForm.title.trim();
    const code = pointForm.code.trim().toLowerCase();
    if (!title) {
      notify("请先填写知识点名称", "error");
      return null;
    }
    const excludeCode = pointModal === "edit" ? editingOriginalCode : "";
    const keyword = findCodeKeywordConflicts({
      title,
      code: code || slugifyPointCode(title, pointForm.categoryCode),
      categoryCode: pointForm.categoryCode,
      points,
      excludeCode,
    });

    let aiHits = [];
    if (withAi) {
      setCheckingTitle(true);
      try {
        const result = await Promise.race([
          knowledgeGraphApi.suggestCovers({
            title,
            content: `请找出与知识点名称「${title}」语义相同或高度相似的已有知识点，用于查重。分类：${pointForm.categoryTitle || "未分类"}`,
            stage: (pointForm.stages || []).join("、") || null,
            limit: 8,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("suggest-timeout")), 8000)),
        ]);
        aiHits = (result?.suggestions || [])
          .filter((item) => item?.code && item.code !== excludeCode)
          .filter((item) => Number(item.score || 0) >= 5)
          .slice(0, 6)
          .map((item) => ({
            code: item.code,
            title: item.title || item.code,
            reason: "意思接近，建议核对是否重复",
            score: item.score,
          }));
      } catch {
        // AI 超时/失败时仍返回关键词结果
      } finally {
        setCheckingTitle(false);
      }
    }

    const status = keyword.blockers.length
      ? "error"
      : (keyword.keywordHits.length || aiHits.length)
        ? "warn"
        : "ok";
    const next = {
      status,
      blockers: keyword.blockers,
      keywordHits: keyword.keywordHits,
      aiHits,
      checkedTitle: title,
      checkedCode: code,
    };
    setTitleCheck(next);
    return next;
  }

  async function commitPointSave(payload, { renameFrom = "" } = {}) {
    setSavingPoint(true);
    setConfirmDialog(null);
    try {
      if (renameFrom && renameFrom !== payload.code) {
        await knowledgeGraphApi.createPoint(payload);
        try {
          await knowledgeGraphApi.deletePoint(renameFrom, { force: true });
        } catch {
          notify("已按新编号保存，但旧编号删除失败，请稍后手动处理", "error");
        }
        notify("已用新编号保存");
      } else if (pointModal === "edit" && editingOriginalCode) {
        await knowledgeGraphApi.updatePoint(editingOriginalCode, payload);
        notify("知识点已更新");
      } else {
        await knowledgeGraphApi.createPoint(payload);
        notify("知识点已创建");
      }
      setPointModal(null);
      setPointForm(EMPTY_POINT_FORM);
      setEditingOriginalCode("");
      setTitleCheck(null);
      setSelectedCode(payload.code);
      await load({ force: true, quiet: true });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSavingPoint(false);
    }
  }

  async function savePoint(event) {
    event.preventDefault();
    if (!isAdmin) return;
    const code = pointForm.code.trim().toLowerCase();
    const title = pointForm.title.trim();
    if (!code || !title) {
      notify("请填写名称和编号", "error");
      return;
    }
    if (!/^[a-z][a-z0-9_.-]{2,63}$/.test(code)) {
      notify("编号格式不正确：请用小写字母开头，可用字母、数字、点和下划线", "error");
      return;
    }

    const stages = (pointForm.stages || []).map((item) => String(item).trim()).filter(Boolean);
    if (!stages.length) {
      notify("请至少选择一个适用学段", "error");
      return;
    }

    const needFreshCheck = !titleCheck
      || titleCheck.checkedTitle !== title
      || titleCheck.checkedCode !== code;
    const check = needFreshCheck
      ? await validatePointTitle({ withAi: true })
      : titleCheck;
    if (!check) return;
    if (check.blockers?.length) {
      notify(`名称与已有知识点重复：${check.blockers[0].title}。请换一个名称后再保存。`, "error");
      return;
    }

    const payload = {
      code,
      title,
      stages,
      stage: stages.join("、"),
      difficulty: Number(pointForm.difficulty) || 2,
      categoryCode: pointForm.categoryCode.trim() || null,
      categoryTitle: pointForm.categoryTitle.trim() || null,
      kind: pointForm.kind || "TOPIC",
      parentCode: pointForm.parentCode.trim() || null,
      prerequisiteCodes: (pointForm.prerequisiteCodes || []).filter((item) => item && item !== code),
      relatedCodes: (pointForm.relatedCodes || []).filter((item) => item && item !== code),
    };
    const renameFrom = pointModal === "edit"
      && editingOriginalCode
      && editingOriginalCode !== code
      ? editingOriginalCode
      : "";

    const similarItems = [
      ...(check.keywordHits || []).map((item) => ({
        ...item,
        tag: "关键词相近",
      })),
      ...(check.aiHits || []).map((item) => ({
        ...item,
        tag: "意思相近",
      })),
    ].slice(0, 8);

    if (similarItems.length) {
      setConfirmDialog({
        title: "名称可能重复，请确认",
        description: "下面这些已有知识点和你填写的名称比较接近。若确认是新内容，可继续保存；否则请返回改名。",
        items: similarItems,
        confirmLabel: renameFrom ? "确认是新内容，继续保存" : "确认是新内容，继续保存",
        onConfirm: () => {
          if (renameFrom) {
            setConfirmDialog({
              title: "将使用新的知识点编号",
              description: `保存后会使用新编号，原编号「${renameFrom}」不再保留。请确认学生端与绑定不会受影响。`,
              danger: true,
              confirmLabel: "确认并保存",
              onConfirm: () => commitPointSave(payload, { renameFrom }),
            });
            return;
          }
          commitPointSave(payload);
        },
      });
      return;
    }

    if (renameFrom) {
      setConfirmDialog({
        title: "将使用新的知识点编号",
        description: `保存后会使用新编号，原编号「${renameFrom}」不再保留。请确认学生端与绑定不会受影响。`,
        danger: true,
        confirmLabel: "确认并保存",
        onConfirm: () => commitPointSave(payload, { renameFrom }),
      });
      return;
    }

    await commitPointSave(payload);
  }

  async function removeSelectedPoint({ force = false } = {}) {
    if (!isAdmin || !selectedCode) return;
    const label = selected?.title || selectedCode;
    const code = selectedCode;
    setConfirmDialog({
      title: force ? "强制删除知识点" : "确认删除知识点",
      description: force
        ? `强制删除「${label}」？相关绑定关系也会断开。`
        : `确认删除「${label}」？`,
      danger: true,
      confirmLabel: force ? "强制删除" : "确认删除",
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingPoint(true);
        try {
          await knowledgeGraphApi.deletePoint(code, { force });
          notify("已删除");
          setSelectedCode("");
          setPointModal(null);
          await load({ force: true, quiet: true });
        } catch (error) {
          if (!force && /强制|引用|CONFLICT|409/i.test(String(error.message || ""))) {
            setConfirmDialog({
              title: "无法直接删除",
              description: `${error.message}。是否强制删除？`,
              danger: true,
              confirmLabel: "强制删除",
              onConfirm: () => removeSelectedPoint({ force: true }),
            });
          } else {
            notify(error.message, "error");
          }
        } finally {
          setDeletingPoint(false);
        }
      },
    });
  }

  async function reviewChapter(chapter, { quiet = false } = {}) {
    if (!isAdmin || !chapter) return null;
    const key = `${chapter.courseId}-${chapter.chapterId}`;
    const codes = chapter.knowledgeCodes || [];
    if (!codes.length) {
      if (!quiet) notify("该章节尚未绑定知识点", "error");
      return null;
    }
    setReviewingChapterKey(key);
    try {
      const result = await knowledgeGraphApi.reviewAlignment({
        title: chapter.title,
        content: chapter.description,
        knowledgeCodes: codes,
      });
      setReviewByChapter((current) => ({
        ...current,
        [key]: { chapterKey: key, chapter, ...result },
      }));
      if (!quiet) notify(result.summary || "审查完成");
      return result;
    } catch (error) {
      if (!quiet) notify(error.message, "error");
      throw error;
    } finally {
      setReviewingChapterKey((current) => (current === key ? "" : current));
    }
  }

  async function runBatchReview(chapters) {
    const targets = (chapters || []).filter((chapter) => (chapter.knowledgeCodes || []).length);
    if (!targets.length) {
      notify("当前筛选下没有可审查的章节", "error");
      return;
    }
    setBatchReviewing(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const chapter of targets) {
        try {
          await reviewChapter(chapter, { quiet: true });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail) {
        notify(`批量审查完成：成功 ${ok}，失败 ${fail}`, "error");
      } else {
        notify(`批量审查完成：共 ${ok} 个章节`);
      }
    } finally {
      setBatchReviewing(false);
      setReviewingChapterKey("");
    }
  }

  function askBatchReview(chapters, { phrase = "批量审查", title = "确认批量审查？" } = {}) {
    if (!isAdmin || batchReviewing || catalogBusy) return;
    const targets = (chapters || []).filter((chapter) => (chapter.knowledgeCodes || []).length);
    if (!targets.length) {
      notify("当前没有可审查的章节", "error");
      return;
    }
    openConfirmDialog({
      title,
      description: `将对 ${targets.length} 个已绑定章节逐一审查，结果会显示在各章节下方。`,
      danger: true,
      requirePhrase: phrase,
      confirmLabel: "开始审查",
      onConfirm: async () => {
        closeConfirmDialog();
        await runBatchReview(targets);
      },
    });
  }

  function chapterKeyOf(chapter) {
    return `${chapter.courseId}-${chapter.chapterId}`;
  }

  function patchChapterCodes(chapter, nextCodes) {
    const key = chapterKeyOf(chapter);
    setOverview((current) => {
      if (!current) return current;
      return {
        ...current,
        chapterCovers: (current.chapterCovers || []).map((item) => (
          item.courseId === chapter.courseId && item.chapterId === chapter.chapterId
            ? { ...item, knowledgeCodes: nextCodes }
            : item
        )),
      };
    });
    setReviewByChapter((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function openBindingEditor(chapter) {
    if (!isAdmin || !chapter) return;
    setBindingEdit({
      chapter,
      codes: [...(chapter.knowledgeCodes || [])],
      aiSuggestedCodes: [],
      saving: false,
      suggesting: false,
    });
  }

  async function saveBindingEdit() {
    if (!bindingEdit?.chapter) return;
    const { chapter, codes } = bindingEdit;
    setBindingEdit((current) => (current ? { ...current, saving: true } : current));
    try {
      await coursesApi.replaceChapterCovers(chapter.courseId, chapter.chapterId, codes);
      patchChapterCodes(chapter, codes);
      notify("章节绑定已保存");
      setBindingEdit(null);
      await load({ force: true, quiet: true });
    } catch (error) {
      notify(error.message, "error");
      setBindingEdit((current) => (current ? { ...current, saving: false } : current));
    }
  }

  async function suggestBindingInEditor() {
    if (!bindingEdit?.chapter) return;
    const { chapter } = bindingEdit;
    setBindingEdit((current) => (current ? { ...current, suggesting: true } : current));
    try {
      const result = await knowledgeGraphApi.suggestCovers({
        title: chapter.title,
        content: chapter.description,
        limit: 10,
      });
      const suggested = (result?.suggestions || [])
        .map((item) => item.code)
        .filter(Boolean);
      setBindingEdit((current) => {
        if (!current) return current;
        return {
          ...current,
          aiSuggestedCodes: suggested,
          codes: [...new Set([...(current.codes || []), ...suggested])].slice(0, 20),
          suggesting: false,
        };
      });
      notify(suggested.length ? `已补充 ${suggested.length} 个 AI 建议` : "暂无新的 AI 建议");
    } catch (error) {
      notify(error.message, "error");
      setBindingEdit((current) => (current ? { ...current, suggesting: false } : current));
    }
  }

  function buildAiFixedCodes(chapter, review) {
    const codes = chapter.knowledgeCodes || [];
    const byCode = new Map((review?.items || []).map((item) => [item.code, item]));
    return codes.filter((code) => byCode.get(code)?.verdict !== "REMOVE");
  }

  async function aiFixChapterBinding(chapter, { quiet = false, manageKey = true } = {}) {
    if (!isAdmin || !chapter) return false;
    const key = chapterKeyOf(chapter);
    if (manageKey) setAiFixingKey(key);
    try {
      let review = reviewByChapter[key];
      if (!review) {
        review = await reviewChapter(chapter, { quiet: true });
      }
      let nextCodes = buildAiFixedCodes(chapter, review);
      const removedCount = (chapter.knowledgeCodes || []).length - nextCodes.length;
      if (removedCount > 0 || nextCodes.length === 0) {
        try {
          const result = await knowledgeGraphApi.suggestCovers({
            title: chapter.title,
            content: chapter.description,
            limit: Math.max(8, nextCodes.length + removedCount + 2),
          });
          const suggested = (result?.suggestions || []).map((item) => item.code).filter(Boolean);
          nextCodes = [...new Set([...nextCodes, ...suggested])].slice(0, 16);
        } catch {
          // 建议失败时仍保存去掉「不符」后的结果
        }
      }
      await coursesApi.replaceChapterCovers(chapter.courseId, chapter.chapterId, nextCodes);
      patchChapterCodes(chapter, nextCodes);
      if (!quiet) {
        notify(`已按审查结果改绑「${chapterLabel(chapter)}」`);
      }
      return true;
    } catch (error) {
      if (!quiet) notify(error.message, "error");
      return false;
    } finally {
      if (manageKey) {
        setAiFixingKey((current) => (current === key ? "" : current));
      }
    }
  }

  function askAiFixChapter(chapter) {
    if (!isAdmin || !chapter || catalogBusy || aiFixingKey) return;
    openConfirmDialog({
      title: "确认 AI 一键改绑？",
      description: `将去掉「不符」知识点，并尽量用 AI 建议补齐「${chapterLabel(chapter)}」的绑定。`,
      danger: true,
      requirePhrase: "AI改绑",
      confirmLabel: "确认改绑",
      onConfirm: async () => {
        closeConfirmDialog();
        const ok = await aiFixChapterBinding(chapter);
        if (ok) await load({ force: true, quiet: true });
      },
    });
  }

  function askAiFixCourse(chapters) {
    if (!isAdmin || catalogBusy || aiFixingKey || batchReviewing) return;
    const targets = (chapters || []).filter((chapter) => (
      reviewByChapter[chapterKeyOf(chapter)] || (chapter.knowledgeCodes || []).length
    ));
    if (!targets.length) {
      notify("请先对本课章节完成审查，或至少有绑定知识点", "error");
      return;
    }
    openConfirmDialog({
      title: "确认对本课 AI 改绑？",
      description: `将对 ${targets.length} 个章节去掉「不符」项，并用 AI 建议补齐。未审查的章节会先自动审查再改。`,
      danger: true,
      requirePhrase: "本课改绑",
      confirmLabel: "确认改绑",
      onConfirm: async () => {
        closeConfirmDialog();
        setAiFixingKey("course");
        let ok = 0;
        let fail = 0;
        try {
          for (const chapter of targets) {
            const success = await aiFixChapterBinding(chapter, { quiet: true, manageKey: false });
            if (success) ok += 1;
            else fail += 1;
          }
          if (fail) notify(`本课改绑完成：成功 ${ok}，失败 ${fail}`, "error");
          else notify(`本课改绑完成：共 ${ok} 个章节`);
          await load({ force: true, quiet: true });
        } finally {
          setAiFixingKey("");
        }
      },
    });
  }

  const loop = overview?.teachingLoop;
  const points = overview?.points || [];
  const edges = overview?.edges || [];
  const categoryTitleByCode = useMemo(() => buildCategoryTitleByCode(points), [points]);
  const selected = useMemo(
    () => resolveSelectedEntity(selectedCode, points, categoryTitleByCode),
    [selectedCode, points, categoryTitleByCode],
  );
  const neighbors = useMemo(
    () => buildDirectNeighbors(selectedCode, edges, points, categoryTitleByCode),
    [selectedCode, edges, points, categoryTitleByCode],
  );
  const categoryNeighbors = useMemo(
    () => neighbors.filter((row) => row.kind === "CATEGORY"),
    [neighbors],
  );
  const topicNeighbors = useMemo(
    () => neighbors.filter((row) => row.kind !== "CATEGORY"),
    [neighbors],
  );
  const chapterCovers = overview?.chapterCovers || [];
  const chapterHits = useMemo(() => {
    if (!selectedCode) return [];
    if (selected?.kind === "CATEGORY") {
      const childCodes = new Set(
        points
          .filter((point) => point.categoryCode === selectedCode)
          .map((point) => point.code),
      );
      topicNeighbors.forEach((row) => childCodes.add(row.code));
      return chapterCovers.filter((chapter) =>
        (chapter.knowledgeCodes || []).some((code) => childCodes.has(code)));
    }
    return chapterCovers.filter((chapter) =>
      (chapter.knowledgeCodes || []).includes(selectedCode));
  }, [selectedCode, selected, points, topicNeighbors, chapterCovers]);

  const categories = useMemo(() => {
    const map = new Map();
    points.forEach((point) => {
      if (!point.categoryCode) return;
      map.set(point.categoryCode, point.categoryTitle || point.categoryCode);
    });
    categoryTitleByCode.forEach((label, value) => {
      if (!map.has(value)) map.set(value, label);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh"));
  }, [points, categoryTitleByCode]);

  const pointByCode = useMemo(() => {
    const map = new Map();
    points.forEach((point) => {
      if (point?.code) map.set(point.code, point);
    });
    return map;
  }, [points]);

  const filteredBoundChapters = useMemo(() => {
    const needle = boundSearch.trim().toLowerCase();
    return chapterCovers.filter((chapter) => {
      const codes = chapter.knowledgeCodes || [];
      if (boundCategoryFilter) {
        const hitCategory = codes.some((code) => pointByCode.get(code)?.categoryCode === boundCategoryFilter);
        if (!hitCategory) return false;
      }
      if (!needle) return true;
      const titles = codes
        .map((code) => pointByCode.get(code)?.title || code)
        .join(" ");
      const hay = [
        courseLabel(chapter),
        chapterLabel(chapter),
        chapter.description,
        chapter.courseId,
        chapter.chapterId,
        titles,
        codes.join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [chapterCovers, boundSearch, boundCategoryFilter, pointByCode]);

  const boundCourseGroups = useMemo(() => {
    const map = new Map();
    filteredBoundChapters.forEach((chapter) => {
      const key = String(chapter.courseId ?? courseLabel(chapter));
      if (!map.has(key)) {
        map.set(key, {
          key,
          courseId: chapter.courseId,
          label: courseLabel(chapter),
          chapters: [],
        });
      }
      map.get(key).chapters.push(chapter);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "zh"));
  }, [filteredBoundChapters]);

  useEffect(() => {
    if (boundCollapseReady || !boundCourseGroups.length) return;
    setBoundCollapsedCourses(new Set(boundCourseGroups.map((group) => group.key)));
    setBoundCollapseReady(true);
  }, [boundCollapseReady, boundCourseGroups]);

  function toggleBoundCourse(courseKey) {
    setBoundCollapsedCourses((current) => {
      const next = new Set(current);
      if (next.has(courseKey)) next.delete(courseKey);
      else next.add(courseKey);
      return next;
    });
  }

  function expandAllBoundCourses() {
    setBoundCollapsedCourses(new Set());
  }

  function collapseAllBoundCourses() {
    setBoundCollapsedCourses(new Set(boundCourseGroups.map((group) => group.key)));
  }

  function draftPointWithAi() {
    const title = pointForm.title.trim();
    if (!title) {
      notify("请先填写知识点名称", "error");
      return;
    }
    const matched = categories.find((item) =>
      title.includes(item.label) || (item.label && item.label.length >= 2 && title.includes(item.label.slice(0, 2))));
    const categoryCode = matched?.value || pointForm.categoryCode;
    const nextCode = slugifyPointCode(title, categoryCode);
    setPointForm((current) => ({
      ...current,
      code: nextCode,
      title,
      categoryCode: categoryCode || current.categoryCode,
      categoryTitle: matched?.label || current.categoryTitle,
      parentCode: categoryCode || current.parentCode,
      kind: "TOPIC",
    }));
    setTitleCheck(null);
    const keyword = findCodeKeywordConflicts({
      title,
      code: nextCode,
      categoryCode,
      points,
      excludeCode: pointModal === "edit" ? editingOriginalCode : "",
    });
    if (keyword.blockers.length || keyword.keywordHits.length) {
      setTitleCheck({
        status: keyword.blockers.length ? "error" : "warn",
        blockers: keyword.blockers,
        keywordHits: keyword.keywordHits,
        aiHits: [],
        checkedTitle: title,
        checkedCode: nextCode,
      });
      notify(keyword.blockers.length
        ? "这个名称或编号和已有知识点重复了，请换一个再保存"
        : "名称和已有知识点比较接近，建议点「检查重名」确认一下", "error");
    } else {
      notify(`已根据名称生成编号：${nextCode}`);
    }
  }

  function onCategoryChange(categoryCode) {
    const category = categories.find((item) => item.value === categoryCode);
    setPointForm((current) => {
      const title = current.title.trim();
      const shouldRefreshCode = !current.code.trim()
        || current.code.startsWith("custom.topic.")
        || current.code.startsWith("custom.");
      return {
        ...current,
        categoryCode: categoryCode || "",
        categoryTitle: category?.label || "",
        // 与分类同步；清空分类时也清空父节点，保存后会拆掉「同属一类」边
        parentCode: categoryCode || "",
        code: shouldRefreshCode && title
          ? slugifyPointCode(title, categoryCode)
          : current.code,
      };
    });
  }

  async function suggestRelationLinks(mode) {
    const title = pointForm.title.trim();
    if (!title) {
      notify("请先填写知识点名称，再让 AI 帮你推荐关联", "error");
      return;
    }
    const selfCode = (pointForm.code || editingOriginalCode || "").trim();
    const setSuggesting = mode === "prerequisite" ? setSuggestingPrereq : setSuggestingRelated;
    setSuggesting(true);
    setRelationSuggestNote("");
    try {
      let codes = localSuggestRelationCodes({
        title,
        categoryTitle: pointForm.categoryTitle,
        categoryCode: pointForm.categoryCode,
        stage: pointForm.stages,
        points,
        selfCode,
        mode,
        limit: 6,
      });
      try {
        const hint = mode === "prerequisite"
          ? `需要先掌握哪些基础知识才能学习「${title}」？分类：${pointForm.categoryTitle || "未分类"}`
          : `与「${title}」相关、可拓展学习的知识点有哪些？分类：${pointForm.categoryTitle || "未分类"}`;
        const result = await Promise.race([
          knowledgeGraphApi.suggestCovers({
            title,
            content: hint,
            stage: (pointForm.stages || [])[0] || null,
            limit: 8,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("suggest-timeout")), 8000)),
        ]);
        const apiCodes = (result?.suggestions || [])
          .map((item) => item.code)
          .filter((code) => code && code !== selfCode && !String(code).startsWith("category."));
        if (apiCodes.length) {
          codes = [...new Set([...apiCodes, ...codes])].slice(0, 8);
        }
      } catch {
        // 超时或失败时沿用本地建议
      }
      if (!codes.length) {
        notify("暂时没有合适推荐，请用搜索自己勾选", "error");
        return;
      }
      if (mode === "prerequisite") {
        const merged = mergeAiSuggestedCodes(pointForm.prerequisiteCodes, codes);
        setAiPrereqCodes(merged.pinned);
        setPointForm((current) => ({
          ...current,
          prerequisiteCodes: merged.codes,
        }));
        setPrereqPickerOpen(true);
        setRelationSuggestNote(`已为你推荐 ${codes.length} 个先修知识点，可再增减`);
      } else {
        const merged = mergeAiSuggestedCodes(pointForm.relatedCodes, codes);
        setAiRelatedCodes(merged.pinned);
        setPointForm((current) => ({
          ...current,
          relatedCodes: merged.codes,
        }));
        setRelatedPickerOpen(true);
        setRelationSuggestNote(`已为你推荐 ${codes.length} 个相关拓展，可再增减`);
      }
      notify(mode === "prerequisite" ? "已填入先修推荐" : "已填入相关拓展推荐");
    } catch (error) {
      notify(error.message || "暂时没法给出推荐，请用搜索自己勾选", "error");
    } finally {
      setSuggesting(false);
    }
  }

  const selectablePoints = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    return points
      .filter((point) => point.kind !== "CATEGORY")
      .filter((point) => {
        if (stageFilter && !pointMatchesStage(point, stageFilter)) return false;
        if (categoryFilter && point.categoryCode !== categoryFilter) return false;
        if (!q) return true;
        return [point.title, point.code, point.categoryTitle]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(q));
      })
      .slice(0, 80);
  }, [points, appliedQuery, stageFilter, categoryFilter]);

  /** 新建/编辑时可关联的其它知识点（排除自身） */
  const linkablePoints = useMemo(() => {
    const self = (pointForm.code || editingOriginalCode || "").trim().toLowerCase();
    return points
      .filter((point) => point.kind !== "CATEGORY")
      .filter((point) => point.code !== self)
      .sort((left, right) => String(left.title || left.code).localeCompare(String(right.title || right.code), "zh"))
      .slice(0, 200);
  }, [points, pointForm.code, editingOriginalCode]);

  const extraNeighborCodes = useMemo(
    () => neighbors.map((row) => row.code),
    [neighbors],
  );

  const focusCategoryKey = useMemo(
    () => resolveFocusCategoryKey(selectedCode, points),
    [selectedCode, points],
  );

  // 切换选中知识点时：默认只勾选其当前分类（查询逻辑不变，仅影响图画）
  useEffect(() => {
    if (!focusCategoryKey) return;
    setEnabledCategoryKeys([focusCategoryKey]);
  }, [focusCategoryKey]);

  /** 本地重绘关系图：不请求接口，只重建画布并恢复「仅当前分类」勾选 */
  function redrawGraphLocal() {
    if (focusCategoryKey) {
      setEnabledCategoryKeys([focusCategoryKey]);
    }
    setGraphRedrawKey((current) => current + 1);
  }

  const queryVisible = useMemo(
    () => buildVisiblePoints({
      points,
      edges,
      selectedCode,
      focusMode,
      categoryFilter,
      stageFilter,
      extraNeighborCodes,
    }).visible,
    [points, edges, selectedCode, focusMode, categoryFilter, stageFilter, extraNeighborCodes],
  );

  const displayVisible = useMemo(
    () => applyCategoryVisibility(queryVisible, enabledCategoryKeys, selectedCode),
    [queryVisible, enabledCategoryKeys, selectedCode],
  );

  const graphComposition = useMemo(
    () => describeGraphComposition({
      visible: displayVisible,
      selectedCode,
      points,
      categoryFilter,
      focusMode,
      enabledCategoryKeys,
    }),
    [displayVisible, selectedCode, points, categoryFilter, focusMode, enabledCategoryKeys],
  );

  function jumpToNode(codeOrTitle) {
    if (!codeOrTitle) return;
    const raw = String(codeOrTitle).trim();
    if (!raw) return;
    // 已是编码 / 分类码
    if (
      points.some((point) => point.code === raw)
      || categoryTitleByCode.has(raw)
      || raw.startsWith("category.")
    ) {
      setSelectedCode(raw);
      return;
    }
    // 图点击偶发回传标题而非编码：按标题精确命中
    const titleHits = points.filter((point) => point.kind !== "CATEGORY" && point.title === raw);
    if (titleHits.length === 1) {
      setSelectedCode(titleHits[0].code);
      return;
    }
    if (titleHits.length > 1) {
      // 同名时优先保留当前筛选范围内的
      const scoped = titleHits.find((point) => {
        if (stageFilter && !pointMatchesStage(point, stageFilter)) return false;
        if (categoryFilter && point.categoryCode !== categoryFilter) return false;
        return true;
      });
      setSelectedCode((scoped || titleHits[0]).code);
      return;
    }
    setSelectedCode(raw);
  }

  function locateFromSearch(event) {
    event?.preventDefault?.();
    const q = searchDraft.trim();
    setAppliedQuery(q);
    if (!q) {
      notify("请输入知识点名称或编码", "error");
      return;
    }
    const needle = q.toLowerCase();
    const hit = points.find((point) => {
      if (point.kind === "CATEGORY") return false;
      if (stageFilter && !pointMatchesStage(point, stageFilter)) return false;
      if (categoryFilter && point.categoryCode !== categoryFilter) return false;
      return [point.title, point.code, point.categoryTitle]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle));
    });
    if (!hit) {
      notify("没有匹配的知识点", "error");
      return;
    }
    setSelectedCode(hit.code);
  }

  const focusModeHint = FOCUS_MODE_OPTIONS.find((item) => item.value === focusMode)?.hint
    || FOCUS_MODE_OPTIONS[0].hint;

  return (
    <section className="page-section kg-page">
      <header className="page-heading kg-page-heading">
        <div className="kg-heading-main">
          <div className="kg-heading-title-row">
            <div>
              <p className="eyebrow">知识图谱</p>
              <h1>知识点关系与教学闭环</h1>
            </div>
            <button
              className="button ghost compact kg-refresh-outside"
              type="button"
              onClick={() => load({ force: true })}
              disabled={loading}
            >
              <RefreshCw size={14} />{loading ? "加载中..." : "刷新"}
            </button>
          </div>
          <p>
            {isAdmin
              ? "点选可改可删；新建用下方工具栏。「一键初始化」= 基础数据 + 重新读清单 + 写进图谱。"
              : "看看知识点之间怎么连、哪些章节讲过这些点。"}
          </p>
        </div>
        {isAdmin ? (
          <div className="kg-heading-actions">
            <button className="button ghost compact" type="button" onClick={openCreatePoint}>
              <Plus size={14} />新建知识点
            </button>
            <button
              className="button ghost compact"
              type="button"
              onClick={askReloadCatalog}
              disabled={catalogBusy}
              title="把最新清单文件重新读进系统，还不改图上的点"
            >
              <RefreshCw size={14} />{reloadingCatalog ? "读取中..." : "重新读清单"}
            </button>
            <button
              className="button ghost compact"
              type="button"
              onClick={askSyncCatalog}
              disabled={catalogBusy}
              title="按清单补齐/更新图上的点；清单里有的编号会盖掉页面上改过的同名点"
            >
              <Network size={14} />{syncingCatalog ? "写入中..." : "写进图谱"}
            </button>
            <button
              className="button primary compact"
              type="button"
              onClick={askSeed}
              disabled={catalogBusy}
              title="新环境用：基础数据（约束、示例章节/资料）+ 重新读清单 + 写进图谱"
            >
              <Sparkles size={14} />{seeding ? "写入中..." : "一键初始化"}
            </button>
            <button
              className="button ghost compact"
              type="button"
              onClick={askPurgeDirty}
              disabled={catalogBusy}
              title="从 Neo4j 删除未发布/已删课程章节引用，以及无效资料讲解节点"
            >
              <Trash2 size={14} />{purgingDirty ? "清理中..." : "清理脏数据"}
            </button>
          </div>
        ) : null}
      </header>

      {isAdmin && (
        <div className="kg-catalog-meta" title={catalogInfo?.resolvedSource || catalogInfo?.location || ""}>
          <span className="kg-catalog-label">知识点清单</span>
          <span>v{catalogInfo?.version ?? "—"}</span>
          <span className="kg-catalog-dot" aria-hidden="true" />
          <span>{catalogInfo?.topicCount ?? 0} 个知识点</span>
          <span className="kg-catalog-dot" aria-hidden="true" />
          <span>{catalogInfo?.categoryCount ?? 0} 个分类</span>
          <span className="kg-catalog-dot" aria-hidden="true" />
          <span>{catalogInfo?.edgeCount ?? 0} 条关系</span>
          {catalogInfo?.loadedAt ? (
            <>
              <span className="kg-catalog-dot" aria-hidden="true" />
              <span>读于 {String(catalogInfo.loadedAt).replace("T", " ").slice(0, 19)}</span>
            </>
          ) : null}
          <span className="kg-catalog-dot" aria-hidden="true" />
          <span
            className={`kg-dirty-badge${
              !dirtyStatus
                ? " is-unknown"
                : (dirtyStatus.remainingChapterRefs || dirtyStatus.remainingDocumentRefs)
                  ? " is-dirty"
                  : " is-clean"
            }`}
            title={dirtyStatus?.message || "图谱脏数据检查"}
          >
            {!dirtyStatus
              ? "脏数据：未检查"
              : (dirtyStatus.remainingChapterRefs || dirtyStatus.remainingDocumentRefs)
                ? `脏数据：章节 ${dirtyStatus.remainingChapterRefs || 0} · 资料 ${dirtyStatus.remainingDocumentRefs || 0}`
                : "脏数据：通过"}
          </span>
        </div>
      )}

      <div className={`kg-status-banner${overview?.status?.ready ? " is-ready" : ""}`}>
        <Network size={18} />
        <div>
          <strong>
            {loading
              ? "图谱加载中…"
              : overview?.status?.enabled
                ? (overview.status.ready ? "图谱服务正常" : "图谱暂未就绪")
                : "图谱未启用（当前为预览数据）"}
          </strong>
          <p>
            {loop?.summary
              || (loading
                ? "正在读取知识点与关系…"
                : "完成章节绑定与资料入库后，闭环指标会逐步变绿。")}
          </p>
        </div>
        <span className="kg-stat">知识点 {loading ? "…" : points.filter((p) => p.kind !== "CATEGORY").length}</span>
        <span className="kg-stat">关系 {loading ? "…" : edges.length}</span>
        <span className="kg-stat">已绑章节 {loading ? "…" : chapterCovers.length}</span>
        <span className="kg-stat">讲解资料 {loading ? "…" : (overview?.explainsCount || 0)}</span>
      </div>

      <KnowledgeGraphStats
        loading={loading}
        points={points}
        edges={edges}
        chapterCovers={chapterCovers}
        explainsCount={overview?.explainsCount || 0}
      />

      <section className="kg-loop-panel">
        <header>
          <GitBranch size={18} />
          <div>
            <strong>教学闭环</strong>
            <small>绿勾表示该环节已有数据支撑，可按顺序自检是否打通</small>
          </div>
        </header>
        <ol className="kg-loop-steps">
          {LOOP_STEPS.map((step, index) => {
            const ok = step.ready(loop);
            return (
              <li key={step.key} className={ok ? "is-ready" : ""}>
                <span className="kg-loop-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </div>
                {ok ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="kg-main-grid">
        <section className="kg-card kg-graph-card">
          <header className="kg-graph-header">
            <div className="kg-graph-intro">
              <div className="kg-graph-intro-row">
                <strong>知识点关系图</strong>
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={redrawGraphLocal}
                  title="仅重绘关系图，不重新拉取数据"
                >
                  <RefreshCw size={14} />重绘
                </button>
              </div>
              <small>
                图上的每个点都是一个知识点。先用学段、分类缩小范围，再点选查看详情。日常浏览用「相关范围」即可。
              </small>
            </div>
            <div className="kg-graph-toolbar" role="group" aria-label="关系图筛选">
              <form className="kg-node-search" onSubmit={locateFromSearch}>
                <span>查找知识点</span>
                <div className="kg-search-row">
                  <input
                    type="search"
                    value={searchDraft}
                    placeholder="输入名称或编码"
                    onChange={(event) => setSearchDraft(event.target.value)}
                  />
                  <button className="button ghost compact" type="submit" title="定位到知识点">
                    <Search size={14} />定位
                  </button>
                </div>
              </form>
              <label>
                展示范围
                <select value={focusMode} onChange={(event) => setFocusMode(event.target.value)}>
                  {FOCUS_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                学段
                <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                分类
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">全部分类</option>
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="kg-mode-hint" role="note">
              当前范围：{focusModeHint}
            </p>
          </header>
          {graphComposition && (
            <div
              className={`kg-view-banner is-${graphComposition.viewKind}`}
              role="status"
              aria-live="polite"
            >
              <span className="kg-view-badge">{graphComposition.viewLabel}</span>
              <div className="kg-view-banner-body">
                <strong>{graphComposition.categorySummary}</strong>
                <small>{graphComposition.viewHint}</small>
              </div>
            </div>
          )}
          {loading ? (
            <p className="manager-empty">正在绘制关系图…</p>
          ) : (
            <KnowledgeForceGraph
              key={graphRedrawKey}
              points={points}
              edges={edges}
              selectedCode={selectedCode}
              focusMode={focusMode}
              stageFilter={stageFilter}
              categoryFilter={categoryFilter}
              extraNeighborCodes={extraNeighborCodes}
              enabledCategoryKeys={enabledCategoryKeys}
              onEnabledCategoryKeysChange={setEnabledCategoryKeys}
              onSelect={jumpToNode}
            />
          )}
          <div className="kg-legend">
            <span><i className="kg-legend-prereq" />先修（需先掌握）</span>
            <span><i className="kg-legend-related" />相关拓展</span>
            <span><i className="kg-legend-child" />同属一类</span>
            <span className="kg-legend-type is-category">分类</span>
            <span className="kg-legend-type is-topic">知识点</span>
            <span>滚轮缩放 · 拖拽画布 · 点击查看详情</span>
          </div>
        </section>

        <aside className="kg-card kg-detail-card">
          <header>
            <Target size={16} />
            <strong>详情</strong>
          </header>
          <p className="kg-detail-guide">
            <strong className="kg-detail-guide-strong">
              关系图只在左侧「知识点关系图」里点击节点时才会加载/切换。若左侧看不到图，请点关系图标题旁的「重绘」（仅重画，不重新拉数据）。
            </strong>
            也可用下方下拉或「定位」选知识点看详情；「直接相关」按颜色区分分类与知识点。
          </p>

          <label className="kg-picker-label">
            快速定位知识点
            <select
              value={selectedCode && selected?.kind !== "CATEGORY" ? selectedCode : ""}
              onChange={(event) => jumpToNode(event.target.value)}
              aria-label="选择知识点"
            >
              <option value="">选择知识点…</option>
              {selectablePoints.map((point) => (
                <option key={point.code} value={point.code}>
                  {point.title || "未命名知识点"}
                  {point.categoryTitle ? ` · ${point.categoryTitle}` : ""}
                </option>
              ))}
            </select>
          </label>

          {appliedQuery.trim() && (
            <ul className="kg-search-hits">
              {selectablePoints.length ? selectablePoints.slice(0, 12).map((point) => (
                <li key={point.code}>
                  <button
                    type="button"
                    className={point.code === selectedCode ? "is-active" : ""}
                    onClick={() => jumpToNode(point.code)}
                  >
                    <strong>{point.title || "未命名知识点"}</strong>
                    <small>{point.categoryTitle || pointStageLabel(point) || "未分类"}</small>
                  </button>
                </li>
              )) : (
                <li className="binding-empty">没有匹配的知识点</li>
              )}
            </ul>
          )}

          {selected ? (
            <>
              <div className="kg-detail-title-row">
                <span className={`kg-entity-badge is-${selected.kind === "CATEGORY" ? "category" : "topic"}`}>
                  {selected.kind === "CATEGORY" ? "分类" : "知识点"}
                </span>
                <h3>{selected.title || "未命名"}</h3>
              </div>
              <p className="kg-meta">
                {selected.kind === "CATEGORY"
                  ? "分类入口 · 点击下方知识点可切换为「知识点聚焦」"
                  : [
                    selected.categoryTitle || "未分类",
                    pointStageLabel(selected) ? `学段 ${pointStageLabel(selected)}` : null,
                    selected.difficulty != null ? `难度 ${selected.difficulty}` : null,
                  ].filter(Boolean).join(" · ")}
              </p>
              {graphComposition && (
                <p className={`kg-jump-layer is-${graphComposition.viewKind}`}>
                  当前所在：{graphComposition.viewLabel}
                  {" · "}
                  {graphComposition.categorySummary}
                </p>
              )}
              {isAdmin && selected.kind !== "CATEGORY" && (
                <div className="kg-detail-actions">
                  <button className="button ghost compact" type="button" onClick={openEditPoint}>
                    <Pencil size={14} />编辑
                  </button>
                  <button
                    className="button ghost compact"
                    type="button"
                    disabled={deletingPoint}
                    onClick={() => removeSelectedPoint()}
                  >
                    <Trash2 size={14} />{deletingPoint ? "删除中…" : "删除"}
                  </button>
                </div>
              )}

              <h4>直接相关（点击可跳转）</h4>
              {!neighbors.length ? (
                <p className="binding-empty">
                  暂时没有直接相关项。可把「展示范围」改成「各类抽样」再找其他点。
                </p>
              ) : (
                <div className="kg-related-groups">
                  {categoryNeighbors.length > 0 && (
                    <div className="kg-related-group">
                      <p className="kg-related-group-label is-category">分类</p>
                      <ul className="kg-neighbor-list">
                        {categoryNeighbors.map((row) => (
                          <li key={row.code}>
                            <button
                              type="button"
                              className="kg-neighbor-btn is-category"
                              onClick={() => jumpToNode(row.code)}
                            >
                              <span className="kg-neighbor-head">
                                <span className="kg-entity-badge is-category">分类</span>
                                <strong>{row.title}</strong>
                              </span>
                              <small>{neighborRelationText(row, selected.kind)}</small>
                              <em className="kg-jump-hint">{jumpTargetHint("CATEGORY")}</em>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {topicNeighbors.length > 0 && (
                    <div className="kg-related-group">
                      <p className="kg-related-group-label is-topic">知识点</p>
                      <ul className="kg-neighbor-list">
                        {topicNeighbors.map((row) => (
                          <li key={row.code}>
                            <button
                              type="button"
                              className="kg-neighbor-btn is-topic"
                              onClick={() => jumpToNode(row.code)}
                            >
                              <span className="kg-neighbor-head">
                                <span className="kg-entity-badge is-topic">知识点</span>
                                <strong>{row.title}</strong>
                              </span>
                              <small>{neighborRelationText(row, selected.kind)}</small>
                              <em className="kg-jump-hint">{jumpTargetHint("TOPIC")}</em>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <h4>
                {selected.kind === "CATEGORY"
                  ? "覆盖本分类下知识点的课程章节"
                  : "覆盖本知识点的课程章节"}
              </h4>
              {chapterHits.length ? (
                <ul className="kg-chapter-list">
                  {chapterHits.map((chapter) => (
                    <li key={`${chapter.courseId}-${chapter.chapterId}`}>
                      <BookOpen size={14} />
                      <div>
                        <strong>{chapterLabel(chapter)}</strong>
                        <small>{courseLabel(chapter)}</small>
                        {chapter.description ? <p>{chapter.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="binding-empty">
                  {isAdmin
                    ? "还没有课程章节绑定，可在课程工作台中绑定。"
                    : "还没有课程章节绑定（绑定由管理员维护）。"}
                </p>
              )}
            </>
          ) : selectedCode ? (
            <p className="binding-empty">
              已点选「{selectedCode}」，但未匹配到知识点详情。请用下方下拉框再选一次，或点左侧「重绘」后重试。
            </p>
          ) : (
            <p className="binding-empty">请在图上点击知识点，或用上方搜索 / 下拉框选择</p>
          )}
        </aside>
      </div>

      <section className="kg-card kg-bound-card">
        <header>
          <div>
            <strong>已绑定章节</strong>
            <small>
              {isAdmin
                ? "可搜索、按分类筛选；课程可折叠。支持单课/批量审查，审查后可手动改绑或 AI 一键改绑。"
                : "可搜索、按分类筛选；课程可折叠。绑定由管理员维护。"}
            </small>
          </div>
          <span className="kg-bound-count">
            {filteredBoundChapters.length}/{chapterCovers.length} 条
          </span>
        </header>

        {chapterCovers.length ? (
          <>
            <div className="kg-bound-toolbar">
              <label className="kg-bound-search">
                <Search size={14} />
                <input
                  value={boundSearch}
                  onChange={(event) => setBoundSearch(event.target.value)}
                  placeholder="搜索课程 / 章节 / 知识点"
                />
              </label>
              <select
                value={boundCategoryFilter}
                onChange={(event) => setBoundCategoryFilter(event.target.value)}
                aria-label="按知识点分类筛选"
              >
                <option value="">全部分类</option>
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="kg-bound-toolbar-actions">
                <button className="button ghost compact" type="button" onClick={expandAllBoundCourses}>
                  全部展开
                </button>
                <button className="button ghost compact" type="button" onClick={collapseAllBoundCourses}>
                  全部收起
                </button>
                {isAdmin ? (
                  <button
                    className="button primary compact"
                    type="button"
                    disabled={batchReviewing || catalogBusy || !filteredBoundChapters.some((item) => item.knowledgeCodes?.length)}
                    onClick={() => askBatchReview(filteredBoundChapters)}
                  >
                    <ShieldCheck size={14} />
                    {batchReviewing ? "批量审查中…" : "批量审查"}
                  </button>
                ) : null}
              </div>
            </div>

            {boundCourseGroups.length ? (
              <div className="kg-bound-groups">
                {boundCourseGroups.map((group) => {
                  const collapsed = boundCollapsedCourses.has(group.key);
                  const courseReviewable = group.chapters.some((item) => item.knowledgeCodes?.length);
                  const courseReviewed = group.chapters.some((item) => reviewByChapter[chapterKeyOf(item)]);
                  return (
                    <section key={group.key} className={`kg-bound-group${collapsed ? " is-collapsed" : ""}`}>
                      <div className="kg-bound-group-head">
                        <button
                          type="button"
                          className="kg-bound-group-toggle"
                          onClick={() => toggleBoundCourse(group.key)}
                          aria-expanded={!collapsed}
                        >
                          <ChevronDown size={16} className="kg-bound-chevron" />
                          <div>
                            <strong>{group.label}</strong>
                            <small>{group.chapters.length} 个章节</small>
                          </div>
                        </button>
                        {isAdmin ? (
                          <div className="kg-bound-group-actions">
                            <button
                              className="button ghost compact"
                              type="button"
                              disabled={!courseReviewable || batchReviewing || catalogBusy}
                              onClick={() => askBatchReview(group.chapters, {
                                phrase: "本课审查",
                                title: `确认审查「${group.label}」？`,
                              })}
                            >
                              <ShieldCheck size={14} />
                              审查本课
                            </button>
                            <button
                              className="button primary compact"
                              type="button"
                              disabled={!courseReviewable || batchReviewing || catalogBusy || Boolean(aiFixingKey)}
                              onClick={() => askAiFixCourse(group.chapters)}
                              title={courseReviewed ? "按审查结果改绑本课" : "未审查章节会先自动审查再改绑"}
                            >
                              <Sparkles size={14} />
                              {aiFixingKey === "course" ? "改绑中…" : "AI改本课"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {!collapsed ? (
                        <div className="kg-chapter-table">
                          {group.chapters.map((chapter) => {
                            const chapterKey = chapterKeyOf(chapter);
                            const localReview = reviewByChapter[chapterKey] || null;
                            const reviewing = reviewingChapterKey === chapterKey || batchReviewing;
                            const fixing = aiFixingKey === chapterKey || aiFixingKey === "course";
                            return (
                              <article key={chapterKey}>
                                <div className="kg-bound-head">
                                  <div>
                                    <strong>{chapterLabel(chapter)}</strong>
                                    <small className="kg-course-name">{courseLabel(chapter)}</small>
                                  </div>
                                  {isAdmin && (
                                    <div className="kg-bound-item-actions">
                                      <button
                                        className="button ghost compact"
                                        type="button"
                                        disabled={reviewing || fixing || !(chapter.knowledgeCodes || []).length}
                                        onClick={() => reviewChapter(chapter)}
                                      >
                                        <ShieldCheck size={14} />
                                        {reviewingChapterKey === chapterKey ? "审查中…" : "审查"}
                                      </button>
                                      <button
                                        className="button ghost compact"
                                        type="button"
                                        disabled={reviewing || fixing || bindingEdit?.saving}
                                        onClick={() => openBindingEditor(chapter)}
                                      >
                                        <Pencil size={14} />
                                        改绑
                                      </button>
                                      <button
                                        className="button ghost compact"
                                        type="button"
                                        disabled={reviewing || fixing || !(chapter.knowledgeCodes || []).length}
                                        onClick={() => askAiFixChapter(chapter)}
                                      >
                                        <Sparkles size={14} />
                                        {aiFixingKey === chapterKey ? "改绑中…" : "AI改"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <p>{chapter.description || "暂无章节导语"}</p>
                                <div className="kg-code-chips">
                                  {(chapter.knowledgeCodes || []).map((code) => {
                                    const title = pointByCode.get(code)?.title || code;
                                    const item = localReview?.items?.find((row) => row.code === code);
                                    return (
                                      <button
                                        key={code}
                                        type="button"
                                        className={`kg-chip${item ? ` is-${String(item.verdict || "").toLowerCase()}` : ""}`}
                                        title={item?.reason || `${title}（${code}）`}
                                        onClick={() => jumpToNode(code)}
                                      >
                                        <span>{title}</span>
                                      </button>
                                    );
                                  })}
                                  {!chapter.knowledgeCodes?.length && (
                                    <span className="binding-empty">未绑定知识点</span>
                                  )}
                                </div>
                                {localReview && (
                                  <AlignmentReviewList
                                    summary={localReview.summary}
                                    items={localReview.items}
                                    onJump={jumpToNode}
                                  />
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className="manager-empty">没有匹配的绑定章节，试试换个关键词或分类。</p>
            )}
          </>
        ) : (
          <p className="manager-empty">
            {isAdmin
              ? "暂无章节绑定。请到课程工作台填写导语并绑定知识点。"
              : "暂无章节绑定。知识点绑定由管理员维护。"}
          </p>
        )}
      </section>

      {pointModal && (
        <Modal
          title={pointModal === "edit" ? "编辑知识点" : "新建知识点"}
          onClose={() => !savingPoint && setPointModal(null)}
          width={720}
          className="kg-point-modal"
        >
          <form className="kg-point-form" onSubmit={savePoint}>
            <label>
              名称
              <div className="kg-point-code-row">
                <input
                  value={pointForm.title}
                  maxLength={128}
                  placeholder="例如：循环结构"
                  onChange={(event) => {
                    setPointForm({ ...pointForm, title: event.target.value });
                    setTitleCheck(null);
                  }}
                  required
                  autoFocus
                />
                <button
                  className="button ghost compact"
                  type="button"
                  disabled={checkingTitle || savingPoint}
                  onClick={() => validatePointTitle({ withAi: true })}
                  title="检查是否与已有知识点重复或意思接近"
                >
                  <ShieldCheck size={13} />{checkingTitle ? "检查中…" : "检查重名"}
                </button>
              </div>
              <small className="kg-point-hint">
                建议先起一个清楚的名称，再点「检查重名」，避免和学生端已有知识点重复。
              </small>
              {titleCheck && (
                <div className={`kg-title-check is-${titleCheck.status}`}>
                  {titleCheck.status === "ok" && (
                    <p>看起来没有明显重复，可以继续填写并保存。</p>
                  )}
                  {titleCheck.blockers?.length > 0 && (
                    <div>
                      <strong>名称已存在，请换一个</strong>
                      <ul>
                        {titleCheck.blockers.map((item) => (
                          <li key={`b-${item.code}`}>
                            <em className="kg-hit-name">{item.title}</em>
                            <span>{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {titleCheck.keywordHits?.length > 0 && (
                    <div>
                      <strong>这些知识点名称比较接近</strong>
                      <ul>
                        {titleCheck.keywordHits.map((item) => (
                          <li key={`k-${item.code}`}>
                            <em className="kg-hit-name">{item.title}</em>
                            <span>{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {titleCheck.aiHits?.length > 0 && (
                    <div>
                      <strong>AI 觉得意思也比较接近</strong>
                      <ul>
                        {titleCheck.aiHits.map((item) => (
                          <li key={`a-${item.code}`}>
                            <em className="kg-hit-name">{item.title}</em>
                            <span>{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {titleCheck.status === "warn" && !titleCheck.blockers?.length && (
                    <p>若确认是新知识点，可以继续保存；否则请改一下名称再检查。</p>
                  )}
                </div>
              )}
            </label>
            <label>
              编号
              <div className="kg-point-code-row">
                <input
                  value={pointForm.code}
                  maxLength={64}
                  placeholder="computing.loops"
                  onChange={(event) => {
                    setPointForm({ ...pointForm, code: event.target.value });
                    setTitleCheck(null);
                  }}
                  required
                />
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={draftPointWithAi}
                  title="根据名称自动生成编号，并尽量匹配分类"
                >
                  <Sparkles size={13} />自动生成
                </button>
              </div>
              <small className="kg-point-hint">
                编号用于系统识别，一般不用手改。填好名称后点「自动生成」即可。
                {pointModal === "edit" ? " 若你改了编号，保存后旧编号会被替换。" : ""}
              </small>
            </label>
            <label className="kg-stages-field">
              适用学段
              <div className="kg-stage-checks">
                {STAGE_OPTIONS.filter((item) => item.value).map((option) => {
                  const checked = (pointForm.stages || []).includes(option.value);
                  return (
                    <label key={option.value} className="kg-stage-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setPointForm((current) => {
                            const prev = current.stages || [];
                            const next = checked
                              ? prev.filter((item) => item !== option.value)
                              : [...prev, option.value];
                            return { ...current, stages: next };
                          });
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
              <small className="kg-point-hint">
                可多选。教学助手会按学生档案里的学段调整讲解难度，不会按节点上勾选的全部学段一刀切。
              </small>
            </label>
            <label>
              分类
              <select
                value={pointForm.categoryCode}
                onChange={(event) => onCategoryChange(event.target.value)}
              >
                <option value="">先不选分类</option>
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {!categories.length && (
                  <small className="kg-point-hint">还没有分类可选，请先点右上角「一键初始化」。</small>
              )}
            </label>

            <RelationPickerDropdown
              label="先修知识点"
              hint="学生学这个之前，最好先会哪些内容？展开后可搜索勾选，也可让 AI 帮你推荐。"
              points={linkablePoints}
              selectedCodes={pointForm.prerequisiteCodes || []}
              aiSuggestedCodes={aiPrereqCodes}
              onChange={(codes) => setPointForm((current) => ({
                ...current,
                prerequisiteCodes: codes,
              }))}
              suggesting={suggestingPrereq}
              onSuggest={() => suggestRelationLinks("prerequisite")}
              disabled={savingPoint}
              open={prereqPickerOpen}
              onOpenChange={setPrereqPickerOpen}
              filterPlaceholder="搜索要关联的先修知识点"
              emptyText="暂无可选知识点，请先点右上角「一键初始化」"
            />

            <RelationPickerDropdown
              label="相关拓展"
              hint="学完这个之后，还可以一起学哪些相关内容？展开后勾选即可连线。"
              points={linkablePoints}
              selectedCodes={pointForm.relatedCodes || []}
              aiSuggestedCodes={aiRelatedCodes}
              onChange={(codes) => setPointForm((current) => ({
                ...current,
                relatedCodes: codes,
              }))}
              suggesting={suggestingRelated}
              onSuggest={() => suggestRelationLinks("related")}
              disabled={savingPoint}
              open={relatedPickerOpen}
              onOpenChange={setRelatedPickerOpen}
              filterPlaceholder="搜索相关拓展知识点"
              emptyText="暂无可选知识点，请先点右上角「一键初始化」"
            />
            {relationSuggestNote ? <p className="binding-hint">{relationSuggestNote}</p> : null}

            <div className="kg-point-actions">
              <button className="button ghost compact" type="button" disabled={savingPoint} onClick={() => setPointModal(null)}>
                取消
              </button>
              <button className="button primary compact" type="submit" disabled={savingPoint}>
                {savingPoint ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {bindingEdit && (
        <Modal
          title={`修改绑定 · ${chapterLabel(bindingEdit.chapter)}`}
          description={`${courseLabel(bindingEdit.chapter)} · 可手动勾选，或让 AI 先补建议再保存`}
          onClose={() => !bindingEdit.saving && setBindingEdit(null)}
          width={760}
          layer={145}
          className="kg-binding-edit-modal"
        >
          <div className="kg-binding-edit">
            <div className="kg-binding-edit-toolbar">
              <p className="kg-binding-edit-hint">
                已选 {bindingEdit.codes.length} 个知识点
                {bindingEdit.chapter.description ? " · 建议结合章节导语核对" : ""}
              </p>
              <button
                className="button ghost compact"
                type="button"
                disabled={bindingEdit.saving || bindingEdit.suggesting}
                onClick={suggestBindingInEditor}
              >
                <Sparkles size={14} />
                {bindingEdit.suggesting ? "建议中…" : "AI建议补充"}
              </button>
            </div>
            <KnowledgePointPicker
              points={points}
              selectedCodes={bindingEdit.codes}
              aiSuggestedCodes={bindingEdit.aiSuggestedCodes}
              onChange={(codes) => setBindingEdit((current) => (
                current ? { ...current, codes } : current
              ))}
              mode="multi"
              layout="accordion"
              readOnly={bindingEdit.saving}
              filterPlaceholder="搜索分类或知识点"
              emptyText="暂无知识点目录"
            />
            <div className="kg-binding-edit-actions">
              <button
                className="button ghost"
                type="button"
                disabled={bindingEdit.saving}
                onClick={() => setBindingEdit(null)}
              >
                取消
              </button>
              <button
                className="button primary"
                type="button"
                disabled={bindingEdit.saving}
                onClick={saveBindingEdit}
              >
                {bindingEdit.saving ? "保存中…" : "保存绑定"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDialog && (
        <Modal
          className={`kg-confirm-modal${confirmDialog.danger ? " is-danger" : ""}${confirmPhraseRequired ? " has-phrase" : ""}`}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onClose={closeConfirmDialog}
          width={460}
          layer={140}
        >
          <div className="kg-confirm-body">
            {confirmDialog.items?.length > 0 && (
              <ul className="kg-confirm-list">
                {confirmDialog.items.map((item) => (
                  <li key={`${item.tag}-${item.code}`}>
                    <span className="kg-confirm-item-tag">{item.tag}</span>
                    <div className="kg-confirm-item-main">
                      <strong>{item.title || item.code}</strong>
                      <small>
                        {item.code}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {confirmPhraseRequired ? (
              <label className={`kg-confirm-phrase${confirmPhraseOk ? " is-ok" : ""}${confirmPhraseInput && !confirmPhraseOk ? " is-bad" : ""}`}>
                <span className="kg-confirm-phrase-label">输入确认文字</span>
                <span className="kg-confirm-phrase-target">
                  请完整输入
                  <kbd>{confirmDialog.requirePhrase}</kbd>
                </span>
                <input
                  value={confirmPhraseInput}
                  onChange={(event) => setConfirmPhraseInput(event.target.value)}
                  placeholder={confirmDialog.requirePhrase}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={savingPoint || deletingPoint || catalogBusy}
                  autoFocus
                />
                {!confirmPhraseOk && confirmPhraseInput ? (
                  <small className="field-error">与确认文字不一致</small>
                ) : null}
              </label>
            ) : null}
            <div className="kg-confirm-actions confirm-actions">
              <button
                className="button ghost"
                type="button"
                disabled={savingPoint || deletingPoint || catalogBusy}
                onClick={closeConfirmDialog}
              >
                取消
              </button>
              <button
                className={`button ${confirmDialog.danger ? "danger-solid" : "primary"}`}
                type="button"
                disabled={savingPoint || deletingPoint || catalogBusy || !confirmPhraseOk}
                onClick={() => {
                  if (!confirmPhraseOk) return;
                  confirmDialog.onConfirm?.();
                }}
              >
                {confirmDialog.confirmLabel || "确认"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
