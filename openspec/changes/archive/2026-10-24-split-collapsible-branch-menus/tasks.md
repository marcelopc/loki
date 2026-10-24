# Tasks

## 1. Refatorar BranchesPanel em grupos colapsáveis

- [x] 1.1 Adicionar em `src/components/LeftPane.tsx` dois estados de colapso (`localOpen`, `remoteOpen`) inicializados em `true` no `BranchesPanel`
- [x] 1.2 Criar componente interno `BranchGroup` (não exportado) que renderiza um cabeçalho de grupo clicável (seta ▶/▼ + título + `aria-expanded` e `cursor: pointer`) e o conteúdo condicionado ao estado expandido, recebendo `title`, `open`, `onToggle`, `items` e `onClick` como props
- [x] 1.3 Substituir a renderização atual de `BranchesPanel` por dois `BranchGroup` ("Locais" com as branches `kind === "local"` e "Remotas" com as de `kind === "remote"`), removendo a `section-subtitle` "Remote"
- [x] 1.4 Manter nos itens locais a lógica existente de marcação `current`, `upstream` (title) e `branch-ab` (ahead/behind), e o handler `onClick` de checkout compartilhado
- [x] 1.5 Preservar a exibição de `error` do `useRepo()` no rodapé do painel

## 2. Estilizar grupos colapsáveis

- [x] 2.1 Adicionar em `src/App.css` estilos para o cabeçalho de grupo colapsável reutilizando os padrões visuais atuais (sidebar 11px uppercased, `--text-dim`, `--panel-2` no hover) com a seta de estado expandido/recolhido
- [x] 2.2 Verificar que itens de branch não sofreram regressão visual (padding/border-radius intactos)

## 3. Verificar

- [x] 3.1 Rodar `npm test` para garantir que os testes de `LeftPane`/`CommitGraph` (se houver) e demais continuam passando
- [x] 3.2 Rodar `npm run build` (ou `tsc`) para confirmar tipagem sem erros com a refatoração

## 4. Corrigir classificação de branches remotas (backend)

- [x] 4.1 Em `src-tauri/src/git/refs.rs`, alterar `list_branches` para emitir `%(refname)` completo (não `%(refname:short)`) e classificar `kind` por `full.starts_with("refs/remotes/")`, derivando o nome curto via `strip_prefix`
- [x] 4.2 Adicionar teste de regressão `list_branches_classifies_remote_tracking_as_remote` em `refs.rs` que cria um bare remote, faz push de `main` e asserta `origin/main.kind == "remote"` e `main.kind == "local"`
- [x] 4.3 Rodar `cargo test` na crate `src-tauri` (31 passing) e aplicar `cargo fmt` aos trechos alterados