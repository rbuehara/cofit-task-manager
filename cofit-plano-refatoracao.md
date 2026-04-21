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

**Colunas atuais:** Backlog, A fazer, Em andamento, Concluído.

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

### Fase 1 — UI sem mexer no Notion (risco zero no banco)

- **1.1** ⚠️ PARCIAL — remover `maxWidth: 1320px` e `overflowX: auto` do container de colunas. Mudança foi feita por mim na pasta local antiga, mas não foi publicada no GitHub. **Precisa ser refeita na pasta nova clonada** (ver "Estado atual / próxima sessão" abaixo).
- **1.2** Colunas recolhíveis com pills. Inbox / A fazer / Em andamento sempre visíveis. Demais como pills clicáveis na barra superior, com contador. Estado em `localStorage`.
- **1.3** Card recém-criado destacado no topo do Inbox até mover/descartar. Botões de destino visíveis diretamente.
- **1.4** Botões de destino contextuais: sempre visíveis no Inbox (card fechado); só no hover/expandido nas outras.
- **1.5** Reordenação manual com botões ↑/↓ dentro de cada coluna.
- **1.6** Mobile: FAB pra criar, dropdown pra trocar coluna.

### Fase 2 — Schema do Notion

**Importante:** o Notion do app COFIT usa API direta com tokens, **não MCP**. Mudanças de schema em parte são automáveis via script, em parte precisam ser manuais na interface do Notion. Backup já foi feito.

- **2.1** Script Node que adiciona via API: campos `Snooze até` (Date), `Aguardando` (Rich text), `Ordem` (Number). Não toca no existente.
- **2.2** Rodrigo adiciona manualmente no select `Status` do Notion as opções: `Inbox`, `Aguardando`, `Snooze`, `Algum dia`. **Sem remover** o "Backlog" ainda. Passar instruções claras.
- **2.3** Script de migração: todas as tarefas com Status="Backlog" → "Inbox"; copia `Prioridade` para `Ordem`.
- **2.4** Só após validar 2.3, Rodrigo remove manualmente a opção "Backlog" do select.

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

**Última etapa confirmada:** Fase 0 completa. Backup OK (86 tarefas, `.json` guardado pelo Rodrigo).

**Bloqueio do fluxo de trabalho resolvido em parte:** a pasta local original (`cofit-task-manager-main`) foi baixada manualmente do GitHub (sem conexão git). Para publicar mudanças daqui pra frente:

- Rodrigo renomeou pasta original para `cofit-task-manager-main-OLD`.
- Rodrigo clonou o repositório pela primeira vez via VS Code (`Cmd+Shift+P` → `Git: Clone`) numa pasta nova `cofit-task-manager`.
- `.env` precisa ser recriado na pasta nova (não vai no GitHub, está no `.gitignore`).
- **Pendente ação do Rodrigo:** trocar no app Cowork qual pasta está selecionada — apontar para a nova clonada em vez da OLD, pra Claude passar a ver os arquivos certos.

**Fluxo de trabalho daqui pra frente (via VS Code):**
1. Claude edita arquivos na pasta (via ferramentas Edit/Write).
2. Rodrigo abre VS Code → Source Control (ícone de ramificação na lateral) → vê diff de cada arquivo alterado.
3. Escreve mensagem de commit, clica `Commit`, depois `Sync Changes` (push).
4. Vercel detecta o push e faz deploy automático em ~30s.
5. Rodrigo testa no navegador, dá feedback, próxima entrega.

**Próxima ação técnica (ao iniciar nova conversa):**

1. Confirmar que Cowork está apontando pra pasta clonada nova.
2. Reaplicar **Fase 1.1** na pasta nova:
   - Em `index.html`, remover `maxWidth: 1320, margin: "0 auto"` do container principal (buscar `maxWidth: 1320`).
   - Remover `overflowX: "auto"` do container de colunas (buscar `display: "flex", gap: 8, overflowX: "auto"`).
3. Rodrigo valida o primeiro ciclo commit→push→deploy pra confirmar que fluxo funciona.
4. Seguir pra Fase 1.2.

---

## Princípios a manter

- **Uma mudança por entrega.** Rodrigo testa antes da próxima.
- **Ordem: menos risco → mais risco.** UI pura antes de tocar no Notion.
- **Cada entrega tem teste explícito.** Claude descreve o que Rodrigo deve clicar pra validar.
- **Sem build step, sem framework novo.** React via CDN, um único `index.html`. Preservar simplicidade.
- **Dívida técnica paga-se cedo.** Se no caminho aparecer código feio/repetido, Claude avisa e propõe limpeza separada.
- **Constantes de estilo centralizadas** (preparando terreno pra Fase 5).
- **Estilo da interação:** Rodrigo pediu tom de conselheiro sênior — direto, analítico, orientado a decisão; verdade útil antes de conforto; apontar erros e riscos antes de complementar com sugestões; recomendação clara quando possível.
