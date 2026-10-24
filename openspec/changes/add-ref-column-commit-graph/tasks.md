# Tasks

## 1. Helpers de apresentação

- [x] 1.1 Criar `pickPrimaryRef(refs)` (prioridade head > branch > remote > tag, desempate pela ordem dos dados; `null` para lista vazia) em `src/components/GraphPane.tsx` (ou módulo utilitário testável) e verificar testes unitários de node passam
- [x] 1.2 Escrever testes para `pickPrimaryRef` cobrindo: commit sem refs (null), apenas branch, head > branch > tag, branch local > remota > tag, ref com `kind` inesperado (ficar atrás de tag) e verificar `pnpm test` passa

## 2. Coluna de referências no layout

- [x] 2.1 Inserir a coluna de referências como **primeira coluna** do `graph-canvas` (antes de `graph-gutter`), renderizando a primeira ref via `pickPrimaryRef` com prefixo visual por kind, e verificar a coluna aparece à esquerda do grafo na interface
- [x] 2.2 Adicionar classes CSS `.ref-column` (largura fixa, `flex: 0 0 auto`, `overflow: hidden`, `white-space: nowrap`, `text-overflow: ellipsis`) e prefixo visual por kind em `src/App.css`, e verificar nomes longos truncam com ellipsis e o `title` mostra o nome completo
- [x] 2.3 Garantir linha sem refs mantém a coluna vazia e alinhada (sem quebrar layout das demais colunas) e verificar visualmente commit sem refs não desloca subject/meta

## 3. Alinhamento e regressão

- [x] 3.1 Verificar que a coluna de refs permanece alinhada durante o scroll com virtualização (mesmo contêiner `graph-scroll`) e que o grafo SVG não sobrepõe a nova coluna
- [x] 3.2 Rodar a suíte completa (`pnpm test`) e garantir que nenhum teste existente de `layoutCommits`/virtualização quebre; ajustar fixtures de layout se necessário
- [x] 3.3 Validar a spec delta (`openspec validate --change add-ref-column-commit-graph`) e revisar o diff antes do commit (sem debug/console.log)