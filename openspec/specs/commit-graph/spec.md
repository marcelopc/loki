# Commit Graph

## Purpose

Renderiza a lista de commits de um repositório como um grafo de ancestors em SVG (estilo GitKraken), com lanes coloridas por branch, dots de commits, badges para branches/tags/HEAD e seleção de um commit.

## Requirements

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
O sistema SHALL desenhar o grafo de ancestors em SVG numa **coluna de gráfico dedicada à esquerda da lista de commits**, atribuindo cada commit a uma lane (coluna vertical fixa) com cor estável por branch e conectando cada commit aos seus pais por arestas: **rails verticais estritos** dentro da coluna do grafo e **conexões de merge ortogonais (pontes horizontais curtas com cotovelos arredondados)** entre lanes, sem invadir o espaço da coluna de texto (mensagem/metadados). As coordenadas dos nós devem mapear `Y` à altura da linha da tabela e `X` ao índice da lane. A atribuição de lanes SHALL seguir a **ordem topológica (filhos antes dos pais)**, de modo que **cada branch ocupe uma única coluna fixa com linha contínua** (sem zig-zag entre lanes), com a **branch atual (HEAD) na coluna mais à esquerda**.

#### Scenario: Histórico linear
- **WHEN** o histórico é linear (cada commit tem um único pai)
- **THEN** o sistema desenha uma única linha vertical contínua dentro da coluna do grafo, com os dots alinhados à linha central de cada commit e sem sobrepor o texto

#### Scenario: Histórico com merges
- **WHEN** o histórico contém commits de merge com múltiplos pais em lanes distintas
- **THEN** o sistema desenha o commit de merge em uma lane existente e conecta cada pai por uma ponte horizontal curta (com cotovelo arredondado) entre as lanes, permanecendo dentro da coluna do grafo

#### Scenario: Overlay entre grafo e texto (regressão)
- **WHEN** a coluna de texto de um commit é desenhada
- **THEN** os elementos do grafo (dots, rails, pontes de merge) não se sobrepõem à mensagem nem aos metadados do commit

#### Scenario: Repositório com muitas branches
- **WHEN** o repositório tem um número de lanes que excederia a largura máxima reservada da coluna do gráfico
- **THEN** o sistema comprime ou limita as lanes dentro da largura máxima da coluna, mantendo as linhas verticais paralelas e o texto sem overlap

#### Scenario: Branch em coluna fixa (sem zig-zag)
- **WHEN** uma sequência de commits pertence à mesma branch (mesmo caminho de ancestrais)
- **THEN** todos os commits dessa branch são posicionados na **mesma coluna**, formando uma linha vertical contínua, sem saltos laterais entre lanes

#### Scenario: Branch atual na coluna mais à esquerda
- **WHEN** o grafo é renderizado
- **THEN** o commit apontado pelo HEAD (branch atual) ocupa a coluna mais à esquerda (índice 0), e as demais branches são distribuídas em colunas à direita

#### Scenario: Sem roubo de lane em merge
- **WHEN** um commit de merge possui múltiplos pais e a coluna à direita do primeiro pai já está ocupada por outra branch
- **THEN** cada pai adicional é posicionado em uma lane livre, sem sobrescrever a lane já atribuída a outra branch

### Requirement: Selecionar um commit
O sistema SHALL permitir selecionar um commit do grafo, destacando-o e disponibilizando seus dados (assunto, autor, data e mensagem completa) para exibição.

#### Scenario: Seleção de commit
- **WHEN** o usuário clica em um commit do grafo
- **THEN** o sistema destaca o commit e exibe seus detalhes, incluindo a mensagem completa

### Requirement: Suportar repositórios grandes
O sistema SHALL manter a renderização do grafo alinhada ao rolamento da lista de commits em repositórios com grande número de commits, renderizando apenas as linhas visíveis (virtualização) e o slice visível do SVG.

#### Scenario: Histórico com muitos commits
- **WHEN** o usuário rola a lista de um repositório com milhares de commits
- **THEN** os rails e dots do grafo permanecem alinhados à altura da linha de cada commit durante o scroll, e apenas os elementos visíveis são renderizados