//! git module — safe CLI-based git interaction.
//!
//! All git access goes through [`run::GitClient`]; parsing lives in the
//! sibling modules. The module deliberately avoids `git2`/libgit2 to keep
//! the binary light and the behaviour identical to the system git.

pub mod diff;
pub mod parse;
pub mod refs;
pub mod run;