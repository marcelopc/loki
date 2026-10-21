// GitKraken-style commit graph rendered in a fixed left gutter.
//
// The layout hoisted here is pure lane-assignment (reused unchanged from the
// original implementation); what changed is the geometry: commits are laid out
// on vertical rails inside a dedicated column (`gutter`) and cross-lane merges
// use orthogonal rounded elbows — never bleeding into the text column.

import { useMemo } from "react";
import type { CommitNode } from "../types";

export const ROW_H = 28;
export const LANE_W = 22;

const GUTTER_MARGIN = 8;
const MAX_GUTTER_W = 120;
const CORNER_R = 4;
const DOT_R = 5;

const LANE_COLORS = [
  "#4f9cf9",
  "#2da44e",
  "#e3b341",
  "#bc4fbf",
  "#e16f24",
  "#39c5cf",
  "#f85149",
  "#8b5cf6",
];

export interface PlacedCommit extends CommitNode {
  column: number;
  color: string;
  /** Display index (row in the list), so node Y = `row * ROW_H + ROW_H / 2`. */
  row: number;
}

/** Grid metrics driven by the number of lanes. */
export interface GraphMetrics {
  laneCount: number;
  gutterWidth: number;
  laneWidth: number;
}

/**
 * Gutter width / lane pitch. Compresses lanes when a repo has more branches
 * than would fit within the reserved column width.
 */
export function graphMetrics(placed: PlacedCommit[]): GraphMetrics {
  const laneCount = placed.reduce((m, p) => Math.max(m, p.column + 1), 1);
  const natural = GUTTER_MARGIN * 2 + laneCount * LANE_W;
  const gutterWidth = Math.min(MAX_GUTTER_W, natural);
  const laneWidth =
    natural > MAX_GUTTER_W ? (MAX_GUTTER_W - GUTTER_MARGIN * 2) / laneCount : LANE_W;
  return { laneCount, gutterWidth, laneWidth };
}

function laneX(i: number, laneWidth: number): number {
  return GUTTER_MARGIN + i * laneWidth + laneWidth / 2;
}

function rowY(r: number): number {
  return r * ROW_H + ROW_H / 2;
}

/**
 * GitKraken-style lane-assignment: each commit gets a column; a branch keeps
 * one lane with a stable color, and commit lines descend continuously.
 *
 * The single forward pass "claims" a lane that a child already reserved for
 * this commit (so a branch continues in its column instead of jumping), frees
 * duplicate reservations (a merge that rejoins the base), lets the first
 * parent inherit the lane (mainline), and seats extra merge parents in the
 * first free lane to the right — never overwriting an occupied lane.
 */
export function layoutCommits(nodes: CommitNode[]): PlacedCommit[] {
  const laneOwner: (string | null)[] = [];
  const output: PlacedCommit[] = [];
  const placed = new Set<string>();
  let row = 0;

  for (const node of nodes) {
    // 1) Claim the lane a child already reserved for this commit, else the
    //    first free one. This keeps a branch in a fixed column (no zig-zag).
    let column = laneOwner.indexOf(node.hash);
    if (column === -1) {
      column = laneOwner.indexOf(null);
      if (column === -1) {
        column = laneOwner.length;
        laneOwner.push(null);
      }
    }
    // 2) Free any other lane still waiting on this same commit (merge base).
    for (let i = 0; i < laneOwner.length; i++) {
      if (i !== column && laneOwner[i] === node.hash) laneOwner[i] = null;
    }
    const color = LANE_COLORS[column % LANE_COLORS.length];

    output.push({ ...node, column, color, row });
    placed.add(node.hash);

    // 3) First parent (mainline) inherits this lane.
    laneOwner[column] = node.parents.length ? node.parents[0] : null;

    // 4) Extra merge parents: first free lane to the right; never steal.
    for (let pi = 1; pi < node.parents.length; pi++) {
      const parent = node.parents[pi];
      if (placed.has(parent) || laneOwner.includes(parent)) continue;
      let slot = column + 1;
      while (slot < laneOwner.length && laneOwner[slot] != null) slot++;
      if (slot >= laneOwner.length) laneOwner.push(null);
      laneOwner[slot] = parent;
    }
    row += 1;
  }
  return output;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  idx: number;
}

function buildGeometry(placed: PlacedCommit[], drawn: Set<string>, laneWidth: number): Edge[] {
  const hashToIdx = new Map(placed.map((p, i) => [p.hash, i]));
  const edges: Edge[] = [];
  let idx = 0;
  for (let i = 0; i < placed.length; i++) {
    const c = placed[i];
    const y = rowY(c.row);
    const x = laneX(c.column, laneWidth);
    for (const p of c.parents) {
      if (drawn.has(`${c.hash}->${p}`)) continue;
      drawn.add(`${c.hash}->${p}`);
      const pi = hashToIdx.get(p);
      // Parent not laid out (e.g. partial data): a short same-lane stub.
      const py = pi === undefined ? y + ROW_H : rowY(placed[pi].row);
      const px = pi === undefined ? x : laneX(placed[pi].column, laneWidth);
      edges.push({ x1: x, y1: y, x2: px, y2: py, color: c.color, idx: idx++ });
    }
  }
  return edges;
}

/**
 * Orthogonal path for an edge: vertical along the child's lane, then a rounded
 * elbow at the parent's Y, then a short horizontal bridge to the parent's dot.
 */
function edgePath(e: Edge): string {
  if (e.x1 === e.x2) return `M ${e.x1} ${e.y1} V ${e.y2}`;
  const sy = Math.sign(e.y1 - e.y2);
  const sx = Math.sign(e.x2 - e.x1);
  const yM = e.y2 + sy * CORNER_R;
  return `M ${e.x1} ${e.y1} L ${e.x1} ${yM} Q ${e.x1} ${e.y2} ${e.x1 + sx * CORNER_R} ${e.y2} L ${e.x2} ${e.y2}`;
}

interface Props {
  placed: PlacedCommit[];
  start: number;
  end: number;
  laneWidth: number;
  gutterWidth: number;
  selectedHash?: string | null;
  headHash?: string | null;
  onSelect?: (hash: string) => void;
}

export function CommitGraph({ placed, start, end, laneWidth, gutterWidth, selectedHash, headHash, onSelect }: Props) {
  const edges = useMemo(() => {
    const drawn = new Set<string>();
    return buildGeometry(placed, drawn, laneWidth);
  }, [placed, laneWidth]);

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) => Math.min(e.y1, e.y2) < end * ROW_H && Math.max(e.y1, e.y2) >= start * ROW_H
      ),
    [edges, start, end]
  );

  const visible = placed.slice(start, end);
  const svgHeight = placed.length * ROW_H;

  return (
    <svg width={gutterWidth} height={svgHeight} style={{ display: "block" }} aria-label="Grafo de commits">
      {visibleEdges.map((e) => (
        <path
          key={e.idx}
          d={edgePath(e)}
          fill="none"
          stroke={e.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {visible.map((c) => {
        const x = laneX(c.column, laneWidth);
        const y = rowY(c.row);
        const selected = c.hash === selectedHash;
        return (
          <g
            key={c.hash}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect?.(c.hash);
            }}
            style={{ cursor: "pointer" }}
          >
            {selected && (
              <circle cx={x} cy={y} r={DOT_R + 4} fill="none" stroke="#eefbff" strokeWidth={2} />
            )}
            <circle
              cx={x}
              cy={y}
              r={DOT_R}
              fill={c.color}
              stroke={c.hash === headHash ? "#ffffff" : "none"}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </svg>
  );
}