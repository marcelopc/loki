# Proposal

## Why

O gráfico de commits exibe as branches/tags apenas como badges inline após a mensagem do commit. Em históricos com muitas referências, é difícil identificar rapidamente em qual branch/tag cada commit está. Uma coluna dedicada como **primeira coluna** (à esquerda do grafo) torna a relação commit ↔ branch/tag escaneável de cima para baixo.

## What Changes

- Criar uma **coluna dedicada de branch/tag** como **primeira coluna** do gráfico de commits, posicionada **antes do grafo (grafo SVG)** — ou seja, à esquerda extrema do painel.
- Cada linha exibe a **primeira referência** do commit (prioridade HEAD > branch local > branch remota > tag) numa **largura fixa**, com truncamento por ellipsis quando o nome for longo.
- A ref é renderizada como um **chip moderno** (fundo translúcido + borda + ícone + nome), com **ícone por tipo**: laptop (branch local), octocat (remota), `◈` (tag), `HEAD` (head). O nome fica sempre na cor clara do texto — a cor do tipo vai no fundo/borda do chip.
- **Branch local + remota correspondente** (tracked pair) exibem **dois ícones** (laptop + octocat), e o nome da remota é mostrado **sem o prefixo do remote** (`origin/feat/mdi-icons` → `feat/mdi-icons`).
- O chip de **tag e branch local** segue a **cor da lane** do commit no grafo (mesma cor do dot/linha), reforçando a ligação visual com a linha.
- A coluna mantém o alinhamento com o rolamento virtualizado das linhas (mesmo contêiner de scroll do grafo).
- Os **badges inline existentes após a mensagem são removidos** — a coluna à esquerda passa a ser a única exibição de referências na lista (antes o design previa mantê-los; o usuário optou por removê-los).
- **Backend ajustado para classificação exata**: `git log` passa a usar `--decorate=full`, então o `%D` carrega nomes completos (`refs/heads/...`, `refs/remotes/...`, `tag: refs/tags/...`) — uma branch local com `/` no nome (ex.: `feat/mdi-icons`) não é mais confundida com remota.

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
- `commit-graph`: adiciona requisito de coluna de referências (branch/tag) como primeira coluna da tabela de commits, antes do grafo, exibindo a primeira ref do commit em chip com ícone por tipo e cor da lane.

## Impact

- **Frontend (React):** `src/components/GraphPane.tsx` — nova coluna `ref-column` no layout (`RefColumn`), `refDisplayName` (remove prefixo do remote), `colorByHash` (cor da lane por commit), `RefGlyph` (ícone por kind).
- **Estilos:** `src/App.css` — classes `.ref-column`, `.ref-row`, `.ref-cell` (chip translúcido com `color-mix`), `.ref-prefix`, `.ref-name`; remoção dos `.ref-badge` inline.
- **Backend (Rust):** `src-tauri/src/git/refs.rs` — `--decorate` → `--decorate=full`; `src-tauri/src/git/parse.rs` — `trim_ref` aplicado após `tag:` / `HEAD ->` para normalizar prefixos completos.
- **Testes:** `src/types.test.ts` (novos testes de `pickPrimaryRef`); `src-tauri/src/git/parse.rs` (teste de branch local com slash); frontend e Rust suítes intactas.
- **Docs/specs:** `openspec/specs/commit-graph/spec.md` (delta).