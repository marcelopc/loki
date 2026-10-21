# Spec Delta

## Purpose

Permite ao usuário selecionar e abrir um repositório git, obter o estado atual do repo (caminho, nome, branch, diretório de trabalho sujo) e reabrir automaticamente o último repo usado. Modela o contexto sobre o qual as demais capacidades operam.

## ADDED Requirements

### Requirement: Selecionar e abrir um repositório git
O sistema SHALL abrir um repositório a partir de uma pasta selecionada pelo usuário, validando que a pasta é um working tree git e armazenando o caminho canônico da raiz do worktree.

#### Scenario: Abre uma pasta git válida
- **WHEN** o usuário seleciona uma pasta que é um working tree git válido
- **THEN** o sistema abre o repositório, exibe nome e branch atual, e disponibiliza o caminho canônico da raiz do worktree

#### Scenario: Seleciona uma pasta que não é git
- **WHEN** o usuário seleciona uma pasta que não é um working tree git
- **THEN** o sistema exibe um erro claro e não altera o repositório aberto

#### Scenario: Seleciona uma subpasta dentro de um worktree git
- **WHEN** o usuário seleciona uma subpasta localizada dentro de um worktree git
- **THEN** o sistema resolve e abre a raiz do worktree, não a subpasta

### Requirement: Expor o estado atual do repositório
O sistema SHALL expor o caminho, nome, branch atual (ou HEAD detached), hash do HEAD e se o worktree está sujo.

#### Scenario: Repositório aberto
- **WHEN** existe um repositório aberto
- **THEN** o sistema retorna caminho, nome, branch atual, hash do HEAD e flag de worktree sujo

#### Scenario: Nenhum repositório aberto
- **WHEN** ainda não há repositório aberto no app
- **THEN** o sistema reporta ausência de repositório e exibe o estado vazio com ação de abrir

### Requirement: Reabrir o último repositório usado
O sistema SHALL persistir o caminho do último repositório aberto e reabri-lo automaticamente no próximo lançamento, se ele ainda for um repo git válido.

#### Scenario: Último repo ainda válido ao relançar
- **WHEN** o usuário fecha e reabre o app e o último repo ainda é um working tree git válido
- **THEN** o sistema abre esse repositório automaticamente sem interação

#### Scenario: Último repo inválido ao relançar
- **WHEN** o usuário fecha e reabre o app e o último repo não existe mais ou não é git
- **THEN** o sistema exibe o estado vazio com ação de abrir, e descarta o caminho inválido