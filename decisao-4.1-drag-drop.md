# Decisão Fase 4.1 — Drag and Drop (adiada)

**Status:** decidido, **execução adiada para depois da Fase 5 (redesign)**.
**Motivo do adiamento:** prioridade no redesign visual; testar por mais tempo se a dor de reordenação/movimentação é real antes de gastar entrega em DnD.

---

## Decisão de design

**Implementar com HTML5 Drag and Drop nativo** (sem biblioteca externa).

### Por que HTML5 nativo (não SortableJS)

Contexto de uso do Rodrigo: mobile é raro e usado só para visualizar/incluir tasks. DnD em mobile é dispensável.

Com isso:

- **Zero dependência externa.** Sem CDN extra, sem risco de versão mudar, sem peso adicional no bundle.
- **Menos código.** ~60–90 linhas vs ~80–120 do Sortable.
- **Sem conflito React-vs-DOM.** Sortable manipula o DOM por fora do React; HTML5 nativo é só atributos e handlers React idiomáticos. Some uma categoria inteira de bug sutil.
- **Manutenção zero.** API HTML5 DnD é estável desde ~2010.

O contra clássico do HTML5 (não funciona em touch) **deixa de ser crítico** dado o uso real. Mantém-se ↑/↓ no mobile (que já existem) e DnD vira a ferramenta do desktop.

---

## Pré-requisito: refatorar `handleMove` para aceitar `targetIndex`

Hoje `handleMove` coloca a task sempre no fim do destino. DnD exige posição arbitrária no destino.

```javascript
async function handleMove(id, target, extraChanges = {}, targetIndex = null) {
  // Se targetIndex == null: comportamento atual (vai pro fim).
  // Se targetIndex != null: insere na posição e renumera DESTINO também
  //   (hoje só renumera origem; passa a renumerar ambos quando há targetIndex).
}
```

Os botões de destino existentes continuam chamando `handleMove(id, target)` sem o quarto parâmetro. Nada muda no comportamento atual. DnD passa o índice calculado a partir da posição Y do drop.

Essa refatoração é o primeiro passo da entrega — testável isoladamente passando `targetIndex` manualmente via console.

---

## Esboço de implementação

### 1. Estado novo no `App`

```javascript
const [dragging, setDragging] = useState(null); // { id, sourceCol }
const [dropTarget, setDropTarget] = useState(null); // { col, index } — para indicador visual
```

### 2. `TaskCard` — torna o card arrastável

```javascript
<div
  draggable={!editing && !isProc && !isNew}
  onDragStart={e => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id); // fallback Firefox
    onDragStart(task.id, task.column);
  }}
  onDragEnd={() => onDragEnd()}
  // ... resto do card
>
```

`onDragStart` e `onDragEnd` são novas props passadas via `Column` → `TaskCard`. No `App`, setam/limpam o state `dragging`.

### 3. `Column` — recebe drops e calcula índice de inserção

```javascript
<div
  onDragOver={e => {
    if (!dragging) return;
    e.preventDefault();              // CRÍTICO: sem isso, onDrop nunca dispara
    e.dataTransfer.dropEffect = "move";
    // Calcula índice baseado na posição Y do mouse dentro da lista
    const idx = computeDropIndex(e, sortedVisibleTasks);
    if (dropTarget?.col !== name || dropTarget?.index !== idx) {
      onDropTargetChange({ col: name, index: idx });
    }
  }}
  onDrop={e => {
    e.preventDefault();
    if (!dragging) return;
    const { id, sourceCol } = dragging;
    const { col: targetCol, index: targetIdx } = dropTarget;
    onDropTask(id, sourceCol, targetCol, targetIdx);
  }}
>
```

`computeDropIndex(e, tasks)`: itera os cards renderizados, compara `e.clientY` com o `getBoundingClientRect().top + height/2` de cada um. Retorna o primeiro índice cuja metade está abaixo do cursor. Se nenhum, retorna `tasks.length` (drop no fim).

### 4. Indicador visual de drop

Renderizar uma linha fina (`<div style={{ height: 2, background: COL_ACCENT[col] }} />`) entre os cards na posição `dropTarget.index` quando `dropTarget.col === name`. Animação CSS opcional (transform/opacity).

### 5. `App.handleDrop` — orquestra

```javascript
function handleDrop(id, sourceCol, targetCol, targetIdx) {
  if (sourceCol === targetCol) {
    // Reorder dentro da mesma coluna: usa lógica de handleReorder generalizada
    handleReorderToIndex(id, targetIdx);
  } else {
    // Move entre colunas com posição: handleMove com targetIndex
    handleMove(id, targetCol, {}, targetIdx);
  }
  setDragging(null);
  setDropTarget(null);
}
```

Talvez valha extrair de `handleReorder` a lógica de "mover task X para índice Y na coluna" como helper, reutilizado tanto pelos botões ↑/↓ quanto pelo DnD.

### 6. Proteção contra concorrência

No início de `handleDrop`, checar `reorderingCol.has(targetCol) || reorderingCol.has(sourceCol)`. Se sim, ignorar o drop (visual feedback opcional: shake no card).

### 7. Mobile: desabilitar

`draggable={!isMobile && !editing && ...}`. `isMobile` já é detectado no app via media query / window width. DnD some no mobile, ↑/↓ continuam.

---

## Armadilhas conhecidas (vigiar na implementação)

1. **`onDragOver` exige `e.preventDefault()`** para `onDrop` disparar. Erro #1 e silencioso.
2. **`dragenter`/`dragleave` flicker:** filhos disparam eventos próprios. **Não usar essas para visual feedback.** Usar `onDragOver` calculando posição baseada em Y do mouse, como descrito acima.
3. **Autoscroll perto da borda da viewport:** Firefox não faz nativo; Chrome faz parcialmente. Para colunas com `overflowY: auto`, pode ser necessário implementar autoscroll manual no `onDragOver` da coluna se cursor estiver a < 40px do topo/fundo. Provavelmente dispensável no volume atual (~11 cards no Inbox cabem na tela).
4. **Ghost image padrão é meio feio.** Aceitar default OU customizar com `e.dataTransfer.setDragImage(node, x, y)`.
5. **Cursor não muda automaticamente.** Adicionar `cursor: grab` no card e `cursor: grabbing` durante drag (via classe).
6. **Conflito com `onClick` para abrir card.** Pequeno movimento durante drag pode disparar click no `dragend`. Mitigar checando se `dragging` foi setado: se sim, ignorar o próximo click. Ou usar threshold de movimento.

---

## Estimativa

Uma entrega. ~80 linhas de código novo + ~20 linhas de modificação em `handleMove` para suportar `targetIndex`. Sem alteração no Notion, sem alteração em `api/`.

---

## Critério para reabrir esta decisão

Após Fase 5 (redesign) e algumas semanas de uso. Perguntas para o Rodrigo se fazer:

- **Quantas vezes por dia preciso reordenar dentro de uma coluna?** Se < 2, talvez ↑/↓ baste e DnD não justifica entrega.
- **Quantas vezes movo entre colunas precisando de posição específica no destino?** É o caso "Inbox → posição 2 de Em andamento". Se raro, idem.
- **Os botões atuais incomodam o suficiente para valer 1 dia de implementação + risco de bug novo?** Sinceridade aqui — não implementar por implementar.

Se a resposta for "sim, vale a pena": executar conforme esboço acima.
Se for "↑/↓ basta": fechar 4.1 como "não será implementado" e remover do roadmap.
