// Left pane: branches list + working-tree changes (staged/unstaged/untracked).

import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";
import { statusSection, type FileStatus } from "../types";

export function LeftPane() {
  const { repo } = useRepo();
  if (!repo) return null;
  return (
    <div className="left-pane">
      <BranchesPanel />
      <ChangesPanel />
    </div>
  );
}

function BranchesPanel() {
  const { branches, refresh, error } = useRepo();
  const local = branches.filter((b) => b.kind === "local");
  const remote = branches.filter((b) => b.kind === "remote");

  async function onClick(name: string) {
    const current = local.find((b) => b.isCurrent);
    if (current?.name === name) return;
    try {
      await api.checkout(name);
      await refresh();
    } catch (e) {
      alert(`Não foi possível alternar: ${String(e)}`);
    }
  }

  return (
    <div className="pane-section">
      <div className="section-title">Branches</div>
      {local.map((b) => (
        <div
          key={b.name}
          className={`branch-item ${b.isCurrent ? "current" : ""}`}
          onClick={() => onClick(b.name)}
          title={b.upstream ? `upstream: ${b.upstream}` : undefined}
        >
          <span className="branch-dot" />
          <span className="branch-name">{b.name}</span>
          {b.ahead !== undefined && b.behind !== undefined && (
            <span className="branch-ab">
              ↑{b.ahead} ↓{b.behind}
            </span>
          )}
        </div>
      ))}
      {remote.length > 0 && (
        <>
          <div className="section-subtitle">Remote</div>
          {remote.map((b) => (
            <div key={b.name} className="branch-item remote" onClick={() => onClick(b.name)}>
              <span className="branch-name">{b.name}</span>
            </div>
          ))}
        </>
      )}
      {error && <div className="pane-error">{error}</div>}
    </div>
  );
}

const LABEL: Record<string, string> = {
  M: "modificado",
  A: "adicionado",
  D: "apagado",
  R: "renomeado",
  C: "copiado",
  T: "tipo alterado",
  U: "sem merge",
};

function statusLabel(f: FileStatus): string {
  const ch = f.index || f.worktree;
  return LABEL[ch] ?? ch;
}

function ChangesPanel() {
  const { status, selectDiff } = useRepo();
  const staged = status.filter((f) => statusSection(f) === "staged");
  const unstaged = status.filter((f) => statusSection(f) === "unstaged");
  const untracked = status.filter((f) => statusSection(f) === "untracked");

  return (
    <div className="pane-section changes">
      <div className="section-title">Changes</div>
      {staged.length > 0 && <FileGroup title={`Staged (${staged.length})`} files={staged} staged onOpen={(p) => selectDiff("staged", p)} />}
      {unstaged.length > 0 && <FileGroup title={`Unstaged (${unstaged.length})`} files={unstaged} onOpen={(p) => selectDiff("worktree", p)} />}
      {untracked.length > 0 && <FileGroup title={`Untracked (${untracked.length})`} files={untracked} onOpen={(p) => selectDiff("untracked", p)} />}
      {status.length === 0 && <div className="clean">Working tree limpo ✓</div>}
    </div>
  );
}

function FileGroup({
  title,
  files,
  staged = false,
  onOpen,
}: {
  title: string;
  files: FileStatus[];
  staged?: boolean;
  onOpen: (path: string) => void;
}) {
  const { refresh } = useRepo();

  async function toggle(f: FileStatus) {
    try {
      if (staged) await api.unstageFile(f.path);
      else await api.stageFile(f.path);
      await refresh();
    } catch (e) {
      alert(String(e));
    }
  }

  return (
    <div className="file-group">
      <div className="file-group-title">{title}</div>
      {files.map((f) => (
        <div key={f.path} className={`file-row ${staged ? "staged" : ""}`}>
          <button
            className="stage-btn"
            onClick={() => toggle(f)}
            title={staged ? "Tirar do stage" : "Adicionar ao stage"}
          >
            {staged ? "−" : "+"}
          </button>
          <span
            className={`file-status ${f.untracked ? "u" : ""}`}
            title={statusLabel(f)}
          >
            {f.untracked ? "?" : f.index || (f.worktree || "·")}
          </span>
          <span className="file-name" onClick={() => onOpen(f.path)} title={f.path}>
            {f.oldPath && f.path !== f.oldPath ? `${f.oldPath} → ` : ""}
            {f.path}
            {f.isBinary ? " (bin)" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
