const requireAuth = require("../_auth");
const { notionHeaders, databaseId, parsePage } = require("../_notion");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const scope = req.query.scope || "trabalho";
    const days = parseInt(req.query.days || "30", 10);
    const dbId = databaseId(scope);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const allPages = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const body = {
        page_size: 100,
        sorts: [{ property: "Concluído em", direction: "descending" }],
        filter: {
          and: [
            { property: "Status", select: { equals: "Concluído" } },
            { property: "Concluído em", date: { on_or_after: cutoffStr } },
          ],
        },
      };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(
        `https://api.notion.com/v1/databases/${dbId}/query`,
        { method: "POST", headers: notionHeaders(), body: JSON.stringify(body) }
      );

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion API error" });
      }

      const data = await r.json();
      allPages.push(...(data.results || []));
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const tasks = allPages.map(parsePage).map(t => ({
      id: t.id,
      title: t.title,
      tags: t.tags || [],
      completedAt: t.completedAt,
    }));

    return res.status(200).json({ tasks });
  } catch (e) {
    console.error("recent-completed error:", e);
    res.status(500).json({ error: e.message });
  }
}
