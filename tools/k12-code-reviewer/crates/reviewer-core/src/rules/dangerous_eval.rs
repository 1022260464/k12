use crate::engine::ReviewRule;
use crate::model::{Diagnostic, Language, ReviewLocation, ReviewRequest, Severity};
use crate::rules::column_number;

pub struct DangerousEvalRule;

impl DangerousEvalRule {
    fn patterns(language: Language) -> &'static [&'static str] {
        match language {
            Language::Python => &["eval(", "exec("],
            Language::JavaScript | Language::TypeScript => &["eval(", "new Function("],
            Language::Java | Language::Rust => &[],
        }
    }
}

impl ReviewRule for DangerousEvalRule {
    fn review(&self, request: &ReviewRequest) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();
        for (line_index, line) in request.source_code.lines().enumerate() {
            for pattern in Self::patterns(request.language) {
                if let Some(byte_index) = line.find(pattern) {
                    diagnostics.push(
                        Diagnostic::new(
                            "security.dynamic-code-execution",
                            Severity::Error,
                            format!("Avoid dynamic code execution through `{pattern}`."),
                            "k12-baseline",
                        )
                        .at(ReviewLocation::point(
                            line_index + 1,
                            column_number(line, byte_index),
                        ))
                        .with_suggestion(
                            "Use an explicit parser, allow-list, or dedicated sandbox instead.",
                        ),
                    );
                }
            }
        }
        diagnostics
    }
}
