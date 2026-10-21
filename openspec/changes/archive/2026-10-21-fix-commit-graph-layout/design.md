# Design

## Context

Ver `proposal.md` — **Why**. O gráfico de commits (componente React/Tauri de `gui-git`) está sobreposto ao texto e usa curvas bézier. Causa raiz confirmada no código: `.graph-canvas` tem **altura zero**, pois `.graph-svg-layer` e `.graph-rows-layer` são ambos `position:absolute`, e as linhas usam `translateY(scrollTop)` (rolagem falsa, sem scroll real) — gerando desalinhamento ao rolar. Além disso `.ga-row` tem `padding-left:12px` e o SVG tem `overflow:visible` com largura estreita, então dots/lines caem sob a mensagem de commit.

## Goals / Non-Goals

**Goals:**
- Coluna de gráfico dedicada (gutter) isolada do texto, via layout de fluxo flex real (não overlay).
- Rails verticais estritos + conexões de merge ortogonais (cotovelos arredondados) dentro da coluna.
- Coordenadas dos nós: `Y` = altura da linha, `X` = índice da lane.
- Rolamento nativo (gutter + rows rolam juntos no mesmo scroll container); virtualização preservada.
- Lane-cap com compressão para repos com muitas branches.

**Non-Goals:**
- Não alterar o lane-assignment (`layoutCommits`) — apenas a geometria e a estrutura.
- Não mudar backend (`CommitNode` já tem `parents`, `refs`).
- Não introduzir driver de clique headless nem testes visuais automatizados neste change (verificação manual via `tauri dev`).

## Decisions

### D1. Estrutura: gutter + rows em fluxo flex dentro de um único scroll container
Substituir o overlay absoluto por:
```
.graph-scroll (overflow-y:auto; containerRef)         ← rolagem nativa
  .graph-canvas (height = total*ROW_H)
    .graph-gutter (flex:0 0 auto; width=gutterWidth; overflow:hidden)
      <CommitGraph placed laneWidth gutterWidth start end .../>
    .graph-rows (flex:1 1 auto; min-width:0; position:relative)
      {graph.slice(start,end).map(row)} (.ga-row absolute top: rowIndex*ROW_H)
```
Ambos os filhos ficam em fluxo dentro do mesmo conteúdo rolável → rolam juntos por construção, sem `translateY`. `scrollTop` do `useVirtual` passa a ser usado apenas internamente para `start/end`; GraphPane não o renderiza mais.

**Alternativa descartada:** manter o overlay SVG e pan via `viewBox` — mais complexo e mantém esteio do bug. O gutter em fluxo resolve o scroll nativamente.

### D2. Hoist do layout para GraphPane + `PlacedCommit.row`
- `layoutCommits` já retorna `{column,color}`. Adicionar `row: number` (índice de display) → elimina o `findIndex` O(n) por dot no render.
- GraphPane memoiza `{ placed, metrics = graphMetrics(placed) }` para saber `gutterWidth` **antes** de renderizar o CommitGraph.

### D3. Geometria e rotas ortogonais (`edgePath`)
Constantes: `GUTTER_MARGIN=8`, `LANE_W=22`, `MAX_GUTTER_W=120`, `ROW_H=28`, `CORNER_R=4`.

Coordenadas (requisito do usuário): `laneX(i)=GUTTER_MARGIN + i*laneWidth + laneWidth/2`; `rowY(r)=r*ROW_H + ROW_H/2`.

`edgePath(e)` — substitui a bézier:
```ts
if (e.x1 === e.x2) return `M ${e.x1} ${e.y1} V ${e.y2}`;        // mesma lane: rail vertical
const sy = Math.sign(e.y1 - e.y2);
const sx = Math.sign(e.x2 - e.x1);
const yM = e.y2 + sy*CORNER_R;
return `M ${e.x1} ${e.y1} L ${e.x1} ${yM} Q ${e.x1} ${e.y2} ${e.x1 + sx*CORNER_R} ${e.y2} L ${e.x2} ${e.y2}`;
```
→ sobe pela lane do filho, cotovelo quadrático arredondado na altura do pai, cruza horizontal até o dot do pai. Todos os X dentro de `[GUTTER_MARGIN, gutterWidth-GUTTER_MARGIN]` → nunca invade texto. `strokeLinecap="round" strokeLinejoin="round"`. Arestas antes dos dots (dots por cima; comportamento atual preservado). `@include overflow:hidden` no gutter garante req. de não-invasão mesmo com bug futuro de largura.

**Exemplo real verificado** (`/tmp/git-test`, 6 commits, ordem do `git log --all`): o lane-assignment REAL (NON-GOAL, não alterado) produz 5 lanes `[0,1,1,2,3,4]` → `gutterWidth=120` (cappado de `16+5*22=126`), `laneWidth=20.8`. Cotovelo real `0b0638a→0247e59` = `M 18.4 14 L 18.4 38 Q 18.4 42 22.4 42 L 39.2 42`; rail mesma-lane (2 commits sintéticos) = `M 19 14 V 42`. Todos os X em `[8,112]`. As colunas `[0,0,1,0,0,0]` (2 lanes) citadas na spec delta correspondem a um snapshot antigo do repo (quando o merge `869c723` figurava em `--all`); o render atual não depende delas — a geometria (Y=row, X=lane, cotovelo ortogonal, non-invasion) é invariante por construção.

### D4. Slice visível + lane-cap
- SVG de altura total (`placed.length*ROW_H`), mas DOM só do slice: `visibleEdges = edges.filter(min(y1,y2)<end*ROW_H && max(y1,y2)>=start*ROW_H)`; dots = `placed.slice(start,end)`. SVG retido é vetorial (sem custo de pixels); DOM sliceado mantém layout bounded.
- Lane-cap por **compressão** (recomendado): `natural = GUTTER_MARGIN*2 + laneCount*LANE_W`; `gutterWidth = min(MAX_GUTTER_W, natural)`; se transborda, `laneWidth = (MAX_GUTTER_W - GUTTER_MARGIN*2)/laneCount`. Sem h-scroll (evita sincronizar 2º eixo). Alternativa h-scroll documentada como melhoria futura.

### D5. CSS
- `.graph-canvas` → `display: flex`.
- Remover `.graph-svg-layer`, `.graph-rows-layer`.
- Adicionar `.graph-gutter { flex:0 0 auto; overflow:hidden }`, `.graph-gutter svg { display:block }`, `.graph-rows { position:relative; flex:1 1 auto; min-width:0 }`.
- `.graph-scroll` → `overflow-x: hidden`.
- `.ga-row` → `padding: 0 12px 0 8px` (texto começa após o gutter por layout).

## Risks / Trade-offs

- **Posição dos cotovelos** em historicos não lineares com pai abaixo do filho → o `sign(sy)` torna o algoritmo simétrico para pai acima/abaixo; coberto nos cenários da spec.
- **Repos densos (13+ lanes)** → lanes comprimem (~8.7px), dots quase se tocam. Aceitável no MVP; elevar `MAX_GUTTER_W` para 150 se ficar apertado.
- **Regressão de scroll** → mitigado pela verificação manual de rolagem (alinhamento dot/linha) em repos com milhares de commits.
- **`ROW_H` duplicado** (CommitGraph, GraphPane, useVirtual) → fora de escopo; manter 28 em sync; exportar `ROW_H` de um módulo é limpeza futura de uma linha.
- **SVG de altura total em repos 100k+** → DOM sliceado; se latência no futuro, trocar para `viewBox` pan (mesma matemática, 1 atributo).

## Migration Plan

Sem estado persistente. A correção é puramente de renderização; o app continua rodando via `npm run tauri dev`. Rollback = reverter os 3 arquivos de frontend. Nenhuma migração de dados.

## Open Questions

Nenhuma — decisões de layout e geometria resolvidas (D1-D5). A verificação visual é manual porque não há driver headless de janela nativa; cenários de regressão mapeados na spec delta.