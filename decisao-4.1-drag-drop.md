# Fase 4 — Busca + DnD (plano de execução para sessão Sonnet)

**Status:** decidido, pronto para executar.
**Ordem:** 4.1 Busca primeiro. 4.2 DnD depois, numa segunda entrega.
**Princípio:** uma entrega por vez. Rodrigo testa a 4.1 antes de iniciar a 4.2. Sem introduzir build step nem dependência externa. Constantes centralizadas no topo do `index.html`.

---

## Contexto e histórico

A Fase 4.1 original planejava DnD e foi adiada (ver `analise-reordenacao.md` para o histórico do bug de reordenação que motivou a refatoração da 3.1b). Duas dores apareceram no uso real e justificam reabrir a fase:

1. **Não existe busca.** Com pills recolhíveis, `Ctrl+F` não ajuda — as tasks das colunas recolhidas estão fora do DOM. Achar uma task específica exige expandir pills e rolar.
2. **Reordenação por ↑/↓ é lenta.** Em colunas com muitos cards ou para mover entre colunas com posição específica, DnD ganharia.

O plano também corrige um problema de desenho: o badge numérico `Tarefa · NN` no topo do card mostra `task.ordem` (sequencial da coluna), mas a posição do card já transmite essa informação. Número visível é ruído — **remover**. O campo `Ordem` **permanece no Notion** como implementation detail.

---

## Entrega 4.1 — Busca entre tasks ativas

### Escopo

Campo de texto no header desktop filtra as colunas em tempo real. Match em `title + description + tags + aguardando`. Case-insensitive, sem diacríticos. Durante busca ativa, colunas recolhidas que tenham match são **temporariamente expandidas**; colunas sem match são escondidas para reduzir ruído. Ao limpar, restaura o estado prévio de colapso.

### Decisões de design

- **Client-side, sem API.** As tasks ativas já estão em `tasks` no state do `App`. Filtrar é um `.filter()` em memória. Zero latência, zero PATCH, zero carga no Notion.
- **Debounce 150ms.** Evita re-render a cada tecla em texto longo.
- **Match normalizado:** `s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()`. "itcd" bate em "ITCD", "publicacao" bate em "publicação".
- **Escopo do match:** `title`, `description`, `tags` (join com espaço), `aguardando`. **Não** incluir `reason` (campo da IA, ruído) nem datas.
- **Tasks "Concluído" ficam fora da busca por padrão.** Motivo: 90% das vezes você busca algo ativo. Se for necessário buscar no histórico, usa o Notion direto. Se o uso mostrar que atrapalha, reabre a decisão — trivial incluir depois.
- **Colunas recolhidas:** ao digitar, colunas que não estão na lista `collapsedCols` mas **teriam** match são forçadas a aparecer. As colunas em `collapsedCols` que têm match também aparecem. Ao limpar (input vazio ou Esc), o estado original de `collapsedCols` é restaurado. Implementação: salvar `collapsedCols` num ref antes de digitar; restaurar no clear.
- **Cards que não batem:** escondidos via filtro no `Column.visible` (não renderizar). Não apenas opacidade baixa — cognitivamente pior. O card simplesmente some da coluna durante a busca.
- **Contador:** ao lado do input, `"N encontradas"`. Se 0, mensagem discreta "nenhuma task encontrada" no lugar do grid.
- **Atalhos:** `/` ou `Ctrl+K` (desktop) foca o input. `Esc` limpa e desfoca.
- **Mobile:** botão 🔍 no header abre/fecha o input, que ocupa a largura toda. Mesma lógica de filtragem na coluna ativa do dropdown; colunas sem match no mobile continuam acessíveis pelo dropdown (o dropdown pode mostrar "(3)" apenas de tasks que batem).
- **Limpeza:** botão ✕ dentro do input quando há texto. Clicar limpa tudo.

### Arquivos e alterações

#### `index.html` — mudanças no `App` (state + lógica)

1. Novo state:
   ```js
   const [search, setSearch] = useState("");
   const [searchDebounced, setSearchDebounced] = useState("");
   const prevCollapsedRef = useRef(null); // snapshot de collapsedCols ao iniciar busca
   ```
2. Debounce (`useEffect` com `setTimeout` de 150ms em `search`).
3. Helper puro no topo do arquivo, fora do componente:
   ```js
   const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
   function taskMatches(task, query) {
     if (!query) return true;
     const q = norm(query);
     const haystack = [
       task.title,
       task.description,
       (task.tags || []).join(" "),
       task.aguardando,
     ].map(norm).join(" ");
     return haystack.includes(q);
   }
   ```
4. `filteredTasks`: `const filteredTasks = searchDebounced ? tasks.filter(t => t.column !== "Concluído" && taskMatches(t, searchDebounced)) : tasks;`
   - Quando busca vazia: usa `tasks` (comportamento atual, inclui "Concluído" com sua limitação de 5).
   - Quando busca ativa: exclui "Concluído" e filtra.
5. Recalcular `byCols` com `filteredTasks` em vez de `tasks`.
6. Efeito que abre colunas durante busca:
   ```js
   useEffect(() => {
     if (searchDebounced && prevCollapsedRef.current === null) {
       prevCollapsedRef.current = collapsedCols;
       // Expande todas: collapsedCols = [] força todas visíveis
       setCollapsedCols([]);
     } else if (!searchDebounced && prevCollapsedRef.current !== null) {
       setCollapsedCols(prevCollapsedRef.current);
       prevCollapsedRef.current = null;
     }
   }, [searchDebounced]);
   ```
   Ponto de atenção: durante busca o usuário **não deve** conseguir recolher colunas manualmente (quebraria a UX — ele escondeu algo que ele estava tentando achar). Forma simples: `onCollapse` é passado como `null` para todas as colunas quando `searchDebounced` é truthy. O header clicável e a seta `⟨` somem temporariamente.
7. Esconder pills das colunas recolhíveis no header durante busca ativa (elas não fazem sentido quando tudo está expandido).

#### Componente novo: `SearchInput`

Pequeno, fica no header. Props: `value`, `onChange`, `count`, `mobile`. Renderiza input + badge contador + botão ✕ quando há texto. Key handling: `Esc` chama `onChange("")`.

Esboço:
```jsx
function SearchInput({ value, onChange, count, mobile }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if ((e.key === "/" || (e.ctrlKey && e.key === "k")) && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape") { onChange(""); ref.current?.blur(); } }}
        placeholder="Buscar (/ ou Ctrl+K)..."
        style={{ /* usa AU.surface, AU.ink, borda AU.hair, padding 5px 28px 5px 10px, largura 220 no desktop, 100% no mobile */ }}
      />
      {value && (
        <>
          <span style={{ /* badge count à direita do input */ }}>{count}</span>
          <button onClick={() => onChange("")} style={{ /* ✕ absolute right */ }}>✕</button>
        </>
      )}
    </div>
  );
}
```

#### Posicionamento no header

- **Desktop:** entre o grupo de contadores (ativa / em andamento / concluídas hoje) e o `AddForm`. Mantém o header de uma linha só.
- **Mobile:** ícone 🔍 junto aos botões 🔄 ⚙️. Ao clicar, o header ganha uma segunda linha com o input em largura total. Segundo clique (ou Esc) oculta.

#### Estado vazio

Quando `searchDebounced` é truthy e `filteredTasks` é `[]`, substituir o grid por:
```jsx
<div style={{ textAlign: "center", padding: "60px 20px", color: AU.inkLow, fontSize: 14 }}>
  Nenhuma task encontrada para <strong style={{ color: AU.ink }}>"{searchDebounced}"</strong>
</div>
```

### Armadilhas a vigiar

1. **Foco do input durante digitação rápida:** o debounce não pode re-renderizar o `SearchInput` de um jeito que perca foco. Usar `useRef` para o input e isolar o componente ajuda.
2. **`/` e `Ctrl+K` com foco em input:** o handler precisa checar `document.activeElement.tagName` para não sequestrar `/` quando o usuário está digitando numa textarea.
3. **Restauração do `collapsedCols`:** se o usuário alterar as colunas via pill no header **durante** a busca (o fluxo sugerido é não deixar ele fazer isso, mas se deixar), a restauração pode sobrescrever a escolha. Decisão: durante busca, pills somem. Sem ambiguidade.
4. **Mobile + busca:** o filtro precisa ser aplicado sobre `byCols[mobileCol]`, não sobre um bypass. A mesma `filteredTasks` resolve.
5. **Card novo (`newCardId`):** se o usuário acabou de criar uma task e começa a buscar por outra, o card novo pode sumir. Aceitável — ele reaparece ao limpar a busca.

### Critério de aceitação (Rodrigo testa)

1. Digitar "itcd" com Inbox e "A fazer" visíveis, "Aguardando" recolhida. Todas as três passam a aparecer. Só os cards que contêm "itcd" ficam visíveis.
2. Limpar a busca. Volta ao estado anterior de colapso.
3. Digitar "claudia" (sem h). Bate em tasks com "Cláudia".
4. Pressionar `/` fora de qualquer campo. Foco vai para o input.
5. Pressionar `Esc` com foco no input e texto digitado. Limpa.
6. Busca vazia (string "xyzzy"). Mostra mensagem "Nenhuma task encontrada".

### Estimativa

~50 linhas novas + ~10 linhas de modificação. Uma entrega. Zero alteração em `api/`.

---

## Entrega 4.2 — Drag and Drop + remoção do número visual

### Escopo

1. **Remove o badge `Tarefa · NN`** do card (linha ~556 do `index.html`). Substitui por uma linha visualmente mais magra ou apenas a seta `▾` de expandir. `task.ordem` **continua existindo no state e no Notion** — some só da UI.
2. **Drag and Drop HTML5 nativo** entre cards (mesma coluna) e entre colunas visíveis. Mobile mantém ↑/↓ (HTML5 DnD não funciona em touch).
3. **Reutiliza `renumberColumn`** para recalcular `Ordem` após drop. Mantém a opção (b) da análise do Rodrigo: `Ordem` como detalhe interno, UI sem número.

### Decisões de design

- **HTML5 nativo (não SortableJS).** Já decidido anteriormente e confirmado: zero dependência externa, menos código, sem conflito React-vs-DOM. Trade-off conhecido (não funciona em touch) continua aceitável — mobile usa ↑/↓.
- **Drop target = coluna inteira, não card específico.** O índice de inserção dentro da coluna é calculado a partir da posição Y do mouse no `onDragOver`. Indicador visual (linha fina colorida com `COL_ACCENT[col]`) entre os cards.
- **Colunas recolhidas não aceitam drop.** Primeira entrega: a pill no header não é drop target. Se aparecer demanda depois, expandir a pill ao hover-during-drag é viável — mas complica e não está no escopo.
- **`handleMove` ganha parâmetro `targetIndex`.** Se `null` (botões atuais), task vai para o fim da coluna destino, comportamento atual preservado. Se número, insere na posição e renumera destino também.
- **Proteção contra concorrência:** drops em colunas com `reorderingCol.has(col)` ativa são ignoradas (com shake opcional no card). Já existe a flag.
- **Conflito com click para expandir card:** usar o padrão "threshold de movimento" — se o drag moveu mais de ~5px, suprimir o próximo `onClick` via ref. Alternativa mais simples: só setar `dragging` no primeiro `dragover` (não no `dragstart`), e ignorar click por 100ms após `dragend`.
- **Disabled em cards em edição, processando, ou recém-criados (`isNew`).** `draggable={!editing && !isProc && !isNew && !isMobile}`.

### Mudanças no `index.html`

#### 1. Remover badge numérico do card

Linha atual (~556):
```jsx
<span>Tarefa{task.ordem != null ? ` · ${String(task.ordem).padStart(2, "0")}` : ""}</span>
```
Passa a:
```jsx
<span>Tarefa</span>
```
(Ou remover a linha toda. Avaliar se o "TAREFA" em mono maiúsculo ainda tem função estética — provavelmente sim, dá assinatura Aurora; manter só o label.)

O campo `task.ordem` continua existindo no objeto e continua sendo usado em `Column.sort` e `renumberColumn`. Não mexer em nada mais.

#### 2. State novo no `App`

```js
const [dragging, setDragging] = useState(null); // { id, sourceCol }
const [dropTarget, setDropTarget] = useState(null); // { col, index }
const dragThresholdRef = useRef(false); // true se moveu mais que threshold durante drag
```

#### 3. Refatorar `handleMove` para aceitar `targetIndex`

```js
async function handleMove(id, target, extraChanges = {}, targetIndex = null) {
  // ... (código atual até a linha de ordem)

  // NOVO: se targetIndex !== null, insere na posição e renumera destino
  if (targetIndex !== null) {
    // Aplica movimentação local primeiro (sem ordem ainda)
    let next = tasks.map(t => t.id === id ? { ...t, ...changes, column: target } : t);
    // Remove o card da lista do destino e reinsere no índice
    const destTasks = next.filter(t => t.column === target && t.id !== id);
    const sortedDest = [...destTasks].sort(/* mesma lógica de renumberColumn */);
    sortedDest.splice(targetIndex, 0, next.find(t => t.id === id));
    // Reatribui ordem 1..N no destino
    const destOrderById = new Map(sortedDest.map((t, i) => [t.id, i + 1]));
    next = next.map(t => destOrderById.has(t.id) ? { ...t, ordem: destOrderById.get(t.id) } : t);
    // Renumera origem para fechar gap
    const { updatedTasks: nextFinal, changed: sourceChanged } = renumberColumn(next, sourceCol, newCardId);
    // ... persistência: task principal + renumerações destino + renumerações origem
  } else {
    // Caminho antigo — comportamento atual preservado
  }
}
```

**Alternativa mais limpa:** extrair um helper `applyMoveWithIndex(tasks, id, target, targetIndex, extraChanges, newCardId)` que retorna `{ updatedTasks, patches }`. `handleMove` e o futuro `handleDrop` consomem esse helper. Reduz duplicação.

#### 4. TaskCard — torna arrastável

```jsx
<div
  draggable={!editing && !isProc && !isNew && !isMobile}
  onDragStart={e => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    onDragStart(task.id, task.column);
  }}
  onDragEnd={() => { onDragEnd(); /* reset threshold após 100ms */ }}
  style={{ cursor: draggable ? "grab" : "default", ... }}
>
```

Passar `onDragStart`, `onDragEnd` como props novas via `Column` → `TaskCard`.

#### 5. Column — recebe drops

```jsx
<div
  onDragOver={e => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const idx = computeDropIndex(e, sortedVisibleTasks, containerRef.current);
    if (dropTarget?.col !== name || dropTarget?.index !== idx) {
      onDropTargetChange({ col: name, index: idx });
    }
  }}
  onDrop={e => {
    e.preventDefault();
    if (!dragging || !dropTarget) return;
    const { id, sourceCol } = dragging;
    onDropTask(id, sourceCol, dropTarget.col, dropTarget.index);
  }}
  onDragLeave={e => {
    // Só limpa se saiu do container, não de filho. Checa relatedTarget.
    if (!containerRef.current?.contains(e.relatedTarget)) onDropTargetChange(null);
  }}
>
```

**`computeDropIndex`:** itera os cards renderizados (via refs ou `container.children`), compara `e.clientY` com o midpoint de cada. Retorna o primeiro índice cuja metade está abaixo do cursor. Se nenhum, retorna `tasks.length`.

#### 6. Indicador visual de drop

Entre os cards, na posição `dropTarget.index` quando `dropTarget.col === name`:
```jsx
<div style={{
  height: 2, background: COL_ACCENT[name], borderRadius: 1,
  boxShadow: `0 0 6px ${COL_ACCENT[name]}88`,
  margin: "2px 0", transition: "opacity 0.12s",
}} />
```

Inserir dinamicamente ao renderizar a lista:
```jsx
{visible.map((t, i) => (
  <React.Fragment key={t.id}>
    {dropTarget?.col === name && dropTarget.index === i && <DropIndicator />}
    <TaskCard ... />
  </React.Fragment>
))}
{dropTarget?.col === name && dropTarget.index === visible.length && <DropIndicator />}
```

#### 7. `handleDrop` no App

```js
function handleDrop(id, sourceCol, targetCol, targetIdx) {
  if (reorderingCol.has(sourceCol) || reorderingCol.has(targetCol)) {
    setDragging(null); setDropTarget(null);
    return;
  }
  // "Aguardando" e "Snooze" via drop também exigem modal — chamar handleMove que já intercepta
  handleMove(id, targetCol, {}, targetIdx);
  setDragging(null);
  setDropTarget(null);
}
```

Importante: se `targetCol === sourceCol`, `handleMove` atual faria early return (`if (task.column === target) return`). Precisa remover esse early return quando `targetIndex !== null` — é reordenação dentro da mesma coluna, caso válido.

### Armadilhas conhecidas (repetindo do plano anterior)

1. **`onDragOver` exige `e.preventDefault()`** para `onDrop` disparar. Erro #1 e silencioso.
2. **`onDragEnter`/`onDragLeave` flicker:** filhos disparam eventos próprios. **Não usar para visual feedback** — usar `onDragOver` com cálculo de Y.
3. **Autoscroll perto da borda da viewport:** dispensável no volume atual (~11 cards Inbox cabem na tela).
4. **Ghost image padrão é feio.** Aceitar default na primeira entrega. Customizar só se incomodar.
5. **Cursor:** `cursor: grab` em cards arrastáveis, `cursor: grabbing` durante drag (via classe no body ou state).
6. **Conflito click-para-expandir:** usar o threshold de movimento OU ignorar click por ~100ms após `dragend`. Testar na prática.
7. **Reorderar para mesma posição:** se o drop index é igual ao índice atual do card na coluna origem, é no-op. `handleMove` deve detectar e sair silenciosamente.
8. **Drop em "Aguardando" ou "Snooze":** abre o modal (ótimo — `handleMove` já faz isso). Se cancelar o modal, o DnD é revertido automaticamente (o state local nunca mudou porque o modal intercepta antes). Verificar.

### Critério de aceitação (Rodrigo testa)

1. Arrastar card do Inbox para "A fazer", soltando entre dois cards existentes. Linha indicadora aparece durante o hover; card vai para a posição. `Ordem` no Notion é renumerada em ambas colunas.
2. Arrastar card dentro da mesma coluna, subindo duas posições. Linha indicadora aparece; card reordena.
3. Arrastar card para "Aguardando". Modal pede texto. Preencher → card vai para Aguardando com o texto.
4. Arrastar card para "Aguardando" e cancelar o modal. Card volta pra posição original.
5. No mobile (< 640px), cards não têm `draggable` (tentar arrastar no toque não deve disparar nada). ↑/↓ continuam funcionando.
6. Badge `Tarefa · NN` não aparece mais em nenhum card. Campo `Ordem` no Notion continua sendo atualizado (verificar em 2–3 reordenações).

### Estimativa

~100–120 linhas novas + ~30 linhas de modificação em `handleMove` + remoção de 1 linha no badge. Uma entrega. Zero alteração em `api/`. Zero alteração no schema do Notion.

---

## O que explicitamente NÃO entra nas duas entregas

- **Status "Delegado":** decidido não criar. Rodrigo usa `D:` e `Ag:` como prefixo no campo `Aguardando` livre e avalia depois de 60 dias se precisa de algo estruturado (provavelmente tag "Delegado" basta).
- **Autoscroll durante drag.** Volume atual não justifica.
- **Drop em pill de coluna recolhida.** Fica como follow-up se a dor aparecer.
- **Busca em "Concluído".** Se o Rodrigo precisar consultar histórico, usa o Notion direto. Reabre se atrapalhar.
- **Highlight do texto buscado dentro do card.** Complica render (justify + hyphens + pre-wrap). A dor é "achar onde está"; uma vez visível, o olho localiza.
- **Ordenação fracionária (LexoRank).** Opção (c) do debate. Volume pequeno demais para justificar.

---

## Princípios a manter nas duas entregas

- Uma entrega por vez. Rodrigo testa antes da próxima.
- Sem build step, sem framework novo. React via CDN, `index.html` único.
- Constantes centralizadas no topo do `index.html`.
- Rollback em caso de erro em qualquer PATCH (snapshot antes, restaura se falha).
- Mobile continua com layout dedicado e ↑/↓.
- Tom do Rodrigo: direto, verdade útil antes de conforto, recomendação clara.
