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

// ─── Fallback hardcoded (retrocompatibilidade sem NOTION_DATABASE_ID_GLOSSARIO) ──

const FALLBACK_GLOSSARIO = [
  { sigla: "COFIT", significado: "Coordenadoria de Fiscalização do IPVA e do ITCD" },
  { sigla: "SAT", significado: "Superintendência de Administração Tributária" },
  { sigla: "UFIPVA", significado: "Unidade de Fiscalização do IPVA" },
  { sigla: "UFITCD", significado: "Unidade de Fiscalização do ITCD" },
  { sigla: "COTIN", significado: "Coordenadoria de Tecnologia da Informação" },
  { sigla: "UGSIS-Cred", significado: "Unidade de Gestão de Sistemas de Crédito Tributário, Arrecadação e Outros Tributos" },
  { sigla: "CELEG", significado: "Coordenadoria de Legislação da SEFAZ-MS" },
  { sigla: "DIT", significado: "Declaração de ITCD" },
  { sigla: "CRD", significado: "Sistema de Gestão de Créditos Tributários" },
  { sigla: "IPVA", significado: "Imposto sobre a Propriedade de Veículos Automotores" },
  { sigla: "ITCD", significado: "Imposto sobre Transmissão Causa Mortis e Doação" },
  { sigla: "SLI", significado: "Superintendência de Logística e Infraestrutura" },
  { sigla: "SUAD", significado: "Superintendência de Administração" },
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
    return { id: page.id, sigla, significado, escopo };
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
    return FALLBACK_GLOSSARIO.map(e => ({ ...e, id: null, escopo: "Trabalho" }));
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

module.exports = { getGlossary, fetchAll, invalidateCache };
