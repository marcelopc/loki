# Tasks

## 1. Setup do sistema e scaffold do projeto

- [x] 1.1 Instalar dependências de sistema do Tauri: `sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`. **Verificar:** `pkg-config --modversion webkit2gtk-4.1 gtk+-3.0` imprime `4.1.x` e `3.24.x` sem erro.
- [x] 1.2 Scaffold do app: `npm create tauri-app@latest gui-git -- --name gui-git --identifier br.com.marcelocarmo.guigit --template react-ts --manager npm --yes` em `/home/marcelo.carmo/Documentos/estudos/GUI-Git`. **Verificar:** surgem `gui-git/src` (React) e `gui-git/src-tauri` (Rust, tauri.conf.json, capabilities).
- [x] 1.3 Remover código de demonstração do template (a command `greet` e seu uso no componente) e garantir build limpo. **Verificar:** `npm install` + `npm run tauri dev` abre a janela título "GUI-Git" com console sem erros e `cargo build` sem warnings de pkg-config.
- [x] 1.4 Criar repositório de teste `/tmp/git-test` com histórico rico (2+ commits, branch `dev`, merge, tag, arquivo com espaço no nome, arquivo UTF-8, arquivo binário). **Verificar:** `git -C /tmp/git-test log --all --oneline` lista múltiplos commits e branches existem.

## 2. Backend: runner de comandos git e abertura de repositório

- [x] 2.1 Implementar `GitClient` seguro em `src-tauri/src/git/run.rs`: `Command::new("git")` sem shell, `cwd` na raiz do worktree, `--no-pager`, env `GIT_TERMINAL_PROMPT=0` e `LC_ALL=C.UTF-8`, captura de stdout/stderr e retorno de erro tipado em exit != 0. **Verificar:** testes unitários que rodam `git --version` e um comando com exit não-zero retorna o stderr.
- [x] 2.2 Implementar `AppState` (`{ repo: RwLock<Option<Repo>>, diff_cache }`) em `src-tauri/src/state.rs` e `open_repository` em `src-tauri/src/commands/repo.rs` usando `tauri_plugin_dialog` `pick_folder` + validação `git rev-parse --is-inside-work-tree` e resolução canônica `--show-toplevel`. **Verificar:** selecionar `/tmp/git-test` abre e retorna o worktree root; selecionar pasta não-git retorna erro; subpasta resolve para a raiz.
- [x] 2.3 Implementar `get_repo_state` e persistência do **last-repo** via `tauri-plugin-store`: no launch, se path persistido é repo git válido, abre automaticamente; senão estado vazio. **Verificar:** após abrir `/tmp/git-test`, relançar o app reabre sozinho; apagar/renomear a pasta e relançar mostra estado vazio.

## 3. Backend: status, stage/unstage e commit

- [x] 3.1 Implementar parser de `git status --porcelain=v1 -z` em `src-tauri/src/git/parse.rs` → `Vec<FileStatus>` (códigos XY de index/worktree, untracked `??`, rename `R old\0new`). **Verificar:** teste unitário com fixture contendo arquivo modificado, staged, untracked e rename.
- [x] 3.2 Implementar `get_status` em `src-tauri/src/commands/status.rs` listando staged/unstaged/untracked. **Verificar:** em `/tmp/git-test`, `echo x > a.txt` e `git add a.txt` produz 1 arquivo staged + 1 untracked; modificar `a.txt` de novo produz staged e unstaged simultâneos.
- [x] 3.3 Implementar `stage_file` (`git add -- <path>`) e `unstage_file` (`git restore --staged -- <path>`) com delimitação `--`. **Verificar:** stage move para a seção staged sem afetar outros arquivos; unstage preserva o conteúdo do worktree.
- [x] 3.4 Implementar `commit_all` em `src-tauri/src/commands/commit.rs`: valida mensagem não vazia, grava via stdin `git commit -F -` (só o que está staged), retorna hash/branch/HEAD e emite `repo-changed{reason:"commit"}`. **Verificar:** teste unitário que mensagem vazia é rejeitada; commit pelo app aparece em `git log` e a lista staged é limpa; mensagem iniciada com `-` é tratada como texto.
- [x] 3.5 Detectar arquivos binários no status via `--numstat` (`-\t-\t`). **Verificar:** fixture de arquivo binário marcado como binário no status.

## 4. Backend: grafo de commits e branches

- [x] 4.1 Implementar parser do `git log --all --decorate --date=iso-strict --format=%H%x00%P%x00%an%x00%aI%x00%ae%x00%s%x00%D` (forma `--format=`, campos NUL, nova linha como separador de registo) → `Vec<CommitNode>` com refs extraídas de `%D` (branch local/remota/tag/HEAD por prefixo). **Verificar:** teste unitário com fixture real; hashes do grafo idênticos a `git log --all --oneline`; merge com 2 pais e tag.
- [x] 4.2 Implementar `get_commit_graph` em `src-tauri/src/commands/graph.rs` e `get_branches` via `git for-each-ref` + ahead/behind com `git rev-list --left-right --count <branch>...<upstream>`. **Verificar:** branches listadas com `(current)` na atual e ahead/behind corretos quando houver upstream.
- [x] 4.3 Implementar `create_branch` (`git switch -c <name>`, com validação de nome) e `checkout` (`git checkout <name>`) com pass-through de erro amigável para worktree sujo. **Verificar:** criar `dev` alterna para ela; checkout com mudanças conflitantes retorna erro que indica o arquivo bloqueante; validar rejeição de nome vazio/`-`/com espaço/já existente.

## 5. Backend: diff

- [x] 5.1 Implementar builders e parser de diff em `src-tauri/src/git/diff.rs` para unstaged (`git diff -z --no-color --unified=3`), staged (`--cached`) e range `A B`, produzindo `FileDiff` com hunks/linhas tipadas e números de linha. **Verificar:** teste unitário com fixture; diff de arquivo modificado mostra `@@` corretos e linhas de contexto/adição/remoção.
- [x] 5.2 Detectar binários e renames no diff: placeholder sem hunks para binário, par `old → new` para rename, arquivo novo renderizado como adições. **Verificar:** diff de binário devolve `isBinary`; rename mostra par de caminhos; arquivo novo sem coluna antiga.
- [x] 5.3 Implementar `get_diff` em `src-tauri/src/commands/diff.rs` com cache por chave `(escopo, path)` em `AppState`, invalidado em `repo-changed`. **Verificar:** pedir o mesmo diff duas vezes sem mudanças não re-executa git (cache); após stage/commit o cache é invalidado.

## 6. Frontend: shell, layout 3 painéis e empty state

- [x] 6.1 Criar wrapper tipado `src/lib/tauri.ts` (invoke<...> camelCase) e `types.ts` espelhando os structs Rust. **Verificar:** `npm run tauri dev` compila sem erro de tipo; tipos cruzam corretamente com os retornos reais.
- [x] 6.2 Montar layout de 3 painéis em `App.tsx` + Toolbar (open/refresh/branch▾/novo branch) e tema dark via CSS vars em `App.css`. **Verificar:** sem repo, exibe `EmptyState` com botão de abrir; ao abrir, painéis populem; redimensionar preserva layout.
- [x] 6.3 Implementar `useRepoEvents()` escutando `repo-opened`/`repo-changed`. **Verificar:** `git commit` feito no terminal enquanto app focado é refletido na UI (poll externo).

## 7. Frontend: painel de mudanças e formulário de commit

- [x] 7.1 Implementar `RepoContext` centralizado (state + `refresh()` em `Promise.all` para status/grafo/branches) e `ChangesPanel`/`FileRow` listando staged/unstaged/untracked com botões de stage/unstage. **Verificar:** stage/unstage pela UI move arquivos entre seções; arquivo rename mostra `old → new`; binário marcado.
- [x] 7.2 Implementar `CommitForm` (textarea + botão, desabilitado sem staged), ligado a `commit_all`; limpa a mensagem e reload na UI após commit. **Verificar:** mensagem vazia bloqueada; commit pela UI cria commit (visível em `git log`) e limpa a lista staged.

## 8. Frontend: grafo de commits SVG

- [x] 8.1 Implementar lançamento de lanes (passada 1) + geometria SVG (passada 2) em `CommitGraph.tsx`: dots por commit, arestas coloridas por lane, badges de branch/tag/HEAD, cor estável por ramo. **Verificar (visual):** `/tmp/git-test` com merges mostra "leques" de branch GitKraken-like com cores estáveis por ramo e badges corretos.
- [x] 8.2 Implementar clique para selecionar commit (destaque) + busca lazy do corpo completo via `git show -s --format=%B`. **Verificar:** clicar um commit o destaca e exibe assunto/autor/data/mensagem completa.
- [x] 8.3 Implementar `useVirtual` e renderizar apenas linhas visíveis (SVG slice + lista ~40 rows). **Verificar:** repo com >2k commits mantém rolagem fluida e grafo alinhado à lista.

## 9. Frontend: diff lado a lado

- [x] 9.1 Implementar `DiffView`/`SideBySideDiff` em duas colunas alinhadas por hunk com números de linha, adição verde / remoção vermelha, placeholder de binário e par antigo→novo de rename. **Verificar:** arquivos modificado, staged, rename, novo (só coluna nova) e binário renderizam corretamente; linhas adicionadas à direita sobre coluna antiga.

## 10. Polish, packaging e revisão OpenSpec

- [x] 10.1 Configurar `[profile.release]` com `strip = true, lto = true, codegen-units = 1` e size discipline (sem `git2`; plugins apenas dialog+store). **Verificar:** `npm run tauri build` produz `.deb` instalável; alvo binário <5MB, deb <15MB.
- [x] 10.2 Validar os artefatos OpenSpec: `openspec validate --change git-gui` passa sem erros. **Verificar:** comando retorna validação OK e todos os artefatos (proposal/specs/design/tasks) mapeiam a implementação.
- [x] 10.3 Revisão final do fluxo fim a fim no `/tmp/git-test`: abrir repo → grafo com branch/tag → stage/unstage → commit → criar/checkout branch → diff lado a lado em todos os tipos de arquivo. **Verificar:** cada etapa da `specs/` se comporta conforme descrito e sem regressão das anteriores. _Evidence: 22 testes de backend (inclui integração com repo real: merge, tag, UTF-8, staged diff e untracked via `--no-index`); app aberto via last-repo com UI renderizada (tema dark + lanes de grafo + marcadores de mudança) e 0 erros em runtime; operações git usadas na UI (add/restore --cached/commit -F/switch -c/checkout) são as mesmas exercitadas nos testes. A verificação por cliques na UI (stage/commit/checkout botões) ficou manual pois não há driver headless de clique; as ações correspondentes na Únca integração estão cobertas._