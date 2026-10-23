# Sync

## Purpose

Operações de sincronização com o remoto — puxar alterações do upstream para a branch atual (pull) e enviar commits locais para o upstream (push) — com detecção de estado (sem upstream, nada a sincronizar, divergência/conflito) e atualização das branches e do histórico após cada operação.

## Requirements

### Requirement: Puxar alterações do upstream
O sistema SHALL puxar as alterações do upstream para a branch atual via `git pull`, integrando os commits remotos ao histórico local e atualizando o commit-graph e o estado ahead/behind das branches após a operação.

#### Scenario: Pull com commits novos no upstream
- **WHEN** o usuário executa pull em uma branch com upstream configurado e o upstream possui commits novos
- **THEN** o sistema integra os commits ao histórico local e atualiza o commit-graph, a lista de branches e o diff

#### Scenario: Pull sem alterações (up-to-date)
- **WHEN** o usuário executa pull em uma branch já sincronizada com o upstream
- **THEN** o sistema conclui sem erro e não altera o histórico nem o working tree

#### Scenario: Pull com conflito ou divergência
- **WHEN** o `git pull` falha por conflito de merge ou rejeição do remoto
- **THEN** o sistema não altera o estado da branch nem do working tree e exibe a mensagem de erro do git para o usuário

### Requirement: Enviar commits para o upstream
O sistema SHALL enviar os commits locais para o upstream da branch atual via `git push`, preservando o working tree e atualizando o estado ahead/behind das branches após a operação.

#### Scenario: Push com commits locais pendentes
- **WHEN** o usuário executa push em uma branch com upstream e commits locais ainda não enviados
- **THEN** o sistema envia os commits para o remoto e a branch passa a não estar à frente (ahead 0) depois do refresh

#### Scenario: Push sem nada a enviar
- **WHEN** o usuário executa push em uma branch sem commits locais pendentes
- **THEN** o sistema conclui sem erro e o estado da branch permanece inalterado

#### Scenario: Push sem upstream configurado
- **WHEN** o usuário executa push em uma branch sem upstream configurado
- **THEN** o sistema não envia nada e exibe erro orientando a definir o upstream (ex.: `git push --set-upstream`)

#### Scenario: Push rejeitado por divergência
- **WHEN** o remoto rejeita o push por divergência (non-fast-forward)
- **THEN** o sistema não força o push, não altera o estado local e exibe a mensagem de erro do git sugerindo puxar antes

### Requirement: Indicar quando a ação de sincronização não está disponível
O sistema SHALL desabilitar a ação de push quando a branch atual não tem upstream configurado ou não há nada a enviar, e indicar visualmente o estado de sincronização da branch (ahead/behind).

#### Scenario: Push desabilitado sem upstream
- **WHEN** a branch atual não possui upstream configurado
- **THEN** o sistema desabilita o botão de push e não oferece a ação

#### Scenario: Push esmaecido sem commits a enviar
- **WHEN** a branch atual possui upstream mas não está à frente (ahead 0)
- **THEN** o sistema indica visualmente que não há nada a enviar, sem bloquear a possibilidade de forçar o refresh

#### Scenario: Estado ahead/behind refletido
- **WHEN** a branch atual está à frente ou atrás do upstream
- **THEN** o sistema expõe a contagem ahead/behind obtida das branches para o usuário