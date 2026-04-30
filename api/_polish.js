// Lógica core do polish — extraída do ai-polish.js para ser reutilizável.
// Handler HTTP em ai-polish.js. Outros endpoints (ex.: tasks.js POST com flag
// polish:true) podem importar polishTask diretamente daqui.

const { getGlossary } = require("./_glossary");

async function polishTask({ title, description, existingTags, scope, activeTasksByTag, recentCompleted }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!title) throw new Error("title is required");

  // Carrega contexto e glossário do scope correto (com cache de 5 min)
  const { contexto, glossario } = await getGlossary(scope);

  const glossarioFmt = glossario.map((g) => `- ${g.sigla} = ${g.significado}`).join("\n");

  // Seções contextuais condicionais (projetos ativos + concluídas recentes)
  let activeSection = "";
  if (activeTasksByTag && typeof activeTasksByTag === "object") {
    const entries = Object.entries(activeTasksByTag).filter(([, titles]) => titles.length > 0);
    if (entries.length > 0) {
      activeSection = "\n\nProjetos ativos (tags com tasks em aberto):\n" +
        entries.map(([tag, titles]) => `- ${tag}: ${titles.join("; ")}`).join("\n");
    }
  }

  let recentSection = "";
  if (Array.isArray(recentCompleted) && recentCompleted.length > 0) {
    recentSection = "\n\nConcluídas recentemente (contexto de projetos em andamento):\n" +
      recentCompleted
        .slice(0, 20)
        .map(t => `- ${t.title}${t.tags?.length ? ` [${t.tags.join(", ")}]` : ""}${t.completedAt ? ` (${t.completedAt.split("T")[0]})` : ""}`)
        .join("\n");
  }

  // Instruções adaptadas por scope
  const isPessoal = scope === "pessoal";
  const scopeInstructions = isPessoal
    ? `\n\nRegras para scope pessoal:
- Use polishStrength: light — só reescreva título/descrição se houver ganho claro de clareza. Caso contrário, mantenha o original.
- NÃO force linguagem profissional. Mantenha tom direto e informal.
- Se a task parece continuação de um projeto ativo listado acima, sugira a MESMA tag do projeto.`
    : `\n\nRegras para scope trabalho:
- Se a task parece continuação de um projeto ativo listado acima, sugira a MESMA tag do projeto.`;

  const system = `Você é assistente de produtividade. Tarefas:
1. Reescrever título (máx 80 chars, claro e conciso).
2. Reescrever descrição profissionalmente. Se vazia, crie breve baseada no título.
3. Sugerir 1-3 tags. Uma tarefa pode ter múltiplas áreas.

Contexto do usuário: ${contexto}

Glossário de siglas do usuário (use para ENTENDER o que o usuário escreveu; NÃO altere, NÃO expanda, NÃO "corrija" essas siglas no título ou descrição — mantenha-as exatamente como estão, a menos que o texto original já use a forma expandida):
${glossarioFmt || "(sem glossário para este scope)"}

Tags existentes: ${(existingTags || []).join(", ") || "nenhuma"}. Prefira existentes.${activeSection}${recentSection}${scopeInstructions}
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
    const e = new Error(err.error?.message || "Anthropic API error");
    e.status = 502;
    throw e;
  }

  const data = await r.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  return JSON.parse(text.replace(/```json\s*|```/g, "").trim());
}

module.exports = { polishTask };
