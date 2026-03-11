const { notionHeaders, buildProperties, parsePage } = require("../_notion");

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing page id" });

    if (req.method === "PATCH") {
      const props = buildProperties(req.body);

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
