//! Diff command builders and hunks parsing.
//!
//! We shell out to `git diff` and parse the combined diff output (`-z`
//! naming plus unified hunks). A diff is requested for one of three
//! scopes: `Worktree` (vs index), `Staged` (index vs HEAD) or `Commit`
//! (two arbitrary revisions).

use serde::Serialize;

use super::run::GitClient;

/// How a diff is computed against the index/worktree or between revisions.
#[derive(Debug, Clone)]
pub enum DiffScope {
    /// Working tree vs index (unstaged).
    Worktree,
    /// Index vs HEAD (staged).
    Staged,
    /// An untracked file's full content, via `git diff --no-index /dev/null`.
    Untracked { path: String },
    /// Between two arbitrary revisions (`<a> <b>`).
    Commit { a: String, b: String },
}

/// A single line within a hunk.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    /// `context`, `add`, `del` or `meta`.
    pub kind: String,
    pub text: String,
    /// Line number in the old file, when applicable.
    pub old_ln: Option<u32>,
    /// Line number in the new file, when applicable.
    pub new_ln: Option<u32>,
}

/// A hunk with its `@@ -l,c +l,c @@` header and lines.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

/// A per-file diff.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    /// Path of the file, or new path after a rename.
    pub path: String,
    /// Old path for a rename; `None` otherwise.
    pub old_path: Option<String>,
    /// `A`, `M`, `D`, `R`, `T`, `C` — file status in the diff.
    pub status: String,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunk>,
}

/// Builds the `git diff` args for the given scope, optionally restricted to
/// one file.
fn diff_args(scope: &DiffScope, path: Option<&str>) -> Vec<String> {
    // Untracked files aren't in the index/worktree diff; show the full file
    // via `--no-index /dev/null`.
    if let DiffScope::Untracked { path: p } = scope {
        let mut args = vec![
            "diff".to_string(),
            "--no-color".to_string(),
            "--no-index".to_string(),
            "--unified=3".to_string(),
            "-z".to_string(),
        ];
        args.push("/dev/null".to_string());
        args.push(p.clone());
        return args;
    }

    let mut args = vec![
        "diff".to_string(),
        "-z".to_string(),
        "--no-color".to_string(),
        "--unified=3".to_string(),
        "--no-ext-diff".to_string(),
    ];
    match scope {
        DiffScope::Worktree => {
            // worktree vs index: no extra revs
        }
        DiffScope::Staged => {
            args.push("--cached".to_string());
        }
        DiffScope::Commit { a, b } => {
            args.push(a.clone());
            args.push(b.clone());
        }
        DiffScope::Untracked { .. } => unreachable!("handled above"),
    }
    if let Some(p) = path {
        args.push("--".to_string());
        args.push(p.to_string());
    }
    args
}

/// Infers a file's diff status from its header lines.
fn status_from_header(lines: &[&str]) -> &'static str {
    if lines.iter().any(|l| l.contains("new file mode")) {
        "A"
    } else if lines.iter().any(|l| l.contains("deleted file mode")) {
        "D"
    } else if lines.first().is_some_and(|f| f.contains("=>")) {
        "R"
    } else {
        "M"
    }
}

/// Parses the combined diff output into [`FileDiff`]s.
///
/// The stream is carried by `-z` for the file-name records: each file block
/// begins with `diff --git a/... b/...` and is NUL-terminated. We split on
/// NUL after the header signatures, then parse unified hunks line-by-line.
pub fn parse_diff(raw: &[u8]) -> Vec<FileDiff> {
    let text = String::from_utf8_lossy(raw);
    let blocks: Vec<&str> = text.split('\u{0}').collect();

    let mut files = Vec::new();
    let mut i = 0;
    while i < blocks.len() {
        let block = blocks[i];
        if !block.starts_with("diff --git ") {
            i += 1;
            continue;
        }
        // Split the block into header lines (until first `@@` or end).
        let lines: Vec<&str> = block.lines().collect();
        let (path, old_path, status, is_binary) = header_info(&lines);
        let mut hunks = Vec::new();
        let mut j = 1;
        while j < lines.len() {
            let line = lines[j];
            if line.starts_with("@@ ") && line.contains("@@") {
                let hunk = parse_hunk(&lines, j);
                hunks.push(hunk);
            }
            j += 1;
        }
        files.push(FileDiff {
            path,
            old_path,
            status: status.to_string(),
            is_binary,
            hunks,
        });
        i += 1;
    }
    files
}

/// Extracts header info from a `diff --git` block's lines.
///
/// `lines` covers the full block up to (but not including) the first hunk,
/// so we can also scan for binary markers that appear on later header lines.
fn header_info(lines: &[&str]) -> (String, Option<String>, &'static str, bool) {
    let first = lines.first().copied().unwrap_or("");
    // `diff --git a/old b/new`
    let status_raw = status_from_header(lines);
    // Extract a/ and b/ paths, handling git quoting (`"a/name with space"`)
    // and octal escapes (`\303`) used when a path is not core.quotePath-safe.
    let paths: Vec<String> = first
        .split_whitespace()
        .filter(|t| {
            let unq = t.trim_matches('"');
            unq.starts_with("a/") || unq.starts_with("b/")
        })
        .map(|t| {
            let unq = t.trim_matches('"');
            unq.strip_prefix("a/").or_else(|| unq.strip_prefix("b/")).unwrap_or(unq).to_string()
        })
        .collect();
    let new = paths.last().cloned().unwrap_or_default();
    let old = if paths.len() > 1 { paths.first().cloned() } else { None };
    let is_binary = lines
        .iter()
        .any(|l| l.contains("Binary files") || l.contains("GIT binary patch"));
    (new, old, status_raw, is_binary)
}

/// Parses a hunk starting at `start` (points at the `@@` line) until the
/// next `@@` or end of the file's block.
fn parse_hunk(lines: &[&str], start: usize) -> DiffHunk {
    let header = lines[start].to_string();
    let mut out_lines = Vec::new();
    let mut old_ln_guess: Option<u32> = None;
    let mut new_ln_guess: Option<u32> = None;

    // Parse @@ -old_start,old_count +new_start,new_count @@
    for range in lines[start]
        .split(' ')
        .filter(|t| t.starts_with('-') || t.starts_with('+'))
    {
        let (sign, body) = range.split_at(1);
        let start_num: u32 = body.split(',').next().and_then(|s| s.parse().ok()).unwrap_or(0);
        if sign == "-" {
            old_ln_guess = Some(start_num);
        } else {
            new_ln_guess = Some(start_num);
        }
    }

    let mut old_ln = old_ln_guess;
    let mut new_ln = new_ln_guess;

    let mut j = start + 1;
    while j < lines.len() && !lines[j].starts_with("@@ ") {
        let l = lines[j];
        let (kind, text) = if let Some(rest) = l.strip_prefix('+') {
            if rest.starts_with("+++") || l.starts_with("+++") {
                // new-file marker lines, treat as meta
                ("meta", l.to_string())
            } else {
                ("add", rest.to_string())
            }
        } else if let Some(rest) = l.strip_prefix('-') {
            if l.starts_with("---") {
                ("meta", l.to_string())
            } else {
                ("del", rest.to_string())
            }
        } else {
            ("context", l.to_string())
        };

        let (row_old, row_new) = match kind {
            "add" => (None, new_ln),
            "del" => (old_ln, None),
            _ => (old_ln, new_ln),
        };
        out_lines.push(DiffLine {
            kind: kind.to_string(),
            text,
            old_ln: row_old,
            new_ln: row_new,
        });

        match kind {
            "add" => {
                if let Some(n) = new_ln {
                    new_ln = Some(n + 1);
                }
            }
            "del" => {
                if let Some(o) = old_ln {
                    old_ln = Some(o + 1);
                }
            }
            _ => {
                if let Some(o) = old_ln {
                    old_ln = Some(o + 1);
                }
                if let Some(n) = new_ln {
                    new_ln = Some(n + 1);
                }
            }
        }
        j += 1;
    }

    DiffHunk { header, lines: out_lines }
}

/// Runs a diff for the given scope and returns parsed [`FileDiff`]s.
pub fn run_diff(client: &GitClient, scope: &DiffScope, path: Option<&str>) -> super::run::GitResult<Vec<FileDiff>> {
    let args: Vec<String> = diff_args(scope, path);
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    // `git diff` exits 1 when differences exist; `--no-index` also exits 1 on
    // a difference. Treat 0 and 1 as success.
    let out = client.run_diff_ok(&args_ref)?;
    Ok(parse_diff(&out.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_diff() -> Vec<u8> {
        // Diff of a file where we add a line (unified=3), with -z: block ends NUL.
        b"diff --git a/hello.rs b/hello.rs\n\
          index 1111111..2222222 100644\n\
          --- a/hello.rs\n\
          +++ b/hello.rs\n\
          @@ -1,3 +1,4 @@\n\
           fn main() {\n\
          -    println!(\"old\");\n\
          +    println!(\"new\");\n\
          +    println!(\"extra\");\n\
           }\n\
          \0next-file\n".to_vec()
    }

    #[test]
    fn parses_hunks_with_add_del() {
        let files = parse_diff(&sample_diff());
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "hello.rs");
        assert_eq!(files[0].hunks.len(), 1);
        let lines = &files[0].hunks[0].lines;
        // context, del, add, add, context
        assert_eq!(lines[0].kind, "context");
        assert_eq!(lines[1].kind, "del");
        assert!(lines[1].text.contains("old"));
        assert_eq!(lines[2].kind, "add");
        assert!(lines[2].text.contains("new"));
        assert_eq!(lines[3].kind, "add");
        assert!(lines[3].text.contains("extra"));
        assert_eq!(lines[4].kind, "context");
    }

    #[test]
    fn line_numbers_advance_correctly() {
        let files = parse_diff(&sample_diff());
        let lines = &files[0].hunks[0].lines;
        // context row1: old1/new1
        assert_eq!(lines[0].old_ln, Some(1));
        assert_eq!(lines[0].new_ln, Some(1));
        // del row2 → old2, no new
        assert_eq!(lines[1].old_ln, Some(2));
        assert_eq!(lines[1].new_ln, None);
        // add row2 → new2; add row3 → new3
        assert_eq!(lines[2].old_ln, None);
        assert_eq!(lines[2].new_ln, Some(2));
        assert_eq!(lines[3].new_ln, Some(3));
    }

    #[test]
    fn binary_diff_detected() {
        let raw = b"diff --git a/img.png b/img.png\nGIT binary patch\n\0".to_vec();
        let files = parse_diff(&raw);
        assert!(files[0].is_binary);
        assert!(files[0].hunks.is_empty());
    }

    #[test]
    fn rename_header_parses_old_new() {
        let raw = b"diff --git a/old.txt b/new.txt\nsimilarity index 100%\nrename from old.txt\nrename to new.txt\n\0".to_vec();
        let files = parse_diff(&raw);
        assert_eq!(files[0].path, "new.txt");
        assert_eq!(files[0].old_path.as_deref(), Some("old.txt"));
        assert_eq!(files[0].status, "M");
    }

    #[test]
    fn empty_diff() {
        assert!(parse_diff(&[]).is_empty());
    }
}