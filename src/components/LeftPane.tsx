// Left pane: branches list. Working-tree changes moved to the right commit panel
// (CommitPanel.tsx); the diff is now rendered in the center column (GraphPane).

import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";
import { BranchIcon } from "./icons";

export function LeftPane() {
  const { repo } = useRepo();
  if (!repo) return null;
  return (
    <div className="left-pane">
      <BranchesPanel />
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
      <div className="section-title">
        <BranchIcon size="13px" /> Branches
      </div>
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