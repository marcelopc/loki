// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use state::AppState;
use std::time::Duration;
use tauri::{Emitter, Manager};

mod commands;
mod git;
mod state;

/// Starts the Tauri application, wiring plugins, managed state, commands and
/// the external-change poller.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            // Auto-open the last-used repo when present and still valid.
            let state = app.state::<AppState>();
            let handle = app.handle().clone();
            if let Some(info) = commands::repo::try_open_last_repo(&handle, state.inner()) {
                let _ = app.emit("repo-opened", &info);
            }
            // Poll for external changes (e.g. a terminal `git commit`) while
            // the window is focused, so the UI stays fresh.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut last_fingerprint: Option<String> = None;
                loop {
                    std::thread::sleep(Duration::from_millis(2000));
                    if app_handle.get_webview_window("main").is_none() {
                        continue;
                    }
                    // Only bother when a repo is open; take an owned root copy.
                    let root = match app_handle.state::<AppState>().repo_root() {
                        Some(r) => r,
                        None => continue,
                    };
                    let client = git::run::GitClient::new(root);
                    // Fingerprint the working tree: a cheap status hash. Any
                    // change (new file, edited, staged) flips it, so we only
                    // emit `repo-changed` when something actually changed.
                    let fingerprint = match client.run(&["status", "--porcelain=v1"]) {
                        Ok(o) => Some(format!("{:?}", o.stdout)),
                        Err(_) => None,
                    };
                    if fingerprint.is_some() && fingerprint != last_fingerprint {
                        last_fingerprint = fingerprint;
                        command_refresh(&app_handle);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::repo::open_repository,
            commands::repo::get_repo_state,
            commands::graph::get_commit_graph,
            commands::graph::get_branches,
            commands::graph::get_current_branch,
            commands::status::get_status,
            commands::status::stage_file,
            commands::status::unstage_file,
            commands::commit::commit_all,
            commands::commit::create_branch,
            commands::commit::checkout,
            commands::diff::get_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Emits a `repo-changed` event to ask the frontend to refresh.
fn command_refresh(app: &tauri::AppHandle) {
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "external" }));
}