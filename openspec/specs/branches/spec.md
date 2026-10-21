# Branches

## Purpose

Lista branches locais e remotas com dados de upstream (ahead/behind do branch atual), permite criar uma branch (com switch) e alternar para uma branch existente (checkout).

## Requirements

### Requirement: Listar branches
O sistema SHALL listar as branches locais e remotas do repositório, marcando a branch atual e fornecendo upstream e contagem ahead/behind para branches locais com upstream.

#### Scenario: Lista de branches com atual indicado
- **WHEN** há um repositório aberto com branches
- **THEN** o sistema lista as branches, destacando a atualmente selecionada

#### Scenario: Branch local com upstream
- **WHEN** uma branch local possui upstream configurado
- **THEN** o sistema exibe o upstream e o nº de commits à frente (ahead) e atrás (behind)

#### Scenario: Branches remotas
- **WHEN** o repositório possui branches remotas rastreadas
- **THEN** o sistema as lista separadamente das locais

### Requirement: Criar uma branch e alternar para ela
O sistema SHALL criar uma branch com nome válido a partir do HEAD atual e alternar para ela (create + switch), rejeitando nomes inválidos.

#### Scenario: Criar branch válida com switch
- **WHEN** o usuário cria uma branch com nome válido ainda não existente
- **THEN** o sistema a cria a partir do HEAD e a ativa como branch atual

#### Scenario: Nome de branch inválido
- **WHEN** o usuário fornece um nome inválido (vazio, com espaços, iniciado com `-` ou já existente)
- **THEN** o sistema não cria a branch e exibe erro de validação

### Requirement: Alternar para uma branch existente
O sistema SHALL executar checkout para a branch selecionada, reportando a branch atual após a troca, e propagando erros quando o working tree limpo o impedir.

#### Scenario: Checkout com working tree limpo
- **WHEN** o usuário alterna para outra branch e o working tree está limpo
- **THEN** o sistema executa o checkout e marca a nova branch como atual

#### Scenario: Checkout bloqueado por working tree sujo
- **WHEN** o usuário alterna para outra branch e o working tree possui mudanças que conflitam
- **THEN** o sistema não o força e exibe o erro do git com a lista de arquivos que impedem o checkout