use crate::model::{Diagnostic, ReviewReport, ReviewRequest};
use crate::rules::{DangerousEvalRule, HardcodedSecretRule, SourceGuardRule};

pub trait ReviewRule: Send + Sync {
    fn review(&self, request: &ReviewRequest) -> Vec<Diagnostic>;
}

pub struct ReviewEngine {
    rules: Vec<Box<dyn ReviewRule>>,
}

impl ReviewEngine {
    #[must_use]
    pub fn new(rules: Vec<Box<dyn ReviewRule>>) -> Self {
        Self { rules }
    }

    #[must_use]
    pub fn review(&self, request: &ReviewRequest) -> ReviewReport {
        let diagnostics = self
            .rules
            .iter()
            .flat_map(|rule| rule.review(request))
            .collect();
        ReviewReport::completed(request, diagnostics)
    }
}

impl Default for ReviewEngine {
    fn default() -> Self {
        Self::new(vec![
            Box::new(SourceGuardRule),
            Box::new(DangerousEvalRule),
            Box::new(HardcodedSecretRule),
        ])
    }
}
