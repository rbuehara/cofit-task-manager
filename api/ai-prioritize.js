const requireAuth = require("./_auth");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { tasks, profile, scope } = req.body;

    // ai-prioritize é exclusivo do scope de trabalho
    if (scope === "pessoal") {
      return res.status(400).json({ error: "ai-prioritize não disponível em scope pessoal" });
    }

    if (!tasks?.length) return res.status(400).json({ error: "No tasks to prioritize" });

    const today = new Date().toISOString().split("T")[0];
    const system = `Priorize tarefas (1=mais urgente, sem repetição). Critérios: prazo, datas no texto (hoje: ${today}), aging, bloqueio, consequência, momentum (Em andamento=peso extra), estratégia.
Perfil: ${profile?.role || "?"} | ${profile?.areas || "?"} | ${profile?.criterion || "?"}
JSON: [{"id":"...","priority":1,"reason":"IMPACTO máx 60 chars"},...]`;

    const list = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      column: t.column,
      deadline: t.deadline || "sem prazo",
      tags: t.tags,
      createdAt: t.createdAt,
    }));

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: JSON.stringify(list) }],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json\s*|```/g, "").trim());

    return res.status(200).json({ priorities: parsed });
  } catch (e) {
    console.error("ai-prioritize error:", e);
    res.status(500).json({ error: e.message });
  }
}
