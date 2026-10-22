# Proposal

## Why

Adicionar arquivos ao stage um por um é tedioso quando há muitas alterações (ex.: um commit inicial após um scaffold). Botões de ação em massa ("stage all" / "unstage all") agilizam o fluxo de commit, reduzindo cliques repetitivos e o risco de esquecer um arquivo.

## What Changes

- Adicionar um botão **"Adicionar todos"** (stage all) com texto e cor verde na seção **Unstaged**, que move **todos** os arquivos unstaged/untracked para o index de uma vez.
- Adicionar um botão **"Tirar todos"** (unstage all) com texto e cor vermelha na seção **Staged**, que remove **todos** os arquivos staged do index de uma vez, preservando o conteúdo do working tree.
- Novos comandos Tauri `stage_all` e `unstage_all` no backend Rust, executando `git add --all` e `git restore --staged -- .` respectivamente.
- Atualizar o painel de commit (CommitPanel) para renderizar os botões de ação em massa nos cabeçalhos das seções como botões destacados (texto + cor sólida, usando os tons `--green`/`--red` do app), visíveis apenas quando a seção tiver arquivos.
- **Reorganizar o layout do painel de commit**: as três áreas **Unstaged**, **Staged** e **Commit** passam a ocupar, em conjunto, 100% do espaço vertical do painel, divididas em partes iguais (`flex: 1 1 0` cada), em vez de cada seção usar apenas a altura do conteúdo. A lista de arquivos de Unstaged/Staged passa a rolar internamente dentro do terço destinado a cada seção.
- Sem alterações no fluxo de stage/unstage individual, na detecção de renames/binários ou no diff.

## Capabilities

### New Capabilities
- _(nenhuma — as ações em massa e o layout estendem o comportamento da capacidade existente `changes`; não introduzem uma capacidade nova no sistema.)_

### Modified Capabilities
- `changes`: adiciona as operações em massa de stage/unstage como novos requisitos do comportamento existente de stage/unstage.

## Impact

- **Backend (Rust):** `src-tauri/src/commands/status.rs` — novos comandos `stage_all` e `unstage_all`; `src-tauri/src/lib.rs` — registrar os novos `#[tauri::command]`.
- **Frontend (React):** `src/components/CommitPanel.tsx` — botões em massa nos cabeçalhos das seções; `src/lib/tauri.ts` — wrappers `stageAll`/`unstageAll`.
- **Estilo (React):** `src/App.css` — `.commit-panel` (`height: 100%`), `.cp-section`, `.file-group` e `.commit-form` com `flex: 1 1 0` para dividir 100% do espaço vertical; scroll interno por seção.
- **Testes:** testes unitários dos novos comandos (backend) e dos novos controles (frontend, se cobertos pelo padrão existente).
- **Sem novas dependências.**