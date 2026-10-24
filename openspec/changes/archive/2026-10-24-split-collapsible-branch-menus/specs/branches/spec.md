# Spec Delta

## MODIFIED Requirements

### Requirement: Listar branches
O sistema SHALL listar as branches locais e remotas do repositório em grupos separados e colapsáveis (Locais e Remotas), marcando a branch atual e fornecendo upstream e contagem ahead/behind para branches locais com upstream. Cada grupo possui estado de expansão/colapso independente, que prevalece sobre a exibição da listagem.

#### Scenario: Lista de branches com atual indicado
- **WHEN** há um repositório aberto com branches
- **THEN** o sistema lista as branches, destacando a atualmente selecionada

#### Scenario: Branch local com upstream
- **WHEN** uma branch local possui upstream configurado
- **THEN** o sistema exibe o upstream e o nº de commits à frente (ahead) e atrás (behind)

#### Scenario: Branches remotas
- **WHEN** o repositório possui branches remotas rastreadas
- **THEN** o sistema as lista em um grupo separado das locais

#### Scenario: Remote-tracking branch classificada corretamente
- **WHEN** o repositório possui uma remote-tracking branch (ex.: `refs/remotes/origin/main`, exibida como `origin/main`)
- **THEN** o sistema a classifica como `kind = "remote"` e a exibe no grupo "Remotas", não em "Locais"

#### Scenario: Grupos colapsáveis independentes
- **WHEN** o usuário recolhe o grupo Locais e o grupo Remotas está expandido
- **THEN** as branches locais ficam ocultas e as remotas permanecem visíveis, preservando o estado de cada grupo de forma independente

#### Scenario: Recolher grupo oculta suas branches
- **WHEN** o usuário recolhe um grupo de branches
- **THEN** o sistema oculta as branches daquele grupo, mantendo visível o cabeçalho do grupo para permitir reexpansão

#### Scenario: Expandir grupo reexibe branches
- **WHEN** o usuário expande um grupo previamente recolhido
- **THEN** o sistema reexibe as branches daquele grupo