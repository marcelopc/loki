# Spec Delta

## Purpose

Operações de stash — guardar temporariamente alterações do working tree (stash push) e restaurar a stash mais recente para o working tree (stash pop) — com tratamento de lista vazia, working tree limpo e conflitos na restauração.

## ADDED Requirements

### Requirement: Guardar alterações no stash
O sistema SHALL guardar as alterações do working tree em uma stash via `git stash push`, incluindo arquivos untracked, e limpar o working tree após guardar.

#### Scenario: Stash com alterações rastreadas e untracked
- **WHEN** o usuário executa stash com alterações rastreadas e/ou arquivos untracked no working tree
- **THEN** o sistema guarda tudo na stash e o working tree fica limpo, sem descartar as alterações

#### Scenario: Stash com working tree limpo
- **WHEN** o usuário executa stash sem alterações no working tree
- **THEN** o sistema não cria stash e exibe erro informativo de que não há o que guardar

### Requirement: Restaurar da stash
O sistema SHALL restaurar a stash mais recente para o working tree via `git stash pop`, removendo-a da lista de stashes ao aplicar com sucesso.

#### Scenario: Pop com stash disponível
- **WHEN** o usuário executa pop e existe pelo menos uma stash
- **THEN** o sistema aplica a stash mais recente ao working tree, remove-a da lista e atualiza o painel de alterações

#### Scenario: Pop com lista de stash vazia
- **WHEN** o usuário executa pop e a lista de stash está vazia
- **THEN** o sistema não faz nada e exibe erro informativo de que não há stash para restaurar

### Requirement: Restauração com conflito
O sistema SHALL preservar a stash quando a restauração encontra conflito com o estado atual do working tree e exibir a mensagem de erro do git.

#### Scenario: Pop com conflito no working tree
- **WHEN** o usuário executa pop e a restauração conflita com alterações já presentes
- **THEN** o sistema não remove a stash da lista e exibe o erro do git indicando o conflito