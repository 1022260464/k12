use crate::engine::ReviewRule;
use crate::model::{Diagnostic, ReviewLocation, ReviewRequest, Severity};
use crate::rules::column_number;

const SECRET_MARKERS: &[&str] = &["password", "api_key", "apikey", "secret", "token"];

pub struct HardcodedSecretRule;

impl ReviewRule for HardcodedSecretRule {
    fn review(&self, request: &ReviewRequest) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();
        for (line_index, line) in request.source_code.lines().enumerate() {
            let normalized = line.to_ascii_lowercase();
            let looks_assigned = (line.contains('=') || line.contains(':'))
                && (line.contains('"') || line.contains('\''));
            if !looks_assigned {
                continue;
            }

            if let Some((byte_index, marker)) = SECRET_MARKERS
                .iter()
                .filter_map(|marker| normalized.find(marker).map(|index| (index, *marker)))
                .min_by_key(|(index, _)| *index)
            {
                diagnostics.push(
                    Diagnostic::new(
                        "security.possible-hardcoded-secret",
                        Severity::Warning,
                        format!("Possible hard-coded credential near `{marker}`."),
                        "k12-baseline",
                    )
                    .at(ReviewLocation::point(
                        line_index + 1,
                        column_number(line, byte_index),
                    ))
                    .with_suggestion("Read secrets from environment variables or a secret store."),
                );
            }
        }
        diagnostics
    }
}
