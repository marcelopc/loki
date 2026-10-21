# Diff

## Purpose

Renderiza diff lado a lado por arquivo para mudanças staged, unstaged e entre commits especificados, com hunks e números de linha alinhados, e placeholder para arquivos binários.

## Requirements

### Requirement: Exibir diff por escopo
O sistema SHALL retornar o diff de arquivos para um escopo específico — unstaged (worktree vs index), staged (index vs HEAD) ou entre dois commits — com hunks e linhas tipadas (contexto, adição, remoção).

#### Scenario: Diff unstaged
- **WHEN** o usuário solicita o diff de um arquivo modificado não staged
- **THEN** o sistema exibe o diff entre o working tree e o index, com hunks numerados e linhas de contexto/adição/remoção

#### Scenario: Diff staged
- **WHEN** o usuário solicita o diff de um arquivo staged
- **THEN** o sistema exibe o diff entre o index e o HEAD (`--cached`)

#### Scenario: Diff entre dois commits
- **WHEN** o usuário solicita o diff de um arquivo entre dois commits
- **THEN** o sistema exibe o diff entre esses commits

#### Scenario: Sem diferenças
- **WHEN** não há diferenças para o escopo solicitado
- **THEN** o sistema reporta diff vazio sem erro

### Requirement: Renderizar diff lado a lado
O sistema SHALL exibir o diff em duas colunas alinhadas por número de linha (antiga e nova), destacando adições em verde e remoções em vermelho, com cabeçalhos de hunk.

#### Scenario: Linhas adicionadas e removidas
- **WHEN** um arquivo tem trechos adicionados e removidos
- **THEN** o sistema renderiza duas colunas com números de linha corretos e coloração de adição/remoção alinhada por hunk

#### Scenario: Arquivo renomeado
- **WHEN** o diff envolve um rename
- **THEN** o sistema exibe o par de caminhos antigo → novo no cabeçalho do arquivo

### Requirement: Tratar arquivos binários e arquivos novos
O sistema SHALL detectar arquivos binários sem renderizar conteúdo textual e renderizar arquivos recém-adicionados totalmente como adições.

#### Scenario: Arquivo binário diferente
- **WHEN** um arquivo binário apresenta diferença no escopo
- **THEN** o sistema exibe um placeholder informando que é binário, sem hunks textuais

#### Scenario: Arquivo novo adicionado
- **WHEN** um arquivo é adicionado no escopo do diff
- **THEN** o sistema renderiza seu conteúdo como linhas de adição na coluna nova, sem coluna antiga

### Requirement: Fazer cache do diff por escopo
O sistema SHALL cachear o resultado do diff por chave de escopo (e arquivo) e invalidar o cache quando o estado do repositório muda.

#### Scenario: Diff solicitado repetidamente
- **WHEN** o usuário solicita o mesmo diff sem mudanças no repo
- **THEN** o sistema retorna o resultado em cache sem re-executar o git

#### Scenario: Invalidação após mudança
- **WHEN** o estado do repositório muda (commit, stage, checkout)
- **THEN** o sistema invalida o cache de diffs