# Design

## Context

O GUI-Git é um app Tauri 2 (React + Rust). O painel de commit (`src/components/CommitPanel.tsx`) renderiza duas seções — **Unstaged** e **Staged** — com um botão por arquivo (`+`/`−`) que chama `api.stageFile`/`api.unstageFile` (ver `src/lib/tauri.ts`), os quais invocam os comandos Tauri `stage_file`/`unstage_file` em `src-tauri/src/commands/status.rs`. Esses comandos usam `git add -- <path>` e `git restore --staged -- <path>`, emitem o evento `repo-changed` e invalidam o cache de diff.

O problema: para N alterações são necessários N cliques. A proposta (ver `proposal.md`) adiciona ações em massa por seção.

## Goals / Non-Goals

**Goals:**
- Um botão na seção Unstaged que faz stage de **todos** os arquivos (`git add --all`).
- Um botão na seção Staged que desfaz o stage de **todos** os arquivos (`git restore --staged -- .`), preservando o working tree.
- Reuso do padrão existente: mesmos eventos, mesma invalidação de cache, mesmo tratamento de erro.

**Non-Goals:**
- Stage/unstage seletivo por grupo (ex.: só untracked, só modificados) — vazio no GitHub Desktop/TortoiseGit e fora do escopo pedido.
- Snapshot/restore seletivo via pathspec com exceções (`:(exclude)`).
- Alterar o layout ou o fluxo individual de stage/unstage.

## Decisions

### 1. Comandos Tauri novos (`stage_all` / `unstage_all`) em vez de reusar `stage_file` em loop
- **Decisão:** adicionar `stage_all` e `unstage_all` em `src-tauri/src/commands/status.rs`, registrados em `src-tauri/src/lib.rs`.
- **Por quê:** `git add --all` e `git restore --staged -- .` são operações atômicas do git (uma única chamada, um evento, uma invalidação de cache). Loop no frontend de `stage_file` geraria N eventos `repo-changed` e N invalidações — ineficiente e com janelas de estado intermediário.
- **Alternativas consideradas:** (a) reusar `commit_all` para stage? Não — `commit` faz commit, não stage. (b) `git add -A` via caminho variável no frontend? Mantém lógica git no frontend, contraria o padrão atual onde o backend encapsula git.

### 2. `git add --all` para stage em massa
- **Por quê:** `--all` == `-A` inclui modificados, novos (untracked) e removidos em uma operação — o comportamento esperado de "passar tudo para staged". Cobre o cenário onde a seção Unstaged tem arquivos untracked (que `git add` sem `-A` em diretórios não pegaria de forma confiável).
- Nota: `git add --all` falha (exit não-zero) se não houver nada? Não — é no-op com sucesso, mas por robustez o comando é seguro mesmo com index vazio (ver cenário "sem alterações").

### 3. `git restore --staged -- .` para unstage em massa
- **Por quê:** espelha o `unstage_file` atual (`git restore --staged`) aplicado a todo o index. `-- .` delimita o pathspec raiz, evitando interpretação como opções e cobrindo todos os paths. Não toca o working tree.
- **Alternativa considerada:** `git reset` misto (sem `--hard`) no index — mas `restore --staged` é o mesmo primitivo já usado no fluxo individual, mantendo consistência e sem risco de alterar HEAD.

### 4. Botões no cabeçalho das seções
- **Decisão:** no `CommitPanel.tsx`, cada `cp-section` ganha um botão com texto e cor destacada no cabeçalho (alinhado à direita, ao lado de "Unstaged"/"Staged"):
  - Unstaged: botão verde "Adicionar todos" (svc: `stageAll`), com fundo sólido da cor semântica de adição (`--green`).
  - Staged: botão vermelho "Tirar todos" (svc: `unstageAll`), com fundo sólido da cor semântica de remoção (`--red`).
  - Ambos ocultos quando a seção está vazia; compartilham a classe `.mass-btn` com um modificador `.stage`/`.unstage` para cor.
- **Por quê:** um botão de ação em massa precisa ser **descoberto de imediato**, não um ícone discreto. Texto explícito ("Adicionar todos"/"Tirar todos") + cor semântica sólida (verde = adicionar, vermelho = remover) comunicam a ação sem exigir hover/tooltip. Reusa os tons `--green`/`--red` já usados no app (consistência visual).
- **Alternativa considerada:** botão circular de ícone (`+`/`−`) — descartado no feedback de UX por ser "muito pequeno e escondido". Outra alternativa (classe `.btn.primary`), mas azul/accent não comunica adicionar/remover tão bem quanto verde/vermelho.

### 5. Wrappers no frontend
- `src/lib/tauri.ts`: `stageAll: () => invoke<void>("stage_all")` e `unstageAll: () => invoke<void>("unstage_all")`, sem argumentos.
- Reuso do `await refresh()` após a operação, igual aos fluxos individuais.

### 6. Layout das três áreas ocupando 100% do espaço
- **Decisão:** as áreas **Unstaged**, **Staged** e **Commit** dividem igualmente os 100% do espaço vertical do painel, usando `flex: 1 1 0` em cada uma (`.cp-section` e `.commit-form`). O container `.commit-panel` passa a `height: 100%` com `overflow: hidden` (não rola mais como um todo), e cada `.cp-section` vira uma coluna cujo `.file-group` rola internamente (`overflow-y: auto`).
- **Por quê:** com `flex: 0 0 auto` (comportamento anterior), cada seção usava só a altura do conteúdo e o painel inteiro rolava — em repositórios pequenos isso deixava muito espaço vazio por seção e, em repositórios grandes, a rolagem conjunta dificultava ver Unstaged e Staged ao mesmo tempo. Dividir 100% em terços fixos dá previsibilidade e aproveita todo o espaço disponível.
- **Alternativa considerada:** manter `flex: 0 0 auto` e só limitar cada seção com `max-height` — não resolve o problema de espaço vazio quando o conteúdo é curto. Outra alternativa (proporções customizáveis ao usuário) fica fora do escopo por simplicidade.

## Risks / Trade-offs

- **[Botão de stage all pega untracked que o usuário não queria]** → é o comportamento esperado de "todos"; o `stage_file` individual permanece disponível para escolha seletiva. Documentado nos cenários do spec.
- **[Unstage all usando `restore --staged -- .` vs `reset`]** → `restore --staged` preserva o working tree por definição; `reset` misto também, mas traz ambiguidade de pathspec. Em caso de comportamento inesperado do git version, o teste unitário cobre o caso.
- **[Seção vazia e botão escondido muda altura do header]** → layout flex do header já acomoda; trivial.
- **[Botão de cor sólida pode parecer intrusivo]** → é a intenção (ação em massa deve ser visível); opaco no hover para reduzir peso. Se o usuário preferir menos contraste, basta trocar `.mass-btn` para fundo transparente + borda na cor.
- **[Operação em massa em repo grande]** → `git add --all` é single-shot; sem risco de N processos. A invalidação de cache de diff é a mesma já existente.
- **[Seção vazia mantém 1/3 do espaço]** → com `flex: 1 1 0`, uma seção sem arquivos continua ocupando seu terço (mostra o `.clean`). É o comportamento desejado de "dividir 100%"; se quiser comprimir seções vazias, bastaria trocar para `flex: 1 1 auto`.

## Migration Plan

- Sem dados persistidos nem contratos externos. Deploy = build normal do app Tauri.
- Rollback: reverter o commit do frontend+backend; os comandos novos são aditivos e não afetam fluxos existentes.

## Open Questions

Nenhuma.