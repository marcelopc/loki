//! Commit graph and branch listing commands.

use tauri::State;

use crate::git::parse::CommitNode;
use crate::git::refs::{BranchInfo, current_branch, list_branches, log_all};
use crate::git::run::GitClient;
use crate::state::AppState;

/// Returns the commit graph (all branches, decorated) for the open repo.
#[tauri::command]
pub fn get_commit_graph(state: State<'_, AppState>) -> Result<Vec<CommitNode>, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    let client = GitClient::new(root);
    log_all(&client).map_err(|e| e.stderr)
}

/// Returns the list of branches for the open repo.
#[tauri::command]
pub fn get_branches(state: State<'_, AppState>) -> Result<Vec<BranchInfo>, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    let client = GitClient::new(root);
    list_branches(&client).map_err(|e| e.stderr)
}

/// Returns the current branch short name (used by the toolbar display).
#[tauri::command]
pub fn get_current_branch(state: State<'_, AppState>) -> Result<String, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    let client = GitClient::new(root);
    current_branch(&client).map_err(|e| e.stderr)
}