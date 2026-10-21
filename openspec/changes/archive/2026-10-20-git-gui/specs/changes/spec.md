# Spec Delta

## Purpose

Lista os arquivos modificados de um repositório com status de staged/unstaged/untracked, permite stage/unstage por arquivo e detecta renames e binários, fornecendo os arquivos-alvo do diff.

## ADDED Requirements

### Requirement: Listar arquivos com estado de staged/unstaged/untracked
O sistema SHALL listar os arquivos modificados do working tree, classificando cada um como staged, unstaged, untracked e indicando o código de status por índice (index) e worktree.

#### Scenario: Arquivo modificado e não staged
- **WHEN** um arquivo rastreado é modificado mas não adicionado ao index
- **THEN** o sistema o lista na seção unstaged com código de status do index e do worktree

#### Scenario: Arquivo staged
- **WHEN** um arquivo é adicionado ao index
- **THEN** o sistema o lista na seção staged

#### Scenario: Arquivo novo (untracked)
- **WHEN** um arquivo não rastreado existe no working tree
- **THEN** o sistema o lista na seção untracked

#### Scenario: Sem alterações
- **WHEN** o working tree está limpo
- **THEN** o sistema lista nenhum arquivo e as seções de staged/untracked aparecem vazias

### Requirement: Fazer stage de um arquivo
O sistema SHALL mover um arquivo específico para o index (staged) via `git add` do caminho exato, sem afetar outros arquivos.

#### Scenario: Stage de arquivo específico
- **WHEN** o usuário faz stage de um arquivo listado como unstaged/untracked
- **THEN** o sistema o move para a seção staged e não altera o estado de outros arquivos

#### Scenario: Stage de caminho arriscado
- **WHEN** o caminho do arquivo é seguro de passar para o git
- **THEN** o sistema usa delimitação `--` para tratar nomes com caracteres especiais sem interpretá-los como opções

### Requirement: Desfazer stage de um arquivo
O sistema SHALL remover um arquivo específico do index (unstaged) via `git restore --staged`, sem afetar o conteúdo do working tree.

#### Scenario: Unstage de arquivo staged
- **WHEN** o usuário desfaz o stage de um arquivo staged
- **THEN** o sistema o move para a seção unstaged/branch e preserva as alterações do working tree

### Requirement: Detectar renames e arquivos binários
O sistema SHALL detectar renames (exibindo caminho antigo → novo) e marcar arquivos binários, sem tentar renderizar diff textual de binários.

#### Scenario: Arquivo renomeado
- **WHEN** um arquivo é renomeado no working tree
- **THEN** o sistema exibe o par de caminho antigo e novo

#### Scenario: Arquivo binário
- **WHEN** um arquivo alterado é detectado como binário
- **THEN** o sistema o marca como binário e não solicita diff textual