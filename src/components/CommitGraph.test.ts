// Unit tests for the GitKraken-style lane assignment. `layoutCommits` is pure,
// so it runs in vitest's node environment (no DOM) against hand-built `CommitNode`
// fixtures mirroring the git `%P` parent order (first-parent-first).

import { describe, expect, it } from "vitest";
import { layoutCommits } from "./CommitGraph";
import type { CommitNode } from "../types";

function node(hash: string, parents: string[], subject = hash): CommitNode {
  return {
    hash,
    parents,
    author: "a",
    authorEmail: "a@b",
    date: "2026-01-01T00:00:00Z",
    subject,
    refs: [],
  };
}

const cols = (nodes: CommitNode[]) => layoutCommits(nodes).map((p) => p.column);

describe("layoutCommits (lane assignment)", () => {
  it("deve manter histórico linear em uma única lane contínua", () => {
    // c -> b -> a, um único caminho de ancestrais.
    const nodes = [node("c", ["b"]), node("b", ["a"]), node("a", [])];
    expect(cols(nodes)).toEqual([0, 0, 0]);
  });

  it("deve colocar o merge no topo e a mainline reta na lane 0", () => {
    // merge tip, depois a mainline e a branch lateral. Shape GitKraken:
    // mainline inteira na coluna 0; a branch lateral na coluna 1.
    const nodes = [
      node("merge", ["main1", "side1"]),
      node("main1", ["base"]),
      node("side1", ["base"]),
      node("base", []),
    ];
    const result = layoutCommits(nodes);
    // merge e a mainline (main1, base) continuam na coluna 0; a lateral na 1.
    expect(result.map((p) => p.column)).toEqual([0, 0, 1, 0]);
  });

  it("deve dar lanes distintas aos pais de um merge (octopus com 3 pais)", () => {
    const nodes = [
      node("o", ["a", "b", "c"]),
      node("a", ["r"]),
      node("b", ["r"]),
      node("c", ["r"]),
      node("r", []),
    ];
    const result = layoutCommits(nodes);
    // O commit o fica na lane 0; seus 3 pais precisam de lanes distintas.
    expect(result[0].column).toBe(0);
    const parentCols = new Set(result.slice(1, 4).map((p) => p.column));
    expect(parentCols.size).toBe(3);
  });

  it("deve reutilizar a lane após o fim de uma branch", () => {
    // Duas branches em sequência: a branch x termina na base r; só depois a
    // branch y começa. A lane 0 liberada por x deve ser reusada por y.
    const nodes = [
      node("x2", ["x1"]),
      node("x1", ["r"]),
      node("r", []),
      node("y2", ["y1"]),
      node("y1", ["r"]),
    ];
    const c = cols(nodes);
    expect(c[3]).toBe(0); // y2 volta para a lane 0 liberada
    expect(c[4]).toBe(0); // y1 continua na lane 0
  });

  it("deve manter a cor estável por branch (mesma lane, mesma cor)", () => {
    const nodes = [node("c", ["b"]), node("b", ["a"]), node("a", [])];
    const result = layoutCommits(nodes);
    const colors = new Set(result.map((p) => p.color));
    expect(colors.size).toBe(1); // mesma lane -> mesma cor
  });

  it("deve posicionar o commit raiz sem pai sem erro", () => {
    const nodes = [node("root", [])];
    const result = layoutCommits(nodes);
    expect(result[0].column).toBe(0);
    expect(result[0].parents).toEqual([]);
  });

  it("deve tratar grafo vazio sem erro", () => {
    expect(layoutCommits([])).toEqual([]);
  });

  it("deve desenhar stub para pai ausente da lista (dados parciais)", () => {
    // `zzz` não existe na lista; o commit a ainda deve ser posicionado (a
    // geometria, não testada aqui, renderiza um stub curto para esse pai).
    const nodes = [node("a", ["zzz"])];
    const result = layoutCommits(nodes);
    expect(result[0].column).toBe(0);
    expect(result[0].parents).toEqual(["zzz"]);
  });

  it("não deve sobrescrever a lane de outra branch ao acomodar um merge", () => {
    // A "branch de fora" (fora) ocupa a lane 1 antes de o merge chegar; o pai
    // extra do merge (extra) precisa ir para a 1ª lane livre à direita (lane 2),
    // sem roubar a lane 1 de fora.
    const nodes = [
      node("merge", ["main", "extra"]),
      node("main", ["base"]),
      node("fora", ["base"]),
      node("extra", ["base"]),
      node("base", []),
    ];
    const result = layoutCommits(nodes);
    const fora = result.find((r) => r.hash === "fora")!;
    const extra = result.find((r) => r.hash === "extra")!;
    expect(extra.column).not.toBe(fora.column);
  });

  it("deve colapsar um histórico multi-branch em poucas lanes e manter a mainline na coluna 0 (regressão do bug)", () => {
    // Grafo real medido (12 commits, 4 merges, ordem --topo-order). O algoritmo
    // antigo produzia 12 lanes (0,1,3,3,5,7,5,8,9,9,10,11) e zig-zag; o novo
    // precisa caber em <=4 lanes com a mainline (c1..c4) toda na coluna 0.
    // Pais em ordem first-parent-first (como `%P`).
    const nodes = [
      node("c4", ["mergeFb"]),
      node("mergeFb", ["mergeFa", "b1"]),
      node("b1", ["c3"]),
      node("mergeFa", ["c3", "mergeNested"]),
      node("mergeNested", ["a2", "n2"]),
      node("n2", ["n1"]),
      node("n1", ["a2"]),
      node("a2", ["a1"]),
      node("a1", ["c3"]),
      node("c3", ["c2"]),
      node("c2", ["c1"]),
      node("c1", []),
    ];
    const result = layoutCommits(nodes);
    const laneCount = Math.max(...result.map((p) => p.column)) + 1;
    expect(laneCount).toBeLessThanOrEqual(4);

    // A mainline (c1..c4) desce contínua na coluna 0 — sem zig-zag temporal.
    const mainline = ["c4", "mergeFb", "mergeFa", "c3", "c2", "c1"];
    for (const h of mainline) {
      const p = result.find((r) => r.hash === h)!;
      expect(p.column).toBe(0);
    }
  });
});