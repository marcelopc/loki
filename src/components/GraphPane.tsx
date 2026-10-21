// Center pane: the commit graph (in a dedicated left gutter) + per-row labels
// and ref badges, virtualized. Both columns live in one native scroll
// container so they scroll together — no translation hacks.

import { useMemo, useState } from "react";
import { useRepo } from "../state/RepoContext";
import { useVirtual } from "../hooks/useVirtual";
import { CommitGraph, layoutCommits, graphMetrics, ROW_H } from "./CommitGraph";
import { DiffView } from "./DiffView";
import type { RefDecoration } from "../types";

function RefBadges({ refs }: { refs: RefDecoration[] }) {
  if (refs.length === 0) return null;
  return (
    <span className="refs">
      {refs.map((r, i) => (
        <span
          key={`${r.name}-${i}`}
          className={`ref-badge ref-${r.kind}`}
          title={`${r.kind}: ${r.name}`}
        >
          {r.kind === "tag" ? "◈" : r.kind === "head" ? "HEAD" : "⎇"} {r.name}
        </span>
      ))}
    </span>
  );
}

export function GraphPane() {
  const { graph, repo } = useRepo();
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const { total, start, end, containerRef } = useVirtual(graph.length, ROW_H);

  // Hoist layout + metrics so the gutter width is known before CommitGraph renders.
  const { placed, metrics } = useMemo(() => {
    const placed = layoutCommits(graph);
    return { placed, metrics: graphMetrics(placed) };
  }, [graph]);

  const headHash = useMemo(() => {
    const current = graph.find((c) => c.refs.some((r) => r.kind === "head"));
    return current?.hash ?? null;
  }, [graph]);

  return (
    <div className="graph-pane">
      <GraphHeader />
      <div className="graph-scroll" ref={containerRef}>
        {graph.length === 0 ? (
          <div className="graph-empty">Nenhum commit neste repositório.</div>
        ) : (
          <div className="graph-canvas" style={{ height: total * ROW_H }}>
            <div className="graph-gutter" style={{ width: metrics.gutterWidth }}>
              <CommitGraph
                placed={placed}
                start={start}
                end={end}
                laneWidth={metrics.laneWidth}
                gutterWidth={metrics.gutterWidth}
                selectedHash={selectedHash}
                headHash={headHash}
                onSelect={setSelectedHash}
              />
            </div>
            <div className="graph-rows">
              {graph.slice(start, end).map((c, i) => {
                const rowIndex = start + i;
                return (
                  <div
                    key={c.hash}
                    className={`ga-row ${c.hash === selectedHash ? "selected" : ""} ${
                      c.hash === headHash ? "head" : ""
                    }`}
                    style={{ top: rowIndex * ROW_H }}
                    onClick={() => setSelectedHash(c.hash)}
                  >
                    <span className="ga-subject">{c.subject}</span>
                    <RefBadges refs={c.refs} />
                    <span className="ga-meta">
                      {c.author} · {shortDate(c.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {repo && <CommitDetail hash={selectedHash} />}
      <DiffView />
    </div>
  );
}

function GraphHeader() {
  const { loading } = useRepo();
  return (
    <div className="graph-header">
      <span>Commits</span>
      {loading && <span className="spinner" aria-label="carregando" />}
    </div>
  );
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function CommitDetail({ hash }: { hash: string | null }) {
  const { graph } = useRepo();
  const node = hash ? graph.find((c) => c.hash === hash) : undefined;
  if (!node) return null;
  return (
    <div className="commit-detail">
      <div className="cd-subject">{node.subject}</div>
      <div className="cd-meta">
        {node.author} &lt;{node.authorEmail}&gt; · {node.date}
      </div>
      <div className="cd-hash">{node.hash.slice(0, 12)}</div>
    </div>
  );
}