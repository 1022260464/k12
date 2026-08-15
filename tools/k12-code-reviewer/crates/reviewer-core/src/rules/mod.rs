mod dangerous_eval;
mod hardcoded_secret;
mod source_guard;

pub use dangerous_eval::DangerousEvalRule;
pub use hardcoded_secret::HardcodedSecretRule;
pub use source_guard::SourceGuardRule;

pub(crate) fn column_number(line: &str, byte_index: usize) -> usize {
    line[..byte_index].chars().count() + 1
}
