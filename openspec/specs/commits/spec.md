# Commits

## Purpose

Cria commits a partir do conteúdo staged, com mensagem fornecida pelo usuário e validação de entrada, atualizando o HEAD e a branch atual após o sucesso.

## Requirements

### Requirement: Criar commit do conteúdo staged
O sistema SHALL criar um commit apenas com os arquivos já staged, a partir de uma mensagem fornecida, e retornar o hash criado e a branch/HEAD resultantes.

#### Scenario: Commit com arquivos staged
- **WHEN** o usuário fornece uma mensagem e há arquivos staged
- **THEN** o sistema cria o commit com esses arquivos e retorna hash, branch atual e novo HEAD

#### Scenario: Commit sem nada staged
- **WHEN** o usuário tenta commitar sem arquivos staged
- **THEN** o sistema não cria commit e reporta que não há alterações staged

#### Scenario: Commit após stage externo
- **WHEN** o usuário faz stage por terminal e commita pelo app
- **THEN** o sistema cria o commit com o conteúdo staged existente

### Requirement: Validar a mensagem de commit
O sistema SHALL rejeitar mensagens vazias (ou somente em branco) e não interpretar o texto da mensagem como opções do git.

#### Scenario: Mensagem vazia
- **WHEN** o usuário envia uma mensagem vazia ou de apenas espaços
- **THEN** o sistema rejeita o commit e exibe validação de mensagem obrigatória

#### Scenario: Mensagem iniciando com hífen
- **WHEN** o usuário fornece uma mensagem que começa com `-`
- **THEN** o sistema a trata como texto da mensagem e não como opção, criando o commit normalmente

### Requirement: Atualizar o estado após o commit
O sistema SHALL, após criar um commit, limpar a lista de staged e disparar a atualização do grafo, das mudanças e da branch atual.

#### Scenario: Atualização pós-commit
- **WHEN** um commit é criado com sucesso
- **THEN** o sistema limpa a lista staged, inclui o novo commit no grafo e reflete a branch atual atualizada

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