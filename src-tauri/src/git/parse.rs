//! Pure parsers for git text output.
//!
//! These functions have no I/O and operate on the exact byte layout emitted
//! by the commands built in [`super::refs`] and [`super::diff`]. Keeping the
//! parsing pure (fed by fixtures in tests) makes the NUL-delimited contract
//! easy to lock down.
//!
//! Filename safety: the caller always uses NUL-delimited output (`-z`,
//! `%x00`, `%x1e`) so renames, spaces, newlines and non-ASCII names survive.

use serde::Serialize;

/// Status of a single file in the working tree (from `git status --porcelain=v1 -z`).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    /// Code shown in the index column of porcelain v1 (X of `XY`), or `""`.
    pub index: String,
    /// Code shown in the worktree column (Y of `XY`), or `""`.
    pub worktree: String,
    /// Work-tree-relative path (new path after a rename).
    pub path: String,
    /// Previous path for a rename; `None` otherwise.
    pub old_path: Option<String>,
    /// True when untracked (`??`).
    pub untracked: bool,
    /// True when the file is binary (detected separately, see `analyze`).
    pub is_binary: bool,
}

impl FileStatus {
    /// True when the file is staged (a resolved change in the index column,
    /// excluding untracked files).
    ///
    /// Public contract for grouped UI display; verified by tests.
    #[allow(dead_code)]
    pub fn is_staged(&self) -> bool {
        !self.untracked && !self.index.is_empty()
    }
}

/// Parses `git status --porcelain=v1 -z` output.
///
/// Input is the NUL-delimited record stream: each record is either
/// `XY path` or `X  new\0old` for renames/copies. Records are split on NUL;
/// a non-NUL LF prefix (the `XY ` header) separates the code from the path.
///
/// # Live separators
/// * first byte pair = XY status
/// * ` ` follows, then either the path, or for renames `new\0old`.
pub fn parse_status_z(raw: &[u8]) -> Vec<FileStatus> {
    let records: Vec<&[u8]> = raw
        .split(|&b| b == 0)
        .filter(|r| !r.is_empty())
        .collect();

    let mut out = Vec::new();
    let mut i = 0;
    while i < records.len() {
        let rec = records[i];
        // Records come as `XY path` (X and Y are single letters or space).
        // For renames git emits two NUL records: `R old` then `new`.
        if rec.len() < 3 {
            i += 1;
            continue;
        }
        let x = rec[0] as char;
        let y = rec[1] as char;
        // Path begins after two status chars + space.
        let path_start = if rec.len() > 3 && rec[2] == b' ' { 3 } else { 2 };
        let path = String::from_utf8_lossy(&rec[path_start..]).into_owned();

        let mut status = FileStatus {
            index: if x == ' ' { String::new() } else { x.to_string() },
            worktree: if y == ' ' { String::new() } else { y.to_string() },
            path,
            old_path: None,
            untracked: false,
            is_binary: false,
        };

        let index_char = status.index.chars().next().unwrap_or(' ');
        let work_char = status.worktree.chars().next().unwrap_or(' ');

        // Untracked.
        status.untracked = index_char == '?' && work_char == '?';

        // Rename/copy: X == 'R' or 'C' -> next NUL record is the new path.
        if index_char == 'R' || index_char == 'C' {
            if i + 1 < records.len() {
                status.path = String::from_utf8_lossy(records[i + 1]).into_owned();
                status.old_path = Some(status_prev_path(&records[i]));
            }
            i += 1;
        }

        out.push(status);
        i += 1;
    }
    out
}

/// Extracts the "old" path from a rename record of the form `R  old`.
fn status_prev_path(rec: &[u8]) -> String {
    // Find the path portion: after the two status chars and optional space.
    let start = if rec.len() > 3 && rec[2] == b' ' { 3 } else { 2 };
    String::from_utf8_lossy(&rec[start..]).into_owned()
}

/// A commit returned by the graph command (from `git log --all ...`).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommitNode {
    pub hash: String,
    /// Parent hashes in order emitted by `%P`.
    pub parents: Vec<String>,
    pub author: String,
    pub author_email: String,
    /// ISO-8601 strict date (`%aI`).
    pub date: String,
    pub subject: String,
    pub refs: Vec<RefDecoration>,
}

/// A decoration parsed from `%D` (e.g. `HEAD -> main, origin/main, tag: v1.0`).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefDecoration {
    /// Decoration name, without the leading `tag:` / `remotes/` prefix.
    pub name: String,
    /// One of `head`, `branch`, `tag`, `remote`, `remote-tracking`, `stash`, `other`.
    pub kind: String,
}

/// Parses the ref-decoration string `%D` into structured items.
///
/// Git's default decorate uses `HEAD -> main, tag: v1.0, origin/main`.
/// We also normalise `remotes/origin/foo` and `refs/remotes/...`.
pub fn parse_decorations(d: &str) -> Vec<RefDecoration> {
    let mut out = Vec::new();
    for part in d.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let (name, kind) = if let Some(rest) = part.strip_prefix("tag:") {
            (trim_ref(rest.trim()).to_string(), "tag")
        } else if let Some(rest) = part.strip_prefix("HEAD ->") {
            (trim_ref(rest.trim()).to_string(), "branch") // current local branch
        } else if part == "HEAD" {
            ("HEAD".to_string(), "head")
        } else if let Some(rest) = part.strip_prefix("remotes/") {
            (trim_ref(rest).to_string(), "remote")
        } else if let Some(rest) = part.strip_prefix("refs/remotes/") {
            (trim_ref(rest).to_string(), "remote")
        } else if part.starts_with("refs/heads/") {
            (trim_ref(part).to_string(), "branch")
        } else if part.starts_with("refs/tags/") {
            (trim_ref(part).to_string(), "tag")
        } else if part.contains('/') {
            // Remote-tracking branch emitted as `origin/main` (no full prefix).
            (part.to_string(), "remote")
        } else {
            // Plain local branch name.
            (part.to_string(), "branch")
        };
        out.push(RefDecoration { name, kind: kind.to_string() });
    }
    out
}

fn trim_ref(s: &str) -> &str {
    s.strip_prefix("refs/remotes/")
        .or_else(|| s.strip_prefix("refs/heads/"))
        .or_else(|| s.strip_prefix("refs/tags/"))
        .unwrap_or(s)
}

/// Parses the NUL-delimited `git log` stream into [`CommitNode`]s.
///
/// Each commit is one line (git appends `\n`), and fields within a commit are
/// separated by NUL:
/// `hash NUL parents NUL author NUL date NUL email NUL subject NUL decorations`.
/// All fields are single-line, so `\n` is a safe record separator.
pub fn parse_commit_stream(raw: &[u8]) -> Vec<CommitNode> {
    let text = String::from_utf8_lossy(raw);
    let mut nodes = Vec::new();
    for rec in text.lines() {
        let fields: Vec<&str> = rec.split('\u{0}').collect();
        if fields.len() < 7 {
            continue;
        }
        let parents: Vec<String> = fields[1]
            .split(' ')
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        nodes.push(CommitNode {
            hash: fields[0].to_string(),
            parents,
            author: fields[2].to_string(),
            date: fields[3].to_string(),
            author_email: fields[4].to_string(),
            subject: fields[5].to_string(),
            refs: parse_decorations(fields[6]),
        });
    }
    nodes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_status_simple_untracked() {
        // Build a realistic record: "XY path\0"
        let mut bytes: Vec<u8> = b"?? path.txt".to_vec();
        bytes.push(0);
        let s = parse_status_z(&bytes);
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].path, "path.txt");
        assert!(s[0].untracked);
        assert!(!s[0].is_staged());
    }

    #[test]
    fn parse_status_staged_and_modified() {
        // Two records: "M  staged.txt" and " M modified.txt"
        let mut bytes = b"M  staged.txt".to_vec();
        bytes.push(0);
        bytes.extend_from_slice(b" M modified.txt");
        bytes.push(0);
        let s = parse_status_z(&bytes);
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].index, "M");
        assert!(s[0].is_staged());
        assert_eq!(s[1].index, "");
        assert_eq!(s[1].worktree, "M");
        assert!(!s[1].is_staged());
    }

    #[test]
    fn parse_status_rename() {
        // porcelain v1 rename (with space): "R  old name\n" NUL "new name\n" NUL — but -z
        // channels: "R  old" NUL "new"
        let mut bytes = b"R  old.txt".to_vec();
        bytes.push(0);
        bytes.extend_from_slice(b"new.txt");
        bytes.push(0);
        let s = parse_status_z(&bytes);
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].index, "R");
        assert_eq!(s[0].old_path.as_deref(), Some("old.txt"));
        assert_eq!(s[0].path, "new.txt");
        assert!(s[0].is_staged());
    }

    #[test]
    fn parse_status_empty() {
        let s = parse_status_z(&[]);
        assert!(s.is_empty());
    }

    #[test]
    fn parse_decorations_mixed() {
        // `git log --decorate=full` emits full ref names; `%D` then carries
        // `refs/heads/...`, `refs/remotes/...`, `tag: refs/tags/...`.
        let d = "HEAD -> refs/heads/main, tag: refs/tags/v1.0, refs/remotes/origin/main, refs/heads/dev";
        let decos = parse_decorations(d);
        let kinds: Vec<&str> = decos.iter().map(|r| r.kind.as_str()).collect();
        assert!(kinds.contains(&"branch"));
        assert!(kinds.contains(&"tag"));
        assert!(kinds.contains(&"remote"));
        let tag = decos.iter().find(|r| r.kind == "tag").unwrap();
        assert_eq!(tag.name, "v1.0");
        let head = decos.iter().find(|r| r.name == "main").unwrap();
        assert_eq!(head.kind, "branch");
        let remote = decos.iter().find(|r| r.name == "origin/main").unwrap();
        assert_eq!(remote.kind, "remote");
    }

    #[test]
    fn parse_decorations_local_branch_with_slash() {
        // A local branch whose name contains `/` (e.g. `feat/mdi-icons`) must
        // NOT be classified as remote just because of the slash. With
        // --decorate=full the prefixes disambiguate exactly.
        let d = "refs/remotes/origin/feat/mdi-icons, refs/heads/feat/mdi-icons";
        let decos = parse_decorations(d);
        let local = decos.iter().find(|r| r.name == "feat/mdi-icons").unwrap();
        assert_eq!(local.kind, "branch");
        let remote = decos.iter().find(|r| r.name == "origin/feat/mdi-icons").unwrap();
        assert_eq!(remote.kind, "remote");
    }

    #[test]
    fn parse_commit_stream_basic() {
        let mut raw = String::new();
        raw.push_str("abc123");
        raw.push('\u{0}');
        raw.push_str("def456");
        raw.push('\u{0}');
        raw.push_str("Jane Doe");
        raw.push('\u{0}');
        raw.push_str("2024-01-02T03:04:05+00:00");
        raw.push('\u{0}');
        raw.push_str("jane@example.com");
        raw.push('\u{0}');
        raw.push_str("Fix the bug");
        raw.push('\u{0}');
        raw.push_str("HEAD -> main");
        raw.push('\n');
        let nodes = parse_commit_stream(raw.as_bytes());
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].hash, "abc123");
        assert_eq!(nodes[0].parents, vec!["def456".to_string()]);
        assert_eq!(nodes[0].subject, "Fix the bug");
        assert_eq!(nodes[0].refs.len(), 1);
        assert_eq!(nodes[0].refs[0].name, "main");
    }

    #[test]
    fn parse_commit_stream_merge_two_parents() {
        let mut raw = String::new();
        raw.push_str("m1");
        raw.push('\u{0}');
        raw.push_str("p1 p2");
        raw.push('\u{0}');
        raw.push_str("A");
        raw.push('\u{0}');
        raw.push_str("d");
        raw.push('\u{0}');
        raw.push_str("a@b");
        raw.push('\u{0}');
        raw.push_str("merge");
        raw.push('\u{0}');
        raw.push_str("");
        raw.push('\n');
        let nodes = parse_commit_stream(raw.as_bytes());
        assert_eq!(nodes[0].parents, vec!["p1".to_string(), "p2".to_string()]);
    }
}