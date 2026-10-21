// Top toolbar: open repo, refresh, current branch + create/checkout controls.

import { useMemo, useState } from "react";
import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";

export function Toolbar() {
  const { repo, branches, refresh, openRepo, error } = useRepo();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const currentBranch = useMemo(
    () => branches.find((b) => b.isCurrent) ?? null,
    [branches]
  );

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
          📂 Abrir
        </button>
        <button className="btn" onClick={refresh}>
          ⟳
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
                ✕
              </button>
            </span>
          ) : (
            <button className="btn small" onClick={() => setCreating(true)} title="Nova branch">
              + Branch
            </button>
          )}
        </div>
      )}

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}