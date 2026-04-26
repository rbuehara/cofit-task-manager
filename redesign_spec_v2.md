# Redesign do Task Manager — spec v2 (revisada contra o código real)

> Esta spec foi confrontada com `index.html` real. Substitui `redesign_spec.md`.

## Stack confirmada

- `index.html` único, ~2300 linhas. React 18 via CDN. JSX transpilado por **Babel standalone** (`<script type="text/babel">`).
- Estilos: mistura de CSS em `<style>` com tokens em `:root` (linhas 11-34) **e** hex inline no JSX. O objeto `AU` (linhas 202-215) e `COL_ACCENT` (linhas 189-197) espelham os tokens do `:root` para uso inline.
- Backend Vercel Serverless em `api/` — fora de escopo aqui.

**Antes de qualquer edição:** ler do início do `<script type="text/babel">` (linha ~183) até linha 320 para entender a paleta, helpers de cor (`statusBg`, `statusBgStrong`) e constantes globais.

---

## Decisão prévia sobre paleta

**Manter a paleta Aurora atual (já existente no código).** Não introduzir um `STATUS_COLORS` paralelo com hex diferentes. Os tokens oficiais são:

| Status | Hex (em `--status-*` e `COL_ACCENT`) |
|---|---|
| Inbox | `#9CA3AF` |
| A fazer | `#3B82F6` |
| Em andamento | `#F59E0B` |
| Concluído | `#22C55E` |
| Aguardando | `#8B5CF6` |
| Snooze | `#06B6D4` |
| Algum dia | `#E879A0` |

O que muda é apenas o **fundo da página por scope** (item 1 abaixo). Cores semânticas de status ficam idênticas.

---

## Objetivo

Quatro mudanças coordenadas:

1. Diferenciar scope (Trabalho vs. Pessoal) pelo **fundo da página**, não por borda do header.
2. Remover o `borderTop: 3px solid` do header (não é uma barra solta — é a borda do header).
3. Redesenhar os pills "mover para" (cards expandidos **e** cards novos no Inbox).
4. Redesenhar o toggle Trabalho/Pessoal (segmented control único, sem cores saturadas em ambos os lados).

**Não fazer:**
- Não mexer em tags coloridas dos cards (`TAG_COLORS`, linhas 220-228).
- Não alterar lógica de filtro, busca, drag&drop, ai-polish.
- Não tocar nos contadores secundários do topo (ativas / em andamento / concluídas hoje) — já usam `COL_ACCENT`.
- Não trocar fontes (Fraunces, Inter Tight, DM Sans, Manrope, JetBrains Mono).

---

## 1. Fundo da página por scope

### Estado atual
- `body { background: #0c1224 }` no CSS (linha 36).
- `useEffect` em `App` (linhas 1620-1623) sobrescreve com `#0d1220` (pessoal) ou `#0c1224` (trabalho) — diferença quase imperceptível.

### Estado novo
Tornar a diferença **clara mas não berrante**. Usar duas variantes do azul-quase-preto Aurora — um deslocado para o azul (trabalho), outro deslocado para o quente (pessoal):

```js
const SCOPE_BG = {
  trabalho: "#0c1224",   // mantém o atual
  pessoal:  "#1a1410",   // marrom-quase-preto, mesma luminância
};
```

Aplicar no `useEffect` existente (linhas 1620-1623), substituindo as duas cores. **Não criar useEffect novo.**

```js
useEffect(() => {
  document.title = scope === "pessoal" ? "COFIT — Pessoal" : "COFIT — Trabalho";
  document.body.style.background = SCOPE_BG[scope];
}, [scope]);
```

Atualizar também `--au-bg` no `:root` (linha 26) — ou aceitar que o body é a única superfície que muda e o resto do app usa `AU.surface`/`surfaceAlt` neutros (recomendado: aceitar, é menos intrusivo).

---

## 2. Remover borda colorida do header

### Onde
- Linha 2103: `<header className="desktop-only" ...>` — remover `borderTop: 3px solid ${scope === "pessoal" ? "#d97706" : "#4f46e5"}` do style inline.
- Linha 2167: `<header className="mobile-only" ...>` — mesma remoção.

### Substituir por
Nada. O `borderBottom: 1px solid ${AU.hair}` que já existe é suficiente para separar o header do conteúdo.

---

## 3. Toggle Trabalho/Pessoal

### Onde
- Linhas 2122-2128 (desktop).
- Linhas 2171-2177 (mobile).

### Estado atual
Dois botões saturados (azul `#4f46e5` e laranja `#d97706`) lado a lado dentro de um container `AU.surface`. Ambos puxam atenção quando ativos.

### Estado novo
Segmented control: container neutro, posição ativa marcada com `AU.surfaceHi` (cinza-azul mais claro) + texto em `AU.ink` + peso 700. Posição inativa: transparente, texto em `AU.inkLow`, peso 500. **Sem usar cores de scope no toggle** — o fundo da página já carrega essa informação.

```jsx
{/* Desktop */}
<div style={{ display: "flex", gap: 2, background: AU.surface, borderRadius: 8, padding: 3, border: `1px solid ${AU.hair}` }}>
  {["trabalho", "pessoal"].map(s => {
    const active = scope === s;
    return (
      <button
        key={s}
        onClick={() => switchScope(s)}
        style={{
          padding: "4px 13px",
          borderRadius: 6,
          border: "none",
          background: active ? AU.surfaceHi : "transparent",
          color: active ? AU.ink : AU.inkLow,
          fontWeight: active ? 700 : 500,
          fontSize: 11.5,
          fontFamily: "inherit",
          cursor: "pointer",
          transition: "all 0.15s",
          letterSpacing: 0.2,
        }}
      >
        {s === "trabalho" ? "💼 Trabalho" : "🏠 Pessoal"}
      </button>
    );
  })}
</div>
```

Mobile (linhas 2171-2177): mesma lógica, padding `3px 8px`, fontSize 10, ícone só (`💼` / `🏠`), sem texto.

---

## 4. Redesign dos pills "mover para"

### Onde (DOIS locais — não esquecer nenhum)
- **Bloco A — card novo no Inbox, colapsado:** linhas 1090-1116. Renderiza pills + botões editar/arquivar no mesmo flex.
- **Bloco B — card expandido (qualquer coluna):** linhas 1201-1223. Tem label "mover para" acima.

### Estado atual
Pills com `background: statusBg(acc)` (~18% alpha), `color: acc`, `fontSize: 11`, `fontWeight: 600`, `padding: "4px 11px"`, `borderRadius: 999`. Sem hover state explícito (só o `filter: brightness(0.93)` global em `button:hover`).

### Estado novo
Mais discretos por padrão, saturados no hover. Borda visível para reforçar que são alvos clicáveis.

**Implementação:** criar componente `StatusPill` reutilizável, definido perto de `TaskCard` (antes da linha 1090).

```jsx
function StatusPill({ status, onClick, onMouseDown }) {
  const acc = COL_ACCENT[status];
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      className="status-pill"
      style={{
        "--pill-acc": acc,
        border: `1px solid ${acc}55`,
        background: `${acc}1F`,           // ~12% alpha
        color: acc,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
      }}
    >
      {status}
    </button>
  );
}
```

**Hover via CSS** (adicionar em `<style>`, após as regras de scrollbar, ~linha 47):

```css
.status-pill:hover {
  background: var(--pill-acc) !important;
  color: #0F0F0F !important;
  border-color: var(--pill-acc) !important;
  filter: none;       /* anula o brightness(0.93) global de button:hover */
}
```

**Substituir** os dois blocos:

```jsx
{/* Bloco A — linha 1090-1103 (manter o flex e os botões editar/arquivar; trocar só os pills) */}
{COLUMNS.filter(c => c !== task.column).map(c => (
  <StatusPill
    key={c}
    status={c}
    onClick={e => { e.stopPropagation(); onMove(task.id, c); }}
  />
))}

{/* Bloco B — linha 1211-1221 (mesmo padrão) */}
{COLUMNS.filter(c => c !== task.column).map(c => (
  <StatusPill
    key={c}
    status={c}
    onClick={e => { e.stopPropagation(); onMove(task.id, c); }}
  />
))}
```

**Por que CSS hover e não `useState`:** em uma coluna com 30 cards e 6 pills cada, useState por pill = 180 listeners e 180 re-renders parciais por hover. CSS é trivial.

---

## 5. Hierarquia das colunas — ajuste de proporção

### Onde
Linhas 1503-1529 do `index.html`. Componente do header da coluna (`Column`).

### Estado atual
- Título: `Inter Tight 19px / 600`
- Número: `Fraunces 28px / 500`

O número fica ~47% maior que o título. Apesar de ser fonte serifada (que pesa menos visualmente que sans), a diferença numérica grande faz o número roubar a leitura.

### Estado novo
- Título: `Inter Tight 21px / 600` (+2)
- Número: `Fraunces 22px / 500` (-6)

O número continua **levemente maior** — a fonte serif decorativa ainda lê como "estatística" — mas a hierarquia se equilibra. Título lidera, número complementa.

### Diff
Na linha 1518: trocar `fontSize: 19` → `fontSize: 21`.
Na linha 1523: trocar `fontSize: 28` → `fontSize: 22`.

Nada mais muda — fontes, pesos, cor (`accent`), `letterSpacing`, `lineHeight` permanecem.

---

## 6. Critérios de aceitação

- [ ] Ao alternar scope, **só** o fundo da página muda (de `#0c1224` para `#1a1410`); header, cards, colunas e toggle continuam iguais.
- [ ] Header desktop e mobile **não** têm mais a faixa colorida de 3px no topo.
- [ ] Toggle Trabalho/Pessoal não usa mais azul `#4f46e5` nem laranja `#d97706`. Posição ativa é cinza-azul (`AU.surfaceHi`).
- [ ] Pills "mover para" no card novo (Inbox, colapsado) e no card expandido têm o **mesmo** visual e mesmo hover.
- [ ] Hover de pill: fundo cheio na cor do status, texto preto.
- [ ] Single-click em qualquer pill move a task. Drag & drop continua funcionando.
- [ ] Tags dos cards (ITCD, IPVA, Sistemas/TI etc.) continuam com cores idênticas às de hoje.
- [ ] Contadores do header (`X ativas / Y em andamento / Z concluídas hoje`) continuam idênticos.
- [ ] Headers das colunas: título Inter Tight **21**/600 + número Fraunces **22**/500, ambos na cor do status. Diferença de 1px só, número levemente maior.

---

## 7. Ordem de implementação

1. Adicionar `SCOPE_BG` no topo do `<script type="text/babel">`, perto de `AU` (linha ~215).
2. Atualizar o `useEffect` das linhas 1620-1623 para usar `SCOPE_BG[scope]`.
3. Remover `borderTop` dos dois `<header>` (linhas 2103, 2167).
4. Refatorar o toggle nos dois headers (linhas 2122-2128 e 2171-2177).
5. Criar componente `StatusPill` antes do `TaskCard` (~linha 1050).
6. Adicionar regra `.status-pill:hover` no `<style>`.
7. Substituir o JSX de pills no Bloco A (1090-1103).
8. Substituir o JSX de pills no Bloco B (1211-1221).
9. Ajustar fontSize do header de coluna (linhas 1518 e 1523).
10. Hard reload (`Cmd+Shift+R`), validar critérios um a um, alternar scope, hover em pills, mover task por pill, mover task por drag.

Implementar incrementalmente, recarregar entre passos.

---

## 8. Pontos abertos para o usuário decidir antes de implementar

Nenhum — todas as decisões cinzas da v1 (paleta, hierarquia de coluna, ícones do toggle) foram resolvidas aqui. Se alguma dessas decisões for revertida, a spec precisa ser reaberta.
