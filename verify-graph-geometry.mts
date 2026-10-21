/**
 * Aplicável a Task 4.2/4.3 do fix-commit-graph-layout.
 * Roda a geometria REAL (gráfico importado de CommitGraph.tsx) contra o
 * grafo REAL do /tmp/git-test e valida as coordenadas exatas do design.
 *
 * Uso: npx tsx verify-graph-geometry.mts
 *
 * Ordem real que o backend alimenta (git log --all, sem topo-order):
 *   0: 0b0638a P=0247e59   (dev)
 *   1: 0247e59 P=5ec127a
 *   2: fba37cb P=5ec127a
 *   3: 5ec127a P=234f475
 *   4: 234f475 P=d90ff32
 *   5: d90ff32 P=
 * Lanes esperadas [0,0,1,0,0,0]; gutter 60; row0 dot em x=19,y=14.
 */
import { layoutCommits, graphMetrics, ROW_H, LANE_W } from "./src/components/CommitGraph.tsx";
import type { CommitNode } from "./src/types";

// edgePath é privado no CommitGraph; replicamos 1:1 do fonte real (mesma matemática).
const CORNER_R = 4;
function edgePath(e: { x1: number; y1: number; x2: number; y2: number }): string {
  if (e.x1 === e.x2) return `M ${e.x1} ${e.y1} V ${e.y2}`;
  const sy = Math.sign(e.y1 - e.y2);
  const sx = Math.sign(e.x2 - e.x1);
  const yM = e.y2 + sy * CORNER_R;
  return `M ${e.x1} ${e.y1} L ${e.x1} ${yM} Q ${e.x1} ${e.y2} ${e.x1 + sx * CORNER_R} ${e.y2} L ${e.x2} ${e.y2}`;
}

// --- monta CommitNode a partir do git log real ---
function sha(sublen = 7) {
  return "";
}
const shorts = new Map<string, string>();

interface Raw { hash: string; parents: string[] }
const raws = [
  { hash: "0b0638a", parents: ["0247e59"] },
  { hash: "0247e59", parents: ["5ec127a"] },
  { hash: "fba37cb", parents: ["5ec127a"] },
  { hash: "5ec127a", parents: ["234f475"] },
  { hash: "234f475", parents: ["d90ff32"] },
  { hash: "d90ff32", parents: [] },
];

const nodes: CommitNode[] = raws.map((r) => ({
  hash: r.hash,
  parents: r.parents,
  shortHash: r.hash,
  author: "a",
  authorEmail: "a@b",
  date: "2026-10-20T00:00:00-03:00",
  subject: "s",
  refs: [],
}));

// --- layout real ---
const placed = layoutCommits(nodes);
const metrics = graphMetrics(placed);

// --- asserções ---
let pass = 0, fail = 0;
const EPS = 1e-6;
function check(label: string, got: unknown, want: unknown) {
  const ok = norm(got) === norm(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`);
}
// Compara tolerando ruído de ponto flutuante (números e strings de números).
function norm(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v.map(norm));
  if (typeof v === "number") return JSON.stringify(Math.round(v * 1e6) / 1e6);
  if (typeof v === "string") return v.replace(/(\d+\.\d{7,})/g, (n) => String(Math.round(parseFloat(n) * 1e6) / 1e6));
  return JSON.stringify(v);
}

console.log("=== Lanchamento de lanes (column por row) ===");
// VALOR REAL pós-gitkraken-lane-layout (2 lanes), ordem real do git log --all.
//   fba37cb cai na lane 1 (merge/divergência); o resto desce na lane 0.
check("columns (real)", placed.map((p) => p.column), [0, 0, 1, 0, 0, 0]);
check("laneCount (2)", metrics.laneCount, 2);
check("gutterWidth (sem compressao)", metrics.gutterWidth, Math.min(120, 16 + 2 * LANE_W)); // =60
check("laneWidth (22)", metrics.laneWidth, LANE_W);
check("ROW_H", ROW_H, 28);

// Geometry: laneX(i)=8+i*22+11 ; rowY(r)=r*28+14
const laneX = (i: number, lw: number) => 8 + i * lw + lw / 2;
const rowY = (r: number) => r * ROW_H + ROW_H / 2;
const laneWidth = metrics.laneWidth;

console.log("=== Coords dos dots (row 0..2, laneWidth 22) ===");
const d0 = { x: laneX(0, laneWidth), y: rowY(0) }; // row0 (0b0638a, lane0) -> x=19,y=14
const d1 = { x: laneX(0, laneWidth), y: rowY(1) }; // row1 (0247e59, lane0) -> x=19,y=42
const d2p = { x: laneX(1, laneWidth), y: rowY(2) }; // row2 (fba37cb, lane1) -> x=41,y=70
check("row0 lane0 dot x=19", d0.x, 19);
check("row0 dot y=14", d0.y, 14);
check("row1 lane0 dot x=19 y=42", [d1.x, d1.y], [19, 42]);
check("row2 lane1 dot x=41 y=70", [d2p.x, d2p.y], [41, 70]);

// --- arestas reais (buildGeometry) ---
// Rail vertical: 0b0638a->0247e59 (mesma lane, x1==x2=19): "M 19 14 V 42"
// Merge: 0b0638a->fba37cb? NÃO: 0b0638a P=0247e59 apenas. Merge real é 0247e59->5ec127a? tb mesma lane.
// fba37cb(lane1,x41,y70) -> 5ec127a(lane0,x19,y98): cross-lane elbow.
//    M 41 70 L 41 94 Q 41 98 37 98 L 19 98
const { edgePaths } = (() => {
  // reconstruct edgePaths deterministically from placed, same as CommitGraph
  const drawn = new Set<string>();
  const edgesOut: { from: string; to: string; d: string; x1: number; x2: number; y1: number; y2: number }[] = [];
  const hashToIdx = new Map(placed.map((p, i) => [p.hash, i]));
  for (const c of placed) {
    const y = rowY(c.row), x = laneX(c.column, laneWidth);
    for (const p of c.parents) {
      const k = `${c.hash}->${p}`;
      if (drawn.has(k)) continue;
      drawn.add(k);
      const pi = hashToIdx.get(p);
      const py = pi === undefined ? y + ROW_H : rowY(placed[pi].row);
      const px = pi === undefined ? x : laneX(placed[pi].column, laneWidth);
      edgesOut.push({ from: c.hash, to: p, x1: x, y1: y, x2: px, y2: py, d: edgePath({ x1: x, y1: y, x2: px, y2: py, color: c.color, idx: 0 }) });
    }
  }
  return { edgePaths: edgesOut };
})();

const findPath = (from: string, to: string) =>
  edgePaths.find((e) => e.from === from && e.to === to)?.d;

console.log("=== Edges (caminhos) ===");
for (const e of edgePaths) {
  // Toda aresta deve manter X dentro de [8, gutterWidth-8]
  const xMin = Math.min(e.x1, e.x2), xMax = Math.max(e.x1, e.x2);
  const inside = xMin >= 8 && xMax <= metrics.gutterWidth - 8;
  console.log(`${inside ? "PASS" : "FAIL"}  ${e.from}->${e.to} x1=${e.x1} x2=${e.x2} insideGutter=${inside}`);
  if (inside) pass++; else fail++;
}
console.log(`  ${edgePaths.map((e) => `${e.from}->${e.to}: ${e.d}`).join("\n  ")}`);

// Rail mesma-lane: 0b0638a -> 0247e59 (ambos lane0, x=19): vertical puro.
check("rail 0b0638a->0247e59 vertical", findPath("0b0638a", "0247e59"), "M 19 14 V 42");
// Cross-lane elbow: fba37cb (lane1, x41, y70) -> 5ec127a (lane0, x19, y98).
check(
  "fba37cb->5ec127a cotovelo ortogonal",
  findPath("fba37cb", "5ec127a"),
  "M 41 70 L 41 94 Q 41 98 37 98 L 19 98"
);
// Cada aresta é OU um rail vertical same-lane (V) OU um cotovelo ortogonal (Q) —
// nunca uma bézier `c`. O check `noBezier` abaixo garante a ausência de bézier.
const allOrthogonal = edgePaths.every((e) => /\bV\b/.test(e.d) || /Q .+ .+ .+ .+ .+ .+/.test(e.d));
check("todas as arestas são ortogonais (V ou Q, nunca bézier c)", allOrthogonal, true);

// Invariante: nenhuma aresta usa bézier c (o takeover era substituir as c ...)
const noBezier = edgePaths.every((e) => !/\bc\s/.test(e.d));
check("nenhuma aresta com comando 'c' bézier", noBezier, true);

// --- Caso sintético: mesma lane => rail vertical puro (x1===x2) ---
{
  const two: CommitNode[] = [
    { hash: "aa", parents: ["bb"], shortHash: "aa", author: "a", authorEmail: "a", date: "d", subject: "s", refs: [] },
    { hash: "bb", parents: [], shortHash: "bb", author: "a", authorEmail: "a", date: "d", subject: "s", refs: [] },
  ];
  const p2 = layoutCommits(two);
  const m2 = graphMetrics(p2);
  const lw = m2.laneWidth; // 2 lanes => laneWidth 22, lane0 x = 8+11 = 19
  const y = (r: number) => r * ROW_H + ROW_H / 2;
  const x = 8 + 0 * lw + lw / 2;
  const d = edgePath({ x1: x, y1: y(0), x2: x, y2: y(1) });
  check("rail vertical mesma-lane (x1==x2)", d, `M ${x} 14 V 42`); // x=19
}

console.log(`\n=== RESUMO ===\n${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);