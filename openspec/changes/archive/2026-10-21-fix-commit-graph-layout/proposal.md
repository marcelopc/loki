# Proposal

## Why

A renderização do gráfico de commits (Git Graph) está quebrada na interface: o SVG é desenhado como camada absoluta sobreposta à esquerda, com largura estreita e `overflow: visible`, fazendo os dots e linhas do grafo **sobreporem as mensagens de commit**. As arestas usam curvas bézier fluidas (`c ...`), produzindo o visual diagonal/desalinhado. O layout deixa inclusive o `.graph-canvas` com altura zero, o que quebra a rolagem real e acentua o efeito "gomor duro".

## What Changes

Correção do layout e do desenho do grafo de commits para o padrão GitKraken/GitGraph:

- **Coluna dedicada (gutter):** reservar uma coluna fixa à esquerda só para a canvas/SVG do gráfico, isolada da coluna de texto (mensagens + metadados).
- **Rails verticais:** cada branch ocupa uma coluna vertical fixa (`lane`); as linhas descem estritamente em eixos verticais paralelos.
- **Conexões ortogonais de merge:** arestas que cruzam lanes usam pontes horizontais curtas com cotovelos arredondados (Q), nunca invadindo o espaço do texto.
- **Coordenadas corretas:** `Y` do nó = altura da linha da tabela (`row height`); `X` = índice da lane.
- **Altura real do canvas + rolagem nativa:** o conteúdo deixa de ser overlay e vira fluxo flex dentro de um único scroll container (gutter + rows rolam juntos), eliminando o `translateY` falso e o desalinhamento durante a rolagem.
- **Manutenção da virtualização:** só as linhas visíveis + o slice visível do SVG são renderizados; repos grandes continuam fluidos.
- **Lane-cap com compressão:** gutter capped (120px) para repos com muitas branches; lanes comprimem em vez de transbordar.

**Não muda:** algoritmos de lane-assignment já existentes (reuso de `layoutCommits`), seleção de commit, badges de refs, tema dark.

## Capabilities

### New Capabilities
<!-- Nenhuma — é uma correção de comportamento existente. -->

### Modified Capabilities
- `commit-graph`: o requisito "Renderizar grafo de ancestors por lanes" muda para exigir coluna de gráfico dedicada e isolate do texto, rails verticais estritos e conexões de merge ortogonais (não diagonais), mantendo virtualização e alinhamento do grafo à lista durante a rolagem.

## Impact

- **Frontend (editado):**
  - `gui-git/src/components/CommitGraph.tsx` — `PlacedCommit.row`, `graphMetrics()`, `edgePath()` ortogonal (V + Q), props `placed/laneWidth/gutterWidth`.
  - `gui-git/src/components/GraphPane.tsx` — hoist do layout (memoize), novo JSX `graph-canvas[gutter | rows]` em fluxo flex, remoção dos wrappers overlay e do `translateY(scrollTop)`.
  - `gui-git/src/App.css` — regras de `.graph-canvas` (flex), `.graph-gutter`, `.graph-rows`; remoção de `.graph-svg-layer`/`.graph-rows-layer`; ajuste de `.ga-row`.
- **Backend:** nenhuma mudança (os dados `CommitNode` já chegam com `parents`, `refs`).
- **Dependências:** nenhuma nova.
- **Spec:** `openspec/specs/commit-graph/spec.md` (MODIFIED).