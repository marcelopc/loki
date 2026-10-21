# Proposal

## Why

Hoje as listas de arquivos modificados (staged/unstaged/untracked) ficam no painel esquerdo junto das branches, enquanto o painel direito mistura o formulário de commit com o diff. O fluxo stage → commit fica espalhado entre painéis. Reorganizar o painel direito como um painel de commit dedicado — com as seções Unstaged, Staged e o campo de mensagem — e mover o diff para o centro segue o padrão GitKraken, concentrando todo o fluxo de commit em um só lugar.

## What Changes

- Painel direito dedicado ao commit, com 3 áreas empilhadas: **Unstaged**, **Staged** e **formulário de commit** (summary).
- Arquivos **untracked** deixam de ter seção própria e passam a ser agrupados na seção **Unstaged**, com marcador distinto (ícone "U").
- A lista de changes sai do painel esquerdo; ele passa a conter apenas branches.
- O diff do arquivo selecionado move para o centro, abaixo do grafo de commits.
- Ações stage/unstage por arquivo permanecem acessíveis nas seções Staged/Unstaged.
- O formulário de commit mantém a validação de mensagem vazia / sem nada staged, a contagem de arquivos staged no botão e o atalho Ctrl+Enter.
- Backend (Rust/Tauri) inalterado — reorganização restrita ao frontend.

## Capabilities

### New Capabilities

Nenhuma capability nova — a mudança reorganiza capacidade existente de listar mudanças e de commitar.

### Modified Capabilities

- `changes`: o requisito de listagem muda — as listas passam a ser apresentadas no painel de commit à direita em duas seções (Staged/Unstaged), e arquivos untracked são agrupados na seção Unstaged com marcador distinto, em vez de seção própria.
- `commits`: novo requisito de apresentação — o painel de commit à direita é organizado em três seções empilhadas (Unstaged, Staged e formulário de commit), com contagem de arquivos staged no botão.
- `diff`: sem mudança de requisito — o comportamento do diff (escopo e renderização lado a lado) permanece igual; apenas a localização do contêiner muda (design, não spec).

## Impact

- **Frontend**
  - `src/App.tsx`: nova composição do workspace (esquerda = branches, centro = grafo + diff, direita = painel de commit).
  - `src/App.css`: layout de 3 colunas, com coluna central empilhando grafo e diff.
  - `src/components/LeftPane.tsx`: remove o `ChangesPanel` (mantém branches).
  - `src/components/CommitPanel.tsx` (novo): seções Unstaged/Staged + formulário de commit.
  - `src/components/DiffView.tsx`: passa a exposar apenas o diff, movido para a coluna central.
  - `src/components/GraphPane.tsx`: torna-se o contêiner central (grafo + diff abaixo).
  - `src/types.ts`: novo helper de agrupamento visual do painel (untracked → Unstaged).
- **Testes**: helper de agrupamento do painel (`statusSection` mantém os 3 estados de dado); testes de componentes dos painéis.
- **Backend**: nenhuma mudança (`get_status`, `stage_file`, `unstage_file`, `commit_all`, `get_diff` inalterados).
- **Dependências**: nenhuma nova.