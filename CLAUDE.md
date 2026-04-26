a cada fase completada, me traga a frase para colar no commit no vscode

# COFIT Task Manager — Contexto para o agente executor

## Arquitetura geral

App React (sem build, CDN) em `index.html`. Backend Vercel Serverless Functions em `api/`. Banco Notion via API direta. IA via Anthropic Claude.

Leia `api/_notion.js` antes de qualquer mudança em parsing ou propriedades. Leia `api/_glossary.js` antes de tocar no glossário ou no ai-polish.

## Dois scopes: Trabalho e Pessoal

O app suporta dois workspaces completamente independentes:

### Trabalho
- Database Notion: env var `NOTION_DATABASE_ID_TRABALHO` (ou alias `NOTION_DATABASE_ID`)
- Glossário: siglas institucionais (SEFAZ-MS, COFIT, SAT, etc.)
- `ai-prioritize` **habilitado**
- Tags silenciosas: nenhuma por default
- Tom do ai-polish: linguagem corporativa/institucional

### Pessoal
- Database Notion: env var `NOTION_DATABASE_ID_PESSOAL`
- Glossário: entidades pessoais (pessoas, lugares, projetos domésticos)
- `ai-prioritize` **desabilitado** — retorna 400 se chamado com `scope=pessoal`
- Tags silenciosas: `["compras"]` por default — tasks com essa tag ficam ocultas no kanban e aparecem no painel Lista de Compras (🛒)
- Tom do ai-polish: direto, sem jargão corporativo, verbos no infinitivo simples

### Como o scope flui no código
- Frontend: estado `scope` em `localStorage` (`cofit-scope`). Toggle no header alterna; recarrega tasks ao mudar.
- GET `/api/tasks?scope=X`: `X` determina qual database Notion é consultado.
- POST `/api/tasks` body inclui `scope`.
- PATCH/DELETE `/api/tasks/:id`: sem scope — Notion identifica a página pelo ID.
- `/api/ai-polish` body inclui `scope` → adapta contexto e glossário.
- `/api/ai-prioritize` body inclui `scope` → rejeita com 400 se `scope=pessoal`.
- `/api/glossary?scope=X`: filtra entradas por Escopo (Trabalho/Pessoal/Ambos).

## Databases Notion (3 no total)

| Database | Env var |
|---|---|
| Tarefas Trabalho | `NOTION_DATABASE_ID_TRABALHO` |
| Tarefas Pessoal | `NOTION_DATABASE_ID_PESSOAL` |
| Glossário COFIT | `NOTION_DATABASE_ID_GLOSSARIO` |

## Padrão arquitetural a respeitar

- `buildProperties` e `parsePage` em `api/_notion.js`: **adicionar campos, nunca renomear ou remover**.
- `getGlossary(scope)` em `api/_glossary.js`: exportado e usado pelo `ai-polish.js` — não fazer fetch HTTP interno.
- Cache do glossário: Map em memória, TTL 5min, chave=scope. `invalidateCache(scope)` deve ser chamado em POST/PATCH/DELETE do glossário.
- Paginação Notion: máx 100 itens por query. Ver padrão implementado em `tasks.js`.
- Auth: todos os endpoints usam `requireAuth` de `api/_auth.js`.

## Features implementadas (histórico de fases)

- **Fase 1**: Suporte a dois scopes com databases separados e toggle no header
- **Fase 2**: Glossário migrado para Notion com cache e filtro por scope
- **Fase 3**: Editor de glossário no app (CRUD + atalho inline)
- **Fase 4**: ai-polish com contexto de projetos ativos e tasks concluídas recentes
- **Fase 5**: Campo `lastMovedAt` e badge visual de aging nos cards
- **Fase 6**: Lista de compras como view alternativa e tags silenciadas configuráveis
- **Fase 7**: Documentação, limpeza e polimento
