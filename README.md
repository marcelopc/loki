# GUI-Git

O **GUI-Git** é um cliente desktop leve e rápido para gerenciamento e visualização de repositórios [Git](https://git-scm.com/), desenvolvido com [Tauri v2](https://tauri.app/) e [React 19](https://react.dev/). O projeto oferece uma experiência visual intuitiva para explorar o histórico de commits através de um grafo em SVG com colunas topológicas (estilo GitKraken), além de permitir inspeção de branches, revisão de diffs e criação de commits.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Setup](#instalação-e-setup)
- [Como Executar](#como-executar)
  - [Modo Desktop (Recomendado)](#modo-desktop-recomendado)
  - [Modo Web (Frontend Isolado)](#modo-web-frontend-isolado)
  - [Build de Produção](#build-de-produção)
- [Como Rodar Testes](#como-rodar-testes)
  - [Testes do Frontend](#testes-do-frontend)
  - [Testes do Backend (Rust)](#testes-do-backend-rust)
- [Arquitetura e Estrutura](#arquitetura-e-estrutura)
  - [Visão Geral](#visão-geral)
  - [Estrutura de Diretórios](#estrutura-de-diretórios)
- [Tech Stack](#tech-stack)
- [Workflow de Desenvolvimento](#workflow-de-desenvolvimento)
- [Configuração Recomendada da IDE](#configuração-recomendada-da-ide)
- [Contribuição](#contribuição)
- [Licença](#licença)

---

## Funcionalidades

- **Grafo de Commits SVG**: Renderização topológica de ancestrais com lanes dedicadas por branch, rails verticais contínuos e conexões de merge ortogonais com cantos arredondados.
- **Painel de Branches e Tags**: Navegação em árvore de branches locais e remotas, visualização de tags e indicação do HEAD ativo.
- **Status da Working Tree**: Monitoramento de arquivos modificados, adicionados, renomeados ou deletados, divididos entre áreas *staged* e *unstaged*.
- **Visualizador de Diffs**: Exibição detalhada de diffs unificados com numeração de linhas e estatísticas de adições e deleções.
- **Painel de Commit**: Criação de novos commits diretamente pela interface, com controle de staging de arquivos e mensagem de commit.
- **Sincronização em Tempo Real**: Monitor em segundo plano que detecta alterações externas feitas no repositório (ex.: via terminal) e atualiza a interface automaticamente.
- **Persistência de Sessão**: Reabertura automática do último repositório válido utilizado ao iniciar o aplicativo.

---

## Pré-requisitos

Antes de iniciar, certifique-se de possuir instalado em seu ambiente:

1. **[Git](https://git-scm.com/downloads)** (versão 2.30 ou superior recomendada): Usado pelo cliente backend para operações com o repositório.
2. **[Node.js](https://nodejs.org/)** (v20.x ou superior) e gerenciador de pacotes `npm`.
3. **[Rust](https://rustup.rs/)** (versão estável com suporte à edição 2024 e Cargo).
4. **Dependências do sistema para o Tauri v2**:
   - No Linux (Ubuntu/Debian):
     ```bash
     sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   - Para outros sistemas operacionais, consulte o [guia de pré-requisitos do Tauri](https://tauri.app/start/prerequisites/).

---

## Instalação e Setup

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/loki.git
   cd loki
   ```

2. Instale as dependências do frontend:
   ```bash
   npm install
   ```

3. Verifique o ambiente do Tauri:
   ```bash
   npm run tauri info
   ```

---

## Como Executar

### Modo Desktop (Recomendado)

Inicia o servidor de desenvolvimento do Vite junto com a janela nativa do Tauri (com hot-reload de frontend e compilação do Rust):

```bash
npm run tauri dev
```

### Modo Web (Frontend Isolado)

Caso queira testar ou inspecionar estilos do frontend diretamente no navegador (recursos que dependem dos comandos nativos Tauri retornarão fallback ou indisponibilidade):

```bash
npm run dev
```

O frontend estará disponível por padrão em `http://localhost:1420`.

### Build de Produção

Gera os binários e instaladores nativos do aplicativo em `src-tauri/target/release/bundle/`:

```bash
npm run tauri build
```

---

## Como Rodar Testes

O projeto conta com suítes de testes automatizados tanto no frontend quanto no backend.

### Testes do Frontend

Utiliza [Vitest](https://vitest.dev/) para validar tipos, algoritmos de renderização e componentes:

```bash
# Executa todos os testes unitários do frontend uma vez
npm test

# Executa em modo watch (re-executa em mudanças de arquivo)
npx vitest

# Executa um teste específico (ex.: CommitGraph)
npx vitest run src/components/CommitGraph.test.ts
```

### Testes do Backend (Rust)

Executa a suíte de testes unitários e de integração das rotas Tauri e comandos Git:

```bash
# Executa todos os testes do backend Rust
cargo test --manifest-path src-tauri/Cargo.toml

# Executa apenas um teste específico
cargo test --manifest-path src-tauri/Cargo.toml git::diff
```

---

## Arquitetura e Estrutura

### Visão Geral

O projeto segue a arquitetura de duas camadas integrada pelo Tauri:

```text
┌────────────────────────────────────────────────────────┐
│               Frontend (React 19 + TS)                 │
│  - RepoContext (Estado global da aplicação)            │
│  - GraphPane & CommitGraph (Grafo em SVG virtualizado) │
│  - LeftPane (Branches, Tags e Mudanças na Worktree)    │
│  - DiffView & CommitPanel (Diff unificado e commits)   │
└───────────────────────────┬────────────────────────────┘
                            │ IPC (Tauri Commands & Events)
┌───────────────────────────▼────────────────────────────┐
│                 Backend (Rust / Tauri v2)              │
│  - AppState & Persistência (tauri-plugin-store)        │
│  - Commands (repo, status, diff, graph, commit)        │
│  - Git Runner & Parsers (execução segura de comandos)  │
│  - External Poller (monitoramento de alterações)       │
└────────────────────────────────────────────────────────┘
```

### Estrutura de Diretórios

```text
.
├── src/                          # Código-fonte da interface (Frontend)
│   ├── assets/                   # Imagens e ícones estáticos
│   ├── components/               # Componentes React (GraphPane, DiffView, etc.)
│   ├── hooks/                    # Hooks reutilizáveis (ex.: useVirtual para virtualização)
│   ├── lib/                      # Funções auxiliares e wrappers de eventos Tauri
│   ├── state/                    # Contextos React (RepoContext)
│   ├── App.tsx                   # Layout principal e casca da aplicação
│   ├── main.tsx                  # Ponto de entrada do React
│   └── types.ts                  # Tipagens TypeScript compartilhadas
├── src-tauri/                    # Código-fonte nativo (Backend Rust)
│   ├── src/
│   │   ├── commands/             # Comandos Tauri invocáveis pelo frontend
│   │   │   ├── commit.rs         # Operações de commit e staging
│   │   │   ├── diff.rs           # Inspeção e parsing de diffs
│   │   │   ├── graph.rs          # Extração de histórico para o grafo
│   │   │   ├── repo.rs           # Abertura e persistência de repositórios
│   │   │   └── status.rs         # Status de working tree
│   │   ├── git/                  # Módulos de interação e parsing com o Git CLI
│   │   │   ├── diff.rs           # Parser de unified diff
│   │   │   ├── parse.rs          # Parser de commits e status porcelain
│   │   │   ├── refs.rs           # Leitura e resolução de branches e tags
│   │   │   └── run.rs            # Cliente executor de processos git
│   │   ├── lib.rs                # Inicialização de plugins, estado e rotas Tauri
│   │   ├── main.rs               # Ponto de entrada do executável nativo
│   │   └── state.rs              # Estrutura gerenciada de estado AppState
│   ├── Cargo.toml                # Dependências e metadados do projeto Rust
│   └── tauri.conf.json           # Configurações do Tauri (janelas, bundle, segurança)
├── openspec/                     # Especificações de design e requisitos orientados a spec
│   ├── config.yaml               # Configuração do OpenSpec
│   ├── specs/                    # Especificações por domínio (branches, diff, commits, etc.)
│   └── changes/                  # Histórico de propostas e tarefas de mudanças
├── package.json                  # Dependências e scripts do frontend
└── vite.config.ts                # Configuração do bundler Vite
```

---

## Tech Stack

| Tecnologia | Uso no Projeto | Documentação Oficial |
| :--- | :--- | :--- |
| [Tauri v2](https://tauri.app/) | Framework de desktop nativo e ponte IPC | [Tauri Docs](https://tauri.app/start/) |
| [Rust](https://www.rust-lang.org/) | Backend nativo, runner Git e parsing de dados | [Rust Documentation](https://www.rust-lang.org/learn) |
| [React 19](https://react.dev/) | Construção declarativa da interface de usuário | [React Documentation](https://react.dev/reference/react) |
| [TypeScript](https://www.typescriptlang.org/) | Tipagem estática no frontend | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) |
| [Vite 8](https://vite.dev/) | Bundler e servidor de desenvolvimento frontend | [Vite Guide](https://vite.dev/guide/) |
| [Vitest](https://vitest.dev/) | Framework de testes unitários do frontend | [Vitest Getting Started](https://vitest.dev/guide/) |
| [Git CLI](https://git-scm.com/) | Motor de controle de versão subjacente | [Git Reference Manual](https://git-scm.com/doc) |

---

## Workflow de Desenvolvimento

O projeto adota o fluxo de especificação contínua com **OpenSpec** (localizado no diretório `openspec/`). As mudanças na arquitetura, modelos de dados e novos requisitos são documentados através de especificações detalhadas por capacidade:

- `openspec/specs/repository/`: Operações de abertura, validação e persistência de repositórios.
- `openspec/specs/branches/`: Listagem, alternância e identificação de branches e referências.
- `openspec/specs/commit-graph/`: Regras de topologia, cálculo de lanes e renderização visual do grafo.
- `openspec/specs/changes/`: Monitoramento e detecção de alterações na pasta de trabalho.
- `openspec/specs/diff/`: Estrutura de dados e renderização de diffs.
- `openspec/specs/commits/`: Fluxo de staging e criação de commits.

---

## Configuração Recomendada da IDE

Para uma melhor experiência de desenvolvimento com Rust e TypeScript:

- **[VS Code](https://code.visualstudio.com/)** com as extensões:
  - **[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)**: Diagnósticos, templates e utilitários para projetos Tauri.
  - **[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)**: Suporte completo de linguagem, autocompletion e checagem de tipos para Rust.

---

## Contribuição

Contribuições são bem-vindas! Para contribuir com o projeto:

1. Crie uma branch com a sua feature ou correção:
   ```bash
   git checkout -b feature/minha-feature
   ```
2. Escreva testes automatizados cobrindo suas modificações.
3. Certifique-se de que todas as suítes de teste e verificações de tipo estejam passando:
   ```bash
   npm run build
   npm test
   cargo test --manifest-path src-tauri/Cargo.toml
   ```
4. Submeta suas alterações através de um Pull Request descrevendo o contexto e as mudanças realizadas.

---

## Licença

Este projeto é disponibilizado para fins educacionais e de estudo. Consulte os arquivos do repositório para detalhes adicionais de licença.
