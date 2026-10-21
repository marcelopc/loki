# Spec Delta

## MODIFIED Requirements

### Requirement: Renderizar grafo de ancestors por lanes
O sistema SHALL desenhar o grafo de ancestors em SVG numa **coluna de gráfico dedicada à esquerda da lista de commits**, atribuindo cada commit a uma lane (coluna vertical fixa) com cor estável por branch e conectando cada commit aos seus pais por arestas: **rails verticais estritos** dentro da coluna do grafo e **conexões de merge ortogonais (pontes horizontais curtas com cotovelos arredondados)** entre lanes, sem invadir o espaço da coluna de texto (mensagem/metadados). As coordenadas dos nós devem mapear `Y` à altura da linha da tabela e `X` ao índice da lane.

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

### Requirement: Suportar repositórios grandes
O sistema SHALL manter a renderização do grafo alinhada ao rolamento da lista de commits em repositórios com grande número de commits, renderizando apenas as linhas visíveis (virtualização) e o slice visível do SVG.

#### Scenario: Histórico com muitos commits
- **WHEN** o usuário rola a lista de um repositório com milhares de commits
- **THEN** os rails e dots do grafo permanecem alinhados à altura da linha de cada commit durante o scroll, e apenas os elementos visíveis são renderizados