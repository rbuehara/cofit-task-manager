const { notionHeaders, buildProperties, parsePage } = require("../_notion");
const requireAuth = require("../_auth");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing page id" });

    if (req.method === "PATCH") {
      const body = req.body;
      // Se o PATCH altera a coluna (mudança de status), seta lastMovedAt automaticamente.
      // Reordenações dentro da mesma coluna enviam apenas { ordem } — sem "column" — e NÃO devem tocar lastMovedAt.
      if (body.column !== undefined && body.lastMovedAt === undefined) {
        body.lastMovedAt = new Date().toISOString();
      }
      const props = buildProperties(body);

      const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ properties: props }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion update failed" });
      }

      const page = await r.json();
      return res.status(200).json({ task: parsePage(page) });
    }

    // Archive (soft delete) — Notion doesn't truly delete via API
    if (req.method === "DELETE") {
      const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ archived: true }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion archive failed" });
      }

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("tasks/[id].js error:", e);
    res.status(500).json({ error: e.message });
  }
}
