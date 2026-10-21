//! Shared application state passed around via Tauri's `State`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;

use serde::Serialize;

/// Information about the currently-open repository.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repo {
    /// Canonical work-tree root (from `rev-parse --show-toplevel`).
    pub root: PathBuf,
    /// Display name (last path segment).
    pub name: String,
}

/// Serialized shape returned to the frontend for a repo.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    /// Current branch short name (mirrors `refs::current_branch`).
    pub current_branch: String,
    /// Whether the working tree is dirty (best-effort).
    pub is_dirty: bool,
    /// Full hash of HEAD when resolvable.
    pub head_hash: Option<String>,
}

/// Key used to cache a diff result.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DiffKey {
    pub scope_hash: String,
    pub path: Option<String>,
}

/// Application state held in Tauri's managed state.
pub struct AppState {
    pub repo: RwLock<Option<Repo>>,
    pub diff_cache: RwLock<HashMap<DiffKey, Vec<crate::git::diff::FileDiff>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            repo: RwLock::new(None),
            diff_cache: RwLock::new(HashMap::new()),
        }
    }

    /// Clears the diff cache — must be called whenever the repo state could
    /// change (stage, commit, checkout, external change).
    pub fn invalidate_diff_cache(&self) {
        self.diff_cache.write().unwrap().clear();
    }

    /// Snapshot of the open repo's root.
    pub fn repo_root(&self) -> Option<PathBuf> {
        self.repo.read().unwrap().clone().map(|r| r.root)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}