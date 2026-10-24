// Center pane: the commit graph (in a dedicated left gutter) + per-row labels
// and ref badges, virtualized. Both columns live in one native scroll
// container so they scroll together — no translation hacks.

import { useMemo, useState, type CSSProperties } from "react";
import { useRepo } from "../state/RepoContext";
import { useVirtual } from "../hooks/useVirtual";
import { CommitGraph, layoutCommits, graphMetrics, ROW_H } from "./CommitGraph";
import { DiffView } from "./DiffView";
import { LaptopIcon, RemoteIcon } from "./icons";
import type { CommitNode, RefDecoration } from "../types";
import { pickPrimaryRef } from "../types";

function refPrefix(kind: string): string {
  return kind === "tag" ? "◈" : kind === "head" ? "HEAD" : "⎇";
}

// Display name for a ref in the chip: remote branches show only the branch
// part (`origin/feat/mdi-icons` → `feat/mdi-icons`); the remote glyph already
// tells it is a remote.
function refDisplayName(r: RefDecoration): string {
  if (r.kind === "remote") {
    const slash = r.name.indexOf("/");
    return slash > 0 ? r.name.slice(slash + 1) : r.name;
  }
  return r.name;
}

// Glyph shown in the ref column before the ref name. Local branch → laptop,
// remote branch → forge icon (octocat, forge-agnostic in practice); tag and
// HEAD keep the symbolic glyphs.
function RefGlyph({ kind }: { kind: string }) {
  if (kind === "branch") return <LaptopIcon size="12px" />;
  if (kind === "remote") return <RemoteIcon size="12px" />;
  return <span className={`ref-prefix ref-${kind}`}>{refPrefix(kind)}</span>;
}

// Dedicated first column (left of the graph gutter). Shows the single primary
// ref of each commit — truncated by the fixed-width `.ref-column`. When a ref
// is tracked (local branch + matching remote, e.g. `main` + `origin/main`),
// both glyphs render side by side. Tag chips inherit the commit's lane color
// (`colorByHash`) so the ref is visually tied to its graph line. Cells are
// absolutely positioned at each row's Y and windowed with the same start/end
// as graph-rows, so the column stays aligned while scrolling.
function RefColumn({
  commits,
  start,
  colorByHash,
}: {
  commits: CommitNode[];
  start: number;
  colorByHash: Map<string, string>;
}) {
  return (
    <div className="ref-column">
      {commits.map((c, i) => {
        const primary = pickPrimaryRef(c.refs);
        if (!primary) {
          return <div key={c.hash} className="ref-row" style={{ top: (start + i) * ROW_H }} />;
        }
        // Tracked pair: local branch + matching remote (`origin/main` ↔ `main`).
        const local = c.refs.find((r) => r.kind === "branch");
        const remote = local
          ? c.refs.find((r) => r.kind === "remote" && r.name.endsWith(`/${local.name}`))
          : undefined;
        const tracked = Boolean(local && remote);
        const title = tracked
          ? `${local!.kind}: ${local!.name} · ${remote!.kind}: ${remote!.name}`
          : `${primary.kind}: ${primary.name}`;
        // Tags and local branches inherit the commit's lane color so the chip is
        // visually tied to its graph line.
        const laneColor =
          primary.kind === "tag" || primary.kind === "branch"
            ? colorByHash.get(c.hash)
            : undefined;
        return (
          <div key={c.hash} className="ref-row" style={{ top: (start + i) * ROW_H }}>
            <span
              className={`ref-cell ref-${primary.kind}`}
              title={title}
              style={laneColor ? ({ "--ref-color": laneColor } as CSSProperties) : undefined}
            >
              <span className="ref-prefix">
                {tracked ? (
                  <>
                    <RefGlyph kind="branch" />
                    <RefGlyph kind="remote" />
                  </>
                ) : (
                  <RefGlyph kind={primary.kind} />
                )}
              </span>
              <span className="ref-name">{refDisplayName(primary)}</span>
            </span>
          </div>
        );
      })}
    </div>
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

  // hash → lane color, so tag chips can inherit the commit's graph line color.
  const colorByHash = useMemo(
    () => new Map(placed.map((p) => [p.hash, p.color])),
    [placed]
  );

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
            <RefColumn
              commits={graph.slice(start, end)}
              start={start}
              colorByHash={colorByHash}
            />
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