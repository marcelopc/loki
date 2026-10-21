//! Diff command — computes staged/unstaged/commit-range diffs with caching.

use tauri::{AppHandle, Emitter, State};

use crate::git::diff::{DiffScope, FileDiff, run_diff};
use crate::state::{AppState, DiffKey};

/// Request shape for a diff.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffRequest {
    /// One of `worktree`, `staged`, `commit`.
    pub scope: String,
    /// For `commit`, the two revisions `<a> <b>` (joined).
    pub revisions: Option<String>,
    /// Optional single file to restrict the diff to.
    pub path: Option<String>,
}

/// Returns the diff for the requested scope, reading from cache when the
/// repo hasn't changed (cache keyed by a hash of the request + HEAD).
#[tauri::command]
pub fn get_diff(
    app: AppHandle,
    state: State<'_, AppState>,
    req: DiffRequest,
) -> Result<Vec<FileDiff>, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    let client = crate::git::run::GitClient::new(root);

    let scope = match req.scope.as_str() {
        "worktree" => DiffScope::Worktree,
        "staged" => DiffScope::Staged,
        "untracked" => {
            let path = req.path.clone().ok_or_else(|| "é preciso informar o caminho para diff de arquivo untracked".to_string())?;
            DiffScope::Untracked { path }
        }
        "commit" => {
            let revs = req.revisions.clone().unwrap_or_default();
            let parts: Vec<&str> = revs.split_whitespace().collect();
            if parts.len() != 2 {
                return Err("é preciso informar dois revisões para diff de commit".to_string());
            }
            DiffScope::Commit { a: parts[0].to_string(), b: parts[1].to_string() }
        }
        other => return Err(format!("escopo de diff desconhecido: {other}")),
    };

    // Build a cache key that folds in the scope and the current HEAD.
    let head = client.run_str(&["rev-parse", "HEAD"]).unwrap_or_default();
    let key = DiffKey {
        scope_hash: format!("{head}|{}|{}", req.scope, req.revisions.clone().unwrap_or_default()),
        path: req.path.clone(),
    };

    if let Some(cached) = state.diff_cache.read().unwrap().get(&key) {
        return Ok(cached.clone());
    }

    let result = run_diff(&client, &scope, req.path.as_deref()).map_err(|e| e.stderr)?;
    state.diff_cache.write().unwrap().insert(key, result.clone());
    let _ = app.emit("diff-cache-warm", ());
    Ok(result)
}