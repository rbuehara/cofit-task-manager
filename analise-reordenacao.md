# Análise: bug de reordenação — campo `Ordem`

Contexto: COFIT Task Manager, React via CDN, backend Vercel + Notion API.
Fase 3.1b migrou a lógica de ordenação do campo `Prioridade` (usado pela IA) para o campo `Ordem` (Number, novo). O bug apareceu após esse deploy.

---

## Três problemas identificados

### 1. Badge exibe `priority` (campo errado)

O número circular exibido no card (`priBadge`) renderiza `task.priority` — o valor que a IA escreveu no campo `Prioridade` do Notion. Nunca foi alterado para `task.ordem`. Portanto, o número que o usuário vê ao clicar ↑/↓ não corresponde ao campo `Ordem` que está sendo alterado. São dois campos completamente separados no Notion.

**Efeito observado:** card mostra "17", o Notion tem `Ordem = 40`. O usuário vê um número, o sistema opera em outro.

---

### 2. Race condition na normalização assíncrona

Quando alguma task da coluna tem `ordem = null`, o código atual executa uma "normalização" fire-and-forget: atribui `1, 2, 3...` para todas as tasks e dispara PATCHes sem aguardar confirmação. Em seguida, imediatamente executa a troca (swap) com base nos índices capturados *antes* da normalização ser concluída.

Resultado: o segundo `setTasks` (da troca) é computado sobre o estado anterior à normalização, porque o React ainda não processou o primeiro `setTasks`. Os dois updates de estado coexistem em closures diferentes. A troca usa `neighbor` capturado antes do estado atualizar — pode apontar para o card errado.

**Efeito observado:** mover a task não altera o `Ordem` no Notion, ou altera o card errado.

---

### 3. Swap de valores numéricos com gaps falha em sequências

O design atual troca os valores de `Ordem` entre dois cards (ex: card A tinha 30, card B tinha 40 → A passa a ter 40, B passa a ter 30). Isso funciona quando os números são contíguos. Mas no Notion atual existem gaps: valores como 1, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 30, 40, 40, 50 (dois cards com valor 40 — duplicata gerada por uma normalização parcial anterior).

Quando dois cards têm o mesmo valor de `Ordem`, o sort é instável: a posição relativa deles não é garantida entre renders. Clicar ↑ move visualmente mas o próximo clique pode não encontrar o vizinho esperado porque o sort reordenou de forma diferente.

**Efeito observado:** seta ↑ funciona na primeira pressão mas não na segunda — o card não consegue "passar" o vizinho.

---

## Causa raiz comum

O design de **swap de valores numéricos** é frágil por natureza quando os números têm gaps ou duplicatas. Qualquer inconsistência no banco (valor null, gap, duplicata) propaga erro visual e comportamental. A normalização assíncrona tentou corrigir isso mas introduziu a race condition.

---

## Solução proposta

Abandonar swap. Adotar **reordenação por índice com renumeração completa da coluna**.

### Lógica nova de `handleReorder`

```
1. Pega as tasks da coluna, sorted pela ordem visual atual
   (ordem ASC; nulls no fim; newCard sempre no topo)

2. Remove a task do índice atual e insere no índice destino
   — manipulação de array pura, sem tocar em números ainda

3. Reatribui ordem = 1, 2, 3... para TODAS as tasks da coluna,
   em sequência, baseado na nova posição do array

4. Calcula quais tasks tiveram o valor de ordem alterado
   (compara com o estado anterior)

5. Atualiza estado local imediatamente com os novos valores

6. Persiste no Notion apenas as tasks cujo valor mudou
   (minimiza PATCHes; com 11 tasks no Inbox, no máximo 11 PATCHes)
   — await Promise.all, com rollback em caso de erro
```

### Por que é melhor

- **Sem gaps:** após qualquer operação, a coluna fica sempre com 1, 2, 3... contíguos.
- **Sem duplicatas:** cada card tem um valor único garantido.
- **Sem race condition:** normalização e troca são uma operação única e síncrona antes do PATCH.
- **Idempotente:** clicar ↑ duas vezes produz resultado previsível e estável.
- **Sort estável:** sem empates possíveis, o sort sempre produz a mesma ordem.

### Ponto de atenção

Pode gerar até N PATCHes por clique (uma por task da coluna). Com volume atual (~11 Inbox, ~5 A fazer, ~3 Em andamento) isso é no máximo 11 requisições paralelas — aceitável. Se o volume crescer muito no futuro, pode-se otimizar para persistir apenas as tasks do índice movido até o fim da coluna (que são as únicas que mudam de valor). Mas não é necessário agora.

### Correção adicional

`priBadge` deve exibir `task.ordem` (Number, inteiro sequencial) em vez de `task.priority`. A cor do badge pode ser simplificada: sem gradiente vermelho/amarelo/verde baseado em ranking — apenas cinza neutro, já que `Ordem` é posição, não urgência. Ou remover o badge completamente, já que com 1, 2, 3... contíguos o número perde utilidade visual (a posição na coluna já informa a ordem). Deixar para o Rodrigo decidir.

---

## Arquivos a alterar

- `index.html` — reescrever `handleReorder` (~20 linhas) e corrigir `priBadge`
- `api/_notion.js` — nenhuma alteração necessária (mapeamento de `Ordem` já está correto)
- `api/tasks/[id].js` — nenhuma alteração necessária

---

## O que NÃO muda

- O campo `Prioridade` (IA) continua existindo no Notion e no código — será removido na Fase 3.7 junto com o botão "Priorizar".
- `handlePrioritize` não é tocado.
- Nenhuma alteração no schema do Notion.
