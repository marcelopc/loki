# Proposal

## Why

O grafo de commits parece uma **árvore compacta em zig-zag**, não os trilhos do GitKraken. A geometria das arestas já foi corrigida (change arquivado `fix-commit-graph-layout`); o defeito restante está em **onde cada commit é colocado em coluna** e **em que ordem os commits chegam**.

Medido no repo real `/tmp/git-test` (7 commits, 1 merge) e num repo sintético (12 commits, 4 merges): o algoritmo atual atribui **uma lane nova por commit** — 7 commits → 7 lanes, 12 commits → 12 lanes — porque só procura a lane de um *pai* do commit, nunca a lane **já reservada para o próprio commit**; e pais extras de merge vão para o offset fixo `column + pi`, **sobrescrevendo** a lane de outra branch. Adicionalmente o backend não passa flag de ordenação, então `git log --all` sai em ordem cronológica reversa — que **não garante filhos antes dos pais**, contrariando a spec canônica (`openspec/specs/commit-graph/spec.md`: "em ordem topológica (filhos antes dos pais)"). Por fim o algoritmo é O(n²): 100k commits → ~41 s de layout.

Resultado esperado: colunas fixas por branch, linhas contínuas bem definidas e ordenação topológica — o visual do GitKraken.

## What Changes

- **Atribuição de lane corrigida:** cada commit reivindica a lane **já reservada para ele** (herdada de um filho) antes de pegar a primeira livre → a branch desce em **uma coluna fixa** com linha contínua, sem zig-zag.
- **Fim do roubo de lane:** pais extras de um merge passam a ocupar a **primeira lane livre à direita**, em vez de sobrescrever `laneOwner[column + pi]`.
- **Lane 0 = branch atual:** com ordenação topológica o commit do HEAD é a primeira linha e ocupa a coluna mais à esquerda (mainline reta), como no GitKraken.
- **Ordenação topológica no backend:** `git log` passa a receber `--topo-order`, cumprindo o requisito já existente na spec e estabilizando o layout.
- **Custo linear:** o layout deixa de ser O(n²) — benchmark sintético de 100k commits cai de ~41 s para ~25 ms.
- **Rede de segurança de testes:** adiciona `vitest` com testes descritivos do lane-assignment (o projeto não tinha test runner no frontend).

**BREAKING:** nenhuma. Muda a posição visual dos nós (é o objetivo), não o formato de dados nem APIs.

**Não muda:** a geometria das arestas (`graphMetrics`, `laneX`, `rowY`, `buildGeometry`, `edgePath`), o layout flex gutter+rows, a virtualização, o `CommitNode`/parser, a seleção de commit, os badges de refs e o tema.

## Capabilities

### New Capabilities
<!-- Nenhuma — o comportamento pertence à capability existente `commit-graph`. -->

### Modified Capabilities
- `commit-graph`: o requisito "Renderizar grafo de ancestors por lanes" passa a exigir que cada branch ocupe **uma coluna fixa com linha contínua** (sem zig-zag) e que a atribuição de lanes siga a **ordem topológica**, com a branch atual (HEAD) na coluna mais à esquerda; o requisito "Exibir commits com dados do autor" passa a exigir explicitamente que o **backend ordene topologicamente** (hoje a spec manda, mas o código não cumpre).

## Impact

- **Backend (editado):** `gui-git/src-tauri/src/git/refs.rs` — flag `--topo-order` em `log_all` + teste de integração de ordenação. Sem mudança em `parse.rs` nem `commands/graph.rs`.
- **Frontend (editado):** `gui-git/src/components/CommitGraph.tsx` — reescrita de `layoutCommits`. Sem mudança em `GraphPane.tsx`, `App.css`, `useVirtual.ts`, `types.ts`.
- **Testes (novo):** `gui-git/src/components/CommitGraph.test.ts` + `vitest` como devDependency e script `npm test`; atualização das expectativas de `gui-git/verify-graph-geometry.mts`.
- **Dependências:** nova devDependency `vitest` (auditada; projeto sem vulnerabilidades críticas).
- **Spec:** `openspec/specs/commit-graph/spec.md` (MODIFIED).