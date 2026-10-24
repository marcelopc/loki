# Design

## Context

Ver `proposal.md` (Why). O painel `BranchesPanel` em `src/components/LeftPane.tsx` hoje renderiza locais e remotas numa única seção `pane-section` com título "Branches" e um subtítulo `section-subtitle` "Remote" separando as remotas. Os dados já vêm distintos por `branch.kind` (`"local"` | `"remote"`) via `useRepo()`, então não há mudança de contrato de dados.

## Goals / Non-Goals

**Goals**: Dois grupos independentemente colapsáveis (Locais e Remotas); comportamento de checkout/upstream/marcação atual preservado; estilos consistentes com o visual atual.

**Non-Goals**: Não persistir o estado de colapso em disco/localStorage (basta o estado em memória de sessão). Não agrupar por remoto específico (ex.: `origin/`, `upstream/`). Não adicionar busca/filtro de branches.

## Decisions

- **Estado de colapso via `useState` local no `BranchesPanel`**, um booleano por grupo (`localOpen`, `remoteOpen`), ambos iniciando em `true`. Alternativa considerada: um único mapa `Record<group, boolean>` — dispensável para apenas dois grupos fixos; dois `useState` é mais simples (KISS).
- **Componente reutilizável `BranchGroup`** interno (não exportado) para renderizar um grupo: cabeçalho clicável com seta (▶/▼) + conteúdo condicionado. Reduz duplicação entre os dois grupos. Alternativa: inliner repetido — menos DRY, mais verboso.
- **Manter `onClick` checkout partilhado** já existente no `BranchesPanel`; o `BranchGroup` recebe a lista e o handler como props, sem duplicar a lógica de checkout.
- **Estado de colapso armazenado no componente pai** (`BranchesPanel`), não em cada `BranchGroup`, para que cada grupo seja stateless no que diz respeito a abrir/fechar. Simples e suficiente.
- **Classificar branches remotas pelo refname completo no backend.** Bug descoberto durante implementação: `list_branches` usava `%(refname:short)`, cujo short name já encurta `refs/remotes/origin/main` → `origin/main`, então `name.starts_with("remotes/")` nunca era verdadeiro e toda remote-tracking branch caía em `kind = "local"`. Correção em `refs.rs`: o `for-each-ref` agora emite `%(refname)` (completo), a classificação usa `full.starts_with("refs/remotes/")`, e o nome curto exibido é derivado via `strip_prefix("refs/heads/" | "refs/remotes/")`. Sem mudança de contrato de dados: o campo `kind` já existia — apenas passa a ser preenchido corretamente.

## Risks / Trade-offs

- [Acessibilidade: cabeçalho clicável pode não ser evidente como botão] → Usar elemento semântico com `aria-expanded` e cursor pointer, mais seta visual indicando estado.
- [Perda de estado de colapso ao remontar painel] → Aceito: recomeça expandido em cada sessão; não descrito como persistente nos specs.
- [Classificação de branch remota depender do formato do refname do `for-each-ref`] → Mitigado com teste de regressão `list_branches_classifies_remote_tracking_as_remote` que cria um bare remote real e asserta `kind == "remote"`; documentado que a classificação usa `%(refname)` completo, não o short.

## Migration Plan

Single-commit UI change + correção de backend, sem esquema de dados nem deploy faseado. Rollback trivial via `git revert`.

## Open Questions

Nenhum.