//! Commit, create-branch and checkout commands.

use std::process::Stdio;
use std::io::Write;

use tauri::{AppHandle, Emitter, State};
use serde::Serialize;

use crate::git::refs::{current_branch, validate_branch_name};
use crate::git::run::GitClient;
use crate::state::AppState;

/// Result of a successful commit.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitOutcome {
    pub hash: String,
    pub current_branch: String,
    pub head_hash: String,
}

/// Result of a checkout.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutOutcome {
    pub current_branch: String,
}

fn client(state: &AppState) -> Result<GitClient, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    Ok(GitClient::new(root))
}

/// Creates a commit from the staged content, using the message from stdin
/// so user input can never be interpreted as git options.
#[tauri::command]
pub fn commit_all(app: AppHandle, state: State<'_, AppState>, message: String) -> Result<CommitOutcome, String> {
    if message.trim().is_empty() {
        return Err("a mensagem de commit não pode ser vazia".to_string());
    }
    let client = client(state.inner())?;
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(client.root())
        .arg("--no-pager")
        .arg("commit")
        .arg("-F")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("falha ao iniciar git commit: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(message.as_bytes());
        // stdin dropped → EOF
    }
    let out = child.wait_with_output().map_err(|e| format!("falha ao esperar git commit: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }

    let hash = String::from_utf8_lossy(&out.stdout).lines().last().unwrap_or("").to_string();
    let current_branch = current_branch(&client).unwrap_or_else(|_| "HEAD".to_string());
    let head_hash = client.run_str(&["rev-parse", "HEAD"]).map(|s| s.trim().to_string()).unwrap_or_default();

    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "commit" }));
    Ok(CommitOutcome { hash, current_branch, head_hash })
}

/// Creates a new branch and switches to it (`git switch -c`).
#[tauri::command]
pub fn create_branch(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<(), String> {
    let client = client(state.inner())?;
    validate_branch_name(&client, &name)?;
    let trimmed = name.trim();
    client
        .run(&["switch", "-c", trimmed])
        .map_err(|e| e.stderr)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "branch-created" }));
    Ok(())
}

/// Switches to an existing branch or tag. On a dirty work-tree collision the
/// git stderr (with the blocking file list) is surfaced for UI confirmation.
#[tauri::command]
pub fn checkout(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<CheckoutOutcome, String> {
    let client = client(state.inner())?;
    client
        .run(&["checkout", name.as_str()])
        .map_err(|e| e.stderr)?;
    let current_branch = current_branch(&client)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "checkout" }));
    Ok(CheckoutOutcome { current_branch })
}