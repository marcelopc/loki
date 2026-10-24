# Design

## Context

O layout atual das linhas do gráfico (`GraphPane.tsx`) era:
`[grafo SVG] [subject] [refs badges] [meta]` — os badges de branch/tag ficavam
inline após a mensagem. Com esta mudança, os badges são **removidos** e passa a
existir uma **coluna dedicada de refs à esquerda do grafo**:
`[ref-column] [graph-gutter] [graph-rows]`.

Os dados das referências já chegam ao frontend em cada `CommitNode.refs`
(`RefDecoration[]`, ver `src/types.ts`), serializados pelo backend em
`src-tauri/src/git/parse.rs::parse_decorations` a partir do `%D` do
`git log --all`. Bundles remotos (`origin/...`) também já trafegavam, mas a
classificação **local vs remota** ficava ambígua para branches com `/` no nome.

A ordem das refs no `%D` do git **não é garantida semanticamente**
(HEAD → branch, tags, remotos aparecem agrupados), então a prioridade de
exibição é derivada no frontend.

## Goals / Non-Goals

**Goals:**
- Nova coluna de referências como **primeira coluna** (à esquerda do grafo SVG), com largura fixa.
- Exibir a **primeira ref** de cada commit: prioridade `head` > `branch` > `remote` > `tag`, desempate pela ordem dos dados.
- Chip moderno: fundo translúcido da cor do tipo, ícone por kind, texto sempre claro, ellipsis em largura fixa.
- **Cor da lane** no chip de tag e branch local (ligação visual com a linha do grafo).
- Alinhamento com a virtualização existente (coluna vive dentro de `graph-canvas`/`graph-rows`).
- Classificação **exata** de branch local vs remota no backend (`--decorate=full`).

**Non-Goals:**
- Exibir múltiplas refs por linha na coluna (escolha do usuário: primeira ref truncada; com exceção do par tracking que mostra dois ícones).
- Backend/API novo (sem novos campos — apenas o format do `git log` muda para trazer refs completas).
- Não há mais badges inline após o subject (removidos a pedido do usuário).

## Decisions

### D1: Coluna como flex child da linha, antes do grafo
Cada linha (`ga-row`) renderiza, na ordem: **coluna de refs → grafo SVG → subject → meta**.

Na prática o grafo é uma coluna separada (`graph-gutter`) ao lado de `graph-rows`; como o usuário pediu a coluna de refs **antes do grafo**, a alteração no `graph-canvas` fica:

```
[ref-column] [graph-gutter] [graph-rows]
```

- `graph-canvas` já é `display: flex`, então basta inserir a nova coluna antes de `graph-gutter`.
- A coluna de refs usa `flex: 0 0 auto` com largura fixa (ex.: `--ref-col-w`, ~120px), mesmo padrão do `graph-gutter`.

**Alternativa considerada:** coluna dentro de cada `ga-row` (por linha). Rejeitada: duplicaria o cálculo, dificultaria manter largura fixa e alinhamento, e quebraria a separação visual atual entre gutter e rows.

### D2: Prioridade de ref derivada no frontend (`pickPrimaryRef`)
Função pura em `src/types.ts`, testável em node sem DOM:

```ts
const REF_PRIORITY: Record<string, number> = { head: 0, branch: 1, remote: 2, tag: 3 };

export function pickPrimaryRef(refs: RefDecoration[]): RefDecoration | null {
  let best: RefDecoration | null = null;
  let bestPri = Infinity;
  for (const r of refs) {
    const pri = REF_PRIORITY[r.kind] ?? 4;
    if (pri < bestPri) { best = r; bestPri = pri; }
    // desempate: primeira ocorrência (i.e. `<=` não usado) mantém a ordem dos dados
  }
  return best;
}
```

- `head` primeiro, depois branch local, depois branch remota, depois tag; qualquer outro `kind` (ex.: `stash`, `other`) fica atrás.
- Retorna `null` para commit sem refs → coluna vazia na linha.

### D3: Largura fixa + ellipsis via CSS
- `.ref-column`: `width: var(--ref-col-w, 120px); flex: 0 0 auto; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;` com `border-right` separando da gutter.
- `.ref-cell`: `display: flex; align-items: center;` — ícone e nome alinhados verticalmente (resolve o desalinhamento do `<svg>` inline do `@mdi/react`, que sentava na baseline).
- `.ref-name`: `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` — o ellipsis trunca apenas o nome, mantendo o ícone sempre visível.
- O `title` (tooltip) mostra o nome completo da ref (e ambos os lados do par tracking).

**Alternativa considerada:** largura responsiva. Rejeitada — colunas largas demais roubam espaço do subject; largura fixa mantém o escaneamento vertical.

### D4: Chip moderno com fundo translúcido (não mais badges sólidos) e remoção dos badges inline
O chip de ref (`ref-cell`) usa **fundo translúcido + borda** com a cor do tipo (`color-mix` com `--ref-color`, alpha ~14%/32%), cantos `border-radius: 6px`, padding `2px 6px`, texto sempre na cor clara (`--text`). A cor do tipo fica **apenas no fundo/borda** — o nome nunca é pintado com uma cor de baixo contraste (a tentativa inicial de pintar o nome com `--amber` tornou a tag ilegível).

Os **badges inline** após o subject foram **removidos** (antes Non-Goal de manutenção; o usuário decidiu que a coluna é a única exibição na lista). Consequência aceita: refs secundárias (além da primeira) não aparecem na linha — ficam no tooltip do chip.

### D5: Ícones por kind e tracking pair
- `RefGlyph` em `GraphPane.tsx` escolhe o glifo por kind: `branch` → laptop (`mdiLaptop`), `remote` → octocat (`mdiGithub`), `tag` → `◈`, `head` → `HEAD`.
- **Tracking pair**: quando o commit tem branch local **e** remota correspondente (`origin/main` ↔ `main`, match por sufixo `/nomeLocal`), o chip exibe **dois ícones** (laptop + octocat) e o tooltip lista ambos: `branch: main · remote: origin/main`.
- `refDisplayName`: refs remotas mostram apenas a parte da branch (`origin/feat/mdi-icons` → `feat/mdi-icons`) — o octocat já indica que é remota; o remote completo fica no tooltip.

**Alternativa considerada:** listar todas as refs na coluna. Rejeitada (escopo do pedido: primeira ref + par tracking).

### D6: Cor da lane no chip (tag e branch local)
- O backend/layout já calcula uma cor por **lane** (`PlacedCommit.color`); no `GraphPane`, `colorByHash` mapeia `hash → cor da lane`.
- O chip de **tag** e **branch local** recebe `--ref-color` com a cor da lane do commit; o CSS usa `color-mix()` para gerar fundo/borda translúcidos (com fallback âmbar/verde quando não houver lane).
- Remote mantém cor fixa roxa e HEAD azul: são refs de rastreamento/estado, não "donos" de uma lane.

### D7: Backend `--decorate=full` para classificação exata local vs remota
Com `--decorate` (nomes curtos), o `%D` emitia `feat/mdi-icons` para uma branch local com slash e `origin/feat/mdi-icons` para a remota — o parser usava `contains('/')` como heurística de "remoto" e **classificava a branch local com slash como remota** (sem laptop). A correção:

- `refs.rs::log_all`: `--decorate` → `--decorate=full`. O `%D` passa a trazer `refs/heads/feat/mdi-icons` e `refs/remotes/origin/feat/mdi-icons` — a distinção é exata pelos prefixos.
- `parse.rs::parse_decorations`: aplica `trim_ref` também nos restos de `tag:` e `HEAD ->` (que com `=full` vêm como `tag: refs/tags/v1` e `HEAD -> refs/heads/main`), normalizando para `v1` e `main`.

## Risks / Trade-offs

- [Largura fixa pode truncar nomes longos de branch/tag] → ellipsis + `title` com nome completo.
- [Refs com `kind` inesperado (ex.: `other`) podem aparecer fora da ordem esperada] → prioridade default `4` (depois de tag), comportamento estável.
- [A coluna consome ~120px da largura do subject em janelas estreitas] → mitigado por ellipsis no subject (já existente) e largura conservadora; aceitável para o objetivo de escaneabilidade.
- [Mudança no `git log --format` pode afetar integração] → testes Rust de integração cobrem `log_all` (topo-order, tags, branches); parser mantém compat com formatos curtos via `trim_ref`.
- [`color-mix` requer navegador moderno] → Tauri usa WebKit/Chromium recente, suportado.

## Migration Plan

- Mudança de format do `git log` (backend) e de layout (frontend), sem migração de dados persistidos.
- Rollback: reverter o commit; o `--decorate` volta ao formato curto e o layout volta ao estado anterior.

## Open Questions

Nenhuma.