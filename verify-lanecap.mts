/**
 * Gate de lane-cap: prova que `graphMetrics` limita gutterWidth a MAX_GUTTER_W
 * e comprime laneWidth quando o número de lanes excede a largura reservada —
 * sem overflow (todo dot X dentro da gutter). Não depende de lanes reais do
 * algoritmo; alimenta lanes sintéticas para forçar o caminho de compressão.
 * Uso: npx tsx verify-lanecap.mts
 */
import { graphMetrics, LANE_W, ROW_H } from "./src/components/CommitGraph.tsx";
import type { CommitNode } from "./src/types";

const GUTTER_MARGIN = 8;
const MAX_GUTTER_W = 120;

// Monta N lanes sintéticas (um PlacedCommit fictício por lane) com um histograma
// que escolhe o pico de lanes simultâneos.
function syntheticPeakLanes(peak: number): Array<CommitNode & { column: number; color: string; row: number }> {
  const out: Array<CommitNode & { column: number; color: string; row: number }> = [];
  for (let c = 0; c < peak; c++) {
    out.push({
      hash: `s${c}`, parents: [], refs: [],
      author: "t", authorEmail: "t", date: "d", subject: "s",
      column: c, color: "#000", row: c,
    });
  }
  return out;
}

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}` + (detail ? `  (${detail})` : ""));
}

// 2 lanes -> nada a comprimir (gutter deixa de ser só a largura natural).
{
  const placed = syntheticPeakLanes(2);
  const m = graphMetrics(placed);
  check("2 lanes: gutterWidth natural < 120", m.gutterWidth < MAX_GUTTER_W, `=${m.gutterWidth}`);
  check("2 lanes: laneWidth mantém LANE_W (sem compressão)", m.laneWidth === LANE_W, `=${m.laneWidth}`);
}

// 15 lanes -> estoura a largura reservada; precisa comprimir e cortar em 120.
{
  const placed = syntheticPeakLanes(15);
  const m = graphMetrics(placed);
  check("15 lanes: gutterWidth <= 120 (lane-cap)", m.gutterWidth <= MAX_GUTTER_W, `=${m.gutterWidth}`);
  check("15 lanes: laneWidth comprimido < LANE_W", m.laneWidth < LANE_W, `=${m.laneWidth.toFixed(3)}`);
  check("15 lanes: laneWidth >= 1 (legível mínimo)", m.laneWidth >= 1, `=${m.laneWidth.toFixed(3)}`);

  // Invariante de não-invasão: todos os dots X dentro da gutter.
  let minDotX = Infinity, maxDotX = -Infinity;
  for (const p of placed) {
    const x = GUTTER_MARGIN + p.column * m.laneWidth + m.laneWidth / 2;
    minDotX = Math.min(minDotX, x); maxDotX = Math.max(maxDotX, x);
  }
  check("15 lanes: todo dot X dentro de [8, gutterWidth-8]",
    minDotX >= GUTTER_MARGIN && maxDotX <= m.gutterWidth - GUTTER_MARGIN,
    `min=${minDotX.toFixed(2)} max=${maxDotX.toFixed(2)} gutter=${m.gutterWidth}`);
  check("15 lanes: gutterWidth == MAX_GUTTER_W (cap preciso)",
    m.gutterWidth === MAX_GUTTER_W, `=${m.gutterWidth}`);
}

console.log(`\n=== RESUMO LANE-CAP ===\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);