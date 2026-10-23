# Design

## Context

O GUI-Git é um app Tauri 2 (React + Rust). A toolbar (`src/components/Toolbar.tsx`) tem botões de abrir/refresh e o controle de branch, e o backend expõe comandos `#[tauri::command]` que chamam git via `GitClient` (`src-tauri/src/git/run.rs`) e emitem o evento `repo-changed` + `state.invalidate_diff_cache()` após cada mutação (padrão em `status.rs`, `commit.rs`). A spec `branches` já expõe upstream e ahead/behind (`refs.rs`); não existe nenhuma capacidade de pull/push/stash. Ver `proposal.md` — Why para a motivação.

## Goals / Non-Goals

**Goals:**
- Botões Pull/Push/Stash/Pop na toolbar que executam as operações git correspondentes.
- Comandos Tauri novos seguindo o padrão existente (evento `repo-changed`, invalidação de diff, refresh do frontend).
- Feedback de disponibilidade: push desabilitado/esmaecido sem upstream ou sem commits; pop esmaecido com stash vazia; erros do git exibidos ao usuário.
- Atualização de branches (ahead/behind) e commit-graph após pull/push.

**Non-Goals:**
- Interface de log de stash (listar/apagar stash específico) — fora do escopo pedido (4 botões).
- Push com `--force`/`--force-with-lease` — apenas push normal (fast-forward).
- Pull com rebase ou estratégias de merge configuráveis — `git pull` default.
- Ganchos de autenticação/credenciais do remoto — delegado ao git/agente de credenciais do sistema.

## Decisions

### 1. Novo módulo `commands/sync.rs` + `commands/stash.rs` em vez de engordar os existentes
- **Decisão:** criar `src-tauri/src/commands/sync.rs` (pull/push) e `src-tauri/src/commands/stash.rs` (stash/pop), declarados em `mod.rs`, com seu próprio helper `client()` espelhando `status.rs`.
- **Por quê:** pull/push e stash são domínios distintos do stage/commit; isolá-los mantém cada arquivo pequeno e evita misturar responsabilidades. Segue a organização atual por domínio (`commit.rs`, `graph.rs`, `repo.rs`, `status.rs`).
- **Alternativas consideradas:** um único `remote.rs` para tudo — mas stash não é operação de remoto. Colocar tudo em `commit.rs` — misturaria conceitos.

### 2. Comandos Tauri atômicos no backend (não encadear `invoke`s no frontend)
- **Decisão:** expor `git_pull`, `git_push`, `git_stash`, `git_stash_pop` como comandos Tauri únicos. Em caso de sucesso, invalidam o cache de diff e emitem `repo-changed` (reason `pull`/`push`/`stash`/`stash-pop`).
- **Por quê:** uma chamada atômica no backend garante um único evento e um refresh; encadear no frontend (ex.: push = 2 invokes) criaria janelas de estado intermediário e múltiplos refreshes.
- **Alternativas consideradas:** (a) só wrappers no frontend chamando `git` via processo — quebraria o encapsulamento atual onde o backend é a única camada que executa git; (b) reusar `get_branches` internamente — desnecessário, o refresh do frontend re-puxa tudo.

### 3. Detecção de "nada a sincronizar" usando a infra de branches existente
- **Decisão:** no frontend, derivar a disponibilidade de Push dos dados já expostos por `get_branches` (spec `branches`): `currentBranch.upstream` ausente → botão desabilitado; upstream presente e `ahead === 0` → botão esmaecido (disabled com estilo "nada a enviar"), mas ainda clicável para forçar refresh se desejado. Pull habilitado sempre que houver repo (git lida com "up-to-date").
- **Por quê:** não há necessidade de novas queries; `refs.rs` já computa upstream e ahead/behind. Simplifica o backend (sem parâmetro extra) e mantém a spec `branches` como fonte de verdade para o estado de sincronização.
- **Alternativa considerada:** consultar `git status`/`git rev-list` por comando para decidir — duplica lógica já existente e adiciona latência.

### 4. Uso dos primitivos git diretos e seguros
- **Pull:** `git pull` (default do git; respeita a config de merge/rebase do usuário). Erros (conflito, divergência) propagados via stderr ao frontend.
- **Push:** `git push` sem flags. Sem upstream → git falha com stderr "no upstream branch" já orientativo; o frontend exibe esse erro (que o git traduz para sugestão `--set-upstream`).
- **Stash:** `git stash push -u` — `-u` inclui untracked (necessário para "guardar tudo", pois `git stash` sem `-u` deixa untracked no working tree, contrariando o requisito de limpar). Verificar com `git status --porcelain` vazio antes de chamar, para emitir erro amigável "nada para guardar" em vez do stderr genérico.
- **Pop:** `git stash pop` (aplica e remove a stash). Se falhar por conflito, o git mantém a stash na lista — comportamento que o requisito preserva. Para "lista vazia", usar `git stash list` antes ou confiar no stderr do git; decisão: verificar `stash list` vazio → erro amigável (consistente com o padrão de stash).
- **Por quê:** primitivos padrão, menos código custom, comportamento bem definido do git preserva/remove stash corretamente em conflito.
- **Alternativas consideradas:** `git stash push -m` com mensagem fixa — desnecessário. `git pull --ff-only`/`--rebase` — muda o comportamento default do usuário; fora do escopo.

### 5. Botões na toolbar com estados e feedback
- **Decisão:** grupo `.action-grp` na `Toolbar.tsx` (lado direito, antes do controle de branch) com 4 botões `.action-btn`:
  - **Pull** (`api.gitPull`) — sempre habilitado com repo; ícone `⤓` + tooltip.
  - **Push** (`api.gitPush`) — `disabled` sem repo. `disabled` também quando `!currentBranch?.upstream`; classe `dim` (visual esmaecido) quando `ahead === 0` mas ainda clicável para forçar refresh.
  - **Stash** (`api.gitStash`) — sempre habilitado com repo; tooltip "Guardar alterações no stash".
  - **Pop** (`api.gitStashPop`) — `disabled` com repo mas sem saber estado da stash (a spec atual não expõe `stash list`); decisão: manter habilitado e deixar o erro do git/frontend informar "sem stash". Opcional futuro: expor `get_stash_list`. *(Escolha simples para manter o escopo dos 4 botões.)*
- Cada handler: `try { await api.<op>(); } catch (e) { alert(...); }` + `await refresh()` no finally/sucesso — idêntico aos handlers atuais (`switchBranch`, `submit`).
- **Por quê:** toolbar é o local natural de ações de repo (GitHub Desktop/VS Code fazem o mesmo); reusa `useRepo`/`refresh` sem estado extra.
- **Alternativa considerada:** painel lateral/commit panel — fica escondido; o estado de sincronização pertence à barra superior.

### 6. Wrappers e tipos no frontend
- `src/lib/tauri.ts`: `gitPull: () => invoke<void>("git_pull")`, `gitPush: () => invoke<void>("git_push")`, `gitStash: () => invoke<void>("git_stash")`, `gitStashPop: () => invoke<void>("git_stash_pop")` — sem argumentos, retorno `void` (as operações não precisam de payload de volta; o refresh re-puxa estado).
- **Por quê:** mantém o padrão atual de wrappers 1:1 com os comandos; nenhum dado novo precisa trafegar (diferente de `commit_all` que retorna `CommitOutcome`).

## Risks / Trade-offs

- **[Push sem upstream mostra erro bruto do git]** → aceitável: o stderr do git já sugere `git push --set-upstream`; o frontend desabilita o botão quando sabe que não há upstream (via `upstream` de `branches`), então o erro só aparece em estado raro.
- **[Stash sem `-u` deixaria untracked]** → mitigado: `git stash push -u` é a decisão; cenário coberto no spec.
- **[Pull pode disparar merge/rebase conforme config do usuário]** → não é uma falha: respeitar a config é a escolha; o erro de conflito é exibido e o working tree fica gerenciável pelo usuário.
- **[Estado da stash não exposto (pop habilitado sem stash)]** → comportamento aceitável: pop com lista vazia apenas avisa; se virar atrito, uma capability futura `stash` pode expor `get_stash_list` (fora do escopo atual).
- **[Push demorado / trava UI]** → todos os comandos Tauri aqui são síncronos (padrão atual); para repositórios grandes isso bloqueia o comando — risco igual ao `commit_all` existente. Mitigação futura (async/spawn) documentada como fora do escopo.
- **[Divergência/confitto no pull]** → o git aborta e o stderr é exibido; o botão não força nada (sem `--rebase`/`--ff-only` forçados).

## Migration Plan

- Sem dados persistidos nem contratos externos. Deploy = build normal do app Tauri.
- Rollback: reverter os commits do frontend+backend; comandos novos são aditivos e não afetam stage/commit/checkout existentes.
- `git stash push -u` e `git pull`/`push` operam sobre o repo real; nenhum dado do app é migrado.

## Open Questions

- _(nenhuma bloqueante — decisões de UI/estado resolvidas acima dentro do escopo dos 4 botões.)_