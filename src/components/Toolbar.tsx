// Top toolbar: open repo, refresh, current branch + create/checkout controls.

import { useMemo, useState } from "react";
import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";
import { gitActionState, type GitAction } from "../types";
import {
  CloseIcon,
  FolderIcon,
  PlusIcon,
  PopIcon,
  PullIcon,
  PushIcon,
  RefreshIcon,
  StashIcon,
} from "./icons";

export function Toolbar() {
  const { repo, branches, refresh, openRepo, error } = useRepo();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const currentBranch = useMemo(
    () => branches.find((b) => b.isCurrent) ?? null,
    [branches]
  );

  const actionState = useMemo(
    () => gitActionState(repo, currentBranch),
    [repo, currentBranch]
  );

  const runAction: Record<GitAction, () => Promise<void>> = {
    pull: () => api.gitPull(),
    push: () => api.gitPush(),
    stash: () => api.gitStash(),
    pop: () => api.gitStashPop(),
  };

  async function runGitAction(action: GitAction) {
    try {
      await runAction[action]();
      await refresh();
    } catch (e) {
      alert(`${action[0].toUpperCase()}${action.slice(1)}: ${String(e)}`);
    }
  }

  async function switchBranch(name: string) {
    if (name === currentBranch?.name) return;
    try {
      await api.checkout(name);
      await refresh();
    } catch (e) {
      alert(`Não foi possível trocar para a branch: ${String(e)}`);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createBranch(name);
      setNewName("");
      setCreating(false);
      await refresh();
    } catch (e) {
      alert(`Falha ao criar branch: ${String(e)}`);
    }
  }

  return (
    <div className="toolbar">
      <div className="tb-left">
        <button className="btn" onClick={openRepo}>
          <FolderIcon /> Abrir
        </button>
        <button className="btn" onClick={refresh} title="Atualizar">
          <RefreshIcon />
        </button>
        {repo && (
          <span className="tb-repo" title={repo.path}>
            {repo.name}
            {repo.currentBranch && currentBranch ? ` · ${currentBranch?.name}` : ""}
          </span>
        )}
      </div>

      {repo && (
        <div className="tb-right">
          <div className="action-grp">
            <button
              className={`action-btn${actionState.pull.dim ? " dim" : ""}`}
              disabled={actionState.pull.disabled}
              onClick={() => runGitAction("pull")}
              title="Puxar alterações do upstream (git pull)"
            >
              <PullIcon /> Pull
            </button>
            <button
              className={`action-btn push${actionState.push.dim ? " dim" : ""}`}
              disabled={actionState.push.disabled}
              onClick={() => runGitAction("push")}
              title="Enviar commits locais para o upstream (git push)"
            >
              <PushIcon /> Push
            </button>
            <button
              className="action-btn"
              disabled={actionState.stash.disabled}
              onClick={() => runGitAction("stash")}
              title="Guardar alterações no stash (git stash push)"
            >
              <StashIcon /> Stash
            </button>
            <button
              className="action-btn"
              disabled={actionState.pop.disabled}
              onClick={() => runGitAction("pop")}
              title="Restaurar a stash mais recente (git stash pop)"
            >
              <PopIcon /> Pop
            </button>
          </div>

          <select
            className="branch-select"
            value={currentBranch?.name ?? ""}
            onChange={(e) => switchBranch(e.currentTarget.value)}
            title="Alternar branch"
          >
            {branches
              .filter((b) => b.kind === "local")
              .map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.isCurrent ? "✓" : ""}
                </option>
              ))}
          </select>

          {creating ? (
            <span className="new-branch-inline">
              <input
                autoFocus
                value={newName}
                placeholder="nova branch"
                onChange={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <button className="btn primary small" onClick={handleCreate}>
                Criar
              </button>
              <button className="btn small" onClick={() => setCreating(false)}>
                <CloseIcon />
              </button>
            </span>
          ) : (
            <button className="btn small" onClick={() => setCreating(true)} title="Nova branch">
              <PlusIcon /> Branch
            </button>
          )}
        </div>
      )}

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}