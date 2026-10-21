# Design

## Context

Ver `proposal.md` — **Why**. O change anterior (`fix-commit-graph-layout`, arquivado) corrigiu a **geometria** das arestas: gutter dedicado, `laneX(i)=8+i*laneWidth+laneWidth/2`, `rowY(r)=r*ROW_H+ROW_H/2`, `edgePath` ortogonal (rail `V` / cotovelo `Q`). Isso permanece intacto. O que resta é **qual coluna cada commit recebe** (`layoutCommits` em `gui-git/src/components/CommitGraph.tsx`) e **em que ordem os commits chegam** (`gui-git/src-tauri/src/git/refs.rs`).

Estado atual medido (repo `/tmp/gkl-demo`, 12 commits, 4 merges, `--topo-order`):

| Algoritmo | Colunas | Lanes |
|---|---|---|
| Atual | `0,1,3,3,5,7,5,8,9,9,10,11` | **12 lanes / 12 commits** (e volta de 7→5) |
| Proposto | `0,0,1,0,2,3,3,2,2,0,0,0` | **4 lanes** |

## Goals / Non-Goals

**Goals:**
- Cada branch em uma coluna fixa, com linha contínua (sem zig-zag).
- HEAD (branch atual) na coluna mais à esquerda.
- Ordem topológica garantida na fonte (backend), não presumida.
- Custo de layout linear em n.
- Cobertura de teste do lane-assignment (o frontend não tinha test runner).

**Non-Goals:**
- Não alterar a geometria (`graphMetrics`/`laneX`/`rowY`/`buildGeometry`/`edgePath`) nem o layout flex gutter+rows nem a virtualização.
- Não alterar o formato de dados (`CommitNode`/parser) nem a API Tauri.
- Não minimizar cruzamentos de arestas de forma ótima (heurística "primeira livre à direita" basta para o visual GitKraken).
- Não mudar cores, badges, seleção ou tema.

## Decisions

### D1. Backend: `--topo-order` na chamada de `log_all`
`src-tauri/src/git/refs.rs`:
```rust
let out = client.run(&["log", "--all", "--topo-order", "--decorate", "--date=iso-strict", &fmt_arg])?;
```
A spec já exige ordem topológica; o código não cumpria. `--topo-order` (e não `--date-order`) garante filhos-antes-dos-pais e, na prática, põe o tip do HEAD na primeira linha — pré-requisito para "HEAD na coluna 0" (D3).

**Alternativa descartada:** reordenar no frontend (topological sort em TS) — duplica lógica, e o backend é a fonte correta do dado; `--topo-order` é uma flag suportada desde sempre (git 2.34.1 aqui).

### D2. Frontend: `layoutCommits` com "claim-your-lane"
```ts
export function layoutCommits(nodes: CommitNode[]): PlacedCommit[] {
  const laneOwner: (string | null)[] = [];
  const output: PlacedCommit[] = [];
  const placed = new Set<string>();
  let row = 0;

  for (const node of nodes) {
    // 1) lane JÁ reservada para este commit (herdada de um filho); senão 1ª livre.
    let column = laneOwner.indexOf(node.hash);
    if (column === -1) {
      column = laneOwner.indexOf(null);
      if (column === -1) { column = laneOwner.length; laneOwner.push(null); }
    }
    // 2) libera reservas duplicadas da mesma lane (merge que reencontra a base).
    for (let i = 0; i < laneOwner.length; i++) {
      if (i !== column && laneOwner[i] === node.hash) laneOwner[i] = null;
    }
    const color = LANE_COLORS[column % LANE_COLORS.length];
    output.push({ ...node, column, color, row });
    placed.add(node.hash);

    // 3) minha lane continua no 1º pai (mainline).
    laneOwner[column] = node.parents.length ? node.parents[0] : null;

    // 4) pais extras (merge): 1ª lane LIVRE à direita — nunca sobrescreve.
    for (let pi = 1; pi < node.parents.length; pi++) {
      const p = node.parents[pi];
      if (placed.has(p) || laneOwner.includes(p)) continue;
      let slot = column + 1;
      while (slot < laneOwner.length && laneOwner[slot] != null) slot++;
      if (slot >= laneOwner.length) laneOwner.push(null);
      laneOwner[slot] = p;
    }
    row += 1;
  }
  return output;
}
```
Diferença central vs. atual: o passo 1 procura `node.hash` em `laneOwner` (a lane que um **filho** já reservou para este commit), não apenas a lane de um **pai**. Isso é o que elimina o zig-zag. O passo 4 troca o offset fixo `column + pi` (que sobrescrevia lanes) pela primeira livre à direita.

**Alternativa descartada:** manter o algoritmo e só ordenar topologicamente — medido: ainda dá 7 lanes / 7 commits (`0,2,3,3,4,5,6`). A ordenação sozinha não corrige.

### D3. HEAD na coluna 0
Com D1, o commit do HEAD é a primeira linha; o passo 1 do D2 dá a ele a lane 0 (nada reservado ainda → primeira livre = 0), e sua mainline desce nessa coluna. Nenhum dado novo do backend é necessário — `CommitNode.refs` já traz `kind: "head"`.

**Alternativa descartada:** reordenar as colunas após o layout para "promover" o HEAD — mais código e instável quando o HEAD muda.

### D4. Cor estável por branch (consequência, não trabalho extra)
`color = LANE_COLORS[column % 8]`. Como D2 mantém a branch numa coluna só, a cor fica automaticamente estável por branch. Sem mapa `branch→color`.

### D5. Testes: `vitest`
Nova devDependency `vitest@5.0.5` (auditada; projeto com 0 vulnerabilidades críticas) + `"test": "vitest run"` em `package.json` + `vitest.config.ts` (ambiente `node` — o algoritmo é puro). Testes descritivos em `src/components/CommitGraph.test.ts`. Alternativa (estender os scripts `verify-*.mts`) descartada por decisão do usuário: um runner real integra ao `npm test` e permite nomes/casos estruturados.

## Risks / Trade-offs

- **`--topo-order` altera a ordem exibida** (não é mais estritamente por data) → é exatamente o que a spec pede; a coluna de data continua correta por linha.
- **Repos com datas incoerentes / clock skew** → `--topo-order` é justamente a defesa; o layout não depende mais de datas para a forma.
- **Expectativas de `verify-graph-geometry.mts` ficam obsoletas** (`[0,1,1,2,3,4]`, 5 lanes, gutter 120, x=18.4) → **atualizar** para os novos valores, não deletar o script.
- **Lanes podem crescer em históricos muito entrelaçados** (a heurística "primeira livre à direita" não compacta ótimo) → aceitável; o lane-cap por compressão (gutter ≤120) já cobre a largura.
- **Custo do `laneOwner.includes/indexOf`** ainda é O(lanes) por commit → O(n·lanes); com lanes pequeno (≤ dezenas) é linear na prática, e o benchmark de 100k dá ~25 ms (vs. ~41 s do atual, que era O(n²) porque `laneOwner` crescia com n).

## Migration Plan

Sem estado persistente. Rollback = reverter `refs.rs` (1 flag) + `CommitGraph.tsx` (`layoutCommits`). Nenhuma migração de dados.

## Open Questions

Nenhuma — decisões D1–D5 resolvidas com evidência medida (benchmark + render ASCII em repo real de 12 commits).