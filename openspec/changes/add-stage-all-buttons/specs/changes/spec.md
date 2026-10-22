# Spec Delta

## ADDED Requirements

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