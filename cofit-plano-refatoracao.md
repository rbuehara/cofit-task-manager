# COFIT Task Manager — Plano de Refatoração

Resumo da conversa de planejamento. Documento para ser usado como contexto ao iniciar nova conversa (Sonnet) de execução.

---

## Contexto do projeto

App pessoal do Rodrigo (Coordenador da COFIT, SEFAZ-MS) para gerenciar tarefas da coordenadoria. Kanban sincronizado com Notion.

**Stack:**
- Frontend: React via CDN (sem build step) — tudo em um único `index.html` (~586 linhas)
- Backend: Vercel Serverless Functions em `api/`
- Banco: Notion (API direta, autenticação por token nas env vars do Vercel)
- IA: Claude (Anthropic) — usada para polish de texto e priorização
- Deploy: Vercel automático a cada push no GitHub

**Colunas atuais:** Inbox, A fazer, Em andamento, Concluído, Aguardando, Snooze, Algum dia.

**Volume atual:** ~86 tarefas no database, ~19 ativas.

---

## Problemas diagnosticados

1. **Backlog sobrecarregado e poluído** — mistura 4 tipos diferentes de item: triagem nova, compromissos futuros, tarefas aguardando terceiros, ideias/"algum dia".
2. **Fluxo de criação ruim** — card novo cai no fim do Backlog, usuário precisa rolar pra encontrar e mover.
3. **Movimento entre colunas é indireto** — só setas de próximo/anterior status, não pula direto do Backlog pra "Em andamento".
4. **Coluna "Concluído" ocupa espaço e é pouco útil** — histórico pode ser consultado no Notion.
5. **Priorização por IA nem sempre faz sentido** — usuário discorda dos rankings e quer reordenar manualmente.
6. **Largura das colunas ruim em ultrawide** — app com `maxWidth: 1320px` desperdiça tela; no mobile, layout horizontal é incômodo.

---

## Decisões tomadas

### Nova estrutura de colunas

Seis colunas no total, mas apenas **três sempre visíveis**. As demais ficam como "pills recolhíveis" na barra superior, com contador, que o usuário expande quando precisa.

| Coluna | Sempre visível? | Função |
|---|---|---|
| **Inbox** | Sim | Triagem. Toda tarefa nova entra aqui. Renomeia o "Backlog" atual |
| **A fazer** | Sim | Compromissos ativos |
| **Em andamento** | Sim | WIP (sem limite — Rodrigo já naturalmente mantém pouco) |
| **Aguardando** | Recolhível | Travado por terceiro; campo obrigatório "aguardando o quê" (texto livre) |
| **Snooze** | Recolhível | Some da UI até data programada; volta pra Inbox no dia D |
| **Algum dia** | Recolhível | Ideias sem compromisso |

**Concluído:** sai como coluna do grid. Vira popover clicável no header ("X concluídas hoje"). Histórico completo fica no Notion.

**Pills recolhíveis:** estado de expansão persistido em `localStorage`. Um botão "Expandir todas / Recolher todas".

### Criação e movimentação

- **Card recém-criado** fica destacado no topo do Inbox **até ser movido ou descartado** (não some sozinho).
- **Botões de destino contextuais:** no Inbox, botões visíveis direto no card (Inbox é onde se faz triagem, ação é esperada). Nas outras colunas, botões no hover ou no card expandido. Card expandido mostra 3 destinos diretos (`A fazer`, `Em andamento`, `Concluído`) + "Mais..." pros raros (`Aguardando`, `Snooze`, `Algum dia`).
- **Mover para Aguardando ou Snooze** abre mini-prompt/modal pedindo a info complementar (texto ou data). Layout base do card não muda — a info aparece como sub-título discreto quando relevante.

### Ranking manual substitui IA de priorização

- Botão "Priorizar" da IA sai da tela principal (move pra settings, caso queira voltar a testar).
- Campo novo no Notion: `Ordem` (Number). Controla posição visual.
- `Prioridade` (atual) pode continuar existindo, mas sem uso na UI por ora.
- Reordenação manual com botões ↑/↓ na primeira entrega. Drag-and-drop só se a dor persistir (Fase 4).

### Layout responsivo

- **Desktop:** remover `maxWidth: 1320px`. Colunas ocupam tela inteira, cada uma com largura mínima. Em ultrawide (3440px), cada uma fica com ~500–850px dependendo de quantas estão expandidas.
- **Mobile:** layout dedicado. FAB (botão flutuante) pra criar tarefa. Dropdown no topo pra trocar coluna exibida. Sem scroll horizontal. Pills recolhíveis entram no mesmo dropdown.

### Outras decisões

- **Alerta visual em cards > 3 dias no Inbox** (borda/ícone, sem bloqueio).
- **Snooze volta pra Inbox no dia D** (força re-triagem).
- **"Algum dia"** cria e avalia em ~60 dias; se não usado, elimina.
- **Redesign visual fica por último** (Fase 5). Motivo: design serve funcionalidade; a estrutura muda nas Fases 1–3, redesenhar antes geraria retrabalho.

---

## Plano de execução (ordem e justificativa)

Execução **uma mudança por entrega**, Rodrigo testa antes da próxima. Rodrigo não é programador — entregas pequenas e reversíveis são obrigatórias. Código limpo, sem introduzir build step ou frameworks novos (preservar a simplicidade que tornou o app manutenível).

### Fase 0 — Preparação ✅ CONCLUÍDA

- **0.1** ✅ Script `scripts/backup-notion.js` criado, executado pelo Rodrigo, 86 tarefas salvas em `.json` local.
- **0.1b** ✅ `.gitignore` criado (protege `.env` e `backups/`).

### Fase 1 — UI sem mexer no Notion (risco zero no banco) ✅ CONCLUÍDA

- **1.1** ✅ Removidos `maxWidth: 1320px` e `overflowX: auto` — app usa largura total da viewport.
- **1.2** ✅ Coluna "Concluído" recolhível como pill no header com contador. Estado em `localStorage` (chave `cofit-collapsed`). Constante `COLLAPSIBLE_COLS` prepara extensão para as colunas novas da Fase 3.
- **1.3** ✅ Card recém-criado vai ao topo do Backlog com badge "NOVA" e botões diretos "A fazer" / "Em andamento". Destaque some ao mover.
- **1.4** ✅ Backlog: botões de destino sempre visíveis no card fechado. Outras colunas: setas no hover.
- **1.5** ✅ Reordenação manual com botões ↑/↓ no card fechado (Backlog sempre visível, outras no hover) e no expandido. Persiste via PATCH no campo `priority` do Notion. Dois PATCHes em paralelo com rollback em caso de erro.
- **1.6** ✅ Mobile (< 640px): header compacto, dropdown de coluna, uma coluna por vez, FAB fixo abre formulário direto. `maximum-scale=1.0` na meta viewport impede zoom automático do iOS em inputs.

### Fase 2 — Schema do Notion ✅ CONCLUÍDA

**Executada via MCP do Cowork (não via script Node).** Resultado idêntico ao planejado.

- **2.1** ✅ Campos `Snooze até` (Date), `Aguardando` (Rich text), `Ordem` (Number) adicionados via MCP.
- **2.2** ✅ Status novos adicionados via MCP: `Inbox` (amarelo), `Aguardando` (roxo), `Snooze` (cinza), `Algum dia` (rosa). "Backlog" preservado neste momento.
- **2.3** ✅ Migração Backlog → Inbox feita manualmente pelo Rodrigo no Notion (volume era pequeno). Zero tarefas restaram com Status="Backlog". Campo `Ordem` não foi populado em massa — será preenchido gradualmente pelo uso dos botões ↑/↓.
- **2.4** ✅ Opção "Backlog" removida do select via MCP. Schema final do Status: `A fazer`, `Em andamento`, `Concluído`, `Inbox`, `Aguardando`, `Snooze`, `Algum dia`.

### Fase 3 — Lógica das novas colunas

- **3.1** Código renderiza 6 colunas; 3 recolhidas por padrão.
- **3.2** Mover pra Aguardando abre mini-prompt ("aguardando o quê").
- **3.3** Mover pra Snooze abre mini-prompt (data). Filtro no GET oculta `Snooze até > hoje`.
- **3.4** Ao carregar o app, cards com Status="Snooze" e `Snooze até ≤ hoje` são automaticamente reatribuídos pra "Inbox".
- **3.5** Alerta visual em cards > 3 dias no Inbox.
- **3.6** Esconder coluna "Concluído"; contador clicável no header com popover das concluídas hoje.
- **3.7** Remover botão "Priorizar" da UI principal.

### Fase 4 — Opcionais (decidir quando chegar)

- **4.1** Drag-and-drop (se ↑/↓ incomodar).
- **4.2** Atalhos de teclado (1–6 pra mover).
- **4.3** Reavaliar "Algum dia" após ~60 dias.

### Fase 5 — Redesign visual

Aplicação de nova identidade visual usando a ferramenta de design do Claude. Só após estrutura e funcionalidade estabilizadas.

**Preparação que deve ser feita durante Fases 1–3:** manter disciplina na separação entre estrutura (JSX) e estilo (objetos de style + constantes `COL_ACCENT`, `TAG_COLORS` no topo do `index.html`). Não introduzir cores/valores inline espalhados — centralizar.

---

## Estado atual / próxima sessão

**Última etapa confirmada:** Fases 1 e 2 completas e validadas. Deploy funcionando via VS Code → GitHub → Vercel.

**Pasta de trabalho:** `cofit-task-manager` (clonada via git). O Cowork está apontado para ela. A pasta `cofit-task-manager-main` é uma cópia OLD sem git — ignorar.

**Fluxo de trabalho estabelecido (via VS Code):**
1. Claude edita `index.html` (e arquivos em `api/` quando necessário).
2. Rodrigo abre VS Code → Source Control → vê diff → escreve mensagem de commit → `Commit` → `Sync Changes`.
3. Vercel detecta o push e faz deploy automático em ~30s.
4. Rodrigo testa no navegador, dá feedback, próxima entrega.

**Estado do código relevante para a Fase 3:**

- **Status "Backlog" ainda hardcoded no código.** O `index.html` e os arquivos em `api/` ainda referenciam "Backlog" como valor padrão de status. A primeira entrega da Fase 3 deve substituir todas as ocorrências por "Inbox".
- **Campo `priority` vs `Ordem`:** A reordenação manual (↑/↓) usa o campo `Prioridade` do Notion. A Fase 3 deve migrar essa lógica para o campo `Ordem` recém-criado. `Prioridade` pode continuar existindo no schema, mas sem uso na UI.
- **`COLLAPSIBLE_COLS = ["Concluído"]`** — constante no topo do `index.html`. Na Fase 3 adicionar `"Aguardando"`, `"Snooze"`, `"Algum dia"` aqui.
- **`api/_notion.js`** — função `buildProperties` não conhece os campos novos (`Snooze até`, `Aguardando`, `Ordem`). Precisará ser atualizada para mapeá-los.
- **`api/tasks.js`** — o GET provavelmente não filtra cards de Snooze. Na Fase 3.3 deve excluir tarefas com `Status="Snooze"` e `Snooze até > hoje`.
- **Coluna "Concluído"** — ainda renderizada como coluna normal. A Fase 3.6 a transforma em popover no header.

**Próxima ação técnica (ao iniciar nova conversa):**

Iniciar **Fase 3**, entrega por entrega na seguinte ordem:

- **3.1a** — Substituir todas as ocorrências de "Backlog" por "Inbox" no código (`index.html` e `api/`). Tarefa cirúrgica e de risco zero — o Notion já não tem mais "Backlog".
- **3.1b** — Migrar lógica de reordenação de `priority`/`Prioridade` para `ordem`/`Ordem`. Atualizar `buildProperties` e `parsePage` em `api/_notion.js`, e os PATCHes de ↑/↓ no `index.html`.
- **3.1c** — Renderizar as 6 colunas no grid; adicionar `"Aguardando"`, `"Snooze"`, `"Algum dia"` ao `COLLAPSIBLE_COLS` (recolhidas por padrão).
- **3.2** — Mover para "Aguardando" abre mini-prompt ("aguardando o quê?"); salva no campo `Aguardando` do Notion.
- **3.3** — Mover para "Snooze" abre mini-prompt (data); salva em `Snooze até`. GET filtra cards com `Snooze até > hoje`.
- **3.4** — Ao carregar, cards com `Status="Snooze"` e `Snooze até ≤ hoje` são automaticamente movidos para "Inbox" via PATCH.
- **3.5** — Alerta visual (borda/ícone) em cards > 3 dias no Inbox.
- **3.6** — Coluna "Concluído" some do grid; contador clicável no header abre popover das concluídas hoje.
- **3.7** — Remover botão "Priorizar com IA" da UI principal.

---

## Princípios a manter

- **Uma mudança por entrega.** Rodrigo testa antes da próxima.
- **Ordem: menos risco → mais risco.** UI pura antes de tocar no Notion.
- **Cada entrega tem teste explícito.** Claude descreve o que Rodrigo deve clicar pra validar.
- **Sem build step, sem framework novo.** React via CDN, um único `index.html`. Preservar simplicidade.
- **Dívida técnica paga-se cedo.** Se no caminho aparecer código feio/repetido, Claude avisa e propõe limpeza separada.
- **Constantes de estilo centralizadas** (preparando terreno pra Fase 5).
- **Estilo da interação:** Rodrigo pediu tom de conselheiro sênior — direto, analítico, orientado a decisão; verdade útil antes de conforto; apontar erros e riscos antes de complementar com sugestões; recomendação clara quando possível.
