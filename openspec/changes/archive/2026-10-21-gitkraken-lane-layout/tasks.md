# Tasks

## 1. Backend: ordenação topológica

- [x] 1.1 Em `gui-git/src-tauri/src/git/refs.rs`, adicionar `--topo-order` à chamada de `log_all` (`["log", "--all", "--topo-order", "--decorate", "--date=iso-strict", &fmt_arg]`). **Verificar:** `cargo build` compila sem erro e a assinatura de `log_all` não muda.
- [x] 1.2 Adicionar teste de integração em `refs.rs`: montar repo com uma branch e um merge `--no-ff` sob clock skew, e assertar que `log_all` segue exatamente a ordem `git rev-list --all --topo-order`. Nota: git `--topo-order` **não** garante crianças-estritamente-antes-dos-pais (pode mostrar um merge antes de um pai de linha antiga); por isso o teste compara contra o topo-order do git, que é a propriedade que o layout precisa. **Verificar:** `cargo test log_all_matches_topo_order` passa.
- [x] 1.3 Teste de regressão: assertar que o commit apontado pelo HEAD é o **primeiro** da lista no repo de teste (pré-requisito de "HEAD na coluna 0"). **Verificar:** `cargo test` roda a suíte inteira verde (24 passed, 0 failed).

## 2. Frontend: lane-assignment em coluna fixa

- [x] 2.1 Adicionar `vitest` como devDependency (`vitest@5.0.5`) e o script `"test": "vitest run"` em `gui-git/package.json`, mais `gui-git/vitest.config.ts` com `environment: "node"`. **Verificar:** `npm install` conclui (0 vulnerabilidades) e `npm test` executa.
- [x] 2.2 Reescrever `layoutCommits` em `gui-git/src/components/CommitGraph.tsx` conforme design D2 (claim-your-lane: procurar `node.hash` em `laneOwner`; liberar reservas duplicadas; 1º pai continua na lane; pais extras na 1ª lane livre à direita). Manter `PlacedCommit`/`color`/`row` e o resto do arquivo inalterado. **Verificar:** `npx tsc --noEmit` sem erro.
- [x] 2.3 Criar `gui-git/src/components/CommitGraph.test.ts` com nomes descritivos (pt-BR). Nota: o teste "mesma lane" original era inválido (reuso de lane faz commits não-adjacentes compartilharem coluna) — substituído por `não deve sobrescrever a lane de outra branch ao acomodar um merge`. **Verificar:** `npm test` → 10 testes passam.
- [x] 2.4 Teste de regressão do bug: com o fixture do repo real de 12 commits (4 merges, topologia first-parent-first), assertar `laneCount <= 4` e que a mainline permanece toda na coluna 0 — o algoritmo antigo dava 12 lanes. **Verificar:** teste passa; reverte se `layoutCommits` voltar à versão antiga.

## 3. Verificação de integração

- [x] 3.1 Atualizar as expectativas obsoletas de `gui-git/verify-graph-geometry.mts` para a saída do novo algoritmo (6-commit fixture → `[0,0,1,0,0,0]`, 2 lanes, gutter 60, laneWidth 22, x=19; rail `M 19 14 V 42`, cotovelo cross-lane `fba37cb→5ec127a`). **Verificar:** `npx tsx verify-graph-geometry.mts` → 19 PASS / 0 FAIL.
- [x] 3.2 Reescrever `gui-git/verify-lanecap.mts`: o fixture antigo de 15 branches era colapsado pelo novo algoritmo (não exercitava compressão); o script agora alimenta lanes sintéticas (2 e 15) diretamente em `graphMetrics`. **Verificar:** `npx tsx verify-lanecap.mts` → 7 PASS / 0 FAIL (15 lanes → gutter 120, laneWidth 6.93, dots em [8,112]).
- [x] 3.3 Build completo + suítes. **Verificar:** `npm run build` limpo; `npm test` → 10/10; `cargo test` → 24/24.
- [x] 3.4 Validação OpenSpec. **Verificar:** `openspec validate gitkraken-lane-layout` → válido.
- [x] 3.5 Verificação em repo real `/tmp/gkl-demo` (12 commits, 3 merges, múltiplas branches) usando a **ordem real** do backend (`--topo-order`) + **algoritmo real** (`layoutCommits`) via tsx: ASCII render confirma **mainline (c1..c4) toda na coluna 0**, cada branch em coluna fixa (feature-b → 1, nested → 3), **12→4 lanes**, sem zig-zag. **Verificar:** 5 PASS / 0 FAIL sobre o repo real (nenhum fixture manual).