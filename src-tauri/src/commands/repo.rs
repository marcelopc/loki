//! Repository open/state commands.

use std::path::PathBuf;

use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

use crate::git::run::GitClient;
use crate::state::{AppState, Repo, RepoInfo};

const LAST_REPO_KEY: &str = "lastRepo";

/// Opens a folder picker, validates the selection is a git work tree, stores
/// it as the current repo and remembers it for next launch.
#[tauri::command]
pub async fn open_repository(app: AppHandle, state: State<'_, AppState>) -> Result<RepoInfo, String> {
    // `blocking_pick_folder` shows a native modal; run it off the async
    // reactor via spawn_blocking so the poller isn't starved.
    let dialog_app = app.clone();
    let picked = match tauri::async_runtime::spawn_blocking(move || {
        dialog_app.dialog().file().blocking_pick_folder()
    })
    .await
    {
        Ok(Some(f)) => f.into_path().map_err(|e| format!("caminho inválido selecionado: {e}"))?,
        Ok(None) => return Err("seleção cancelada".to_string()),
        Err(_) => return Err("falha ao abrir o seletor de pasta".to_string()),
    };

    let info = load_repo(&picked)?;

    // Persist as last-repo for next launch.
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set(LAST_REPO_KEY, serde_json::Value::String(info.path.clone()));
        let _ = store.save();
    }

    state.repo.write().unwrap().replace(Repo {
        root: PathBuf::from(&info.path),
        name: info.name.clone(),
    });
    // Emit so the frontend can refresh immediately.
    let _ = app.emit("repo-opened", &info);
    Ok(info)
}

/// Returns the current repo info, if any.
#[tauri::command]
pub fn get_repo_state(state: State<'_, AppState>) -> Result<Option<RepoInfo>, String> {
    let root = match state.repo_root() {
        Some(r) => r,
        None => return Ok(None),
    };
    Ok(Some(collect_repo_info(&root)?))
}

/// Validates `candidate` is inside a git work tree and reports repo info.
pub fn load_repo(candidate: &PathBuf) -> Result<RepoInfo, String> {
    // Cheap probe on a throwaway client is enough to reject non-repos.
    let probe = GitClient::new(candidate.clone());
    let root = probe
        .run_str(&["rev-parse", "--show-toplevel"])
        .map_err(|e| if e.stderr.contains("not a git repository") {
            "a pasta selecionada não é um repositório git".to_string()
        } else {
            format!("não é possível ler o repositório: {}", e.stderr)
        })?;
    let root = PathBuf::from(root.trim());
    collect_repo_info(&root)
}

/// Gathers the serializable [`RepoInfo`] for an open repo root.
pub fn collect_repo_info(root: &PathBuf) -> Result<RepoInfo, String> {
    let client = GitClient::new(root.clone());
    let current_branch = crate::git::refs::current_branch(&client).unwrap_or_else(|_| "HEAD".to_string());
    // `git diff --quiet` exits non-zero when there are differences; so an
    // error means dirty. A clean tree (no diff) exits 0.
    let unstaged = client.run(&["diff", "--quiet"]).is_err();
    let staged = client.run(&["diff", "--cached", "--quiet"]).is_err();
    let is_dirty = unstaged || staged;
    let head_hash = client
        .run_str(&["rev-parse", "--short", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string());

    Ok(RepoInfo {
        path: root.to_string_lossy().into_owned(),
        name: root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "repositório".to_string()),
        current_branch,
        is_dirty,
        head_hash,
    })
}

/// Try to auto-open the persisted last repo at startup. Returns info when a
/// valid repo is found; otherwise clears the stale entry.
pub fn try_open_last_repo(app: &AppHandle, state: &AppState) -> Option<RepoInfo> {
    let last: Option<String> = app.store("settings.json").ok().and_then(|s| s.get(LAST_REPO_KEY)).and_then(|v| v.as_str().map(|s| s.to_string()));
    let path = last.map(PathBuf::from)?;
    let info = load_repo(&path).ok()?;
    state.repo.write().unwrap().replace(Repo {
        root: PathBuf::from(&info.path),
        name: info.name.clone(),
    });
    Some(info)
}