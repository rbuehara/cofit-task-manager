# Implementação: correção da reordenação via campo `Ordem`

Contexto: COFIT Task Manager, React via CDN (`index.html` monolítico), backend Vercel + Notion API.
Este documento é a especificação final para implementação pelo Sonnet. A análise do problema está em `analise-reordenacao.md`.

---

## Decisões de design (já tomadas pelo Rodrigo)

1. **Abandonar swap de valores.** Adotar renumeração sequencial da coluna.
2. **`Ordem` é posição local à coluna**, não ranking global. Cada coluna tem sua própria sequência 1..N.
3. **Ao mover entre colunas, renumerar ambas as colunas** (origem e destino). Mantém o invariante "sempre 1..N contíguo por coluna".
4. **Badge permanece**, exibindo `task.ordem`, em cinza neutro (sem gradiente vermelho/amarelo/verde).
5. **Flag de concorrência** (`reorderingCol`) para bloquear cliques em voo na mesma coluna.
6. **Persistência otimizada**: só emite PATCH para tasks cujo valor de `ordem` efetivamente mudou.
7. **Sem rollback server-side complexo**: em caso de falha parcial do `Promise.all`, o próximo `fetchTasks` reconcilia. Documentar no código.

---

## Arquivos afetados

- `index.html` — única alteração necessária. Escopo:
  - Novo helper `renumberColumn(tasks, colName, newCardId)` (puro, sem side-effects).
  - Reescrita de `handleReorder`.
  - Reescrita de `handleMove` para renumerar origem e destino.
  - Estado novo `reorderingCol` (Set de nomes de coluna em operação).
  - Ajuste do `priBadge` para exibir `task.ordem` em cinza neutro.
- `api/_notion.js` — nenhuma alteração.
- `api/tasks/[id].js` — nenhuma alteração.

---

## Especificação detalhada

### 1. Helper `renumberColumn` (novo)

Função pura. Recebe a lista completa de tasks, o nome de uma coluna e o `newCardId` atual. Retorna:
- `updatedTasks`: nova lista completa com `ordem` atualizada para as tasks da coluna.
- `changed`: array de `{ id, ordem }` só das tasks cujo valor de `ordem` mudou (para PATCH).

Regras de ordenação (mesmas da `Column`):
- Se a task é `newCardId`, fica no topo (`ordem = 1`).
- Demais ordenadas por `ordem ASC`, `null` no fim. Empates e nulls: desempate por `createdAt ASC` (estável).
- Após ordenar, reatribui `ordem = 1, 2, 3...` sequencialmente.

**Pseudocódigo:**

```javascript
function renumberColumn(allTasks, colName, newCardId) {
  const colTasks = allTasks.filter(t => t.column === colName);
  const sorted = [...colTasks].sort((a, b) => {
    if (a.id === newCardId) return -1;
    if (b.id === newCardId) return 1;
    const oa = a.ordem ?? Infinity;
    const ob = b.ordem ?? Infinity;
    if (oa !== ob) return oa - ob;
    // desempate estável por createdAt
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
  const changed = [];
  const newOrderById = new Map();
  sorted.forEach((t, i) => {
    const newOrdem = i + 1;
    if (t.ordem !== newOrdem) changed.push({ id: t.id, ordem: newOrdem });
    newOrderById.set(t.id, newOrdem);
  });
  const updatedTasks = allTasks.map(t =>
    newOrderById.has(t.id) ? { ...t, ordem: newOrderById.get(t.id) } : t
  );
  return { updatedTasks, changed };
}
```

### 2. Estado novo `reorderingCol`

Adicionar no componente topo (onde `tasks`, `newCardId`, etc. estão):

```javascript
const [reorderingCol, setReorderingCol] = useState(new Set());
```

Uso: antes de cada operação de reordenação, verificar se a coluna está no Set. Se sim, ignorar clique. Adicionar no início, remover no fim (inclusive em caso de erro).

### 3. Reescrita de `handleReorder`

Substituir a função atual (linhas ~639-699) por:

```javascript
async function handleReorder(id, direction) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (reorderingCol.has(task.column)) return; // bloqueia cliques concorrentes

  // Ordena a coluna pela visão atual (mesma lógica do Column e do helper)
  const colTasks = [...tasks.filter(t => t.column === task.column)].sort((a, b) => {
    if (a.id === newCardId) return -1;
    if (b.id === newCardId) return 1;
    const oa = a.ordem ?? Infinity;
    const ob = b.ordem ?? Infinity;
    if (oa !== ob) return oa - ob;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });

  const idx = colTasks.findIndex(t => t.id === id);
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= colTasks.length) return;

  // Manipulação de array: remove e insere no novo índice
  const reordered = [...colTasks];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, moved);

  // Aplica nova ordem (1..N) em memória e identifica diffs
  const newOrderById = new Map();
  const changed = [];
  reordered.forEach((t, i) => {
    const newOrdem = i + 1;
    newOrderById.set(t.id, newOrdem);
    if (t.ordem !== newOrdem) changed.push({ id: t.id, ordem: newOrdem });
  });

  if (changed.length === 0) return; // nada a fazer

  // Snapshot para rollback local
  const prevOrderById = new Map(colTasks.map(t => [t.id, t.ordem]));

  // Atualiza estado local imediatamente
  setTasks(prev => prev.map(t =>
    newOrderById.has(t.id) ? { ...t, ordem: newOrderById.get(t.id) } : t
  ));

  // Marca coluna como em operação
  setReorderingCol(prev => { const s = new Set(prev); s.add(task.column); return s; });

  try {
    await Promise.all(
      changed.map(c => api(`/api/tasks/${c.id}`, { method: "PATCH", body: { ordem: c.ordem } }))
    );
  } catch (e) {
    // Rollback local. Obs: se algum PATCH tiver sucedido e outro falhado, o Notion
    // fica temporariamente inconsistente — o próximo fetchTasks reconcilia.
    setTasks(prev => prev.map(t =>
      prevOrderById.has(t.id) ? { ...t, ordem: prevOrderById.get(t.id) } : t
    ));
    setBanner({ type: "error", msg: "Erro ao reordenar", detail: e.message });
  } finally {
    setReorderingCol(prev => { const s = new Set(prev); s.delete(task.column); return s; });
  }
}
```

### 4. Reescrita de `handleMove`

A função atual (linhas ~598-608) só atualiza `column`. Precisa também:
- Atribuir `ordem` final na coluna de destino (fim da fila = N+1).
- Renumerar a coluna de origem para fechar o gap.
- Persistir os PATCHes de renumeração em paralelo com o PATCH de movimentação.

```javascript
async function handleMove(id, target) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.column === target) return; // nada a fazer
  if (id === newCardId) setNewCardId(null);

  const sourceCol = task.column;

  // Monta changes do move (column, timestamps, duration)
  const changes = { column: target };
  if (target === "Em andamento" && !task.startedAt) changes.startedAt = new Date().toISOString();
  if (target === "Concluído") {
    changes.completedAt = new Date().toISOString();
    changes.duration = calcDuration(task.startedAt || task.createdAt, changes.completedAt);
  }
  if (sourceCol === "Concluído" && target !== "Concluído") {
    changes.completedAt = null;
    changes.duration = null;
  }

  // Calcula nova ordem no destino: fim da coluna destino
  const destSize = tasks.filter(t => t.column === target).length;
  const movedOrdem = destSize + 1; // entra no fim
  changes.ordem = movedOrdem;

  // Snapshot para rollback
  const snapshot = tasks.map(t => ({ id: t.id, column: t.column, ordem: t.ordem,
    startedAt: t.startedAt, completedAt: t.completedAt, duration: t.duration }));

  // Aplica movimentação local
  let next = tasks.map(t => t.id === id ? { ...t, ...changes } : t);

  // Renumera coluna origem (fecha o gap). Não renumera destino:
  // a task acabou de entrar no fim com o valor correto, e as demais do destino
  // não mudam de posição.
  const { updatedTasks: nextAfterSourceRenum, changed: sourceChanged } =
    renumberColumn(next, sourceCol, newCardId);
  next = nextAfterSourceRenum;

  setTasks(next);

  // Monta lista de PATCHes: o move + renumerações da origem
  const patches = [
    api(`/api/tasks/${id}`, { method: "PATCH", body: changes }),
    ...sourceChanged.map(c =>
      api(`/api/tasks/${c.id}`, { method: "PATCH", body: { ordem: c.ordem } })
    ),
  ];

  try {
    await Promise.all(patches);
  } catch (e) {
    // Rollback total
    setTasks(prev => prev.map(t => {
      const snap = snapshot.find(s => s.id === t.id);
      return snap ? { ...t, ...snap } : t;
    }));
    setBanner({ type: "error", msg: "Erro ao mover tarefa", detail: e.message });
  }
}
```

**Observação importante para o Sonnet:** a função existente usa `updateLocal(id, changes)`. Se `updateLocal` faz mais do que `setTasks(prev => prev.map(...))`, preservar a semântica. Ler `updateLocal` antes de aplicar o patch.

### 5. Ajuste do `priBadge`

Substituir o bloco atual (linhas ~356-361) por:

```javascript
const priBadge = task.ordem != null ? (
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    borderRadius: "50%",
    fontSize: 10,
    fontWeight: 700,
    background: "#f1f5f9",
    color: "#64748b",
    border: "1.5px solid #cbd5e1",
    flexShrink: 0
  }}>{task.ordem}</span>
) : null;
```

Mudanças:
- Lê `task.ordem` em vez de `task.priority`.
- Cor fixa cinza neutro (sem gradiente baseado em valor).
- Guarda `!= null` em vez de truthy, porque `ordem = 0` seria falsy (não deve ocorrer, mas defensivo).

### 6. Quando chamar renumeração inicial?

Na primeira vez que o app abre após essa mudança, o Notion terá estado atual sujo (gaps, duplicatas, nulls). **Não implementar limpeza automática no load.** A renumeração natural acontece à medida que o usuário usa:
- Cada `handleReorder` renumera a coluna afetada.
- Cada `handleMove` renumera a coluna origem.

Se o Rodrigo quiser forçar limpeza imediata, ele pode arrastar/clicar ↑↓ uma vez em cada coluna. Alternativa futura: botão "Normalizar ordem" no header, que chama `renumberColumn` para cada coluna e persiste. **Não implementar agora.**

### 7. `handleAdd`

Não precisa alterar. A task nova entra em `Inbox` sem `ordem` definida — o `sort` coloca `null` no fim, e a primeira reordenação manual já a renumera. Se quiser ser mais limpo (opcional, não obrigatório): atribuir `ordem = tasks.filter(t => t.column === "Inbox").length + 1` antes de persistir.

---

## Testes manuais após implementação

1. Com Inbox em estado atual sujo (gaps, duplicatas), clicar ↑ numa task do meio. Verificar:
   - Badge visual reordena corretamente.
   - Após `fetchTasks` (reload), a coluna Inbox está com `ordem = 1, 2, 3...` contíguos.
2. Clicar ↑↑↑ rapidamente numa mesma task. Verificar: cliques em voo são ignorados (flag `reorderingCol`).
3. Mover task de Inbox para "A fazer". Verificar:
   - Task entra no fim de "A fazer" com `ordem` correto.
   - Coluna Inbox renumera para fechar o gap.
4. Abrir Notion. Conferir que valores de `Ordem` estão 1..N em cada coluna.
5. Badge: exibe número cinza neutro, sem gradiente. Corresponde à posição visual.

---

## O que NÃO muda

- Campo `Prioridade` (IA) permanece no Notion e no código. Remoção é Fase 3.7.
- `handlePrioritize` não é tocado.
- Schema do Notion não muda.
- Nenhuma alteração em `api/`.

---

## Frase para commit (após implementação completa)

```
fix(reorder): reescreve reordenação usando renumeração sequencial por coluna

- substitui swap de valores por renumeração 1..N local à coluna
- adiciona flag reorderingCol para bloquear cliques concorrentes
- handleMove agora renumera coluna origem ao mover entre colunas
- badge passa a exibir task.ordem em cinza neutro (sem gradiente)
- PATCHes otimizados: só persiste tasks cujo ordem efetivamente mudou
```
