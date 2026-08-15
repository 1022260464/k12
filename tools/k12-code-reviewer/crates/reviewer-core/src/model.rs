use serde::{Deserialize, Serialize};

fn default_ruleset() -> String {
    "k12-default".to_owned()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Python,
    Java,
    JavaScript,
    TypeScript,
    Rust,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ReviewStatus {
    Completed,
    Rejected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRequest {
    pub request_id: String,
    pub language: Language,
    pub source_code: String,
    pub file_name: Option<String>,
    #[serde(default = "default_ruleset")]
    pub ruleset: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewLocation {
    pub line: usize,
    pub column: usize,
    pub end_line: Option<usize>,
    pub end_column: Option<usize>,
}

impl ReviewLocation {
    #[must_use]
    pub const fn point(line: usize, column: usize) -> Self {
        Self {
            line,
            column,
            end_line: None,
            end_column: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub rule_id: String,
    pub severity: Severity,
    pub message: String,
    pub location: Option<ReviewLocation>,
    pub suggestion: Option<String>,
    pub analyzer: String,
}

impl Diagnostic {
    #[must_use]
    pub fn new(
        rule_id: impl Into<String>,
        severity: Severity,
        message: impl Into<String>,
        analyzer: impl Into<String>,
    ) -> Self {
        Self {
            rule_id: rule_id.into(),
            severity,
            message: message.into(),
            location: None,
            suggestion: None,
            analyzer: analyzer.into(),
        }
    }

    #[must_use]
    pub fn at(mut self, location: ReviewLocation) -> Self {
        self.location = Some(location);
        self
    }

    #[must_use]
    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSummary {
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
}

impl ReviewSummary {
    #[must_use]
    pub fn from_diagnostics(diagnostics: &[Diagnostic]) -> Self {
        let mut summary = Self {
            error_count: 0,
            warning_count: 0,
            info_count: 0,
        };

        for diagnostic in diagnostics {
            match diagnostic.severity {
                Severity::Error => summary.error_count += 1,
                Severity::Warning => summary.warning_count += 1,
                Severity::Info => summary.info_count += 1,
            }
        }
        summary
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewReport {
    pub request_id: String,
    pub language: Language,
    pub status: ReviewStatus,
    pub ruleset: String,
    pub diagnostics: Vec<Diagnostic>,
    pub summary: ReviewSummary,
    pub engine_version: String,
}

impl ReviewReport {
    #[must_use]
    pub fn completed(request: &ReviewRequest, diagnostics: Vec<Diagnostic>) -> Self {
        let summary = ReviewSummary::from_diagnostics(&diagnostics);
        Self {
            request_id: request.request_id.clone(),
            language: request.language,
            status: ReviewStatus::Completed,
            ruleset: request.ruleset.clone(),
            diagnostics,
            summary,
            engine_version: env!("CARGO_PKG_VERSION").to_owned(),
        }
    }
}
