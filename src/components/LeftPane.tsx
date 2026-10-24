// Left pane: branches list. Working-tree changes moved to the right commit panel
// (CommitPanel.tsx); the diff is now rendered in the center column (GraphPane).

import { useState } from "react";
import { useRepo } from "../state/RepoContext";
import { api } from "../lib/tauri";
import type { BranchInfo } from "../types";
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
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(true);

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
      <BranchGroup
        title="Locais"
        open={localOpen}
        onToggle={() => setLocalOpen((v) => !v)}
        items={local}
        onClick={onClick}
      />
      <BranchGroup
        title="Remotas"
        open={remoteOpen}
        onToggle={() => setRemoteOpen((v) => !v)}
        items={remote}
        onClick={onClick}
      />
      {error && <div className="pane-error">{error}</div>}
    </div>
  );
}

function BranchGroup({
  title,
  open,
  onToggle,
  items,
  onClick,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  items: BranchInfo[];
  onClick: (name: string) => void;
}) {
  return (
    <div className="branch-group">
      <div
        className="branch-group-head"
        role="button"
        aria-expanded={open}
        aria-controls={`${title}-branches`}
        onClick={onToggle}
      >
        <span className="branch-group-caret">{open ? "▼" : "▶"}</span>
        <span>{title}</span>
      </div>
      {open && (
        <div className="branch-group-body" id={`${title}-branches`}>
          {items.length === 0 && <div className="branch-group-empty">Nenhuma branch</div>}
          {items.map((b) => (
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
        </div>
      )}
    </div>
  );
}