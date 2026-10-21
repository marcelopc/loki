# Design

## Context

Aplicação Tauri + React/TypeScript. O workspace atual (`.workspace`) tem 3 colunas flex: `LeftPane` (branches + changes), `GraphPane` (grafo de commits) e `RightPane` (formulário de commit + diff). O estado centralizado vive no `RepoContext` (`status`, `selectDiff`, `currentDiff`, `diffScope`, `refresh`), e todos os comandos Tauri já expostos (`get_status`, `stage_file`, `unstage_file`, `commit_all`, `get_diff`) permanecem inalterados. Ver `proposal.md` para motivação.

Decisões confirmadas com o usuário:
- O diff move para o centro, abaixo do grafo.
- Untracked são agrupados na seção **Unstaged** com marcador distinto (não há seção própria).

## Goals / Non-Goals

**Goals:**
- Painel direito dedicado ao commit com 3 seções empilhadas: Unstaged, Staged, formulário (summary).
- Escopo restrito ao frontend; backend (Rust/Tauri) intocado.
- Reuso do estado e comandos existentes do `RepoContext` e `api`.

**Non-Goals:**
- Alterar comportamento de stage/unstage/commit (semântica igual, apenas novo lugar).
- Alterar o backend ou adicionar comandos Tauri.
- Redesenhar o grafo ou a virtualização de commits.

## Decisions

### 1. Coluna direita vira um `CommitPanel` dedicado
Novo `CommitPanel.tsx` substitui o `RightPane` atual: empilha as seções **Unstaged**, **Staged** e o **formulário de commit** (campo summary + botão com contagem de arquivos staged + dica Ctrl+Enter).

**Alternativa descartada**: manter o commit form dentro do `DiffView` (mistura responsabilidades e dificulta mover o diff para o centro).

### 2. Diff movido para o centro, dentro do `GraphPane`
`GraphPane` passa a ser o contêiner central da coluna: o grafo (virtualizado) em cima e o `DiffView` embaixo, com o grid/flex já existente. `DiffView.tsx` de manutenção mínima — o diff em si (renderização lado a lado, escopos) não muda.

**Alternativa descartada**: abrir uma 4ª coluna para o diff (encolhe o grafo sem ganho de UX — gitkraken usa diff na coluna central).

### 3. LeftPane reduzido a branches
`ChangesPanel` sai do `LeftPane`; este passa a conter apenas o `BranchesPanel`.

### 4. Agrupamento visual do painel: helper puro em `types.ts`
`statusSection` (dado: 3 estados) continua sendo o modelo de dados; ganha um helper de **apresentação** `commitPanelSection(f)` que mapeia `untracked → unstaged`. Mantém o dado e a UI desacoplados e é trivial de testar (RTL/puro).

### 5. Rotas de seleção e scroll preservadas
A seleção de diff (`selectDiff(scope, path)`) e os cursos (`currentDiff`/`diffScope`) não mudam; apenas o local de renderização do `DiffView` muda de coluna.

## Risks / Trade-offs

- `DiffView` hoje não é virtualizado; movê-lo para a coluna central pode expor mais linhas lado a lado em tela — diffs grandes podem ficar pesados. → Mitigação: o componente já usa `useVirtual`-style na renderização? Não — mitigamos mantendo a rolagem da coluna central e, se necessário, cap do container do diff com `overflow: auto`.
- Painel direito mais estreito que o atual pode apertar a lista de arquivos (nomes longos). → Mitigação: `overflow-x: auto` + ellipsis no nome do arquivo.
- Arrastar componentes entre painéis aumenta o diff do CSS. → Mitigação: agrupar estilos por seção no `App.css` seguindo o padrão já usado.

## Migration Plan

- Mudança de layout é atômica no frontend; sem deploy/rollback de dados.
- Rollback: reverter o commit do layout (estrutura anterior permanece no histórico/arquivado).

## Open Questions

Nenhuma — decisões de layout foram resolvidas com o usuário antes desta etapa.