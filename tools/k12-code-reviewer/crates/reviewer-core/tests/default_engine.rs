use k12_code_reviewer_core::{Language, ReviewEngine, ReviewRequest, ReviewStatus, Severity};

fn request(language: Language, source_code: &str) -> ReviewRequest {
    ReviewRequest {
        request_id: "review-1".to_owned(),
        language,
        source_code: source_code.to_owned(),
        file_name: Some("main.py".to_owned()),
        ruleset: "k12-default".to_owned(),
    }
}

#[test]
fn reports_dynamic_execution_and_hardcoded_secret() {
    let report = ReviewEngine::default().review(&request(
        Language::Python,
        "password = \"demo-secret\"\nresult = eval(user_input)\n",
    ));

    assert_eq!(report.status, ReviewStatus::Completed);
    assert_eq!(report.summary.error_count, 1);
    assert_eq!(report.summary.warning_count, 1);
    assert!(report.diagnostics.iter().any(|diagnostic| {
        diagnostic.rule_id == "security.dynamic-code-execution"
            && diagnostic.severity == Severity::Error
    }));
}

#[test]
fn accepts_clean_source_without_diagnostics() {
    let report = ReviewEngine::default().review(&request(
        Language::Python,
        "def add(left, right):\n    return left + right\n",
    ));

    assert!(report.diagnostics.is_empty());
    assert_eq!(report.summary.error_count, 0);
}

#[test]
fn json_contract_uses_camel_case() {
    let report = ReviewEngine::default().review(&request(Language::TypeScript, "const n = 1;"));
    let json = serde_json::to_value(report).expect("report must serialize");

    assert_eq!(json["requestId"], "review-1");
    assert_eq!(json["language"], "typescript");
    assert!(json.get("engineVersion").is_some());
}
