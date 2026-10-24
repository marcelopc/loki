# Spec Delta

## Purpose
<!-- Capacidade existente: commit-graph. Delta para adicionar coluna de referências. -->

## ADDED Requirements

### Requirement: Exibir coluna de referências (branch/tag) como primeira coluna
O sistema SHALL exibir, no gráfico de commits, uma **coluna dedicada de referências** posicionada como **primeira coluna** da tabela — à esquerda do grafo SVG —, listando por commit, em largura fixa, a **primeira referência** que o aponta, com truncamento por ellipsis quando o nome exceder a largura da coluna. O nome da referência SHALL ser exibido em texto claro legível (não na cor do tipo); a diferenciação por tipo fica no ícone e no fundo/borda do chip.

#### Scenario: Commit com branch e tag
- **WHEN** um commit é apontado por uma branch e uma tag
- **THEN** a coluna de referências exibe a branch como primeira referência (prioridade HEAD > branch local > branch remota > tag; desempate pela ordem dos dados), em chip com ícone de branch local e fundo na cor da lane, truncada com ellipsis se exceder a largura fixa

#### Scenario: Commit do HEAD atual
- **WHEN** o commit é o HEAD atual apontado por uma branch
- **THEN** a coluna de referências exibe a branch atual (HEAD) como primeira referência daquele commit

#### Scenario: Commit com referência longa
- **WHEN** o nome da primeira referência excede a largura fixa da coluna
- **THEN** o nome é truncado com ellipsis e permanece alinhado à linha, sem quebrar o layout das demais colunas, e o `title` (tooltip) mostra o nome completo

#### Scenario: Commit sem referências
- **WHEN** um commit não possui nenhuma branch ou tag apontando-o
- **THEN** a coluna de referências permanece vazia para aquela linha, mantendo o alinhamento das demais colunas

#### Scenario: Alinhamento durante a rolagem (virtualização)
- **WHEN** o usuário rola a lista de commits de um repositório com muitos commits
- **THEN** a coluna de referências permanece alinhada à altura da linha de cada commit durante o scroll, sem descolar do grafo nem da mensagem

### Requirement: Ícone de tipo por referência e tracking branch local/remota
O sistema SHALL exibir, no chip da coluna de referências, um **ícone por tipo de referência**: laptop para branch local, ícone de forja (octocat) para branch remota, e símbolo para tag/HEAD. Quando um commit tiver uma **branch local e a branch remota correspondente** (tracking pair), o chip SHALL exibir **os dois ícones** (laptop + octocat) e o nome SHALL ser mostrado **sem o prefixo do remote** (ex.: `origin/feat/mdi-icons` → `feat/mdi-icons`).

#### Scenario: Branch local sem remota correspondente
- **WHEN** um commit é apontado apenas por uma branch local
- **THEN** o chip exibe apenas o ícone de laptop seguido do nome da branch

#### Scenario: Branch local com remota correspondente
- **WHEN** um commit é apontado por uma branch local e pela remota correspondente (ex.: `refs/heads/feat/mdi-icons` e `refs/remotes/origin/feat/mdi-icons`)
- **THEN** o chip exibe ambos os ícones (laptop + octocat) e o nome da branch sem o prefixo do remote, com tooltip listando os dois lados

#### Scenario: Branch local com `/` no nome não é confundida com remota
- **WHEN** uma branch local possui `/` no nome (ex.: `feat/mdi-icons`)
- **THEN** o sistema a classifica como branch local (não remota) e exibe o ícone de laptop — o backend usa `--decorate=full` para diferenciar exatamente `refs/heads/...` de `refs/remotes/...`

#### Scenario: Branch remota sem branch local correspondente
- **WHEN** um commit é apontado apenas por uma branch remota
- **THEN** o chip exibe apenas o ícone de forja (octocat) seguido do nome da branch sem o prefixo do remote

### Requirement: Chip de tag e branch local segue a cor da lane do commit
O sistema SHALL colorir o fundo e a borda do chip de **tag** e de **branch local** com a **cor da lane** daquele commit no grafo (mesma cor do dot/linha), reforçando a ligação visual entre a referência e a linha do gráfico. Refers remota e HEAD mantêm cores fixas.

#### Scenario: Tag em commit com lane colorida
- **WHEN** um commit é apontado por uma tag e possui uma lane colorida no grafo
- **THEN** o chip da tag usa a cor da lane como base do fundo/borda translúcidos

#### Scenario: Branch local em commit com lane colorida
- **WHEN** um commit é apontado por uma branch local e possui uma lane colorida no grafo
- **THEN** o chip da branch local usa a cor da lane como base do fundo/borda translúcidos

### Requirement: Remover badges inline de referências após a mensagem
O sistema SHALL **remover** os badges inline de branch/tag que eram exibidos após o subject do commit. A coluna de referências à esquerda passa a ser a única exibição das referências na lista de commits.

#### Scenario: Lista sem badges inline
- **WHEN** um commit possui referências
- **THEN** nenhum badge de referência é renderizado após a mensagem do commit; as referências aparecem apenas na coluna à esquerda

## MODIFIED Requirements

### Requirement: Decorar commits com referências
O sistema SHALL exibir, por commit, **na coluna de referências (à esquerda do grafo)**, um **chip** da referência principal que o aponta (branch local/remota, tag ou HEAD), com ícone por tipo e fundo na cor da lane para tag/branch local. O sistema SHALL **usar `git log --decorate=full`** para que o `%D` carregue nomes completos de referências (`refs/heads/...`, `refs/remotes/...`, `tag: refs/tags/...`), permitindo classificação exata entre branch local e branch remota mesmo quando o nome da branch contém `/`. Refers secundárias além da primeira SHALL NOT ser exibidas na linha (ficam no tooltip do chip).

#### Scenario: Commit com branch e tag
- **WHEN** um commit é apontado por uma branch e uma tag
- **THEN** o sistema exibe, na coluna de referências, um único chip para a referência de maior prioridade (a branch), com ícone e fundo na cor da lane — sem badges inline após a mensagem

#### Scenario: Commit do HEAD atual
- **WHEN** um commit é o HEAD atual apontado por uma branch
- **THEN** o sistema exibe um chip com a branch atual como primeira referência daquele commit

#### Scenario: Branch local com slash (ex.: feat/mdi-icons)
- **WHEN** o repositório possui uma branch local `feat/mdi-icons` e também a remota `origin/feat/mdi-icons`
- **THEN** o parser classifica a primeira como branch local e a segunda como remota, sem heurística baseada em `/` — o chip exibe laptop + octocat