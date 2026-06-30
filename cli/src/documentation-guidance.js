const REQUIRED_DOCUMENTS = [
  {
    code: "agents_md_missing",
    path: "AGENTS.md",
    label: "agent rules",
    why: "讓 agent 先知道這個 workspace 的工作規則和不能踩的邊界。",
    next_step: "新增 AGENTS.md，先用幾段白話寫清楚專案目標、常用指令、開工前要讀哪些文件。"
  },
  {
    code: "readme_missing",
    path: "README.md",
    label: "workspace overview",
    why: "讓第一次看到專案的人快速知道這裡有哪些 repo，以及各自大概做什麼。",
    next_step: "新增 README.md，用一小段說明 workspace 用途，再列出主要資料夾。"
  },
  {
    code: "decision_index_missing",
    path: "docs/decisions/index.md",
    label: "decision index",
    why: "讓重要決策有入口，不用每次重新翻對話或猜現在的設計方向。",
    next_step: "新增 docs/decisions/index.md，先列出目前已確定的架構、產品、流程決策。"
  }
];

const OPTIONAL_DOCUMENTS = [
  {
    code: "adr_missing",
    path: "docs/decisions/ADR-*.md",
    label: "ADR files",
    why: "當決策會影響多人或多個 repo 時，用 ADR 留下原因和取捨。",
    next_step: "下次有重大決策時，新增一篇 ADR，記錄背景、決定、後果。"
  },
  {
    code: "specs_missing",
    path: "openspec/specs/ or docs/superpowers/specs/",
    label: "spec files",
    why: "讓需求和驗收條件有固定位置，agent 不會只靠聊天記憶工作。",
    next_step: "若這個 workspace 會持續開發功能，建立 specs 目錄保存需求和驗收條件。"
  }
];

function hasExactPath(evidence, path) {
  return evidence.includes(path);
}

function hasPathWithPrefix(evidence, prefix) {
  return evidence.some((path) => path.startsWith(prefix));
}

function hasAdr(evidence) {
  return evidence.some((path) => /^docs\/decisions\/ADR-.*\.md$/.test(path));
}

function hasSpecs(evidence) {
  return evidence.some((path) =>
    path.startsWith("openspec/specs/") ||
    path.startsWith("docs/superpowers/specs/")
  );
}

export function createDocumentationGuidance(scan) {
  const rootGuidance = scan.root?.guidance ?? [];
  const missing = [];

  if (!hasExactPath(rootGuidance, "AGENTS.md")) {
    missing.push(REQUIRED_DOCUMENTS[0]);
  }
  if (!hasExactPath(rootGuidance, "README.md")) {
    missing.push(REQUIRED_DOCUMENTS[1]);
  }
  if (!hasExactPath(rootGuidance, "docs/decisions/index.md")) {
    missing.push(REQUIRED_DOCUMENTS[2]);
  }
  if (hasPathWithPrefix(rootGuidance, "docs/decisions/") && !hasAdr(rootGuidance)) {
    missing.push(OPTIONAL_DOCUMENTS[0]);
  }
  if (!hasSpecs(rootGuidance)) {
    missing.push(OPTIONAL_DOCUMENTS[1]);
  }

  return {
    ok: missing.length === 0,
    missing,
    summary: missing.length === 0
      ? "這個 workspace 的決策文件入口看起來已經夠 agent 使用。"
      : "目前少了一些基本決策文件。先補重要的入口文件，agent 才不用靠猜的理解專案。"
  };
}

export function formatDocumentationGuidance(guidance) {
  if (!guidance || guidance.ok || guidance.missing.length === 0) {
    return [];
  }

  return [
    guidance.summary,
    ...guidance.missing.map((item) => `- ${item.path}: ${item.next_step}`)
  ];
}
