// Módulo auxiliar — lógica de glossário com cache.
// Importado por glossary.js (handler) e ai-polish.js.

const { notionHeaders } = require("./_notion");

// ─── Contextos estáticos por scope ───────────────────────────────────────────

const CONTEXTOS = {
  trabalho:
    "Auditor fiscal da Receita Estadual de Mato Grosso do Sul (SEFAZ-MS), coordenador da COFIT. Atua como ponte entre as unidades de fiscalização (UFIPVA e UFITCD), a SAT e a COTIN.",
  pessoal:
    "Uso pessoal de Rodrigo. Tarefas domésticas, financeiras pessoais, vendas de itens usados, manutenção da casa, saúde, família. Tom direto, sem jargão institucional. Não use linguagem corporativa ('alinhar', 'tratativa', 'demanda'). Mantenha verbos no infinitivo simples.",
};

// ─── Fallback mínimo (sem NOTION_DATABASE_ID_GLOSSARIO configurado) ──────────
// Mantém apenas o suficiente para não quebrar o ai-polish em deploy parcial.
// Adicionar entradas reais via database Notion — não editar aqui.

const FALLBACK_GLOSSARIO = [
  { sigla: "COFIT", significado: "Coordenadoria de Fiscalização do IPVA e do ITCD", cor: null },
  { sigla: "SAT", significado: "Superintendência de Administração Tributária", cor: null },
  { sigla: "IPVA", significado: "Imposto sobre a Propriedade de Veículos Automotores", cor: null },
  { sigla: "ITCD", significado: "Imposto sobre Transmissão Causa Mortis e Doação", cor: null },
];

// Cores válidas para a propriedade Cor do glossário (Notion Select).
// Mantidas alinhadas à paleta usada pelo front (TAG_COLORS).
const CORES_VALIDAS = [
  "verde", "vermelho", "azul", "roxo", "marrom",
  "amarelo", "laranja", "rosa", "cinza",
];

// ─── Cache em memória ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const cache = new Map(); // chave: scope → { data, expiresAt }

function getCached(scope) {
  const entry = cache.get(scope);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCache(scope, data) {
  cache.set(scope, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Busca no Notion ──────────────────────────────────────────────────────────

async function fetchFromNotion(scope) {
  const dbId = process.env.NOTION_DATABASE_ID_GLOSSARIO;
  if (!dbId) return null; // sem configuração → fallback

  // scope="all" → sem filtro, retorna tudo (para o modal de edição)
  const body = { sorts: [{ property: "Sigla", direction: "ascending" }], page_size: 100 };

  if (scope !== "all") {
    const escopoNotion = scope === "pessoal" ? "Pessoal" : "Trabalho";
    body.filter = {
      or: [
        { property: "Escopo", select: { equals: escopoNotion } },
        { property: "Escopo", select: { equals: "Ambos" } },
      ],
    };
  }

  const res = await fetch(
    `https://api.notion.com/v1/databases/${dbId}/query`,
    {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion glossary query failed: ${err.message || res.status}`);
  }

  const data = await res.json();

  return (data.results || []).map((page) => {
    const p = page.properties || {};
    const sigla = p["Sigla"]?.title?.[0]?.plain_text || "";
    const significado = p["Significado"]?.rich_text?.[0]?.plain_text || "";
    const escopo = p["Escopo"]?.select?.name || "Trabalho";
    // Cor é Select opcional; normaliza para minúsculas
    const corRaw = p["Cor"]?.select?.name || null;
    const cor = corRaw ? String(corRaw).toLowerCase() : null;
    return { id: page.id, sigla, significado, escopo, cor };
  });
}

// ─── Função principal exportada ───────────────────────────────────────────────

async function getGlossary(scope) {
  const s = scope === "pessoal" ? "pessoal" : "trabalho";

  const cached = getCached(s);
  if (cached) return cached;

  let glossario;
  try {
    const fromNotion = await fetchFromNotion(s);
    if (fromNotion !== null) {
      glossario = fromNotion;
    } else {
      // NOTION_DATABASE_ID_GLOSSARIO não configurado: fallback só para trabalho
      glossario = s === "trabalho" ? FALLBACK_GLOSSARIO : [];
    }
  } catch (e) {
    console.error("glossary fetch error, using fallback:", e.message);
    glossario = s === "trabalho" ? FALLBACK_GLOSSARIO : [];
  }

  const result = { contexto: CONTEXTOS[s], glossario };
  setCache(s, result);
  return result;
}

// Retorna todas as entradas (sem filtro de scope) com id — para o modal CRUD
async function fetchAll() {
  const entries = await fetchFromNotion("all");
  if (entries === null) {
    // fallback: retorna as hardcoded com id=null
    return FALLBACK_GLOSSARIO.map(e => ({ ...e, id: null, escopo: "Trabalho", cor: null }));
  }
  return entries;
}

function invalidateCache(scope) {
  if (scope) {
    cache.delete(scope);
  } else {
    cache.clear(); // invalida tudo
  }
}

module.exports = { getGlossary, fetchAll, invalidateCache, CORES_VALIDAS };
