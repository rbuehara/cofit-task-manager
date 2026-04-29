// PATCH /api/glossary/:id  → atualiza entrada { sigla?, significado?, escopo? }
// DELETE /api/glossary/:id → arquiva entrada (archived: true)

const requireAuth = require("../_auth");
const { notionHeaders } = require("../_notion");
const { invalidateCache, CORES_VALIDAS } = require("../_glossary");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing page id" });

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const { sigla, significado, escopo, cor } = req.body || {};

    if (escopo && !["Trabalho", "Pessoal", "Ambos"].includes(escopo)) {
      return res.status(400).json({ error: "escopo deve ser Trabalho, Pessoal ou Ambos" });
    }

    // cor: undefined = não mexer; null/"" = limpar; string válida = setar
    let corOp = "skip";
    let corNorm = null;
    if (cor !== undefined) {
      if (cor === null || cor === "") {
        corOp = "clear";
      } else {
        corNorm = String(cor).toLowerCase();
        if (!CORES_VALIDAS.includes(corNorm)) {
          return res.status(400).json({ error: `cor inválida. Use uma de: ${CORES_VALIDAS.join(", ")}` });
        }
        corOp = "set";
      }
    }

    const props = {};
    if (sigla !== undefined)      props["Sigla"]      = { title:     [{ text: { content: sigla } }] };
    if (significado !== undefined) props["Significado"] = { rich_text: [{ text: { content: significado } }] };
    if (escopo !== undefined)      props["Escopo"]     = { select: { name: escopo } };
    if (corOp === "set")           props["Cor"]        = { select: { name: corNorm } };
    if (corOp === "clear")         props["Cor"]        = { select: null };

    try {
      const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ properties: props }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion update failed" });
      }

      // Invalida cache de todos os scopes (escopo pode ter mudado)
      invalidateCache(null);

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("glossary PATCH error:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE (archive) ──────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    try {
      const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(),
        body: JSON.stringify({ archived: true }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion archive failed" });
      }

      invalidateCache(null);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("glossary DELETE error:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
