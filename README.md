# COFIT Task Manager

Kanban board sincronizado com Notion, com IA para melhoria de texto e priorização. Suporta dois workspaces independentes: **Trabalho** e **Pessoal**.

## Arquitetura

- **Frontend**: React via CDN (sem build step) — `index.html`
- **Backend**: Vercel Serverless Functions — `api/`
- **Banco de dados**: Notion (API direta) — 3 databases
- **IA**: Anthropic Claude (polish de texto + priorização)

## Workspaces (Trabalho / Pessoal)

O app suporta dois scopes independentes, cada um com seu próprio database Notion. O toggle no header alterna entre eles e persiste em `localStorage`.

- **Trabalho**: kanban padrão com glossário corporativo (siglas SEFAZ-MS), `ai-prioritize` habilitado, sem tags silenciosas por default.
- **Pessoal**: glossário com entidades pessoais, `ai-prioritize` desabilitado, tag `compras` silenciada por default (aparece na Lista de Compras, não no kanban).

Todas as chamadas de API carregam `scope=trabalho|pessoal` como query param (GET) ou campo no body (POST/PATCH).

## Lista de Compras e Tags Silenciosas

Tasks com determinadas tags podem ser ocultadas do kanban e exibidas num painel lateral dedicado (ícone 🛒 no header). A configuração é por scope e persiste em `localStorage`.

- **Default Pessoal**: tag `compras` é silenciada.
- **Default Trabalho**: nenhuma tag silenciada.
- O painel de Lista de Compras permite criar itens rapidamente (a tag silenciosa é adicionada automaticamente), marcar como concluído via checkbox e arquivar.
- Tags silenciosas são configuráveis via botão ⚙ Tags dentro do painel.

## Setup

### 1. Notion Integration

1. Acesse https://www.notion.so/my-integrations
2. Crie uma nova integration (Internal)
3. Copie o **Internal Integration Secret** → será o `NOTION_API_KEY`
4. Conecte a integration aos 3 databases (veja abaixo)

### 2. Databases Notion

São necessários 3 databases, todos conectados à mesma integration:

| Database | Env var | Descrição |
|---|---|---|
| Tarefas Trabalho | `NOTION_DATABASE_ID_TRABALHO` | Database principal (escopo profissional) |
| Tarefas Pessoal | `NOTION_DATABASE_ID_PESSOAL` | Database do escopo pessoal |
| Glossário COFIT | `NOTION_DATABASE_ID_GLOSSARIO` | Siglas/entidades para o ai-polish |

> **Retrocompatibilidade**: `NOTION_DATABASE_ID` (nome antigo) ainda funciona como fallback para o database de trabalho.

### 3. Variáveis de ambiente no Vercel

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NOTION_API_KEY` | Sim | Secret da Notion integration |
| `NOTION_DATABASE_ID_TRABALHO` | Sim | ID do database de trabalho (32 chars) |
| `NOTION_DATABASE_ID_PESSOAL` | Sim | ID do database pessoal (32 chars) |
| `NOTION_DATABASE_ID_GLOSSARIO` | Não* | ID do database do glossário |
| `NOTION_DATABASE_ID` | Não | Alias antigo para trabalho (fallback) |
| `ANTHROPIC_API_KEY` | Não** | API key da Anthropic |
| `AUTH_TOKEN` | Sim | Senha de acesso ao app |

*Sem o glossário configurado, o app usa um fallback hardcoded com as siglas de trabalho.
**Sem a key da Anthropic, o app funciona normalmente mas sem IA.

### 4. Deploy

```bash
git add -A
git commit -m "sua mensagem"
git push
```

Vercel faz deploy automático a cada push na main.

## Propriedades esperadas nos Databases de Tarefas

Os dois databases (Trabalho e Pessoal) devem ter o mesmo schema:

| Propriedade | Tipo | Obrigatória |
|---|---|---|
| Título | Title | Sim |
| Descrição | Rich text | Sim |
| Status | Select | Sim |
| Categoria | Multi-select | Sim |
| Prioridade | Number | Não |
| Ordem | Number | Não |
| Prazo | Date | Não |
| Criado em | Date | Não |
| Início execução | Date | Não |
| Concluído em | Date | Não |
| Justificativa IA | Rich text | Não |
| App ID | Rich text | Não |
| Tempo de execução | Rich text | Não |
| Aguardando | Rich text | Não |
| Snooze até | Date | Não |
| Última movimentação | Date | Não (Fase 5 — aging visual) |

Valores válidos para **Status**: `Inbox`, `A fazer`, `Em andamento`, `Concluído`, `Aguardando`, `Snooze`, `Algum dia`

## Schema do Database de Glossário

| Propriedade | Tipo | Obrigatória |
|---|---|---|
| Sigla | Title | Sim |
| Significado | Rich text | Sim |
| Escopo | Select (`Trabalho`, `Pessoal`, `Ambos`) | Sim |

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tasks?scope=trabalho\|pessoal` | Lista tarefas do scope |
| POST | `/api/tasks` | Cria tarefa (body: `{ ..., scope }`) |
| PATCH | `/api/tasks/:id` | Atualiza tarefa (scope desnecessário — Notion identifica pelo ID) |
| DELETE | `/api/tasks/:id` | Arquiva tarefa |
| GET | `/api/tasks/recent-completed?scope=X&days=30` | Tarefas concluídas nos últimos N dias |
| GET | `/api/glossary?scope=trabalho\|pessoal` | Retorna `{ contexto, glossario }` filtrado por scope |
| GET | `/api/glossary?scope=all` | Retorna todas as entradas (para o modal CRUD) |
| POST | `/api/glossary` | Cria entrada no glossário |
| PATCH | `/api/glossary/:id` | Atualiza entrada |
| DELETE | `/api/glossary/:id` | Arquiva entrada |
| POST | `/api/ai-polish` | Melhora texto + sugere tags (ambos os scopes) |
| POST | `/api/ai-prioritize` | Prioriza tarefas ativas (só scope trabalho) |

## Scripts utilitários

| Script | Descrição |
|---|---|
| `scripts/backfill-last-moved.js` | Preenche `Última movimentação` em tasks antigas (rodar uma vez por database) |
| `scripts/migrate-backlog-to-inbox.js` | Migra tasks com status `Backlog` para `Inbox` |
