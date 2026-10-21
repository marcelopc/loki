# Spec Delta

## MODIFIED Requirements

### Requirement: Listar arquivos com estado de staged/unstaged/untracked
O sistema SHALL listar os arquivos modificados do working tree em um painel de commit dedicado à direita, apresentando-os em duas seções empilhadas — **Staged** e **Unstaged** — e agrupando arquivos untracked na seção **Unstaged** com marcador distinto, indicando o código de status por índice (index) e worktree.

#### Scenario: Arquivo modificado e não staged
- **WHEN** um arquivo rastreado é modificado mas não adicionado ao index
- **THEN** o sistema o lista na seção Unstaged do painel de commit, com código de status do index e do worktree

#### Scenario: Arquivo staged
- **WHEN** um arquivo é adicionado ao index
- **THEN** o sistema o lista na seção Staged do painel de commit

#### Scenario: Arquivo novo (untracked)
- **WHEN** um arquivo não rastreado existe no working tree
- **THEN** o sistema o lista na seção Unstaged do painel de commit com um marcador distinto de untracked

#### Scenario: Sem alterações
- **WHEN** o working tree está limpo
- **THEN** o sistema não lista arquivos e as seções Staged e Unstaged do painel de commit aparecem vazias