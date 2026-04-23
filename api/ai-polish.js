const requireAuth = require("./_auth");
const { contexto, glossario } = require("./glossary");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { title, description, existingTags } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const glossarioFmt = glossario.map((g) => `- ${g.sigla} = ${g.significado}`).join("\n");

    const system = `Você é assistente de produtividade. Tarefas:
1. Reescrever título (máx 80 chars, claro e conciso).
2. Reescrever descrição profissionalmente. Se vazia, crie breve baseada no título.
3. Sugerir 1-3 tags. Uma tarefa pode ter múltiplas áreas.

Contexto do usuário: ${contexto}

Glossário de siglas do usuário (use para ENTENDER o que o usuário escreveu; NÃO altere, NÃO expanda, NÃO "corrija" essas siglas no título ou descrição — mantenha-as exatamente como estão, a menos que o texto original já use a forma expandida):
${glossarioFmt}

Tags existentes: ${(existingTags || []).join(", ") || "nenhuma"}. Prefira existentes.
Responda APENAS JSON: {"title":"...","description":"...","tags":["tag1"]}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: `Título: ${title}\nDescrição: ${description || "(vazio)"}` }],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json\s*|```/g, "").trim());

    return res.status(200).json(parsed);
  } catch (e) {
    console.error("ai-polish error:", e);
    res.status(500).json({ error: e.message });
  }
}
