# Tasks

## 1. Helper de apresentação do painel

- [x] 1.1 Adicionar `commitPanelSection(f: FileStatus): "staged" | "unstaged"` em `src/types.ts`, mapeando `untracked → unstaged`, e verificar que `npm test` continua verde
- [x] 1.2 Criar teste unitário puro em `src/types.test.ts` cobrindo staged, unstaged e untracked (emulando `CommitGraph.test.ts`, sem DOM) e verificar que o teste passa com `npx vitest run src/types.test.ts`

## 2. Painel de commit (coluna direita)

- [x] 2.1 Criar `src/components/CommitPanel.tsx` com as seções **Unstaged** (com marcador distinto para untracked), **Staged** e **formulário de commit** (campo summary + botão com contagem de arquivos staged), reusando a lógica de stage/unstage/commit de `LeftPane`/`DiffView` e o helper `commitPanelSection`; verificar que `npm run build` (tsc + vite) compila sem erros
- [x] 2.2 Remover o `ChangesPanel` de `src/components/LeftPane.tsx` (mantendo as branches) e verificar que `npm run build` compila sem erros
- [x] 2.3 Mover o formulário de commit para fora de `src/components/DiffView.tsx`, deixando-o exportar apenas o diff, e verificar que `npm run build` compila sem erros
- [x] 2.4 Adicionar estilos das seções do painel de commit (Unstaged/Staged/form) em `src/App.css`, seguindo os padrões existentes (`.file-row`, `.stage-btn`), e verificar que `npm run build` compila sem erros

## 3. Diff na coluna central

- [x] 3.1 Alterar `src/components/GraphPane.tsx` para empilhar o grafo e o `DiffView` na coluna central, e verificar que `npm run build` compila sem erros
- [x] 3.2 Atualizar `src/App.tsx` para a nova composição do workspace (esquerda: branches; centro: grafo + diff; direita: painel de commit) e o `src/App.css` da grade de 3 colunas, e verificar que `npm run build` compila sem erros

## 4. Integração

- [x] 4.1 Rodar `npm test` e confirmar que todos os testes existentes (incl. `CommitGraph.test.ts`) e novos passam
- [x] 4.2 Rodar `npm run build` e confirmar que `tsc` e `vite build` concluem sem erros