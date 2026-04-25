# Plano de Desenvolvimento — Versão Pessoal do COFIT Task Manager

**Contexto para o agente executor:** este plano adiciona suporte a tarefas pessoais ao COFIT Task Manager (hoje só suporta trabalho). O app é React via CDN (sem build) em `public/index.html`, backend em Vercel Serverless Functions em `api/`, Notion como banco. Cada fase é autocontida e deve ser entregue com frase de commit no final. Leia `README.md` e `api/_notion.js` antes de começar qualquer fase para entender o padrão arquitetural.

**Princípio orientador:** a versão pessoal NÃO é um clone da de trabalho com outro database. Ela tem contexto de IA diferente, glossário próprio (de entidades, não de siglas), funcionalidades específicas (lista de compras, aging visual) e remove o que não faz sentido no pessoal (ai-prioritize).

**Arquitetura final esperada:**
- 2 databases Notion: tarefas-trabalho (existente) e tarefas-pessoal (novo).
- 1 database Notion adicional: glossário (com escopo Trabalho/Pessoal/Ambos).
- Seletor de workspace na interface (toggle Trabalho/Pessoal) que persiste em localStorage.
- Todas as chamadas de API carregam `scope=trabalho|pessoal` como query param.
- `ai-polish` adapta contexto/glossário/tom conforme scope; `ai-prioritize` permanece apenas para trabalho.

---

## Fase 1 — Setup dos databases Notion e seletor de workspace

**Objetivo:** permitir que o app aponte para um de dois databases (trabalho ou pessoal) conforme o scope selecionado, sem alterar nenhuma lógica de IA ainda. No fim desta fase, o usuário consegue alternar e ver dois kanbans completamente independentes, cada um com suas próprias tasks.

**Pré-requisito manual (o usuário faz, não o agente):**
1. Duplicar o database Notion atual, renomear para "Tarefas Pessoal". Garantir que a integration existente tenha acesso ao novo database.
2. Copiar o ID do novo database (32 chars da URL).
3. Adicionar no Vercel a env var `NOTION_DATABASE_ID_PESSOAL` com esse ID. Renomear opcionalmente `NOTION_DATABASE_ID` para `NOTION_DATABASE_ID_TRABALHO` para clareza (mas manter retrocompatibilidade aceitando ambos os nomes no código).

**Alterações de código:**

1. `api/_notion.js`:
   - Transformar `databaseId()` em `databaseId(scope)`. Se `scope === "pessoal"` retornar `process.env.NOTION_DATABASE_ID_PESSOAL`. Caso contrário (default ou `"trabalho"`) retornar `process.env.NOTION_DATABASE_ID_TRABALHO || process.env.NOTION_DATABASE_ID`.
   - Validar: se o env var correspondente estiver ausente, lançar erro claro (ex.: "NOTION_DATABASE_ID_PESSOAL não configurado").

2. `api/tasks.js`:
   - Ler `req.query.scope` (GET) ou `req.body.scope` (POST). Default: `"trabalho"`.
   - Usar `databaseId(scope)` em todas as chamadas.
   - No GET, a lógica de wake-snooze deve continuar funcionando por database (passa scope normalmente). 
   - No POST, persistir no database correto conforme scope.

3. `api/tasks/[id].js`:
   - PATCH e DELETE não precisam de scope porque o Notion identifica a página pelo ID — não importa de qual database ela é. Manter como está.

4. `api/ai-polish.js` e `api/ai-prioritize.js`:
   - Nesta fase, apenas aceitar `scope` no body e ignorar (pass-through). A lógica de adaptação vem nas fases 3 e 4. Isso garante que o frontend já pode enviar o parâmetro.

5. `public/index.html`:
   - Adicionar estado `scope` (default `"trabalho"`), persistindo em `localStorage` (chave `cofit-scope`).
   - Adicionar toggle no header do app. Duas opções visuais suficientes: botões pill "Trabalho" / "Pessoal", o ativo destacado. Mudança de scope força recarregar as tasks (limpar estado local e chamar `fetchTasks` de novo).
   - Todas as chamadas fetch para `/api/tasks`, `/api/tasks/:id`, `/api/ai-polish`, `/api/ai-prioritize` devem passar `scope` (query param em GET, body em POST/PATCH).
   - Título da aba do navegador pode refletir o scope ativo ("COFIT — Trabalho" / "COFIT — Pessoal") para evitar confusão entre abas.

**Validação manual ao final:**
- Trocar de Trabalho para Pessoal e criar uma task. Ela aparece só no database Pessoal do Notion.
- Voltar para Trabalho: tasks antigas continuam aparecendo, as criadas em Pessoal NÃO aparecem.
- Snooze/drag-and-drop funcionam em ambos os scopes independentemente.
- Recarregar a página mantém o scope selecionado.

**Frase de commit:**  
`feat: suporte a scope trabalho/pessoal com databases Notion separados e toggle no header`

---

## Fase 2 — Database de glossário no Notion e endpoint de leitura

**Objetivo:** migrar glossário de `api/glossary.js` (estático) para um database Notion, permitindo edição futura via app. Nesta fase só a LEITURA — edição vem na fase 3.

**Pré-requisito manual:**
1. Criar database Notion "Glossário COFIT" com schema:
   | Propriedade | Tipo | Obrigatória |
   |---|---|---|
   | Sigla | Title | Sim |
   | Significado | Rich text | Sim |
   | Escopo | Select (Trabalho, Pessoal, Ambos) | Sim |
2. Popular com as 13 entradas atuais de `glossary.js`, todas com Escopo = "Trabalho".
3. Conectar a integration ao novo database.
4. Adicionar env var `NOTION_DATABASE_ID_GLOSSARIO`.

**Alterações de código:**

1. Novo `api/glossary.js` (SUBSTITUI o atual):
   - `GET /api/glossary?scope=trabalho|pessoal`: retorna `{ contexto, glossario: [{sigla, significado}] }` filtrando por escopo (Trabalho ou Pessoal, mais Ambos em ambos os casos).
   - O campo `contexto` vira ESTÁTICO no código, mas DEPENDE do scope:
     - Trabalho: mantém o atual ("Auditor fiscal da Receita Estadual...").
     - Pessoal: "Uso pessoal de Rodrigo. Tarefas domésticas, financeiras pessoais, vendas de itens usados, manutenção da casa, saúde, família. Tom direto, sem jargão institucional. Não use linguagem corporativa ('alinhar', 'tratativa', 'demanda'). Mantenha verbos no infinitivo simples."
   - Implementar cache em memória com TTL de 5 minutos (Map simples com timestamp) para evitar hit no Notion a cada request de ai-polish. Chave do cache: scope.
   - Autenticação: usar `requireAuth` como os outros endpoints.

2. `api/ai-polish.js`:
   - Em vez de importar `{ contexto, glossario }` de `./glossary`, fazer um fetch interno (ou chamar função exportada do novo `glossary.js`) passando o scope recebido no body. **Recomendado:** exportar função `getGlossary(scope)` do próprio `api/glossary.js` e importar em `ai-polish.js`, evitando uma chamada HTTP interna.
   - Usar `contexto` e `glossario` retornados para o prompt, já adaptados ao scope.

**Atenção — retrocompatibilidade:**
- Se `NOTION_DATABASE_ID_GLOSSARIO` não estiver configurado, o endpoint retorna um fallback hardcoded com o glossário atual (Trabalho apenas). Isso evita que o app quebre em deploys parciais.

**Validação manual ao final:**
- `GET /api/glossary?scope=trabalho` retorna as 13 entradas originais.
- `GET /api/glossary?scope=pessoal` retorna vazio (ou entradas com Escopo=Ambos, se houver).
- Adicionar manualmente no Notion uma entrada com Escopo=Pessoal (ex.: "Isa" / "esposa" / Pessoal). Esperar 5 min OU reiniciar o dev server, confirmar que aparece em `?scope=pessoal`.
- `ai-polish` continua funcionando em Trabalho com o mesmo comportamento de antes.
- `ai-polish` em Pessoal não usa mais o glossário corporativo (validar criando task "comprar gramix" — não deve ganhar tag de trabalho nem contexto SEFAZ no polish).

**Frase de commit:**  
`feat: glossário migrado para database Notion com cache e filtro por scope`

---

## Fase 3 — Editor de glossário no app

**Objetivo:** permitir CRUD do glossário direto na interface, sem sair do app. Incluir botão "adicionar ao glossário" inline quando a IA sugerir tag que o usuário rejeita.

**Alterações de código:**

1. `api/glossary.js` (expandir):
   - `POST /api/glossary`: cria entrada. Body: `{ sigla, significado, escopo }`. Valida campos obrigatórios. Invalida cache.
   - `PATCH /api/glossary/:id` (novo arquivo `api/glossary/[id].js`): atualiza entrada. Invalida cache.
   - `DELETE /api/glossary/:id`: arquiva a página no Notion. Invalida cache.

2. `public/index.html`:
   - Botão no header (ícone de livro ou engrenagem) abre modal "Glossário".
   - Modal mostra tabela com 3 colunas (Sigla, Significado, Escopo) e ações inline (editar, deletar). Linha extra no final para "+ adicionar nova entrada".
   - Filtro no topo do modal: "Todos | Trabalho | Pessoal" (default: scope atual do app).
   - Ao salvar uma entrada, chamar o endpoint correspondente, recarregar a lista, mostrar toast de sucesso.
   - **Botão inline de atalho:** quando a IA sugere tags no modal de criar/editar task e o usuário rejeita (clica X na tag sugerida), aparece microlink "Adicionar 'X' ao glossário?". Clicar abre o modal do glossário com Sigla pré-preenchida e foco no campo Significado. Escopo pré-selecionado = scope atual.

**Detalhes de UX importantes:**
- Ao deletar entrada, confirmar com modal simples ("Arquivar 'XYZ'? Não aparecerá mais no glossário. Pode ser restaurada no Notion.").
- Ao editar entrada existente, o cache do backend precisa ser invalidado — garantir que POST/PATCH/DELETE invalidem antes de responder.
- Scope "Ambos" existe, mas na UI deixar claro que "Ambos" significa "aparece em Trabalho e em Pessoal". Tooltip ou label explicativo.

**Validação manual ao final:**
- Criar entrada nova via app aparece no Notion.
- Editar entrada existente reflete no Notion e no próximo `ai-polish`.
- Deletar entrada a remove do Notion (archived=true).
- Criar task com palavra incomum, rejeitar tag sugerida, clicar "Adicionar ao glossário" — modal abre pré-preenchido.
- Filtro por escopo funciona no modal.

**Frase de commit:**  
`feat: editor de glossário no app com CRUD e atalho inline de adição`

---

## Fase 4 — Adaptação do ai-polish ao contexto pessoal

**Objetivo:** tornar o polish realmente útil no pessoal, passando contexto de projetos ativos (tags recorrentes) e tasks concluídas recentes para enriquecer a sugestão de tags e a reescrita.

**Alterações de código:**

1. `api/ai-polish.js`:
   - Aceitar no body: `scope`, `title`, `description`, `existingTags`, `activeTasksByTag` (novo), `recentCompleted` (novo).
   - `activeTasksByTag`: objeto `{ tag: [titulos...] }` com as 3-5 tasks ativas mais recentes de cada tag. Permite à IA entender o projeto em andamento.
   - `recentCompleted`: array de `{ title, tags, completedAt }` das últimas 15-20 tasks concluídas nos últimos 30 dias.
   - Adicionar ao prompt duas seções condicionais (só se não vazios):
     - "Projetos ativos (tags com tasks em aberto):" listando cada tag com seus títulos.
     - "Concluídas recentemente (contexto de projetos em andamento):" listando títulos + tags + data.
   - Ajustar instruções do prompt para pessoal:
     - "Se esta task parece continuação de um projeto ativo listado, sugira a MESMA tag do projeto."
     - "Em scope pessoal, use `polishStrength: light` — só reescreva título/descrição se houver ganho claro de clareza. Caso contrário, mantenha o original."
     - "Em scope pessoal, NÃO force linguagem profissional."

2. `public/index.html`:
   - Antes de chamar `/api/ai-polish`, o frontend calcula `activeTasksByTag` a partir do estado local (tasks ativas do scope atual) e envia.
   - Para `recentCompleted`, filtrar tasks do estado local com `column === "Concluído"` e `completedAt` dentro dos últimos 30 dias, top 20 por `completedAt` desc. Enviar só campos necessários (title, tags, completedAt) para economizar payload.
   - **Importante:** hoje o GET de `/api/tasks` não traz concluídas antigas (filtro é `concluído hoje OU não concluído`). Para `recentCompleted` funcionar de verdade, criar endpoint auxiliar `GET /api/tasks/recent-completed?scope=X&days=30` que retorna tasks concluídas no período. Chamar esse endpoint uma vez ao carregar o app e cachear localmente. Não recarregar a cada polish (caro).

3. `api/tasks/recent-completed.js` (novo):
   - Query no Notion filtrando Status=Concluído e Concluído em >= hoje - 30 dias.
   - Retorna formato enxuto: `[{title, tags, completedAt, id}]`.
   - Respeita scope.
   - Autenticação padrão.

**Validação manual ao final:**
- Criar task em Pessoal "comprar caixa correios". Se já existe tag `venda-cadeira` com tasks ativas relacionadas, a IA deve sugerir essa tag.
- Criar task em Pessoal "comprar gramix". A IA não deve tentar reescrever muito nem usar tom corporativo.
- No Trabalho, o polish deve continuar funcionando como antes, agora com contexto adicional de projetos ativos (o que também melhora o trabalho).
- Performance: polish não pode ficar perceptivelmente mais lento. Se payload ficar grande, reduzir `recentCompleted` para top 10.

**Frase de commit:**  
`feat: ai-polish com contexto de projetos ativos e tasks concluídas recentes`

---

## Fase 5 — Aging visual via lastMovedAt

**Objetivo:** sinalizar visualmente cards parados há muito tempo, sem alterar ordem automaticamente. Funciona em ambos os scopes (útil no trabalho também).

**Alterações de código:**

1. Notion — adicionar propriedade manualmente em AMBOS os databases (trabalho e pessoal):
   - Nome: "Última movimentação"
   - Tipo: Date

2. `api/_notion.js`:
   - Em `buildProperties`, adicionar bloco para `lastMovedAt`:
     ```js
     if (task.lastMovedAt !== undefined) {
       props["Última movimentação"] = task.lastMovedAt ? { date: { start: task.lastMovedAt } } : { date: null };
     }
     ```
   - Em `parsePage`, adicionar `lastMovedAt: getDate(p["Última movimentação"])`.

3. `api/tasks.js` e `api/tasks/[id].js`:
   - Em qualquer PATCH que altere `column`, setar automaticamente `lastMovedAt = new Date().toISOString()`. Fazer isso no backend, não no frontend — fonte única da verdade.
   - Em POST (criar task), setar `lastMovedAt = createdAt` por default.
   - Edições de título/descrição NÃO atualizam `lastMovedAt`. Só movimentação de coluna (incluindo drag entre colunas e snooze/wake) conta.

4. `public/index.html`:
   - Para cada card, calcular `daysSinceLastMove = floor((now - lastMovedAt) / 1day)`.
   - Regras visuais (começar conservador, ajustar depois):
     - 0-7 dias: sem badge.
     - 8-14 dias: badge discreto "📅 Xd" em cinza claro no canto do card.
     - 15-30 dias: badge em amarelo/laranja.
     - 31+ dias: badge em vermelho claro + borda lateral vermelha no card.
   - Excluir da lógica de aging:
     - Cards com tag `compras` (a definir na fase 6) — lista de compras não é aging.
     - Cards com deadline futura próxima (prazo já é o sinal, aging é ruído).
     - Cards em Snooze (snooze é parado por design).
     - Cards Concluídos.

5. Migração one-shot para cards antigos:
   - Script standalone `scripts/backfill-last-moved.js` (pode rodar via `node scripts/...` local ou Vercel cron): para cada task sem `lastMovedAt`, setar = `createdAt`. Rodar uma vez por database, depois esquecer.

**Validação manual ao final:**
- Task criada agora tem `lastMovedAt = agora` e sem badge.
- Mover task entre colunas atualiza `lastMovedAt`.
- Editar título/descrição NÃO atualiza `lastMovedAt`.
- Simular: editar manualmente no Notion uma task para ter `lastMovedAt` de 20 dias atrás — o card deve aparecer com badge laranja.
- Cards com tag `compras` (mesmo parados) não mostram badge.

**Frase de commit:**  
`feat: campo lastMovedAt e badge visual de aging em cards parados`

---

## Fase 6 — Lista de compras como view alternativa e tags silenciosas

**Objetivo:** permitir que tasks com tag `compras` apareçam numa view de lista plana com checkboxes (não como cards no kanban), e generalizar com mecanismo de "tags silenciosas" configurável.

**Alterações de código:**

1. `public/index.html`:
   - Adicionar estado `silentTags` (array de strings, persistido em `localStorage` por scope — chave `cofit-silent-tags-trabalho` / `cofit-silent-tags-pessoal`).
   - Default em Pessoal: `["compras"]`. Default em Trabalho: `[]`.
   - Filtro aplicado ao render do kanban: ocultar tasks cuja `tags` contenha alguma tag de `silentTags`, a menos que o filtro "Mostrar silenciadas" esteja ativo.
   - Botão no header (ícone 🛒 ou similar) abre painel lateral/modal "Lista de Compras":
     - Renderiza tasks do scope atual com tag `compras` (ou tag configurada).
     - Formato: lista com checkbox à esquerda, título no meio, botão ✕ à direita.
     - Checkbox marca → move task para Concluído (e remove da lista).
     - Input no topo: "Adicionar item...". Enter cria task nova com tag `compras` automática. Sem polish de IA para itens de compras (é overkill). Opcional: passar por polish só se o input tiver > 10 palavras.
   - Agrupamento opcional: se houver sub-tags como `compras/jardim`, `compras/casa`, renderizar agrupado.

2. Configuração de tags silenciosas:
   - No modal de glossário (ou num modal separado "Configurações"), mostrar lista de tags em uso no scope atual com checkbox "silenciar no kanban". Estado lido/salvo em localStorage.

3. `api/tasks.js`:
   - Nenhuma alteração necessária — o filtro é frontend-only. Mas se a performance degradar com muitas tasks silenciadas, considerar parâmetro opcional `?excludeTags=compras` no GET para filtro server-side.

**Detalhes importantes:**
- Tag `compras` é convenção, não hardcoded. Ser configurável desde o início — mesmo que na prática só `compras` seja usada.
- Cards com tag silenciada continuam aparecendo no polish/IA como tasks ativas. Silenciar é visualização, não arquivamento.
- Ao marcar item de compra como concluído, ele deveria alimentar o `recentCompleted` da fase 4 normalmente (útil para a IA entender "comprou gramix ontem, hoje criou 'aplicar gramix no jardim'" e sugerir tag de projeto jardim).

**Validação manual ao final:**
- Criar task em Pessoal com tag `compras` — ela não aparece no kanban.
- Abrir lista de compras — ela aparece lá, com checkbox.
- Marcar checkbox move para Concluído; confirma no Notion.
- Adicionar "sabão em pó" via input da lista — cria task com tag `compras` e aparece na lista.
- Alternar "Mostrar silenciadas" no kanban — cards de compras aparecem temporariamente.
- Em Trabalho, nenhuma tag silenciada por default. Pode-se silenciar manualmente.

**Frase de commit:**  
`feat: lista de compras como view alternativa e tags silenciadas configuráveis`

---

## Fase 7 — Polimento, documentação e limpeza

**Objetivo:** deixar o código limpo, README atualizado e remover dívidas acumuladas das fases anteriores.

**Tarefas:**

1. `README.md`:
   - Atualizar seção "Propriedades esperadas no Notion Database" para refletir `Última movimentação`.
   - Documentar os 3 databases (Trabalho, Pessoal, Glossário) e todos os env vars.
   - Documentar o schema do database de glossário.
   - Adicionar seção "Workspaces" explicando toggle Trabalho/Pessoal.
   - Adicionar seção "Lista de Compras" explicando convenção de tag silenciosa.

2. `api/glossary.js`:
   - Remover fallback hardcoded da fase 2 se tudo está estável.
   - Revisar e centralizar a invalidação de cache.

3. `api/ai-prioritize.js`:
   - Confirmar que só é chamado em scope trabalho. Se o frontend chamar em pessoal por engano, retornar 400 com mensagem clara "ai-prioritize não disponível em scope pessoal".

4. Observações finais no CLAUDE.md:
   - Adicionar bloco sobre a existência dos dois scopes e qual é o contexto de cada um, para que o agente executor em sessões futuras já saiba.

5. Revisão de UX:
   - Garantir que toggle Trabalho/Pessoal tem cor/visual distinto o suficiente para o usuário sempre saber em qual scope está.
   - Considerar mudar cor de fundo sutil do app conforme scope (ex.: tom frio para trabalho, tom quente para pessoal).

**Frase de commit:**  
`chore: documentação, limpeza de fallbacks e polimento visual dos scopes`

---

## Notas transversais para todas as fases

**Sobre ambiente e deploy:**
- O projeto usa Vercel Serverless; `vercel dev` para local.
- Toda nova env var precisa ser adicionada tanto local (`.env`) quanto no Vercel (Settings → Environment Variables) antes do deploy da fase.
- Vercel faz deploy automático a cada push na main.

**Sobre o Notion:**
- Notion API aceita no máximo 100 itens por query — paginação já está implementada em `tasks.js`, replicar o padrão se precisar em novos endpoints.
- `archived: true` em PATCH é a forma de "deletar" via API — não há delete real.
- Rate limit do Notion é ~3 req/s por integration. Uso de cache em memória no backend é essencial para o glossário.

**Sobre retrocompatibilidade:**
- Em cada fase, garantir que o scope Trabalho continua funcionando idêntico. Todas as mudanças devem ser aditivas em relação ao que existe.
- Se o agente executor precisar mudar o schema de `buildProperties` ou `parsePage`, fazer sem remover campos — adicionar, nunca renomear.

**Sobre testes:**
- Não há suíte de testes automatizada. Validação é manual, seguindo o roteiro "Validação manual ao final" de cada fase.
- Sempre testar as duas pontas (Trabalho e Pessoal) após mudanças em código compartilhado.

**Sobre commits:**
- Cada fase = 1 commit (ou poucos, agrupados). Frase de commit já definida no final de cada fase.
- Se o agente precisar subdividir internamente, usar a frase final ao juntar.
