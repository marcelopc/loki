# Proposal

## Why

O GUI-Git hoje só oferece operações de stage/commit via interface; pull, push, stash e pop exigem voltar ao terminal, quebrando o fluxo de trabalho dentro do app. Botões de ação diretos na UI agilizam o ciclo de sincronização com o remoto e o gerenciamento de alterações temporárias, sem sair da ferramenta.

## What Changes

- Adicionar um grupo de botões de ação Git na toolbar com as operações **Pull**, **Push**, **Stash** e **Pop**:
  - **Pull** (`git pull`) — integra alterações do upstream na branch atual, atualizando o commit-graph e o diff.
  - **Push** (`git push`) — envia commits locais para o upstream, atualizando o estado ahead/behind das branches.
  - **Stash** (`git stash push`) — guarda alterações do working tree (incluindo untracked com `-u`) na stash list e limpa o working tree.
  - **Pop** (`git stash pop`) — restaura o stash mais recente para o working tree, mantendo o conteúdo.
- Novos comandos Tauri no backend Rust: `git_pull`, `git_push`, `git_stash`, `git_stash_pop`, seguindo o padrão dos comandos atuais (emitir `repo-changed`, invalidar cache de diff).
- Feedback de estado no frontend: botões desabilitados quando não há repo; Push esmaecido quando não há nada para enviar (branch sem upstream ou ahead=0); Pop esmaecido quando a stash list está vazia.
- Tratamento de erros específicos: pull/pop com conflito ou divergência, push sem upstream configurado (`git push -u` sugerido), stash com working tree limpo.
- Atualização automática da lista de branches (upstream/ahead-behind) e do commit-graph após pull/push, via `refresh()` reutilizado.

## Capabilities

### New Capabilities
- `sync`: operações de sincronização com o remoto — pull do upstream para a branch atual e push dos commits locais para o upstream, com detecção de estado (sem upstream, nada a enviar, divergência/conflito). Capaz de evoluir (ex.: `push -u` explícito, `--force-with-lease` no futuro).
- `stash`: operações de stash — guardar alterações do working tree (stash push) e restaurar a stash mais recente (stash pop), com tratamento de lista vazia, working tree limpo e conflitos na restauração.

### Modified Capabilities
- _(nenhuma — as operações pull/push/stash/pop não alteram os requisitos existentes de `changes`, `commits`, `branches`, `diff` ou `commit-graph`; estendem o sistema com comportamento novo e durável, sem modificar contratos atuais.)_

## Impact

- **Backend (Rust):** `src-tauri/src/commands/` — novo módulo `sync.rs` (comandos `git_pull`, `git_push`) e `stash.rs` (comandos `git_stash`, `git_stash_pop`), ou comandos no módulo existente conforme convenção; `src-tauri/src/lib.rs` — registrar os novos `#[tauri::command]` no `invoke_handler`.
- **Frontend (React):** `src/components/Toolbar.tsx` — grupo de botões Pull/Push/Stash/Pop; `src/lib/tauri.ts` — wrappers `gitPull`/`gitPush`/`gitStash`/`gitStashPop` e tipagens de retorno; `src/types.ts` — tipos de resultado (ex.: `SyncOutcome` com `branchChanged`, `stash` vazio/cheio).
- **Estilo (React):** `src/App.css` — estilos do grupo de botões de ação na toolbar (classe `.action-btn` com variantes).
- **Testes:** testes unitários do backend para os comandos novos (seguindo o padrão `git/run.rs`, `git/refs.rs` com `#[cfg(test)]`) e testes de frontend para o estado dos botões (desabilitado/sem repo, esmaecido sem upstream).
- **Sem novas dependências.** Uso apenas dos binários git já invocados pelo `GitClient`.