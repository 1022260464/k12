use crate::engine::ReviewRule;
use crate::model::{Diagnostic, ReviewRequest, Severity};

const MAX_SOURCE_BYTES: usize = 1_048_576;

pub struct SourceGuardRule;

impl ReviewRule for SourceGuardRule {
    fn review(&self, request: &ReviewRequest) -> Vec<Diagnostic> {
        if request.source_code.trim().is_empty() {
            return vec![Diagnostic::new(
                "common.source.empty",
                Severity::Error,
                "Source code must not be empty.",
                "k12-baseline",
            )];
        }

        if request.source_code.len() > MAX_SOURCE_BYTES {
            return vec![Diagnostic::new(
                "common.source.too-large",
                Severity::Error,
                "Source code exceeds the 1 MiB review limit.",
                "k12-baseline",
            )];
        }

        Vec::new()
    }
}
