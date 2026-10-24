# Changes

## Purpose

Lista os arquivos modificados de um repositório com status de staged/unstaged/untracked, permite stage/unstage por arquivo e detecta renames e binários, fornecendo os arquivos-alvo do diff.

## Requirements

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

### Requirement: Fazer stage de todos os arquivos
O sistema SHALL mover todos os arquivos unstaged/untracked para o index (staged) de uma só vez via `git add --all`, quando o usuário acionar a ação em massa na seção Unstaged do painel de commit.

#### Scenario: Stage em massa com alterações pendentes
- **WHEN** a seção Unstaged contém um ou mais arquivos e o usuário aciona o botão de stage em massa
- **THEN** o sistema move todos os arquivos unstaged e untracked para a seção Staged em uma única operação

#### Scenario: Stage em massa com seção vazia
- **WHEN** a seção Unstaged está vazia
- **THEN** o sistema não exibe o botão de stage em massa

#### Scenario: Stage em massa sem alterações
- **WHEN** não há arquivos unstaged ou untracked no working tree
- **THEN** a operação de stage em massa não altera o index e não produz erro

### Requirement: Desfazer stage de todos os arquivos
O sistema SHALL remover todos os arquivos staged do index (unstaged) de uma só vez via `git restore --staged`, preservando as alterações do working tree, quando o usuário acionar a ação em massa na seção Staged do painel de commit.

#### Scenario: Unstage em massa com arquivos staged
- **WHEN** a seção Staged contém um ou mais arquivos e o usuário aciona o botão de unstage em massa
- **THEN** o sistema move todos os arquivos staged para a seção Unstaged em uma única operação, sem modificar o conteúdo do working tree

#### Scenario: Unstage em massa com seção vazia
- **WHEN** a seção Staged está vazia
- **THEN** o sistema não exibe o botão de unstage em massa

#### Scenario: Unstage em massa sem arquivos staged
- **WHEN** não há arquivos staged no index
- **THEN** a operação de unstage em massa não altera o index nem o working tree