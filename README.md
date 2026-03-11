# COFIT Task Manager v2.0

Kanban board sincronizado com Notion, com IA para melhoria de texto e priorização.

## Arquitetura

- **Frontend**: React via CDN (sem build step) — `public/index.html`
- **Backend**: Vercel Serverless Functions — `api/`
- **Banco de dados**: Notion (API direta)
- **IA**: Anthropic Claude (somente para polish de texto e priorização)

## Setup

### 1. Notion Integration

1. Acesse https://www.notion.so/my-integrations
2. Crie uma nova integration (Internal)
3. Copie o **Internal Integration Secret** → será o `NOTION_API_KEY`
4. No Notion, abra o database do COFIT Task Manager
5. Clique em `...` → `Connections` → conecte sua integration
6. Copie o ID do database da URL: `notion.so/SEU_WORKSPACE/DATABASE_ID?v=...`

### 2. Variáveis de ambiente no Vercel

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NOTION_API_KEY` | Sim | Secret da Notion integration |
| `NOTION_DATABASE_ID` | Sim | ID do database (32 chars) |
| `ANTHROPIC_API_KEY` | Não* | API key da Anthropic |

*Sem a key da Anthropic, o app funciona normalmente mas sem IA (polish de texto e priorização ficam indisponíveis).

### 3. Deploy

```bash
# No GitHub, substitua os arquivos do repositório por estes
git add -A
git commit -m "v2.0 — API direta Notion"
git push
```

O Vercel faz deploy automático a cada push.

## Propriedades esperadas no Notion Database

| Propriedade | Tipo | Obrigatória |
|---|---|---|
| Título | Title | Sim |
| Descrição | Rich text | Sim |
| Status | Select (Backlog, A fazer, Em andamento, Concluído) | Sim |
| Categoria | Multi-select | Sim |
| Prioridade | Number | Sim |
| Prazo | Date | Sim |
| Criado em | Date | Sim |
| Início execução | Date | Sim |
| Concluído em | Date | Sim |
| Justificativa IA | Rich text | Sim |
| App ID | Rich text | Sim |
| Tempo de execução | Rich text | Sim |

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tasks` | Lista todas as tarefas |
| GET | `/api/tasks?active=1` | Lista só tarefas não concluídas |
| POST | `/api/tasks` | Cria nova tarefa |
| PATCH | `/api/tasks/:id` | Atualiza tarefa |
| DELETE | `/api/tasks/:id` | Arquiva tarefa |
| POST | `/api/ai-polish` | Melhora texto + sugere tags |
| POST | `/api/ai-prioritize` | Prioriza tarefas ativas |
