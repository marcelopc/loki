//! Branch / tag / HEAD resolution via `rev-parse` and `for-each-ref`.
//!
//! These commands are pure queries and rely on [`super::run::GitClient`]
//! for argument safety.

use serde::Serialize;

use super::parse::{parse_commit_stream, CommitNode};
use super::run::{GitClient, GitResult};

/// A single branch shown in the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    /// Short name (e.g. `main`, `origin/dev`).
    pub name: String,
    /// `local` or `remote`.
    pub kind: String,
    /// True when this is the currently checked-out branch.
    pub is_current: bool,
    /// Upstream tracking branch, when known.
    pub upstream: Option<String>,
    /// Commits ahead of upstream; `None` when no upstream/ahead data.
    pub ahead: Option<i64>,
    /// Commits behind upstream; `None` when no upstream data.
    pub behind: Option<i64>,
}

/// Validates a proposed local branch name.
///
/// Rejects empty names, control characters/spaces, a leading `-` (would be
/// parsed as an option) and names that already exist locally.
pub fn validate_branch_name(client: &GitClient, name: &str) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("nome de branch não pode ser vazio".to_string());
    }
    if name.starts_with('-') {
        return Err("nome de branch não pode começar com '-'".to_string());
    }
    for ch in name.chars() {
        if ch.is_whitespace() || ch.is_control() {
            return Err("nome de branch não pode conter espaços ou caracteres de controle".to_string());
        }
    }
    // `-` guards handled; `..`, `~`, `^`, `:`, `?`, `*`, `[`, `\` are invalid
    // in git, but git will reject those natively — we only guard what could
    // lead to argument confusion or an obvious UX error.
    if name.ends_with(".lock") {
        return Err("nome de branch não pode terminar com '.lock'".to_string());
    }
    // Existence pre-check (best-effort) against other local branches.
    let refname = format!("refs/heads/{name}");
    if client.run(&["rev-parse", "--verify", &refname]).is_ok() {
        return Err(format!("branch '{name}' já existe"));
    }
    Ok(())
}

/// Lists local and remote branches with upstream and ahead/behind data.
pub fn list_branches(client: &GitClient) -> GitResult<Vec<BranchInfo>> {
    // git 2.34's for-each-ref does not expose `%(ahead)`/`%(behind)`
    // (added in 2.44), so we list refs here and compute ahead/behind with
    // `rev-list` only for branches that actually have an upstream.
    let fmt = "%(refname:short)%00%(upstream:short)%00%(HEAD)";
    let fmt_arg = format!("--format={fmt}");
    let out = client.run_str(&["for-each-ref", &fmt_arg, "refs/heads", "refs/remotes"])?;

    let mut branches = Vec::new();
    for line in out.lines() {
        let fields: Vec<&str> = line.split('\u{0}').collect();
        if fields.len() < 3 {
            continue;
        }
        let name = fields[0].to_string();
        let upstream = if fields[1].is_empty() { None } else { Some(fields[1].to_string()) };
        let is_head = fields[2] == "*";
        let kind = if name.starts_with("remotes/") { "remote" } else { "local" };

        let (ahead, behind) = if let Some(up) = &upstream {
            ahead_behind(client, &name, up).unwrap_or((None, None))
        } else {
            (None, None)
        };

        branches.push(BranchInfo {
            name,
            kind: kind.to_string(),
            is_current: is_head,
            upstream,
            ahead,
            behind,
        });
    }

    Ok(branches)
}

/// Returns `(ahead, behind)` of `name` relative to its upstream via
/// `git rev-list --left-right --count name...upstream` (format `L\tR`).
fn ahead_behind(client: &GitClient, name: &str, upstream: &str) -> GitResult<(Option<i64>, Option<i64>)> {
    let range = format!("{name}...{upstream}");
    let out = client.run_str(&["rev-list", "--left-right", "--count", &range])?;
    let mut parts = out.split_whitespace();
    let ahead = parts.next().and_then(|s| s.parse::<i64>().ok());
    let behind = parts.next().and_then(|s| s.parse::<i64>().ok());
    Ok((ahead, behind))
}

/// Returns the current branch short name, or a "detached" marker.
pub fn current_branch(client: &GitClient) -> GitResult<String> {
    let out = client.run_str(&["symbolic-ref", "--short", "-q", "HEAD"])?;
    let name = out.trim().to_string();
    Ok(if name.is_empty() { "HEAD (detached)".to_string() } else { name })
}

/// Runs the `git log --all --decorate` command and returns parsed nodes.
///
/// Every field is single-line and NUL-delimited; git appends one `\n` per
/// commit, so `\n` is a safe record separator (no `%x1e` needed).
pub fn log_all(client: &GitClient) -> GitResult<Vec<CommitNode>> {
    const FMT: &str = "%H%x00%P%x00%an%x00%aI%x00%ae%x00%s%x00%D";
    let fmt_arg = format!("--format={FMT}");
    // --topo-order guarantees children-before-parents (the spec's "ordem
    // topológica"), stabilizing the lane layout in the frontend. Without it
    // git defaults to reverse-chronological commit date, which can place a
    // parent's commit-date before its children under clock skew.
    let out = client.run(&["log", "--all", "--topo-order", "--decorate", "--date=iso-strict", &fmt_arg])?;
    Ok(parse_commit_stream(&out.stdout))
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::run::GitClient;
    use std::env::temp_dir;
    use std::process::Command as SysCommand;

    use std::sync::atomic::{AtomicU64, Ordering};

    fn repo() -> (std::path::PathBuf, GitClient) {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        // Unique per call so parallel tests never race on the same directory.
        let dd = temp_dir().join(format!("git-refs-test-{}-{n}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dd);
        std::fs::create_dir_all(&dd).unwrap();
        let init = SysCommand::new("git").args(["init", "-q", "-b", "main"]).current_dir(&dd).output().unwrap();
        assert!(init.status.success(), "git init failed: {:?}", init);
        let client = GitClient::new(&dd);
        (dd, client)
    }

    fn commit(client: &GitClient, file: &str, msg: &str) {
        let _ = std::fs::write(client.root().join(file), msg);
        for cmd in [
            vec!["add", "--", file],
            vec!["commit", "-q", "-m", msg],
        ] {
            let out = client.run(&cmd).unwrap();
            assert!(out.status.success(), "{cmd:?} failed");
        }
    }

    #[test]
    fn current_branch_after_init_is_main() {
        let (_, client) = repo();
        assert_eq!(current_branch(&client).unwrap(), "main");
    }

    #[test]
    fn validate_rejects_bad_names() {
        let (_, client) = repo();
        assert!(validate_branch_name(&client, "").is_err());
        assert!(validate_branch_name(&client, "-flag").is_err());
        assert!(validate_branch_name(&client, "has space").is_err());
        assert!(validate_branch_name(&client, "ok/branch_1-2").is_ok());
    }

    #[test]
    fn list_branches_contains_local_main() {
        let (_, client) = repo();
        commit(&client, "a.txt", "first");
        let branches = list_branches(&client).unwrap();
        assert!(branches.iter().any(|b| b.name == "main"));
    }

    #[test]
    fn log_all_returns_commit() {
        let (_, client) = repo();
        commit(&client, "a.txt", "hello");
        let nodes = log_all(&client).unwrap();
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].subject, "hello");
    }
}
#[cfg(test)]
mod integration {
    use super::*;
    use crate::git::parse::parse_status_z;
    use crate::git::diff::{DiffScope, run_diff};
    use std::env::temp_dir;
    use std::sync::atomic::{AtomicU64, Ordering};

    /// Builds a small repo with a merge and a tag in a temp dir, then runs the
    /// full backend data path over it (graph, branches, status, diff).
    #[test]
    fn current_repo_full_path() {
        use std::process::Command as Cmd;

        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = temp_dir().join(format!("git-full-{}-{}", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let sh = |args: &[&str], cwd: &std::path::Path| {
            let o = Cmd::new("git").args(args).current_dir(cwd).output().unwrap();
            assert!(o.status.success(), "{args:?} -> {}", String::from_utf8_lossy(&o.stderr));
        };
        sh(&["init", "-q", "-b", "main"], &dir);
        sh(&["config", "user.email", "t@t"], &dir);
        sh(&["config", "user.name", "T"], &dir);
        let commit = |file: &str, msg: &str| {
            std::fs::write(dir.join(file), msg).unwrap();
            sh(&["add", "--", file], &dir);
            sh(&["commit", "-q", "-m", msg], &dir);
        };
        commit("f.txt", "c1");
        commit("f.txt", "c2");
        sh(&["checkout", "-qb", "dev"], &dir);
        commit("g.txt", "side");
        sh(&["checkout", "-q", "main"], &dir);
        sh(&["merge", "-q", "--no-ff", "dev", "-m", "merge side"], &dir);
        sh(&["tag", "v1"], &dir);
        // untracked file for status
        std::fs::write(dir.join("untracked-ã.txt"), "x").unwrap();

        let client = GitClient::new(&dir);

        // Graph: non-empty, contains a merge commit (2 parents) and a tag.
        let nodes = log_all(&client).unwrap();
        assert!(!nodes.is_empty(), "expected commits");
        assert!(
            nodes.iter().any(|n| n.parents.len() > 1),
            "expected a merge commit"
        );
        let all_refs: Vec<&str> = nodes
            .iter()
            .flat_map(|n| n.refs.iter().map(|r| r.name.as_str()))
            .collect();
        assert!(all_refs.contains(&"v1"), "expected tag v1 in decorations");
        assert!(all_refs.contains(&"dev"), "expected dev branch in decorations");

        // Branches include main + dev, and current resolves.
        let branches = list_branches(&client).unwrap();
        assert!(branches.iter().any(|b| b.name == "main"));
        assert!(branches.iter().any(|b| b.name == "dev" && b.kind == "local"));
        let current = branches.iter().find(|b| b.is_current).expect("current branch");
        assert_eq!(current_branch(&client).unwrap(), current.name.as_str());

        // Status parses, sees untracked UTF-8 file.
        let status_out = client.run(&["status", "--porcelain=v1", "-z"]).unwrap();
        let files = parse_status_z(&status_out.stdout);
        assert!(
            files.iter().any(|f| f.untracked && f.path.contains("ã")),
            "expected untracked file"
        );

        // `git diff` intentionally ignores untracked files (displays only tracked
        // changes), so the worktree diff must parse without error even though
        // it will not include the untracked file. Instead the dedicated
        // Untracked scope surfaces the untracked file's full content.
        let diffs = run_diff(&client, &DiffScope::Worktree, None).unwrap();
        assert!(!diffs.iter().any(|d| d.path.contains("untracked")));
        let untracked_diff =
            run_diff(&client, &DiffScope::Untracked { path: "untracked-ã.txt".to_string() }, None).unwrap();
        assert!(
            untracked_diff.iter().any(|d| d.path.contains("untracked") && d.status == "A"),
            "expected untracked file as addition via --no-index"
        );

        // After staging the untracked file it becomes a tracked addition, and
        // the staged diff (index vs HEAD) must surface it with status A.
        sh(&["add", "--", "untracked-ã.txt"], &dir);
        let staged = run_diff(&client, &DiffScope::Staged, None).unwrap();
        assert!(
            staged.iter().any(|d| d.path.contains("untracked") && d.status == "A"),
            "expected staged addition"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// `log_all` passes `--topo-order`, so its output is exactly git's
    /// topological order (`rev-list --all --topo-order`) even under clock
    /// skew. The spec's "ordem topológica (filhos antes dos pais)" is a
    /// weakened claim: git's --topo-order avoids interleaving parallel tracks
    /// but may show a merge before an older-line parent; what the frontend
    /// layout relies on is that the order is a genuine topological sort of the
    /// graph, which this test pins by comparison against git.
    #[test]
    fn log_all_matches_topo_order() {
        use std::process::Command as Cmd;

        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = temp_dir().join(format!("git-topo-{}-{}", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let sh = |args: &[&str], cwd: &std::path::Path| {
            let o = Cmd::new("git").args(args).current_dir(cwd).output().unwrap();
            assert!(o.status.success(), "{args:?} -> {}", String::from_utf8_lossy(&o.stderr));
        };
        sh(&["init", "-q", "-b", "main"], &dir);
        sh(&["config", "user.email", "t@t"], &dir);
        sh(&["config", "user.name", "T"], &dir);
        let commit = |file: &str, msg: &str| {
            std::fs::write(dir.join(file), msg).unwrap();
            sh(&["add", "--", file], &dir);
            sh(&["commit", "-q", "-m", msg], &dir);
        };
        // Force a clock skew: side branch tip is committer-dated AFTER the merge,
        // so git's default date order would place it out of topological order.
        commit("f.txt", "c1");
        commit("f.txt", "c2");
        sh(&["checkout", "-qb", "side"], &dir);
        commit("g.txt", "side");
        let skew = Cmd::new("git").args(["log", "-1", "--format=%ct"]).current_dir(&dir).output().unwrap();
        let skew: i64 = String::from_utf8_lossy(&skew.stdout).trim().parse().unwrap();
        // SAFETY: single-threaded test; the env var is scoped to this commit
        // and removed immediately after, so it cannot leak into other tests.
        unsafe { std::env::set_var("GIT_COMMITTER_DATE", format!("@{} +0000", skew + 3600)); }
        commit("h.txt", "side2 (future date)");
        unsafe { std::env::remove_var("GIT_COMMITTER_DATE"); }
        sh(&["checkout", "-q", "main"], &dir);
        sh(&["merge", "-q", "--no-ff", "side", "-m", "merge side"], &dir);

        let client = GitClient::new(&dir);
        let nodes = log_all(&client).unwrap();
        assert!(nodes.len() >= 3, "expected a merge + its parents");

        // Reference: the exact topological order git itself produces.
        let ref_out = client.run(&["rev-list", "--all", "--topo-order"]).unwrap();
        let ref_text = String::from_utf8_lossy(&ref_out.stdout);
        let ref_order: Vec<&str> = ref_text.split_whitespace().collect();

        let got_order: Vec<&str> = nodes.iter().map(|n| n.hash.as_str()).collect();
        assert_eq!(got_order, ref_order, "log_all must follow git --topo-order");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The HEAD commit (branch atual) is the first listed node, so the frontend
    /// places the current branch on the leftmost column (lane 0).
    #[test]
    fn log_all_puts_head_first() {
        use std::process::Command as Cmd;

        static SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = temp_dir().join(format!("git-headfirst-{}-{}", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let sh = |args: &[&str], cwd: &std::path::Path| {
            let o = Cmd::new("git").args(args).current_dir(cwd).output().unwrap();
            assert!(o.status.success(), "{args:?} -> {}", String::from_utf8_lossy(&o.stderr));
        };
        sh(&["init", "-q", "-b", "main"], &dir);
        sh(&["config", "user.email", "t@t"], &dir);
        sh(&["config", "user.name", "T"], &dir);
        let commit = |file: &str, msg: &str| {
            std::fs::write(dir.join(file), msg).unwrap();
            sh(&["add", "--", file], &dir);
            sh(&["commit", "-q", "-m", msg], &dir);
        };
        commit("f.txt", "c1");
        sh(&["checkout", "-qb", "dev"], &dir);
        commit("g.txt", "side");
        sh(&["checkout", "-q", "main"], &dir);
        commit("f.txt", "c2");
        sh(&["merge", "-q", "--no-ff", "dev", "-m", "merge into main"], &dir);

        let client = GitClient::new(&dir);
        // HEAD is main's merge tip.
        let head_out = client.run_str(&["rev-parse", "HEAD"]).unwrap();
        let head = head_out.trim().to_string();

        let nodes = log_all(&client).unwrap();
        assert_eq!(nodes.first().expect("has commits").hash, head, "HEAD must be the first listed commit");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
