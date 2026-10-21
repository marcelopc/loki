# Spec Delta

## Purpose

Renderiza a lista de commits de um repositório como um grafo de ancestors em SVG (estilo GitKraken), com lanes coloridas por branch, dots de commits, badges para branches/tags/HEAD e seleção de um commit.

## ADDED Requirements

### Requirement: Exibir commits com dados do autor
O sistema SHALL listar os commits (todos os branches `--all`) com hash, pais, autor, data, assunto e referências, em ordem topológica (filhos antes dos pais), para o repositório aberto.

#### Scenario: Repositório com histórico
- **WHEN** existe um repositório aberto com commits
- **THEN** o sistema lista os commits ordenados filhos-antes-dos-pais com hash, assunto, autor e data

#### Scenario: Repositório vazio (sem commits)
- **WHEN** o repositório aberto não possui commits
- **THEN** o sistema exibe o estado de repositório sem histórico sem erro

### Requirement: Decorar commits com referências
O sistema SHALL exibir, por commit, badges das referências que o apontam: branches (locais/remotas), tags e HEAD.

#### Scenario: Commit com branch e tag
- **WHEN** um commit é apontado por uma branch e uma tag
- **THEN** o sistema exibe badges distintos para a branch e para a tag sobre esse commit

#### Scenario: Commit do HEAD atual
- **WHEN** um commit é o HEAD atual
- **THEN** o sistema exibe um badge HEAD sobre esse commit

### Requirement: Renderizar grafo de ancestors por lanes
O sistema SHALL desenhar o grafo de ancestors em SVG, atribuindo cada commit a uma lane com cor estável por branch e conectando cada commit aos seus pais por arestas coloridas.

#### Scenario: Histórico linear
- **WHEN** o histórico é linear (cada commit tem um único pai)
- **THEN** o sistema desenha uma única linha vertical contínua com dots por commit

#### Scenario: Histórico com merges
- **WHEN** o histórico contém commits de merge com múltiplos pais
- **THEN** o sistema desenha o commit de merge em uma lane existente e conecta cada pai em lanes distintas a ele

### Requirement: Selecionar um commit
O sistema SHALL permitir selecionar um commit do grafo, destacando-o e disponibilizando seus dados (assunto, autor, data e mensagem completa) para exibição.

#### Scenario: Seleção de commit
- **WHEN** o usuário clica em um commit do grafo
- **THEN** o sistema destaca o commit e exibe seus detalhes, incluindo a mensagem completa

### Requirement: Suportar repositórios grandes
O sistema SHALL manter usabilidade fluida em repositórios com grande número de commits, renderizando apenas as linhas visíveis (virtualização) e mantendo alinhado o grafo à lista.

#### Scenario: Histórico com muitos commits
- **WHEN** o repositório possui milhares de commits
- **THEN** o sistema renderiza apenas os commits visíveis na viewport, mantendo a rolagem fluida e o alinhamento do grafo correto