// Right pane: the commit panel. Three stacked areas — Unstaged (with a distinct
// marker for untracked files), Staged, and the commit form (summary + button with
// the staged-file count). The diff moved to the center column (GraphPane).

import { useState } from "react";
import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";
import { commitPanelSection, type FileStatus } from "../types";

export function CommitPanel() {
  const { repo } = useRepo();
  if (!repo) return null;
  return (
    <div className="commit-panel">
      <section className="cp-section">
        <header className="section-head">
          <div className="section-title">Unstaged</div>
          <MassAction files={statusFor("unstaged")} staged={false} />
        </header>
        <FileGroup files={statusFor("unstaged")} staged={false} />
      </section>
      <section className="cp-section">
        <header className="section-head">
          <div className="section-title">Staged</div>
          <MassAction files={statusFor("staged")} staged />
        </header>
        <FileGroup files={statusFor("staged")} staged />
      </section>
      <CommitForm />
    </div>
  );
}

function statusFor(section: "staged" | "unstaged") {
  const { status } = useRepo();
  return status.filter((f) => commitPanelSection(f) === section);
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

/// Inline action in a section header to stage/unstage all files at once.
/// Hidden when the section has no files (empty sections show the `.clean` hint).
function MassAction({ files, staged }: { files: FileStatus[]; staged: boolean }) {
  const { repo, refresh } = useRepo();
  if (files.length === 0) return null;
  const label = staged ? "Remover todos do stage" : "Adicionar todos ao stage";
  return (
    <button
      className={`mass-btn ${staged ? "unstage" : "stage"}`}
      title={label}
      aria-label={label}
      disabled={!repo}
      onClick={async () => {
        try {
          if (staged) await api.unstageAll();
          else await api.stageAll();
          await refresh();
        } catch (e) {
          alert(String(e));
        }
      }}
    >
      {staged ? "Tirar todos" : "Adicionar todos"}
    </button>
  );
}

function FileGroup({ files, staged }: { files: FileStatus[]; staged: boolean }) {
  const { refresh, selectDiff } = useRepo();

  async function toggle(f: FileStatus) {
    try {
      if (staged) await api.unstageFile(f.path);
      else await api.stageFile(f.path);
      await refresh();
    } catch (e) {
      alert(String(e));
    }
  }

  function onOpen(f: FileStatus) {
    // Untracked files are presented under "Unstaged"; their diff scope stays "untracked".
    const scope = staged ? "staged" : f.untracked ? "untracked" : "worktree";
    selectDiff(scope, f.path);
  }

  if (files.length === 0) {
    return <div className="clean">{staged ? "Nada em stage" : "Sem alterações pendentes"}</div>;
  }
  return (
    <div className="file-group">
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
            {f.untracked ? "U" : f.index || (f.worktree || "·")}
          </span>
          <span className="file-name" onClick={() => onOpen(f)} title={f.path}>
            {f.oldPath && f.path !== f.oldPath ? `${f.oldPath} → ` : ""}
            {f.path}
            {f.isBinary ? " (bin)" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function CommitForm() {
  const { status, refresh } = useRepo();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const stagedCount = status.filter((f) => commitPanelSection(f) === "staged").length;

  async function submit() {
    if (!message.trim() || stagedCount === 0) return;
    setBusy(true);
    try {
      await api.commitAll(message);
      setMessage("");
      await refresh();
    } catch (e) {
      alert(`Commit falhou: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="commit-form card">
      <div className="section-title">Commit</div>
      <textarea
        className="commit-message"
        rows={4}
        value={message}
        placeholder="Mensagem do commit..."
        onChange={(e) => setMessage(e.currentTarget.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
        }}
      />
      <button
        className="btn primary full"
        disabled={!message.trim() || stagedCount === 0 || busy}
        onClick={submit}
      >
        {busy ? "Gravando..." : `Commit (${stagedCount} arquivo${stagedCount === 1 ? "" : "s"})`}
      </button>
      <div className="commit-hint">Ctrl+Enter para commitar</div>
    </div>
  );
}