// GET  /api/glossary?scope=trabalho|pessoal  → { contexto, glossario }
// POST /api/glossary                          → cria nova entrada { sigla, significado, escopo }

const requireAuth = require("./_auth");
const { notionHeaders } = require("./_notion");
const { getGlossary, fetchAll, invalidateCache } = require("./_glossary");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const rawScope = req.query.scope;

    // scope=all: retorna todas as entradas com id e escopo (para o modal CRUD)
    if (rawScope === "all") {
      try {
        const entries = await fetchAll();
        return res.status(200).json({ entries });
      } catch (e) {
        console.error("glossary GET all error:", e);
        return res.status(500).json({ error: e.message });
      }
    }

    const scope = rawScope === "pessoal" ? "pessoal" : "trabalho";
    try {
      const result = await getGlossary(scope);
      return res.status(200).json(result);
    } catch (e) {
      console.error("glossary GET error:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { sigla, significado, escopo } = req.body || {};
    if (!sigla || !significado || !escopo) {
      return res.status(400).json({ error: "sigla, significado e escopo são obrigatórios" });
    }
    if (!["Trabalho", "Pessoal", "Ambos"].includes(escopo)) {
      return res.status(400).json({ error: "escopo deve ser Trabalho, Pessoal ou Ambos" });
    }

    const dbId = process.env.NOTION_DATABASE_ID_GLOSSARIO;
    if (!dbId) return res.status(500).json({ error: "NOTION_DATABASE_ID_GLOSSARIO não configurado" });

    try {
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Sigla: { title: [{ text: { content: sigla } }] },
            Significado: { rich_text: [{ text: { content: significado } }] },
            Escopo: { select: { name: escopo } },
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || "Notion create failed" });
      }

      const page = await r.json();
      // Invalida cache dos scopes afetados
      if (escopo === "Ambos") { invalidateCache("trabalho"); invalidateCache("pessoal"); }
      else if (escopo === "Trabalho") invalidateCache("trabalho");
      else invalidateCache("pessoal");

      return res.status(201).json({
        id: page.id,
        sigla,
        significado,
        escopo,
      });
    } catch (e) {
      console.error("glossary POST error:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
