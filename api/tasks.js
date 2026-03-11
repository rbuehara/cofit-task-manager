const { notionHeaders, databaseId, buildProperties, parsePage } = require("./_notion");

export default async function handler(req, res) {
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

        // If ?active=1, filter out Concluído
        const today = new Date().toISOString().split("T")[0];
body.filter = {
  or: [
    { property: "Status", select: { does_not_equal: "Concluído" } },
    {
      and: [
        { property: "Status", select: { equals: "Concluído" } },
        { property: "Concluído em", date: { on_or_after: today } },
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

      const tasks = allPages.map(parsePage);
      return res.status(200).json({ tasks });
    }

    if (req.method === "POST") {
      const task = req.body;
      if (!task.title) return res.status(400).json({ error: "title is required" });

      const props = buildProperties({
        ...task,
        column: task.column || "Backlog",
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
