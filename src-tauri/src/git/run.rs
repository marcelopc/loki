//! Safe git command runner.
//!
//! Every git invocation goes through [`GitClient`], which builds an
//! argument list (never a shell), pins the working directory to the repo
//! root, and captures stdout/stderr. Non-zero exit codes surface the git
//! stderr as a domain error for the frontend to display.

use std::path::{Path, PathBuf};
use std::process::{Command, Output};

/// Error returned when a git command exits non-zero.
#[derive(Debug)]
pub struct GitError {
    /// Human-readable stderr from git (trimmed).
    pub stderr: String,
    /// Raw exit code, when reported by the process.
    pub code: Option<i32>,
}

impl std::fmt::Display for GitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.stderr)
    }
}

impl std::error::Error for GitError {}

/// Allows `?` to lift a `GitError` into a Tauri command's `Result<_, String>`,
/// since commands return `Result<T, String>` that the frontend shows as-is.
impl From<GitError> for String {
    fn from(e: GitError) -> Self {
        e.to_string()
    }
}

/// Result alias used across the git module.
pub type GitResult<T> = Result<T, GitError>;

/// Runs git commands inside a repository.
#[derive(Clone)]
pub struct GitClient {
    root: PathBuf,
}

impl GitClient {
    /// Creates a client pinned to `root` (the repo work-tree root).
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// The repo root this client operates on.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Runs `git <args>` and returns captured output.
    ///
    /// A subprocess boundary is used instead of a shell, so arguments are
    /// passed verbatim (no token splitting, no globbing, no command
    /// substitution). `--` must be added by callers before file paths when
    /// the path could start with `-`.
    pub fn run(&self, args: &[&str]) -> GitResult<Output> {
        let mut cmd = Command::new("git");
        cmd.current_dir(&self.root)
            .arg("--no-pager")
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C.UTF-8")
            .args(args);
        // Run inside try/catch to convert IO errors (missing git, permission)
        // into a surface-able GitError as well.
        let output = cmd
            .output()
            .map_err(|e| GitError { stderr: format!("falha ao executar git: {e}"), code: None })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(GitError {
                stderr: if stderr.is_empty() {
                    format!(
                        "git saiu com status {:?}",
                        output.status.code()
                    )
                } else {
                    stderr
                },
                code: output.status.code(),
            });
        }
        Ok(output)
    }

    /// Runs `git <args>` and returns stdout as UTF-8 lossily decoded.
    ///
    /// Errors are non-zero exit only; git output is decoded best-effort
    /// since paths/messages may not be valid UTF-8 in pathological cases.
    pub fn run_str(&self, args: &[&str]) -> GitResult<String> {
        let out = self.run(args)?;
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    /// Runs `git <args>` treating exit codes 0 and 1 as success — the exit
    /// contract of `git diff`/`diff --no-index` (1 means "differences found").
    pub fn run_diff_ok(&self, args: &[&str]) -> GitResult<Output> {
        let mut cmd = Command::new("git");
        cmd.current_dir(&self.root)
            .arg("--no-pager")
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C.UTF-8")
            .args(args);
        let output = cmd
            .output()
            .map_err(|e| GitError { stderr: format!("falha ao executar git: {e}"), code: None })?;
        if output.status.success() || output.status.code() == Some(1) {
            return Ok(output);
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(GitError {
            stderr: if stderr.is_empty() {
                format!("git saiu com status {:?}", output.status.code())
            } else {
                stderr
            },
            code: output.status.code(),
        })
    }

    /// True when `path` (given as work-tree relative) is not going to be
    /// treated as a git option — i.e. should be passed after `--`.
    #[allow(dead_code)]
    pub fn needs_dashdash(path: &str) -> bool {
        path.is_empty() || path.starts_with('-')
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::process::Command as SysCommand;

    fn temp_git_repo(tag: &str) -> PathBuf {
        let dir = temp_dir().join(format!("git-run-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let init = SysCommand::new("git").args(["init", "-q", "-b", "main"]).current_dir(&dir).output().unwrap();
        assert!(init.status.success(), "git init failed: {init:?}");
        dir
    }

    #[test]
    fn captures_git_version() {
        let repo = temp_git_repo("version");
        let client = GitClient::new(&repo);
        let out = client.run(&["--version"]).unwrap();
        let s = String::from_utf8_lossy(&out.stdout);
        assert!(s.contains("git version"), "got: {s}");
    }

    #[test]
    fn identity_is_repo_root() {
        let repo = temp_git_repo("root");
        let client = GitClient::new(&repo);
        let root = client.run_str(&["rev-parse", "--show-toplevel"]).unwrap();
        assert_eq!(root.trim(), repo.to_str().unwrap());
    }

    #[test]
    fn non_zero_exit_returns_stdout_error() {
        let repo = temp_git_repo("nonzero");
        let client = GitClient::new(&repo);
        // `git status` in a freshly init'd repo with no commits exits 0,
        // so use a genuinely failing command.
        let err = client.run(&["rev-parse", "definitely-not-a-ref"]).unwrap_err();
        assert!(err.stderr.contains("definitely-not-a-ref"), "got: {}", err.stderr);
    }

    #[test]
    fn unknown_repo_dir_reports_io_error() {
        let client = GitClient::new(temp_dir().join("definitely-missing-repo"));
        let err = client.run(&["status"]).unwrap_err();
        assert!(!err.stderr.is_empty(), "expected an error message");
    }

    #[test]
    fn dashdash_detection() {
        assert!(GitClient::needs_dashdash("-file.txt"));
        assert!(GitClient::needs_dashdash(""));
        assert!(!GitClient::needs_dashdash("normal/path.txt"));
    }
}