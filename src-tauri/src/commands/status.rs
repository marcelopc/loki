//! Working-tree status and stage/unstage commands.

use tauri::{AppHandle, Emitter, State};

use crate::git::parse::{FileStatus, parse_status_z};
use crate::git::run::GitClient;
use crate::state::AppState;

/// Builds a GitClient for the currently open repo, else an error string.
fn client(state: &AppState) -> Result<GitClient, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    Ok(GitClient::new(root))
}

/// Returns the list of changed files (staged/unstaged/untracked).
#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<Vec<FileStatus>, String> {
    let client = client(state.inner())?;
    let raw = client.run(&["status", "--porcelain=v1", "-z"]).map_err(|e| e.stderr)?;
    let mut files = parse_status_z(&raw.stdout);
    // Detect binary files for accurate UI markers.
    for f in files.iter_mut() {
        f.is_binary = is_binary(&client, &f.path);
    }
    Ok(files)
}

/// Stages a single file (exact path) into the index.
#[tauri::command]
pub fn stage_file(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    let client = client(state.inner())?;
    let mut args = vec!["add"];
    if !path.starts_with('-') {
        args.push("--");
    }
    args.push(&path);
    client.run(&args).map_err(|e| e.stderr)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "stage" }));
    Ok(())
}

/// Unstages a single file (moves it out of the index, keeps worktree edits).
#[tauri::command]
pub fn unstage_file(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    let client = client(state.inner())?;
    let mut args = vec!["restore", "--staged"];
    if !path.starts_with('-') {
        args.push("--");
    }
    args.push(&path);
    client.run(&args).map_err(|e| e.stderr)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "unstage" }));
    Ok(())
}

/// Best-effort binary detection for a work-tree path.
fn is_binary(client: &GitClient, path: &str) -> bool {
    // `git diff --numstat -z -- path` prints `-\t-\t<path>\0` for binaries.
    if let Ok(out) = client.run(&["diff", "--numstat", "-z", "--", path]) {
        let line = String::from_utf8_lossy(&out.stdout);
        return line.starts_with("-") && line.contains('\t');
    }
    false
}