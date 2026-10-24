# Proposal

## Why

O painel lateral esquerdo lista branches locais e remotas em uma única seção "Branches", com as remotas apenas separadas por um subtítulo. Com muitos branches, a lista fica longa e difícil de navegar. Dividir a listagem em dois menus colapsáveis (Locais e Remotas) permite ao usuário recolher a seção que não usa e focar na relevante.

## What Changes

- Dividir o painel de branches do `LeftPane.tsx` em **dois grupos colapsáveis**: "Locais" e "Remotas".
- Cada grupo mantém as funcionalidades atuais de listagem (marcação da branch atual, upstream com ahead/behind, checkout ao clicar).
- Cada grupo pode ser **expandido/recolhido** independentemente (estado de colapso por seção, persistido localmente na sessão).
- Remover o subtítulo "Remote" existente em favor do novo grupo colapsável "Remotas".
- **Corrigir classificação de branches remotas no backend**: todas as remote-tracking branches (`refs/remotes/...`, ex. `origin/main`) eram reportadas com `kind = "local"` — o backend usava `%(refname:short)`, que já encurta o prefixo `refs/remotes/` (produz `origin/main`), fazendo `name.starts_with("remotes/")` nunca ser verdadeiro. A correção classifica pelo refname completo (`%(refname)`) e deriva o nome curto apenas para exibição. Sem isso, as branches `origin/...` apareceriam incorretamente no grupo "Locais".

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `branches`: o requisito "Listar branches" passa a exigir que locais e remotas sejam exibidas em grupos colapsáveis separados, com estado de expansão individual; e que as remote-tracking branches (`refs/remotes/...`) sejam classificadas como `remote` (correção de bug no backend de classificação por refname completo).

## Impact

- `src/components/LeftPane.tsx`: refatora `BranchesPanel` para renderizar dois grupos colapsáveis.
- `src/App.css`: adiciona estilos para o cabeçalho de grupo colapsável (botão de expandir/recolher e estados).
- `src/types.ts` / `src/state/RepoContext.tsx`: sem mudança de contrato (os dados de branch já distintos por `kind`).
- Novo estado local (React) para controlar expansão/colapso dos dois grupos.
- `src-tauri/src/git/refs.rs`: corrige `list_branches` para classificar remote-tracking branches como `kind = "remote"` (classificação pelo refname completo), e adiciona teste de regressão `list_branches_classifies_remote_tracking_as_remote`.
- Sem mudança de contrato de dados entre backend e frontend: o campo `kind` já existia; a correção apenas faz com que seja preenchido corretamente para branches remotas.