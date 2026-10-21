# Proposal

## Why

O usuário quer interagir com Git por uma interface visual leve, parecida com o GitKraken (grafo de commits colorido por branch, painéis de mudanças e diff). Ferramentas comerciais (GitKraken/Fork) são pesadas ou fechadas; um GUI próprio, nativo e leve permite estudo e controle total do fluxo. O projeto nasce do zero em `/home/marcelo.carmo/Documentos/estudos/GUI-Git`.

## What Changes

Criação de um aplicativo desktop **GUI-Git**: Tauri v2 (Rust backend + WebView nativo) com frontend React + Vite (TypeScript).

- **Grafo de commits**: visualização estilo GitKraken em SVG, com lanes coloridas por branch, dots de commits, badges de branch/tag/HEAD. Suporta branches/merges/tags.
- **Abrir repositório**: seletor de pasta, validação de repo git, reabertura automática do último repo usado.
- **Mudanças (changes)**: lista de arquivos staged/unstaged/untracked, stage/unstage por arquivo, indicação de rename e binário.
- **Commit**: mensagem via formulário, commit apenas do que está staged, atualização automática após commit.
- **Branches**: listar branches (locais/remotas, com ahead/behind do upstream), criar e switch, checkout.
- **Diff**: diff lado a lado por arquivo (staged, unstaged e range entre commits), hunks com números de linha, placeholder para binários.
- **Tema dark** por padrão, layout de 3 painéis, leve (binário <5MB, deb <15MB).

**Fora de escopo (MVP):** rebase interativo, cherry-pick, stash, merge com resolução de conflito, push/pull de remotes avançados.

## Capabilities

### New Capabilities
- `repository`: abrir/selecionar um repositório git, obter o estado atual do repo (caminho, branch, HEAD) e reabrir o último usado. Modela e valida o contexto sobre o qual as demais capacidades operam.
- `commit-graph`: rendereirar a lista de commits com grafo de ancestors em SVG, referências (branches/tags/HEAD) decoradas e seleção de commit.
- `changes`: listar arquivos modificados com status de staged/unstaged/untracked, stage/unstage por arquivo e detecção de rename/binário. Fornece os arquivos alvo do diff.
- `commits`: criar commit com mensagem a partir do conteúdo staged, validando entrada e emitindo o novo HEAD/branch.
- `branches`: listar, criar e alternar (checkout) branches locais, com indicação do atual e dados de upstream.
- `diff`: renderizar diff lado a lado por arquivo para staged, unstaged e entre commits especificados, com hunks numerados e placeholder para binários.

### Modified Capabilities
<!-- Nenhuma existente no projeto (só scaffold no momento). -->

## Impact

- **Novo projeto em `../../gui-git/`** (Tauri v2 + React/TS Vite), criado via `create-tauri-app`.
- **Sistema (Ubuntu 22.04):** instalar `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `curl`, `wget`, `file` (dependência de build do Tauri; requer `sudo`).
- **Backend Rust:** `src-tauri/src/git/{run,parse,refs,diff}.rs` e `src-tauri/src/commands/{repo,graph,status,commit,diff}.rs`; integra com o CLI `git` do sistema via `std::process::Command` (sem libgit2).
- **Frontend:** `src/App.tsx`, `src/components/*`, `src/state/RepoContext.tsx`, tema dark via CSS vars.
- **Plugins Tauri v2:** `tauri-plugin-dialog` (seletor de pasta), `tauri-plugin-store` (last-repo). Ajustar `capabilities/default.json`.
- **Zero novas dependências de rede** além das do scaffold; parsing git via formatos NUL-separados.