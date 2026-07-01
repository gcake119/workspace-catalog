use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use serde_yaml::{Mapping, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const CATALOG_DIR: &str = ".workspace-catalog";
const CATALOG_FILE: &str = "catalog.yaml";
const DRAFT_FILE: &str = "catalog.draft.yaml";
const REVIEW_FILE: &str = "review.md";
const REVIEW_QUESTIONS_FILE: &str = "review-questions.json";
const STATUS_FILE: &str = "status.json";
const DRIFT_FILE: &str = "drift-report.md";

const ROOT_GUIDANCE_FILES: &[&str] = &["AGENTS.md", "README.md", ".cursorrules", "package.json"];
const GUIDANCE_FILES: &[&str] = &[
    "AGENTS.md",
    "README.md",
    ".cursorrules",
    "docs/decisions/index.md",
    "package.json",
];
const GUIDANCE_DIRS: &[(&str, Option<&str>)] = &[
    (".cursor/rules", None),
    ("docs/decisions", Some("ADR-")),
    ("openspec/specs", None),
    ("openspec/changes", None),
    ("docs/superpowers/specs", None),
    ("docs/superpowers/plans", None),
];

#[derive(Debug, Clone, Serialize)]
struct ScanResult {
    root: GuidanceGroup,
    tools: Vec<ToolEvidence>,
    codebase_memory: Availability,
    documentation_guidance: DocumentationGuidance,
}

#[derive(Debug, Clone, Serialize)]
struct GuidanceGroup {
    path: String,
    guidance: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ToolEvidence {
    path: String,
    guidance: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct Availability {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DocumentationGuidance {
    ok: bool,
    missing: Vec<DocSuggestion>,
    summary: String,
}

#[derive(Debug, Clone, Serialize)]
struct DocSuggestion {
    code: &'static str,
    path: &'static str,
    label: &'static str,
    why: &'static str,
    next_step: &'static str,
}

#[derive(Debug, Serialize)]
struct PreflightReport {
    generated_at: String,
    workspace: String,
    catalog: CatalogRef,
    trigger: Trigger,
    reminders: Vec<Reminder>,
}

#[derive(Debug, Serialize)]
struct CatalogRef {
    exists: bool,
    path: String,
}

#[derive(Debug, Serialize)]
struct Trigger {
    event: Option<String>,
    changed_files: Vec<String>,
}

#[derive(Debug, Serialize)]
struct Reminder {
    code: &'static str,
    message: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    documentation_guidance: Option<DocumentationGuidance>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    changed_files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    event: Option<String>,
}

#[derive(Debug, Serialize)]
struct DriftReport {
    generated_at: String,
    evidence: DriftEvidence,
    items: Vec<DriftItem>,
}

#[derive(Debug, Serialize)]
struct DriftEvidence {
    scanned_sources: Vec<String>,
    codebase_memory: Availability,
}

#[derive(Debug, Serialize)]
struct DriftItem {
    code: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
}

#[derive(Debug, Serialize)]
struct StatusSnapshot {
    generated_at: String,
    catalog_ref: StatusCatalogRef,
    live_status: LiveStatus,
}

#[derive(Debug, Serialize)]
struct StatusCatalogRef {
    path: String,
    schema_version: i64,
    workspace_id: String,
    tool_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct LiveStatus {
    git: JsonValue,
    spectra: JsonValue,
    adr_index: JsonValue,
    package_scripts: Vec<PackageScripts>,
    suggested_verification_commands: Vec<VerificationCommand>,
    codebase_memory: Availability,
}

#[derive(Debug, Serialize)]
struct PackageScripts {
    ok: bool,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<&'static str>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    scripts: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct VerificationCommand {
    script: String,
    command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReviewQuestionQueue {
    current_index: usize,
    questions: Vec<ReviewQuestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReviewQuestion {
    id: String,
    kind: String,
    question: String,
    current_value: String,
    suggested_action: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    answer: Option<String>,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    let executable = Path::new(
        args.first()
            .map(String::as_str)
            .unwrap_or("workspace-catalog"),
    )
    .file_name()
    .and_then(OsStr::to_str)
    .unwrap_or("workspace-catalog");

    if executable.contains("workspace-catalog-session-preflight") {
        let start = args
            .get(1)
            .map(PathBuf::from)
            .unwrap_or(env::current_dir().map_err(to_string)?);
        return run_session_preflight(&start, &args[2..]);
    }

    if executable.contains("workspace-catalog-preflight") {
        let workspace = args
            .get(1)
            .map(PathBuf::from)
            .unwrap_or(env::current_dir().map_err(to_string)?);
        return run_preflight(&workspace, &args[2..]);
    }

    let command = args.get(1).map(String::as_str).unwrap_or("");
    let workspace = args
        .get(2)
        .map(PathBuf::from)
        .unwrap_or(env::current_dir().map_err(to_string)?);
    match command {
        "scan" => run_scan(&workspace),
        "review" => run_review(&workspace),
        "next-question" => run_next_question(&workspace),
        "answer-question" => run_answer_question(&workspace, &args[3..]),
        "preflight" => run_preflight(&workspace, &args[3..]),
        "drift" => run_drift(&workspace),
        "status" => run_status(&workspace),
        "confirm" => run_confirm(&workspace, &args[3..]),
        _ => {
            eprintln!(
                "Usage: workspace-catalog <scan|review|next-question|answer-question|status|drift|preflight|confirm> [workspace]"
            );
            Err("unknown command".to_string())
        }
    }
}

fn run_scan(workspace: &Path) -> Result<(), String> {
    let scan = scan_workspace(workspace).map_err(to_string)?;
    let draft = build_draft(workspace, &scan);
    fs::create_dir_all(catalog_dir(workspace)).map_err(to_string)?;
    let output = draft_path(workspace);
    fs::write(&output, serde_yaml::to_string(&draft).map_err(to_string)?).map_err(to_string)?;
    println!("Wrote {}", output.display());
    let review_output = write_review_report(workspace, &draft).map_err(to_string)?;
    println!("Wrote {}", review_output.display());
    let questions_output = write_review_questions(workspace, &draft).map_err(to_string)?;
    println!("Wrote {}", questions_output.display());
    println!(
        "Next: run workspace-catalog next-question, then ask the user one question at a time."
    );
    Ok(())
}

fn run_review(workspace: &Path) -> Result<(), String> {
    let draft = read_yaml(&draft_path(workspace))?;
    let output = write_review_report(workspace, &draft).map_err(to_string)?;
    println!("Wrote {}", output.display());
    let questions_output = write_review_questions(workspace, &draft).map_err(to_string)?;
    println!("Wrote {}", questions_output.display());
    println!("{}", format_review_report(&draft));
    Ok(())
}

fn run_next_question(workspace: &Path) -> Result<(), String> {
    let queue = load_or_create_review_questions(workspace)?;
    println!("{}", format_next_question(&queue));
    Ok(())
}

fn run_answer_question(workspace: &Path, args: &[String]) -> Result<(), String> {
    let question_id = args
        .first()
        .ok_or("answer-question requires a question id")?
        .to_string();
    let answer = parse_answer_arg(args)?;
    let mut queue = load_or_create_review_questions(workspace)?;
    let question = queue
        .questions
        .iter_mut()
        .find(|question| question.id == question_id)
        .ok_or_else(|| format!("question not found: {question_id}"))?;
    question.status = "answered".to_string();
    question.answer = Some(answer);
    queue.current_index = queue
        .questions
        .iter()
        .position(|question| question.status != "answered")
        .unwrap_or(queue.questions.len());
    write_review_question_queue(workspace, &queue).map_err(to_string)?;
    println!("{}", format_next_question(&queue));
    Ok(())
}

fn run_preflight(workspace: &Path, args: &[String]) -> Result<(), String> {
    let report = create_preflight_report(workspace, args)?;
    println!("{}", format_preflight_report(&report));
    Ok(())
}

fn run_session_preflight(start: &Path, args: &[String]) -> Result<(), String> {
    let Some(workspace) = find_initialized_workspace(start) else {
        return Ok(());
    };
    let report = create_preflight_report(&workspace, args)?;
    let formatted = format_preflight_report(&report);
    if formatted != "No workspace catalog preflight reminders." {
        println!("{formatted}");
    }
    Ok(())
}

fn run_drift(workspace: &Path) -> Result<(), String> {
    let report = detect_drift(workspace)?;
    let output = write_drift_report(workspace, &report).map_err(to_string)?;
    println!("Wrote {}", output.display());
    Ok(())
}

fn run_status(workspace: &Path) -> Result<(), String> {
    let snapshot = create_status_snapshot(workspace)?;
    fs::create_dir_all(catalog_dir(workspace)).map_err(to_string)?;
    let output = catalog_dir(workspace).join(STATUS_FILE);
    fs::write(
        &output,
        serde_json::to_string_pretty(&snapshot).map_err(to_string)?,
    )
    .map_err(to_string)?;
    println!("Wrote {}", output.display());
    Ok(())
}

fn run_confirm(workspace: &Path, args: &[String]) -> Result<(), String> {
    if !args.iter().any(|arg| arg == "--yes") {
        return Err(
            "confirm requires --yes after the user has reviewed and approved the draft".to_string(),
        );
    }

    let draft = read_yaml(&draft_path(workspace))?;
    let inference_paths = find_inference_wrappers(&draft, Vec::new());
    if !inference_paths.is_empty() {
        return Err(inference_paths
            .into_iter()
            .map(|path| format!("unconfirmed inference remains at {path}"))
            .collect::<Vec<_>>()
            .join("\n"));
    }

    let mut catalog = draft
        .as_mapping()
        .cloned()
        .ok_or("draft catalog must be a mapping")?;
    for key in ["questions", "evidence", "recommended_next_steps"] {
        catalog.remove(Value::String(key.to_string()));
    }
    validate_catalog(&Value::Mapping(catalog.clone()))?;

    fs::create_dir_all(catalog_dir(workspace)).map_err(to_string)?;
    let output = confirmed_catalog_path(workspace);
    fs::write(
        &output,
        serde_yaml::to_string(&Value::Mapping(catalog)).map_err(to_string)?,
    )
    .map_err(to_string)?;
    println!("Wrote {}", output.display());
    Ok(())
}

fn scan_workspace(root: &Path) -> io::Result<ScanResult> {
    let root_guidance = collect_guidance(root, Path::new(""), ROOT_GUIDANCE_FILES)?;
    let tools = list_child_dirs(root)?
        .into_iter()
        .filter_map(|dir| {
            let guidance = collect_guidance(root, Path::new(&dir), GUIDANCE_FILES).ok()?;
            if guidance.is_empty() {
                None
            } else {
                Some(ToolEvidence {
                    path: dir,
                    guidance,
                })
            }
        })
        .collect::<Vec<_>>();

    let mut scan = ScanResult {
        root: GuidanceGroup {
            path: ".".to_string(),
            guidance: root_guidance,
        },
        tools,
        codebase_memory: Availability {
            ok: false,
            reason: Some("codebase_memory_unavailable".to_string()),
        },
        documentation_guidance: DocumentationGuidance {
            ok: true,
            missing: Vec::new(),
            summary: String::new(),
        },
    };
    scan.documentation_guidance = create_documentation_guidance(&scan);
    Ok(scan)
}

fn collect_guidance(root: &Path, base: &Path, exact_files: &[&str]) -> io::Result<Vec<String>> {
    let mut found = BTreeSet::new();
    for file in exact_files {
        let path = root.join(base).join(file);
        if path.exists() {
            found.insert(relative_string(root, &path));
        }
    }

    for (dir, prefix) in GUIDANCE_DIRS {
        let dir_path = root.join(base).join(dir);
        collect_recursive(root, &dir_path, *prefix, &mut found)?;
    }

    Ok(found.into_iter().collect())
}

fn collect_recursive(
    root: &Path,
    current: &Path,
    prefix: Option<&str>,
    found: &mut BTreeSet<String>,
) -> io::Result<()> {
    if !current.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !["node_modules", ".git", ".workspace-catalog"].contains(&name.as_str()) {
                collect_recursive(root, &path, prefix, found)?;
            }
        } else if path.is_file() && prefix.map(|p| name.starts_with(p)).unwrap_or(true) {
            found.insert(relative_string(root, &path));
        }
    }
    Ok(())
}

fn list_child_dirs(root: &Path) -> io::Result<Vec<String>> {
    let mut dirs = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if entry.path().is_dir()
            && !name.starts_with('.')
            && !["node_modules", ".git", ".workspace-catalog", ".cursor"].contains(&name.as_str())
        {
            dirs.push(name);
        }
    }
    dirs.sort();
    Ok(dirs)
}

fn build_draft(workspace: &Path, scan: &ScanResult) -> Value {
    let workspace_name = workspace
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("workspace");
    let mut root = Mapping::new();
    root.insert(s("schema_version"), Value::Number(1.into()));

    let mut workspace_map = Mapping::new();
    workspace_map.insert(
        s("id"),
        inference(workspace_name, "medium", &scan.root.guidance),
    );
    workspace_map.insert(
        s("name"),
        inference(workspace_name, "medium", &scan.root.guidance),
    );
    workspace_map.insert(
        s("purpose"),
        inference(
            "Review workspace docs to confirm purpose.",
            "low",
            &scan.root.guidance,
        ),
    );
    workspace_map.insert(
        s("orientation"),
        inference(
            "Review workspace docs to confirm orientation.",
            "low",
            &scan.root.guidance,
        ),
    );
    root.insert(s("workspace"), Value::Mapping(workspace_map));

    let mut routing = Mapping::new();
    routing.insert(
        s("default_skills"),
        inference_array(Vec::new(), "low", &scan.root.guidance),
    );
    routing.insert(
        s("task_routes"),
        inference_array(Vec::new(), "low", &scan.root.guidance),
    );
    routing.insert(
        s("rules"),
        inference_array(Vec::new(), "low", &scan.root.guidance),
    );
    root.insert(s("agent_routing"), Value::Mapping(routing));
    root.insert(s("workflows"), Value::Sequence(Vec::new()));

    let tools = scan
        .tools
        .iter()
        .map(|tool| {
            let mut item = Mapping::new();
            item.insert(s("id"), s(&tool.path));
            item.insert(s("path"), s(format!("./{}", tool.path)));
            item.insert(s("role"), inference("unknown", "low", &tool.guidance));
            item.insert(s("primary_docs"), string_sequence(&tool.guidance));
            item.insert(
                s("recommended_skills"),
                inference_array(Vec::new(), "low", &tool.guidance),
            );
            item.insert(
                s("required_preflight_skills"),
                inference_array(Vec::new(), "low", &tool.guidance),
            );
            item.insert(
                s("skill_rules"),
                inference_array(Vec::new(), "low", &tool.guidance),
            );
            item.insert(
                s("disabled_skills"),
                inference_array(Vec::new(), "low", &tool.guidance),
            );
            Value::Mapping(item)
        })
        .collect();
    root.insert(s("tools"), Value::Sequence(tools));

    let questions = scan
        .tools
        .iter()
        .flat_map(|tool| {
            [
                Value::String(format!(
                    "What role does {} play in this workspace?",
                    tool.path
                )),
                Value::String(format!(
                    "Which skills should agents use or avoid when working on {}?",
                    tool.path
                )),
            ]
        })
        .collect();
    root.insert(s("questions"), Value::Sequence(questions));
    root.insert(
        s("recommended_next_steps"),
        serde_yaml::to_value(&scan.documentation_guidance).unwrap_or(Value::Null),
    );
    root.insert(
        s("evidence"),
        serde_yaml::to_value(evidence_summary(scan)).unwrap_or(Value::Null),
    );
    Value::Mapping(root)
}

fn write_review_report(root: &Path, draft: &Value) -> io::Result<PathBuf> {
    fs::create_dir_all(catalog_dir(root))?;
    let output = catalog_dir(root).join(REVIEW_FILE);
    fs::write(&output, format!("{}\n", format_review_report(draft)))?;
    Ok(output)
}

fn write_review_questions(root: &Path, draft: &Value) -> io::Result<PathBuf> {
    fs::create_dir_all(catalog_dir(root))?;
    let queue = build_review_question_queue(draft);
    write_review_question_queue(root, &queue)
}

fn write_review_question_queue(root: &Path, queue: &ReviewQuestionQueue) -> io::Result<PathBuf> {
    fs::create_dir_all(catalog_dir(root))?;
    let output = catalog_dir(root).join(REVIEW_QUESTIONS_FILE);
    let content = serde_json::to_string_pretty(queue).map_err(io::Error::other)?;
    fs::write(&output, format!("{content}\n"))?;
    Ok(output)
}

fn load_or_create_review_questions(root: &Path) -> Result<ReviewQuestionQueue, String> {
    let path = review_questions_path(root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(to_string)?;
        return serde_json::from_str(&content).map_err(to_string);
    }
    let draft = read_yaml(&draft_path(root))?;
    let queue = build_review_question_queue(&draft);
    write_review_question_queue(root, &queue).map_err(to_string)?;
    Ok(queue)
}

fn build_review_question_queue(draft: &Value) -> ReviewQuestionQueue {
    let empty = Value::Null;
    let workspace = draft.get("workspace").unwrap_or(&empty);
    let mut questions = Vec::new();
    questions.push(ReviewQuestion {
        id: "workspace.purpose".to_string(),
        kind: "workspace".to_string(),
        question: "這個 workspace 的主要用途是什麼？".to_string(),
        current_value: plain_field(workspace, "purpose"),
        suggested_action: "請用一句話確認或修正。".to_string(),
        status: "pending".to_string(),
        answer: None,
    });
    questions.push(ReviewQuestion {
        id: "workspace.orientation".to_string(),
        kind: "workspace".to_string(),
        question: "agent 進入這個 workspace 時，最需要先理解的方向或邊界是什麼？".to_string(),
        current_value: plain_field(workspace, "orientation"),
        suggested_action:
            "例如：這是 coordination layer、產品 repo、文件工具，或只負責某段工作流。".to_string(),
        status: "pending".to_string(),
        answer: None,
    });

    for tool in draft
        .get("tools")
        .and_then(Value::as_sequence)
        .into_iter()
        .flatten()
    {
        let id = plain_field(tool, "id");
        let path = plain_field(tool, "path");
        questions.push(ReviewQuestion {
            id: format!("tools.{id}.role"),
            kind: "tool_role".to_string(),
            question: format!("{id} 在這個 workspace 負責什麼？"),
            current_value: format!("路徑：{path}；目前角色：{}", plain_field(tool, "role")),
            suggested_action:
                "例如：frontend、backend、workflow bot、knowledge engine、supporting tool。"
                    .to_string(),
            status: "pending".to_string(),
            answer: None,
        });
        questions.push(ReviewQuestion {
            id: format!("tools.{id}.skills"),
            kind: "skill_routing".to_string(),
            question: format!("agent 處理 {id} 時，適合或不適合使用哪些 skills？"),
            current_value: plain_field(tool, "recommended_skills"),
            suggested_action: "可以回答適合的 skill、必須先讀的 skill，或沒有特別規則。"
                .to_string(),
            status: "pending".to_string(),
            answer: None,
        });
    }

    ReviewQuestionQueue {
        current_index: 0,
        questions,
    }
}

fn format_next_question(queue: &ReviewQuestionQueue) -> String {
    let Some((index, question)) = queue
        .questions
        .iter()
        .enumerate()
        .find(|(_, question)| question.status != "answered")
    else {
        return "所有 review 問題都已回答。請整理 catalog.draft.yaml，確認後再執行 workspace-catalog confirm <workspace> --yes。".to_string();
    };
    format!(
        "問題 {}/{} [{}]\n{}\n目前判斷：{}\n回覆方式：{}\n記錄回答：workspace-catalog answer-question <workspace> {} --answer \"你的回答\"",
        index + 1,
        queue.questions.len(),
        question.id,
        question.question,
        question.current_value,
        question.suggested_action,
        question.id
    )
}

fn parse_answer_arg(args: &[String]) -> Result<String, String> {
    let answer = args
        .windows(2)
        .find_map(|window| (window[0] == "--answer").then(|| window[1].clone()))
        .ok_or("answer-question requires --answer <text>")?;
    if answer.trim().is_empty() {
        Err("answer cannot be empty".to_string())
    } else {
        Ok(answer)
    }
}

fn format_review_report(draft: &Value) -> String {
    let empty = Value::Null;
    let workspace = draft.get("workspace").unwrap_or(&empty);
    let workspace_name = plain_field(workspace, "name");
    let workspace_purpose = plain_field(workspace, "purpose");
    let workspace_orientation = plain_field(workspace, "orientation");

    let mut lines = vec![
        "# Workspace Catalog Review".to_string(),
        "".to_string(),
        "請先確認這 4 件事，不需要直接讀 YAML。".to_string(),
        "".to_string(),
        "## 1. Workspace 方向".to_string(),
        "".to_string(),
        format!("- 名稱：{workspace_name}"),
        format!("- 目的：{workspace_purpose}"),
        format!("- 方向：{workspace_orientation}"),
        "".to_string(),
        "## 2. 子 repo 與角色".to_string(),
        "".to_string(),
    ];

    let tools = draft
        .get("tools")
        .and_then(Value::as_sequence)
        .cloned()
        .unwrap_or_default();
    if tools.is_empty() {
        lines.push("- 尚未掃描到子 repo。".to_string());
    } else {
        lines.extend(tools.iter().map(|tool| {
            let id = plain_field(tool, "id");
            let path = plain_field(tool, "path");
            let role = plain_field(tool, "role");
            format!("- {id}：{path}，角色：{role}")
        }));
    }

    lines.extend([
        "".to_string(),
        "## 3. Agent／Skill 使用方式".to_string(),
        "".to_string(),
    ]);
    let routing = draft.get("agent_routing").unwrap_or(&empty);
    lines.push(format!(
        "- Workspace 預設 skills：{}",
        plain_field(routing, "default_skills")
    ));
    lines.push(format!(
        "- Task routes：{}",
        plain_field(routing, "task_routes")
    ));
    for tool in &tools {
        let id = plain_field(tool, "id");
        let skills = plain_field(tool, "recommended_skills");
        lines.push(format!("- {id} 適用 skills：{skills}"));
    }

    lines.extend([
        "".to_string(),
        "## 4. 需要使用者確認或補充".to_string(),
        "".to_string(),
    ]);
    let questions = draft
        .get("questions")
        .and_then(Value::as_sequence)
        .cloned()
        .unwrap_or_default();
    if questions.is_empty() {
        lines.push("- 目前沒有額外問題。".to_string());
    } else {
        lines.extend(
            questions
                .iter()
                .filter_map(Value::as_str)
                .map(|question| format!("- {}", plain_question(question))),
        );
    }

    lines.extend([
        "".to_string(),
        "## 回覆方式".to_string(),
        "".to_string(),
        "- 如果正確，回覆：正確，可以更新記憶。".to_string(),
        "- 如果有錯，回覆：需要修改，然後指出哪一項不對。".to_string(),
        "".to_string(),
        "確認前不會寫入 .workspace-catalog/catalog.yaml。".to_string(),
    ]);
    lines.join("\n")
}

fn create_preflight_report(root: &Path, args: &[String]) -> Result<PreflightReport, String> {
    let parsed = parse_preflight_args(args);
    let catalog_exists = confirmed_catalog_path(root).exists();
    let mut reminders = Vec::new();

    if catalog_exists {
        reminders.push(Reminder {
            code: "WORKSPACE_CATALOG_READ_REQUIRED",
            message: "Read .workspace-catalog/catalog.yaml before inferring tool roles, workflow boundaries, or active project direction.",
            documentation_guidance: None,
            changed_files: Vec::new(),
            event: None,
        });
    } else {
        let scan = scan_workspace(root).map_err(to_string)?;
        if !scan.tools.is_empty() {
            reminders.push(Reminder {
                code: "WORKSPACE_CATALOG_MISSING",
                message: "Use the workspace-catalog skill to scan this workspace and produce a draft catalog for user confirmation.",
                documentation_guidance: Some(scan.documentation_guidance),
                changed_files: Vec::new(),
                event: None,
            });
        } else if !scan.documentation_guidance.ok {
            reminders.push(Reminder {
                code: "WORKSPACE_DOCUMENTATION_MISSING",
                message: "這個 workspace 還缺少基本文件，agent 會比較難判斷專案決策。",
                documentation_guidance: Some(scan.documentation_guidance),
                changed_files: Vec::new(),
                event: None,
            });
        }
    }

    let drift_relevant_files = parsed
        .changed_files
        .iter()
        .map(|path| normalize_changed_path(path))
        .filter(|path| is_drift_relevant_path(path))
        .collect::<Vec<_>>();
    let drift_event = parsed.event.as_deref() == Some("spectra-archive");
    if catalog_exists && (drift_event || !drift_relevant_files.is_empty()) {
        reminders.push(Reminder {
            code: "WORKSPACE_CATALOG_DRIFT_POSSIBLE",
            message: "Catalog drift may exist because workspace guidance, ADRs, README, or Spectra artifacts changed. Run workspace-catalog drift or refresh the draft before relying on old catalog semantics.",
            documentation_guidance: None,
            changed_files: drift_relevant_files,
            event: parsed.event.clone(),
        });
    }

    Ok(PreflightReport {
        generated_at: now_iso(),
        workspace: root.display().to_string(),
        catalog: CatalogRef {
            exists: catalog_exists,
            path: relative_confirmed_catalog_path(),
        },
        trigger: Trigger {
            event: parsed.event,
            changed_files: parsed.changed_files,
        },
        reminders,
    })
}

fn format_preflight_report(report: &PreflightReport) -> String {
    if report.reminders.is_empty() {
        return "No workspace catalog preflight reminders.".to_string();
    }
    report
        .reminders
        .iter()
        .map(|reminder| {
            let mut lines = vec![format!("{}: {}", reminder.code, reminder.message)];
            if let Some(guidance) = &reminder.documentation_guidance {
                if !guidance.ok && !guidance.missing.is_empty() {
                    lines.push(guidance.summary.clone());
                    lines.extend(
                        guidance
                            .missing
                            .iter()
                            .map(|item| format!("- {}: {}", item.path, item.next_step)),
                    );
                }
            }
            lines.join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn detect_drift(root: &Path) -> Result<DriftReport, String> {
    let catalog_path = confirmed_catalog_path(root);
    let catalog = read_yaml(&catalog_path)?;
    validate_catalog(&catalog)?;
    let catalog_mtime = fs::metadata(&catalog_path)
        .ok()
        .and_then(|meta| meta.modified().ok());
    let scan = scan_workspace(root).map_err(to_string)?;
    let current_evidence = flatten_evidence(&scan);
    let catalog_sources = catalog_evidence_sources(&catalog);
    let mut items = Vec::new();

    if let Some(tools) = catalog.get("tools").and_then(Value::as_sequence) {
        for tool in tools {
            let tool_id = string_field(tool, "id");
            let tool_path = string_field(tool, "path");
            match tool_path
                .as_deref()
                .and_then(|path| resolve_workspace_path(root, path).ok())
            {
                Some(path) => {
                    if !path.exists() {
                        items.push(DriftItem {
                            code: "CATALOG_TOOL_PATH_MISSING",
                            message: format!(
                                "Catalog tool path is missing: {}",
                                tool_path.unwrap_or_default()
                            ),
                            tool_id,
                            source: None,
                        });
                    }
                }
                None => items.push(DriftItem {
                    code: "CATALOG_TOOL_PATH_INVALID",
                    message: format!(
                        "Catalog tool path is invalid: {}",
                        tool_path.unwrap_or_default()
                    ),
                    tool_id,
                    source: None,
                }),
            }
        }
    }

    for source in &current_evidence {
        if !catalog_sources.contains(source) {
            items.push(DriftItem {
                code: "CATALOG_EVIDENCE_SOURCE_NEW",
                message: format!(
                    "Workspace evidence source is not referenced by the local catalog: {source}"
                ),
                tool_id: None,
                source: Some(source.clone()),
            });
        }
        if is_docs_or_spec_source(source) {
            if let (Some(catalog_time), Ok(source_meta)) =
                (catalog_mtime, fs::metadata(root.join(source)))
            {
                if let Ok(source_time) = source_meta.modified() {
                    if source_time > catalog_time {
                        items.push(DriftItem {
                            code: "CATALOG_EVIDENCE_NEWER_THAN_CATALOG",
                            message: format!(
                                "Workspace evidence changed after the local catalog: {source}"
                            ),
                            tool_id: None,
                            source: Some(source.clone()),
                        });
                    }
                }
            }
        }
    }

    Ok(DriftReport {
        generated_at: now_iso(),
        evidence: DriftEvidence {
            scanned_sources: current_evidence,
            codebase_memory: scan.codebase_memory,
        },
        items,
    })
}

fn write_drift_report(root: &Path, report: &DriftReport) -> io::Result<PathBuf> {
    fs::create_dir_all(catalog_dir(root))?;
    let output = catalog_dir(root).join(DRIFT_FILE);
    let mut lines = vec![
        "# Workspace Catalog Drift Report".to_string(),
        "".to_string(),
        format!("Generated: {}", report.generated_at),
        "".to_string(),
        "## Scanned Evidence".to_string(),
        "".to_string(),
    ];
    lines.extend(
        report
            .evidence
            .scanned_sources
            .iter()
            .map(|source| format!("- {source}")),
    );
    lines.extend(["".to_string(), "## Findings".to_string(), "".to_string()]);
    if report.items.is_empty() {
        lines.push("- No drift items detected.".to_string());
    } else {
        lines.extend(
            report
                .items
                .iter()
                .map(|item| format!("- {}: {}", item.code, item.message)),
        );
    }
    fs::write(&output, format!("{}\n", lines.join("\n")))?;
    Ok(output)
}

fn create_status_snapshot(root: &Path) -> Result<StatusSnapshot, String> {
    let catalog = read_yaml(&confirmed_catalog_path(root))?;
    validate_catalog(&catalog)?;
    let schema_version = catalog
        .get("schema_version")
        .and_then(Value::as_i64)
        .unwrap_or(1);
    let workspace_id = catalog
        .get("workspace")
        .and_then(|workspace| workspace.get("id"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let tool_ids = catalog
        .get("tools")
        .and_then(Value::as_sequence)
        .map(|tools| {
            tools
                .iter()
                .filter_map(|tool| string_field(tool, "id"))
                .collect()
        })
        .unwrap_or_default();
    let package_scripts = collect_package_scripts(root, &catalog);
    let suggested_verification_commands = package_scripts
        .iter()
        .flat_map(verification_commands_for_package)
        .collect();

    Ok(StatusSnapshot {
        generated_at: now_iso(),
        catalog_ref: StatusCatalogRef {
            path: relative_confirmed_catalog_path(),
            schema_version,
            workspace_id,
            tool_ids,
        },
        live_status: LiveStatus {
            git: collect_git_status(root),
            spectra: collect_spectra_status(root),
            adr_index: serde_json::json!({
                "ok": root.join("docs/decisions/index.md").exists(),
                "path": "docs/decisions/index.md"
            }),
            package_scripts,
            suggested_verification_commands,
            codebase_memory: Availability {
                ok: false,
                reason: Some("codebase_memory_unavailable".to_string()),
            },
        },
    })
}

fn collect_package_scripts(root: &Path, catalog: &Value) -> Vec<PackageScripts> {
    let mut package_paths = BTreeSet::from(["package.json".to_string()]);
    let mut invalid = Vec::new();
    if let Some(tools) = catalog.get("tools").and_then(Value::as_sequence) {
        for tool in tools {
            let tool_id = string_field(tool, "id");
            let Some(raw_path) = string_field(tool, "path") else {
                invalid.push(PackageScripts {
                    ok: false,
                    path: String::new(),
                    tool_id,
                    reason: Some("catalog_tool_path_invalid"),
                    scripts: BTreeMap::new(),
                });
                continue;
            };
            match resolve_workspace_path(root, &raw_path) {
                Ok(path) => {
                    package_paths.insert(format!("{}/package.json", relative_string(root, &path)));
                }
                Err(_) => invalid.push(PackageScripts {
                    ok: false,
                    path: raw_path,
                    tool_id,
                    reason: Some("catalog_tool_path_invalid"),
                    scripts: BTreeMap::new(),
                }),
            }
        }
    }

    let mut packages = package_paths
        .into_iter()
        .map(|path| read_package_scripts(root, &path))
        .collect::<Vec<_>>();
    packages.extend(invalid);
    packages
}

fn read_package_scripts(root: &Path, package_path: &str) -> PackageScripts {
    let path = root.join(package_path);
    let Ok(content) = fs::read_to_string(&path) else {
        return PackageScripts {
            ok: false,
            path: package_path.to_string(),
            tool_id: None,
            reason: Some("package_json_missing"),
            scripts: BTreeMap::new(),
        };
    };
    let Ok(json) = serde_json::from_str::<JsonValue>(&content) else {
        return PackageScripts {
            ok: false,
            path: package_path.to_string(),
            tool_id: None,
            reason: Some("package_json_unreadable"),
            scripts: BTreeMap::new(),
        };
    };
    let scripts = json
        .get("scripts")
        .and_then(JsonValue::as_object)
        .map(|scripts| {
            scripts
                .iter()
                .filter_map(|(name, value)| {
                    value
                        .as_str()
                        .map(|value| (name.clone(), value.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    PackageScripts {
        ok: true,
        path: package_path.to_string(),
        tool_id: None,
        reason: None,
        scripts,
    }
}

fn verification_commands_for_package(package: &PackageScripts) -> Vec<VerificationCommand> {
    if !package.ok {
        return Vec::new();
    }
    ["test", "vitest", "test:e2e", "e2e", "lint", "build"]
        .iter()
        .filter(|script| package.scripts.contains_key(**script))
        .map(|script| {
            let command = if package.path == "package.json" {
                format!("pnpm {script}")
            } else {
                format!(
                    "pnpm --dir {} {script}",
                    package.path.trim_end_matches("/package.json")
                )
            };
            VerificationCommand {
                script: (*script).to_string(),
                command,
            }
        })
        .collect()
}

fn collect_git_status(root: &Path) -> JsonValue {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .arg("status")
        .arg("--short")
        .output();
    match output {
        Ok(output) => serde_json::json!({
            "ok": output.status.success(),
            "short": String::from_utf8_lossy(&output.stdout).trim().to_string()
        }),
        Err(_) => serde_json::json!({ "ok": false, "reason": "git_unavailable" }),
    }
}

fn collect_spectra_status(root: &Path) -> JsonValue {
    let output = Command::new("spectra")
        .arg("list")
        .arg("--json")
        .current_dir(root)
        .output();
    match output {
        Ok(output) if output.status.success() => serde_json::from_slice(&output.stdout)
            .unwrap_or_else(
                |_| serde_json::json!({ "ok": false, "reason": "spectra_output_unreadable" }),
            ),
        _ => serde_json::json!({ "ok": false, "reason": "spectra_unavailable" }),
    }
}

fn create_documentation_guidance(scan: &ScanResult) -> DocumentationGuidance {
    let guidance = &scan.root.guidance;
    let mut missing = Vec::new();
    if !guidance.iter().any(|path| path == "AGENTS.md") {
        missing.push(DocSuggestion {
            code: "agents_md_missing",
            path: "AGENTS.md",
            label: "agent rules",
            why: "讓 agent 先知道這個 workspace 的工作規則和不能踩的邊界。",
            next_step: "新增 AGENTS.md，先用幾段白話寫清楚專案目標、常用指令、開工前要讀哪些文件。",
        });
    }
    if !guidance.iter().any(|path| path == "README.md") {
        missing.push(DocSuggestion {
            code: "readme_missing",
            path: "README.md",
            label: "workspace overview",
            why: "讓第一次看到專案的人快速知道這裡有哪些 repo，以及各自大概做什麼。",
            next_step: "新增 README.md，用一小段說明 workspace 用途，再列出主要資料夾。",
        });
    }
    if !guidance
        .iter()
        .any(|path| path == "docs/decisions/index.md")
    {
        missing.push(DocSuggestion {
            code: "decision_index_missing",
            path: "docs/decisions/index.md",
            label: "decision index",
            why: "讓重要決策有入口，不用每次重新翻對話或猜現在的設計方向。",
            next_step: "新增 docs/decisions/index.md，先列出目前已確定的架構、產品、流程決策。",
        });
    }
    if !guidance.iter().any(|path| {
        path.starts_with("openspec/specs/") || path.starts_with("docs/superpowers/specs/")
    }) {
        missing.push(DocSuggestion {
            code: "specs_missing",
            path: "openspec/specs/ or docs/superpowers/specs/",
            label: "spec files",
            why: "讓需求和驗收條件有固定位置，agent 不會只靠聊天記憶工作。",
            next_step: "若這個 workspace 會持續開發功能，建立 specs 目錄保存需求和驗收條件。",
        });
    }
    let ok = missing.is_empty();
    DocumentationGuidance {
        ok,
        missing,
        summary: if ok {
            "這個 workspace 的決策文件入口看起來已經夠 agent 使用。".to_string()
        } else {
            "目前少了一些基本決策文件。先補重要的入口文件，agent 才不用靠猜的理解專案。".to_string()
        },
    }
}

fn evidence_summary(scan: &ScanResult) -> Value {
    let mut map = Mapping::new();
    map.insert(s("root"), string_sequence(&scan.root.guidance));
    map.insert(
        s("tools"),
        Value::Sequence(
            scan.tools
                .iter()
                .map(|tool| {
                    let mut item = Mapping::new();
                    item.insert(s("path"), s(&tool.path));
                    item.insert(s("guidance"), string_sequence(&tool.guidance));
                    Value::Mapping(item)
                })
                .collect(),
        ),
    );
    map.insert(
        s("codebase_memory"),
        serde_yaml::to_value(&scan.codebase_memory).unwrap_or(Value::Null),
    );
    Value::Mapping(map)
}

fn flatten_evidence(scan: &ScanResult) -> Vec<String> {
    let mut evidence = BTreeSet::new();
    evidence.extend(scan.root.guidance.iter().cloned());
    for tool in &scan.tools {
        evidence.extend(tool.guidance.iter().cloned());
    }
    evidence.into_iter().collect()
}

fn catalog_evidence_sources(catalog: &Value) -> BTreeSet<String> {
    let mut sources = BTreeSet::new();
    for key in ["evidence_sources", "primary_docs"] {
        if let Some(values) = catalog.get(key).and_then(Value::as_sequence) {
            sources.extend(values.iter().filter_map(Value::as_str).map(str::to_string));
        }
    }
    if let Some(tools) = catalog.get("tools").and_then(Value::as_sequence) {
        for tool in tools {
            if let Some(values) = tool.get("primary_docs").and_then(Value::as_sequence) {
                sources.extend(values.iter().filter_map(Value::as_str).map(str::to_string));
            }
        }
    }
    if let Some(workflows) = catalog.get("workflows").and_then(Value::as_sequence) {
        for workflow in workflows {
            if let Some(values) = workflow.get("primary_docs").and_then(Value::as_sequence) {
                sources.extend(values.iter().filter_map(Value::as_str).map(str::to_string));
            }
        }
    }
    sources
}

fn validate_catalog(catalog: &Value) -> Result<(), String> {
    let mut errors = Vec::new();
    let Some(map) = catalog.as_mapping() else {
        return Err("catalog must be an object".to_string());
    };
    if map.get(s("schema_version")).and_then(Value::as_i64) != Some(1) {
        errors.push("schema_version must be 1");
    }
    match map.get(s("workspace")).and_then(Value::as_mapping) {
        Some(workspace) => {
            for field in ["id", "name", "purpose"] {
                if !workspace.contains_key(s(field)) {
                    errors.push(match field {
                        "id" => "workspace.id is required",
                        "name" => "workspace.name is required",
                        _ => "workspace.purpose is required",
                    });
                }
            }
        }
        None => errors.push("workspace is required"),
    }
    if !map
        .get(s("workflows"))
        .map(Value::is_sequence)
        .unwrap_or(false)
    {
        errors.push("workflows must be an array");
    }
    if !map.get(s("tools")).map(Value::is_sequence).unwrap_or(false) {
        errors.push("tools must be an array");
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Invalid catalog: {}", errors.join(", ")))
    }
}

fn find_inference_wrappers(value: &Value, path: Vec<String>) -> Vec<String> {
    if let Some(map) = value.as_mapping() {
        if map.contains_key(s("value"))
            && map.contains_key(s("confidence"))
            && map.contains_key(s("inferred_from"))
        {
            return vec![if path.is_empty() {
                "<root>".to_string()
            } else {
                path.join(".")
            }];
        }
        return map
            .iter()
            .flat_map(|(key, item)| {
                let key = key.as_str().unwrap_or("<key>").to_string();
                let mut next = path.clone();
                next.push(key);
                find_inference_wrappers(item, next)
            })
            .collect();
    }
    if let Some(sequence) = value.as_sequence() {
        return sequence
            .iter()
            .enumerate()
            .flat_map(|(index, item)| {
                let mut next = path.clone();
                next.push(index.to_string());
                find_inference_wrappers(item, next)
            })
            .collect();
    }
    Vec::new()
}

fn resolve_workspace_path(root: &Path, raw_path: &str) -> Result<PathBuf, ()> {
    if raw_path.trim().is_empty() {
        return Err(());
    }
    let path = Path::new(raw_path);
    if path.is_absolute() {
        return Err(());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(());
    }
    let resolved = root.join(path).canonicalize().map_err(|_| ())?;
    let canonical_root = root.canonicalize().map_err(|_| ())?;
    if resolved.starts_with(canonical_root) {
        Ok(resolved)
    } else {
        Err(())
    }
}

fn find_initialized_workspace(start: &Path) -> Option<PathBuf> {
    let mut current = start.canonicalize().ok()?;
    loop {
        if confirmed_catalog_path(&current).exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

#[derive(Default)]
struct ParsedPreflightArgs {
    changed_files: Vec<String>,
    event: Option<String>,
}

fn parse_preflight_args(args: &[String]) -> ParsedPreflightArgs {
    let mut parsed = ParsedPreflightArgs::default();
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--changed" | "--changed-file" => {
                if let Some(value) = args.get(index + 1) {
                    parsed.changed_files.push(value.clone());
                    index += 1;
                }
            }
            "--event" => {
                parsed.event = args.get(index + 1).cloned();
                index += 1;
            }
            _ => {}
        }
        index += 1;
    }
    parsed
}

fn is_drift_relevant_path(path: &str) -> bool {
    let basename = path.rsplit('/').next().unwrap_or(path);
    ["AGENTS.md", "README.md", ".cursorrules"].contains(&basename)
        || [
            ".cursor/rules/",
            "docs/decisions/",
            "openspec/changes/",
            "openspec/specs/",
            "docs/superpowers/specs/",
            "docs/superpowers/plans/",
        ]
        .iter()
        .any(|segment| path.contains(segment) || path.starts_with(segment))
}

fn is_docs_or_spec_source(source: &str) -> bool {
    [
        "AGENTS.md",
        "README.md",
        ".cursorrules",
        ".cursor/rules/",
        "docs/decisions/",
        "openspec/specs/",
        "openspec/changes/",
        "docs/superpowers/specs/",
        "docs/superpowers/plans/",
        "package.json",
    ]
    .iter()
    .any(|pattern| {
        source == *pattern || source.contains(&format!("/{pattern}")) || source.starts_with(pattern)
    })
}

fn normalize_changed_path(path: &str) -> String {
    path.strip_prefix("./").unwrap_or(path).to_string()
}

fn read_yaml(path: &Path) -> Result<Value, String> {
    let content = fs::read_to_string(path).map_err(to_string)?;
    serde_yaml::from_str(&content).map_err(to_string)
}

fn catalog_dir(root: &Path) -> PathBuf {
    root.join(CATALOG_DIR)
}

fn confirmed_catalog_path(root: &Path) -> PathBuf {
    catalog_dir(root).join(CATALOG_FILE)
}

fn draft_path(root: &Path) -> PathBuf {
    catalog_dir(root).join(DRAFT_FILE)
}

fn review_questions_path(root: &Path) -> PathBuf {
    catalog_dir(root).join(REVIEW_QUESTIONS_FILE)
}

fn relative_confirmed_catalog_path() -> String {
    format!("{CATALOG_DIR}/{CATALOG_FILE}")
}

fn relative_string(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn inference(value: impl Into<String>, confidence: &str, inferred_from: &[String]) -> Value {
    let mut map = Mapping::new();
    map.insert(s("value"), s(value.into()));
    map.insert(s("confidence"), s(confidence));
    map.insert(s("inferred_from"), string_sequence(inferred_from));
    Value::Mapping(map)
}

fn inference_array(values: Vec<String>, confidence: &str, inferred_from: &[String]) -> Value {
    let mut map = Mapping::new();
    map.insert(s("value"), string_sequence(&values));
    map.insert(s("confidence"), s(confidence));
    map.insert(s("inferred_from"), string_sequence(inferred_from));
    Value::Mapping(map)
}

fn string_sequence(values: &[String]) -> Value {
    Value::Sequence(values.iter().map(|value| s(value)).collect())
}

fn s(value: impl Into<String>) -> Value {
    Value::String(value.into())
}

fn string_field(value: &Value, field: &str) -> Option<String> {
    value.get(field).and_then(Value::as_str).map(str::to_string)
}

fn plain_field(value: &Value, field: &str) -> String {
    value
        .get(field)
        .map(plain_value)
        .unwrap_or_else(|| "未判斷".to_string())
}

fn plain_value(value: &Value) -> String {
    if let Some(map) = value.as_mapping() {
        if let Some(inner) = map.get(s("value")) {
            return plain_value(inner);
        }
    }
    if let Some(value) = value.as_str() {
        if value.trim().is_empty()
            || value == "unknown"
            || value == "Review workspace docs to confirm purpose."
            || value == "Review workspace docs to confirm orientation."
        {
            return "需確認".to_string();
        }
        return value.to_string();
    }
    if let Some(sequence) = value.as_sequence() {
        if sequence.is_empty() {
            return "待確認".to_string();
        }
        return sequence
            .iter()
            .map(plain_value)
            .collect::<Vec<_>>()
            .join(", ");
    }
    if value.is_null() {
        return "未判斷".to_string();
    }
    serde_yaml::to_string(value)
        .map(|text| text.trim().to_string())
        .unwrap_or_else(|_| "未判斷".to_string())
}

fn plain_question(question: &str) -> String {
    if let Some(tool) = question
        .strip_prefix("What role does ")
        .and_then(|text| text.strip_suffix(" play in this workspace?"))
    {
        return format!("請確認 {tool} 在這個 workspace 的角色。");
    }
    if let Some(tool) = question
        .strip_prefix("Which skills should agents use or avoid when working on ")
        .and_then(|text| text.strip_suffix("?"))
    {
        return format!("請確認 agent 處理 {tool} 時適合或不適合使用哪些 skills。");
    }
    question.to_string()
}

fn now_iso() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("unix:{seconds}")
}

fn to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_workspace(name: &str) -> PathBuf {
        let path = env::temp_dir().join(format!(
            "workspace-catalog-{name}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn confirm_rejects_inference_wrappers() {
        let draft = serde_yaml::from_str::<Value>(
            r#"
schema_version: 1
workspace:
  id:
    value: demo
    confidence: low
    inferred_from: []
  name: Demo
  purpose: Demo
workflows: []
tools: []
"#,
        )
        .unwrap();
        let paths = find_inference_wrappers(&draft, Vec::new());
        assert_eq!(paths, vec!["workspace.id"]);
    }

    #[test]
    fn session_preflight_finds_nearest_initialized_workspace() {
        let root = temp_workspace("session");
        fs::create_dir_all(root.join(".workspace-catalog")).unwrap();
        fs::write(
            root.join(".workspace-catalog/catalog.yaml"),
            "schema_version: 1\n",
        )
        .unwrap();
        let child = root.join("tool-a/src");
        fs::create_dir_all(&child).unwrap();
        assert_eq!(
            find_initialized_workspace(&child),
            Some(root.canonicalize().unwrap())
        );
    }

    #[test]
    fn path_guard_rejects_absolute_and_parent_paths() {
        let root = temp_workspace("path-guard");
        assert!(resolve_workspace_path(&root, "").is_err());
        assert!(resolve_workspace_path(&root, "../outside").is_err());
        assert!(resolve_workspace_path(&root, "/tmp/outside").is_err());
    }

    #[test]
    fn review_report_turns_draft_into_user_checklist() {
        let draft = sample_review_draft();

        let report = format_review_report(&draft);
        assert!(report.contains("請先確認這 4 件事"));
        assert!(report.contains("- 名稱：Demo Workspace"));
        assert!(report.contains("- tool-a：./tool-a，角色：frontend"));
        assert!(report.contains("- tool-a 適用 skills：playwright"));
        assert!(report.contains("請確認 tool-a 在這個 workspace 的角色。"));
        assert!(report.contains("正確，可以更新記憶"));
    }

    #[test]
    fn review_questions_support_one_question_at_a_time() {
        let draft = sample_review_draft();
        let queue = build_review_question_queue(&draft);
        assert_eq!(queue.current_index, 0);
        assert_eq!(queue.questions[0].id, "workspace.purpose");
        assert_eq!(queue.questions[2].id, "tools.tool-a.role");

        let next = format_next_question(&queue);
        assert!(next.contains("問題 1/4 [workspace.purpose]"));
        assert!(next.contains("這個 workspace 的主要用途是什麼？"));
    }

    #[test]
    fn answer_question_records_answer_and_advances_queue() {
        let root = temp_workspace("answer-question");
        let draft = sample_review_draft();
        write_review_question_queue(&root, &build_review_question_queue(&draft)).unwrap();

        run_answer_question(
            &root,
            &[
                "workspace.purpose".to_string(),
                "--answer".to_string(),
                "Coordinate split repos.".to_string(),
            ],
        )
        .unwrap();

        let queue = load_or_create_review_questions(&root).unwrap();
        assert_eq!(queue.current_index, 1);
        assert_eq!(queue.questions[0].status, "answered");
        assert_eq!(
            queue.questions[0].answer,
            Some("Coordinate split repos.".to_string())
        );
        assert!(format_next_question(&queue).contains("[workspace.orientation]"));
    }

    fn sample_review_draft() -> Value {
        serde_yaml::from_str::<Value>(
            r#"
schema_version: 1
workspace:
  id:
    value: demo
    confidence: medium
    inferred_from: [AGENTS.md]
  name:
    value: Demo Workspace
    confidence: medium
    inferred_from: [AGENTS.md]
  purpose:
    value: Coordinate split repos.
    confidence: low
    inferred_from: [README.md]
  orientation:
    value: Review before changing repo roles.
    confidence: low
    inferred_from: [README.md]
agent_routing:
  default_skills:
    value: [workspace-catalog]
    confidence: low
    inferred_from: [AGENTS.md]
  task_routes:
    value: []
    confidence: low
    inferred_from: []
tools:
  - id: tool-a
    path: ./tool-a
    role:
      value: frontend
      confidence: low
      inferred_from: [tool-a/README.md]
    recommended_skills:
      value: [playwright]
      confidence: low
      inferred_from: [tool-a/README.md]
questions:
  - What role does tool-a play in this workspace?
"#,
        )
        .unwrap()
    }
}
