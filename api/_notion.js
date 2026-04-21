// Shared helpers for Notion API calls

const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function databaseId() {
  return process.env.NOTION_DATABASE_ID;
}

// Build Notion property object from our flat task data
function buildProperties(task) {
  const props = {};

  if (task.title !== undefined) {
    props["Título"] = { title: [{ text: { content: task.title || "" } }] };
  }
  if (task.description !== undefined) {
    props["Descrição"] = { rich_text: [{ text: { content: task.description || "" } }] };
  }
  if (task.column !== undefined) {
    props["Status"] = { select: { name: task.column } };
  }
  if (task.tags !== undefined) {
    props["Categoria"] = {
      multi_select: (task.tags || []).map((t) => ({ name: t })),
    };
  }
  if (task.priority !== undefined) {
    props["Prioridade"] = { number: task.priority || null };
  }
  if (task.reason !== undefined) {
    props["Justificativa IA"] = { rich_text: [{ text: { content: task.reason || "" } }] };
  }
  if (task.appId !== undefined) {
    props["App ID"] = { rich_text: [{ text: { content: task.appId || "" } }] };
  }
  if (task.duration !== undefined) {
    props["Tempo de execução"] = { rich_text: [{ text: { content: task.duration || "" } }] };
  }
  if (task.deadline !== undefined) {
    props["Prazo"] = task.deadline ? { date: { start: task.deadline } } : { date: null };
  }
  if (task.createdAt !== undefined) {
    props["Criado em"] = task.createdAt ? { date: { start: task.createdAt } } : { date: null };
  }
  if (task.startedAt !== undefined) {
    props["Início execução"] = task.startedAt ? { date: { start: task.startedAt } } : { date: null };
  }
  if (task.completedAt !== undefined) {
    props["Concluído em"] = task.completedAt ? { date: { start: task.completedAt } } : { date: null };
  }

  return props;
}

// Parse a Notion page into our flat task object
function parsePage(page) {
  const p = page.properties || {};

  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || "";
  const getTitle = (prop) => prop?.title?.[0]?.plain_text || "";
  const getDate = (prop) => prop?.date?.start || null;
  const getNumber = (prop) => prop?.number ?? null;
  const getSelect = (prop) => prop?.select?.name || "";
  const getMultiSelect = (prop) => (prop?.multi_select || []).map((o) => o.name);

  return {
    id: page.id,
    url: page.url || "",
    title: getTitle(p["Título"]),
    description: getText(p["Descrição"]),
    column: getSelect(p["Status"]) || "Inbox",
    tags: getMultiSelect(p["Categoria"]),
    priority: getNumber(p["Prioridade"]),
    reason: getText(p["Justificativa IA"]),
    appId: getText(p["App ID"]),
    duration: getText(p["Tempo de execução"]),
    deadline: getDate(p["Prazo"]),
    createdAt: getDate(p["Criado em"]),
    startedAt: getDate(p["Início execução"]),
    completedAt: getDate(p["Concluído em"]),
  };
}

module.exports = { notionHeaders, databaseId, buildProperties, parsePage };
