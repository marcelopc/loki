# Design

## Context

Ver `proposal.md` — **Why**. Trata-se de um app desktop **leve** estilo GitKraken, construído do zero. Stack decidida: **Tauri v2** (Rust backend + WebView nativo) com frontend **React + Vite (TS)**. Ambiente Ubuntu 22.04 + X11, Rust 1.98.1, Node v24, git 2.34. As dependências de sistema do Tauri (`libwebkit2gtk-4.1-dev` etc.) ainda **não estão instaladas** — pré-requisito de setup documentado em `tasks.md`.

## Goals / Non-Goals

**Goals:**
- Binário leve (alvo <5MB, deb <15MB) e baixo uso de memória.
- Grafo de commits com visual GitKraken (lanes coloridas por branch, dots, refs badges) em SVG.
- Fluxo essencial: abrir repo → ver grafo/mudanças → stage/unstage → commit → criar/checkout branch → diff lado a lado.
- Parsing git robusto contra filenames com espaços/UTF-8/renames/binários.

**Non-Goals:**
- Fora do MVP: rebase interativo, cherry-pick, stash, resolução de conflito de merge, push/pull de remotes avançados, multi-repo, autenticação remota.
- Não há sincronização com fornecedor de remoto (GitHub/GitLab).
- Sem libgit2 (`git2` crate) — integração via CLI `git` do sistema.

## Decisions

### D1. Integração Git via shell-out ao CLI `git` (não `git2`)
Todo comando roda por `std::process::Command::new("git")`, sem shell, `cwd` = raiz canônica do worktree. Ganhos: zero deps compiladas, binário menor, comportamento idêntico ao git que o usuário conhece. Parse via formatos de saída que controlamos.
- Grafo: `git log --all --decorate --date=iso-strict --format=%H%x00%P%x00%an%x00%aI%x00%ae%x00%s%x00%D` — separador de campo `\x00`; **a nova linha de fim de commit de um `log` é o separador de registo** (todos os campos são de uma linha só), o que dispensa `%x1e`. **Refinamento p/ git 2.34:** usar a forma `--format=...` (com `=`) — a forma `--format <valor>` separada faz o git 2.34 interpretar o valor como revisão ("ambiguous argument").
- Status: `git status --porcelain=v1 -z` (renames `R old\0new`).
- Diff: `git diff -z --no-color --unified=3` (unstaged), `--cached` (staged), `A B` (range). Binário por `-\t-\t` no `--numstat` ou marcador `GIT binary patch`. **Refinamento:** `git diff` (e `--no-index`) saem com exit code **1** quando há diferenças — o runner de diff trata 0 e 1 como sucesso. Untracked não aparece em `git diff`; para um arquivo untracked usar `git diff --no-index /dev/null <path>` e renderizar tudo como adição. Parser de path ignora aspas/escapes octais do git para nomes não quote-safe.
- Segurança: `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C.UTF-8`, `--no-pager`, `--` antes de paths; commit via stdin (`git commit -F -`) para nunca interpretar a mensagem como opção.
- Branches: **refinamento p/ git 2.34** — `for-each-ref` não tem o campo `%(ahead)`/`%(behind)` (adicionado em 2.44); listar refs e calcular ahead/behind só via `git rev-list --left-right --count <branch>...<upstream>`.

**Alternativa descartada:** crate `git2` (libgit2) — adiciona ~1-2MB e compile C pesado, com lacunas de comportamento vs git 2.34. Fere o requisito de leveza.

### D2. AppState único com cache de diff + eventos
`AppState { repo: RwLock<Option<Repo>>, diff_cache: RwLock<HashMap<DiffKey, Vec<FileDiff>>> }`.
- **Eventos** (`app.emit`): `repo-opened` e `repo-changed{reason}` disparados após toda mutação (commit/stage/unstage/branch/checkout); poll de `git diff --quiet HEAD` a cada ~2s apenas com a janela focada detecta mudanças externas (terminal).
- **Last-repo** persistido via `tauri-plugin-store`; no launch, se válido, auto-abre; senão exibe estado vazio (ver spec `repository`).

### D3. Grafo de commits em SVG custom (não `@gitgraph/react`)
`@gitgraph/react` resolve o gráfico em ~50 linhas mas o visual não é GitKraken e é difícil reestilizar. Algoritmo clássico de **lane-assignment** (estilo gitk): passada 1 atribui colunas reutilizando lanes de pais (merge-parent pega lane livre à direita); passada 2 geometriza (row 28px, dot r=5, lane 22px, cor estável por lane na criação de um ramo). Renderiza apenas linhas visíveis (virtualização ~40 rows) + slice do SVG. Badges de ref desenhados por cima do dot.

### D4. Backend Rust — módulos
`src-tauri/src/git/{run,parse,refs,diff}.rs` (parser puros unit-testados) e `src-tauri/src/commands/{repo,graph,status,commit,diff}.rs`. Commands `#[tauri::command]`: `open_repository`, `get_repo_state`, `get_commit_graph`, `get_branches`, `get_status`, `stage_file`, `unstage_file`, `commit_all`, `create_branch`, `checkout`, `get_diff`. Plugin **dialog** para `pick_folder` + validação `rev-parse --is-inside-work-tree`/`--show-toplevel`.

### D5. Frontend React — Context + useState, layout 3 painéis, tema dark
Sem Redux/Zustand (leveza). `RepoContext` centraliza estado e `refresh()` em `Promise.all` (status+grafo+branches) após `repo-changed`. Componentes: `Toolbar`, `BranchesPanel`, `ChangesPanel`, `CommitGraph` (SVG), `DiffView`/`SideBySideDiff`, `CommitForm`. Tema dark via **CSS vars** (não depender de `prefers-color-scheme`, que o WebKitGTK ignora sem GTK dark). `capabilities/default.json`: `core:default`, `dialog:default`, `core:event:default`.

### D6. Cut de MVP
- Checkout com worktree sujo → propaga stderr do git como erro amigável (sem stash/force no MVP).
- Corpo completo do commit buscado lazy por commit selecionado (`git show -s --format=%B`).
- Branches futuras: `branches` capability cobre listar/criar/checkout; nada de merge.

## Risks / Trade-offs

- **Falta de `libwebkit2gtk-4.1-dev` (sudo)** → 1ª `cargo build` falha com erro de pkg-config. *Mitigação:* setup gated em `pkg-config --modversion webkit2gtk-4.1 gtk+-3.0`; linha apt em `tasks.md`.
- **1ª build Rust lenta** → cache cargo aquecido (~434MB) reduz para ~3-6min; builds incrementais ~10-30s. Release final com `[profile.release] strip+lto` (mais lento, feito uma vez no fim).
- **Parsing de outputs git** (renames, espaços, UTF-8, binários) → NUL-delimited em tudo; fixtures de teste nos parsers.
- **Repos grandes (100k commits)** → virtualização + slice do SVG + cache de diff; poll de status embaralhado em 2s.
- **X11/Wayland** → Ubuntu 22.04 usa X11/XWayland por padrão (ok); fallback `GDK_BACKEND=x11` se houver problema de render.
- **Injeção de args/mensagem** → commit via stdin, validação de nomes de branch (sem espaços/`-` inicial), `--` antes de paths.
- **Checagem perdida / event storm** → emit após cada mutação + poll periódico idempotente; `refresh()` é idempotente.

## Migration Plan

App novo, sem estado de migração. Pacote release via `npm run tauri build` → `.deb` instalável (pull automático do runtime `libwebkit2gtk-4.1-0`). Rollback: desinstalar o `.deb`. Desenvolvimento via `npm run tauri dev` (Vite porta 1420 + janela).

## Open Questions

Nenhuma em aberto — decisões de escopo e stack resolvidas (ver `proposal.md` e `design.md` D1-D6). Dúvidas restantes sobre UX de checkout com worktree sujo foram deliberadamente cortadas para o MVP (só erro amigável).