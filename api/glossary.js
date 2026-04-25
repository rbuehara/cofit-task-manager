// GET /api/glossary?scope=trabalho|pessoal
// Retorna { contexto, glossario: [{sigla, significado}] } filtrado por escopo.

const requireAuth = require("./_auth");
const { getGlossary } = require("./_glossary");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const scope = req.query.scope === "pessoal" ? "pessoal" : "trabalho";

  try {
    const result = await getGlossary(scope);
    return res.status(200).json(result);
  } catch (e) {
    console.error("glossary handler error:", e);
    return res.status(500).json({ error: e.message });
  }
}
