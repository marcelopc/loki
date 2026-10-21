# Spec Delta

## ADDED Requirements

### Requirement: Apresentar o painel de commit em três seções
O sistema SHALL apresentar o painel de commit à direita organizado em três seções empilhadas: **Unstaged**, **Staged** e o **formulário de commit** com o campo de mensagem (summary), nesta ordem.

#### Scenario: Painel de commit padrão
- **WHEN** um repositório está aberto com alterações no working tree
- **THEN** o painel de commit exibe, de cima para baixo, as seções Unstaged, Staged e o formulário de commit com o campo de mensagem

#### Scenario: Painel sem alterações
- **WHEN** o working tree está limpo
- **THEN** as seções Unstaged e Staged exibem estado vazio e o formulário de commit permanece visível desabilitado

#### Scenario: Contagem de arquivos staged no botão de commit
- **WHEN** há arquivos staged no painel
- **THEN** o botão de commit exibe a contagem de arquivos staged habilitando a ação de commit