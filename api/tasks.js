const requireAuth = require("./_auth");
const { notionHeaders, databaseId, buildProperties, parsePage } = require("./_notion");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === "GET") {
      // Fetch all tasks (paginated — Notion returns max 100 per call)
      const allPages = [];
      let cursor = undefined;
      let hasMore = true;

      while (hasMore) {
        const body = {
          page_size: 100,
          sorts: [{ property: "Prioridade", direction: "ascending" }],
        };
        if (cursor) body.start_cursor = cursor;

        const today = new Date().toISOString().split("T")[0];
        body.filter = {
          or: [
            // Qualquer status que não seja Concluído nem Snooze
            {
              and: [
                { property: "Status", select: { does_not_equal: "Concluído" } },
                { property: "Status", select: { does_not_equal: "Snooze" } },
              ],
            },
            // Concluído hoje (mantém visível no board durante o dia)
            {
              and: [
                { property: "Status", select: { equals: "Concluído" } },
                { property: "Concluído em", date: { on_or_after: today } },
              ],
            },
            // Snooze ativo (data futura) — aparece na coluna Snooze com indicação de prazo
            {
              and: [
                { property: "Status", select: { equals: "Snooze" } },
                { property: "Snooze até", date: { after: today } },
              ],
            },
            // Snooze com data vencida ou sem data (já deveria ter voltado para Inbox)
            {
              and: [
                { property: "Status", select: { equals: "Snooze" } },
                { property: "Snooze até", date: { on_or_before: today } },
              ],
            },
            {
              and: [
                { property: "Status", select: { equals: "Snooze" } },
                { property: "Snooze até", date: { is_empty: true } },
              ],
            },
          ],
        };

        const r = await fetch(
          `https://api.notion.com/v1/databases/${databaseId()}/query`,
          { method: "POST", headers: notionHeaders(), body: JSON.stringify(body) }
        );

        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          return res.status(r.status).json({ error: err.message || "Notion API error", code: r.status });
        }

        const data = await r.json();
        allPages.push(...(data.results || []));
        hasMore = data.has_more;
        cursor = data.next_cursor;
      }

      let tasks = allPages.map(parsePage);

      // Wake snooze vencido — server-side (idempotente, single-writer):
      // Move tasks com Status=Snooze e Snooze até <= hoje para Inbox no topo,
      // limpa Snooze até, e renumera Ordem 1..N do Inbox. Como acontece no
      // backend, elimina race entre múltiplos clients/abas.
      const today = new Date().toISOString().split("T")[0];
      const vencidos = tasks.filter(
        (t) => t.column === "Snooze" && t.snoozeUntil && t.snoozeUntil <= today
      );

      if (vencidos.length > 0) {
        const vencidosIds = new Set(vencidos.map((v) => v.id));

        // Move localmente para Inbox + limpa snoozeUntil + ordem=0 (cabeça do Inbox)
        let next = tasks.map((t) =>
          vencidosIds.has(t.id)
            ? { ...t, column: "Inbox", snoozeUntil: null, ordem: 0 }
            : t
        );

        // Renumera coluna Inbox 1..N por ordem ascendente (createdAt como desempate estável)
        const inboxSorted = next
          .filter((t) => t.column === "Inbox")
          .sort((a, b) => {
            const oa = a.ordem ?? Infinity;
            const ob = b.ordem ?? Infinity;
            if (oa !== ob) return oa - ob;
            return (a.createdAt || "").localeCompare(b.createdAt || "");
          });

        const newOrderById = new Map();
        inboxSorted.forEach((t, i) => newOrderById.set(t.id, i + 1));

        next = next.map((t) =>
          newOrderById.has(t.id) ? { ...t, ordem: newOrderById.get(t.id) } : t
        );

        // Persiste no Notion. Para os vencidos, patch completo (Status + Snooze até + Ordem).
        // Para os demais do Inbox, só patcha se Ordem mudou (evita writes desnecessários).
        const ordemFinalById = newOrderById;
        const tasksById = new Map(tasks.map((t) => [t.id, t]));

        const patches = [];

        for (const v of vencidos) {
          patches.push(
            fetch(`https://api.notion.com/v1/pages/${v.id}`, {
              method: "PATCH",
              headers: notionHeaders(),
              body: JSON.stringify({
                properties: buildProperties({
                  column: "Inbox",
                  snoozeUntil: null,
                  ordem: ordemFinalById.get(v.id),
                }),
              }),
            })
          );
        }

        for (const [id, novaOrdem] of ordemFinalById.entries()) {
          if (vencidosIds.has(id)) continue;
          const original = tasksById.get(id);
          if (!original || original.ordem === novaOrdem) continue;
          patches.push(
            fetch(`https://api.notion.com/v1/pages/${id}`, {
              method: "PATCH",
              headers: notionHeaders(),
              body: JSON.stringify({
                properties: buildProperties({ ordem: novaOrdem }),
              }),
            })
          );
        }

        // Aguarda todos os PATCHes; loga falhas mas não derruba a request — o
        // estado local `next` já reflete a intenção, e a próxima query corrige
        // qualquer divergência.
        const results = await Promise.allSettled(patches);
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.error(
            `wake-snooze: ${failures.length}/${patches.length} PATCHes falharam`,
            failures.map((f) => f.reason?.message || f.reason)
          );
        }

        tasks = next;
      }

      return res.status(200).json({ tasks });
    }

    if (req.method === "POST") {
      const task = req.body;
      if (!task.title) return res.status(400).json({ error: "title is required" });

      const props = buildProperties({
        ...task,
        column: task.column || "Inbox",
        createdAt: task.createdAt || new Date().toISOString(),
        appId: task.appId || crypto.randomUUID(),
      });

      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: databaseId() },
          properties: props,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion create failed" });
      }

      const page = await r.json();
      return res.status(201).json({ task: parsePage(page) });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("tasks.js error:", e);
    res.status(500).json({ error: e.message });
  }
}
