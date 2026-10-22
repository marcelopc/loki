# Tasks

## 1. Backend — comandos Tauri de operação em massa

- [x] 1.1 Adicionar comando `stage_all` em `src-tauri/src/commands/status.rs` executando `git add --all`, invalidando o cache de diff e emitindo `repo-changed` (reason `stage-all`); verificar com `cargo build` sem erros e `cargo test` passando
- [x] 1.2 Adicionar comando `unstage_all` em `src-tauri/src/commands/status.rs` executando `git restore --staged -- .`, invalidando o cache de diff e emitindo `repo-changed` (reason `unstage-all`); verificar com `cargo build` sem erros e `cargo test` passando
- [x] 1.3 Registrar `stage_all` e `unstage_all` no `invoke_handler` em `src-tauri/src/lib.rs`; verificar que o handler compila (`cargo check`) e que os comandos aparecem no runtime

## 2. Frontend — wrappers de API e botões em massa

- [x] 2.1 Adicionar `stageAll` e `unstageAll` em `src/lib/tauri.ts` chamando os comandos novos; verificar com `npm test` que o módulo não quebra o build de tipos (`tsc --noEmit`)
- [x] 2.2 Em `src/components/CommitPanel.tsx`, adicionar no cabeçalho da seção **Unstaged** um botão verde "Adicionar todos" (classe `.mass-btn.stage`) que chama `stageAll` e `refresh()`, oculto quando a seção está vazia; verificar visualmente no `npm run dev` que o botão aparece só com arquivos unstaged/untracked
- [x] 2.3 Em `src/components/CommitPanel.tsx`, adicionar no cabeçalho da seção **Staged** um botão vermelho "Tirar todos" (classe `.mass-btn.unstage`) que chama `unstageAll` e `refresh()`, oculto quando a seção está vazia; verificar visualmente no `npm run dev` que o botão aparece só com arquivos staged
- [x] 2.4 Garantir que os botões em massa e o fluxo individual (`+`/`−` por arquivo) convivem sem conflito; verificar com `npm test` que os testes existentes de `CommitGraph.test.ts` continuam passando e `npm run build` sem erros de tipo
- [x] 2.5 Garantir que o botão em massa tenha **texto explícito + cor sólida** (`--green` para "Adicionar todos", `--red` para "Tirar todos"), legível e destacado no header da seção (não um ícone circular discreto); verificar com `tsc --noEmit` e visualmente no `npm run dev`
- [x] 2.6 Reorganizar o layout do painel de commit: as áreas **Unstaged**, **Staged** e **Commit** dividem 100% do espaço vertical (`flex: 1 1 0` cada), `.commit-panel` com `height: 100%` + `overflow: hidden` e `.file-group` rolando internamente; verificar com `npm run build` e `npm test` (13 testes) e visualmente no `npm run dev`

## 3. Integração e validação

- [x] 3.1 Validar cenário "stage em massa": com 3+ arquivos (modificado, novo/untracked, removido) na seção Unstaged, clicar no botão "Adicionar todos" move **todos** para Staged em uma operação (`git status` confirmado)
- [x] 3.2 Validar cenário "unstage em massa": com 3+ arquivos staged, clicar no botão "Tirar todos" move **todos** para Unstaged preservando o conteúdo do working tree (`git status` + conteúdo dos arquivos intacto)
- [x] 3.3 Validar cenários de seção vazia: sem arquivos na seção, o botão em massa não é exibido; com index vazio, `stageAll`/`unstageAll` não erram nem alteram estado (no-op); verificar via `npm run dev`
- [x] 3.4 Rodar `openspec validate --change add-stage-all-buttons` e confirmar validação sem erros; arquivar com `/opsx:archive` após aprovação
- [x] 3.5 Validar o novo layout: Unstaged, Staged e Commit ocupam juntos 100% do espaço vertical do painel, dividido em 3 terços iguais, com a lista de arquivos rolando internamente em cada seção; conferir no `npm run dev` (aprovado pelo usuário)