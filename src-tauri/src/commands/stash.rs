//! Operações de stash: guardar (push) e restaurar (pop) alterações do working tree.

use tauri::{AppHandle, Emitter, State};

use crate::git::run::GitClient;
use crate::state::AppState;

/// Builds a GitClient for the currently open repo, else an error string.
fn client(state: &AppState) -> Result<GitClient, String> {
    let root = state
        .repo_root()
        .ok_or_else(|| "nenhum repositório aberto".to_string())?;
    Ok(GitClient::new(root))
}

/// Guarda as alterações do working tree (incluindo untracked) numa stash e
/// limpa o working tree. Emite erro amigável quando não há nada a guardar.
#[tauri::command]
pub fn git_stash(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let client = client(state.inner())?;
    // `git status --porcelain` sem -z: qualquer saída significa alterações.
    let status = client.run(&["status", "--porcelain"]).map_err(|e| e.stderr)?;
    if String::from_utf8_lossy(&status.stdout).trim().is_empty() {
        return Err("nada para guardar no stash".to_string());
    }
    // `-u` inclui arquivos untracked (requisito: "guardar tudo, limpar o tree").
    client.run(&["stash", "push", "-u"]).map_err(|e| e.stderr)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "stash" }));
    Ok(())
}

/// Restaura a stash mais recente para o working tree via `git stash pop`,
/// removendo-a da lista ao aplicar com sucesso. Emite erro amigável quando a
/// lista de stashes está vazia. Em conflito, o git preserva a stash na lista
/// e o stderr é propagado.
#[tauri::command]
pub fn git_stash_pop(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let client = client(state.inner())?;
    // Lista vazia → nada a restaurar (erro amigável, consistente com o stash).
    let list = client.run(&["stash", "list"]).map_err(|e| e.stderr)?;
    if String::from_utf8_lossy(&list.stdout).trim().is_empty() {
        return Err("sem stash para restaurar".to_string());
    }
    client.run(&["stash", "pop"]).map_err(|e| e.stderr)?;
    state.invalidate_diff_cache();
    let _ = app.emit("repo-changed", serde_json::json!({ "reason": "stash-pop" }));
    Ok(())
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
        let dd = temp_dir().join(format!("git-stash-test-{}-{n}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dd);
        std::fs::create_dir_all(&dd).unwrap();
        let sh = |args: &[&str], cwd: &std::path::Path| {
            let o = SysCommand::new("git").args(args).current_dir(cwd).output().unwrap();
            assert!(o.status.success(), "{args:?} -> {}", String::from_utf8_lossy(&o.stderr));
        };
        sh(&["init", "-q", "-b", "main"], &dd);
        sh(&["config", "user.email", "t@t"], &dd);
        sh(&["config", "user.name", "T"], &dd);
        let client = GitClient::new(&dd);
        (dd, client)
    }

    fn commit(client: &GitClient, file: &str, msg: &str) {
        let _ = std::fs::write(client.root().join(file), msg);
        client.run(&["add", "--", file]).unwrap();
        client.run(&["commit", "-q", "-m", msg]).unwrap();
    }

    /// Simulates the guard checks + stash push path via the client.
    fn run_stash(client: &GitClient) -> Result<(), String> {
        let status = client.run(&["status", "--porcelain"]).map_err(|e| e.stderr)?;
        if String::from_utf8_lossy(&status.stdout).trim().is_empty() {
            return Err("nada para guardar no stash".to_string());
        }
        client.run(&["stash", "push", "-u"]).map(|_| ()).map_err(|e| e.stderr)
    }

    /// Simulates the guard checks + stash pop path via the client.
    fn run_pop(client: &GitClient) -> Result<(), String> {
        let list = client.run(&["stash", "list"]).map_err(|e| e.stderr)?;
        if String::from_utf8_lossy(&list.stdout).trim().is_empty() {
            return Err("sem stash para restaurar".to_string());
        }
        client.run(&["stash", "pop"]).map(|_| ()).map_err(|e| e.stderr)
    }

    #[test]
    fn stash_with_clean_worktree_errors_friendly() {
        let (_, client) = repo();
        commit(&client, "a.txt", "base");
        let err = run_stash(&client).unwrap_err();
        assert_eq!(err, "nada para guardar no stash");
    }

    #[test]
    fn stash_with_tracked_and_untracked_clears_worktree() {
        let (dd, client) = repo();
        commit(&client, "a.txt", "base");
        // Rastreada modificada + untracked novo.
        std::fs::write(dd.join("a.txt"), "changed").unwrap();
        std::fs::write(dd.join("new.txt"), "untracked").unwrap();
        run_stash(&client).unwrap();
        // Working tree limpo e stash criada.
        let status = client.run_str(&["status", "--porcelain"]).unwrap();
        assert!(status.trim().is_empty(), "expected clean tree, got: {status}");
        let list = client.run_str(&["stash", "list"]).unwrap();
        assert!(!list.trim().is_empty(), "expected a stash to exist");
    }

    #[test]
    fn pop_with_empty_list_errors_friendly() {
        let (_, client) = repo();
        commit(&client, "a.txt", "base");
        let err = run_pop(&client).unwrap_err();
        assert_eq!(err, "sem stash para restaurar");
    }

    #[test]
    fn pop_restores_stashed_content() {
        let (dd, client) = repo();
        commit(&client, "a.txt", "base");
        std::fs::write(dd.join("a.txt"), "stashed-change").unwrap();
        run_stash(&client).unwrap();
        // Tree limpo após o stash.
        let status = client.run_str(&["status", "--porcelain"]).unwrap();
        assert!(status.trim().is_empty());
        // Pop restaura o conteúdo e remove a stash.
        run_pop(&client).unwrap();
        let content = std::fs::read_to_string(dd.join("a.txt")).unwrap();
        assert_eq!(content, "stashed-change");
        let list = client.run_str(&["stash", "list"]).unwrap();
        assert!(list.trim().is_empty(), "expected stash list empty after pop");
    }
}