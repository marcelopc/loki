# Tasks

## 1. Backend — comandos de sincronização (pull/push)

- [x] 1.1 Criar `src-tauri/src/commands/sync.rs` com o helper `client()` espelhando `status.rs` e o comando `git_pull` executando `git pull`, invalidando o cache de diff e emitindo `repo-changed` (reason `pull`); verificar com `cargo build` sem erros e `cargo test` passando
- [x] 1.2 Adicionar no mesmo módulo o comando `git_push` executando `git push`, invalidando o cache de diff e emitindo `repo-changed` (reason `push`); propagar o stderr do git quando o push falhar (ex.: sem upstream); verificar com `cargo build` sem erros e `cargo test` passando
- [x] 1.3 Registrar `git_pull` e `git_push` no `invoke_handler` em `src-tauri/src/lib.rs` e declarar o módulo em `src-tauri/src/commands/mod.rs`; verificar que `cargo check` compila e os comandos aparecem no runtime

## 2. Backend — comandos de stash (stash/pop)

- [x] 2.1 Criar `src-tauri/src/commands/stash.rs` com o helper `client()` e o comando `git_stash` executando `git stash push -u` (inclui untracked), invalidando o cache de diff e emitindo `repo-changed` (reason `stash`); antes de executar, verificar com `git status --porcelain` se o working tree está vazio para emitir erro amigável "nada para guardar"; verificar com `cargo build` sem erros e `cargo test` passando
- [x] 2.2 Adicionar no mesmo módulo o comando `git_stash_pop` executando `git stash pop` (aplica e remove a stash; preserva a stash em conflito), invalidando o cache de diff e emitindo `repo-changed` (reason `stash-pop`); verificar com `git stash list` vazio para emitir erro amigável "sem stash para restaurar"; verificar com `cargo build` sem erros e `cargo test` passando
- [x] 2.3 Registrar `git_stash` e `git_stash_pop` no `invoke_handler` em `src-tauri/src/lib.rs` e declarar o módulo em `src-tauri/src/commands/mod.rs`; verificar que `cargo check` compila e os comandos aparecem no runtime
- [x] 2.4 Adicionar testes unitários em `sync.rs`/`stash.rs` (padrão `#[cfg(test)]` de `refs.rs`): pull up-to-date, push sem upstream (erro propagado), stash com working tree limpo (erro amigável), pop com lista vazia (erro amigável); verificar com `cargo test` passando

## 3. Frontend — wrappers de API e botões na toolbar

- [x] 3.1 Adicionar `gitPull`, `gitPush`, `gitStash`, `gitStashPop` em `src/lib/tauri.ts` chamando os comandos novos; verificar com `tsc --noEmit` que os tipos compilam
- [x] 3.2 Em `src/components/Toolbar.tsx`, adicionar o grupo `.action-grp` com 4 botões `.action-btn` (Pull `⤓`, Push, Stash, Pop) chamando os wrappers e `refresh()` no success; cada handler com try/catch exibindo o erro via `alert` (padrão atual); verificar com `tsc --noEmit` e `npm test` que os testes existentes continuam passando
- [x] 3.3 Lógica de disponibilidade: Push `disabled` sem repo ou sem upstream da branch atual (via `branches.find(b => b.isCurrent)`), e com classe `dim` (esmaecido) quando `ahead === 0`; Pull/Stash/Pop habilitados com repo; verificar visualmente no `npm run dev` os estados de disabled/dim
- [x] 3.4 Adicionar teste de frontend (padrão `CommitGraph.test.ts`/`types.test.ts`) validando que Push fica desabilitado quando `upstream` ausente e esmaecido quando `ahead === 0`, e que Pull/Stash/Pop ficam desabilitados sem repo; verificar com `npm test` passando
- [x] 3.5 Adicionar estilos `.action-grp`/`.action-btn` (+ variante `.dim`) em `src/App.css`, alinhados ao tema (tom de destaque `--accent`/verde para pull, consistente com os botões existentes); verificar com `npm run build` sem erros e visualmente no `npm run dev`

## 4. Integração e validação

- [ ] 4.1 Validar cenário "pull": em repo com upstream e commit remoto, clicar Pull atualiza o commit-graph e a branch deixa de estar atrás (behind 0) após refresh; verificar via `npm run dev` + `git log`/`git status`
- [ ] 4.2 Validar cenário "push": com commit local não enviado, clicar Push envia e a branch deixa de estar à frente (ahead 0) após refresh; verificar via `npm run dev` + `git status`/log do remoto
- [ ] 4.3 Validar cenário "stash": com alterações rastreadas e untracked, clicar Stash limpa o working tree e o painel de commit fica vazio; clicar Pop restaura tudo (conteúdo intacto); verificar via `npm run dev` + `git stash list`
- [ ] 4.4 Validar cenários de borda: Push desabilitado/esmaecido sem upstream ou sem commits; Pop com stash vazia exibe erro amigável sem quebrar; Stash com working tree limpo exibe erro amigável; verificar via `npm run dev`
- [ ] 4.5 Rodar `openspec validate --change add-git-action-buttons` e confirmar validação sem erros; arquivar com `/opsx:archive` após aprovação do usuário