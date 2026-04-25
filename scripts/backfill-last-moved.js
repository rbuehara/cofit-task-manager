/**
 * Backfill — lastMovedAt (Fase 5)
 *
 * Para cada task sem "Última movimentação" definida, seta o campo igual a "Criado em".
 * Roda uma única vez por database; depois pode ser descartado.
 *
 * Uso:
 *   node scripts/backfill-last-moved.js                  # scope trabalho (default)
 *   node scripts/backfill-last-moved.js pessoal          # scope pessoal
 *
 * Pré-requisitos:
 *   - Variáveis de ambiente: NOTION_API_KEY, NOTION_DATABASE_ID_TRABALHO (ou NOTION_DATABASE_ID),
 *     NOTION_DATABASE_ID_PESSOAL (se rodar com escopo pessoal).
 *   - Pode usar arquivo .env local: `node -r dotenv/config scripts/backfill-last-moved.js`
 */

const NOTION_VERSION = "2022-06-28";

const scope = process.argv[2] || "trabalho";

function databaseId() {
  if (scope === "pessoal") {
    const id = process.env.NOTION_DATABASE_ID_PESSOAL;
    if (!id) throw new Error("NOTION_DATABASE_ID_PESSOAL não configurado");
    return id;
  }
  const id = process.env.NOTION_DATABASE_ID_TRABALHO || process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID_TRABALHO (ou NOTION_DATABASE_ID) não configurado");
  return id;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function fetchAllPages(dbId) {
  const pages = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`Notion query falhou: ${err.message || r.status}`);
    }

    const data = await r.json();
    pages.push(...(data.results || []));
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return pages;
}

function getDate(prop) {
  return prop?.date?.start || null;
}

async function patchLastMovedAt(pageId, value) {
  const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        "Última movimentação": { date: { start: value } },
      },
    }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`PATCH falhou para ${pageId}: ${err.message || r.status}`);
  }
}

// Limita concorrência para não estourar o rate limit do Notion (~3 req/s)
async function withConcurrencyLimit(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { error: e.message };
      }
    }
  }
  const workers = Array.from({ length: limit }, () => next());
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!process.env.NOTION_API_KEY) throw new Error("NOTION_API_KEY não configurado");

  const dbId = databaseId();
  console.log(`\nBackfill lastMovedAt — scope: ${scope} | database: ${dbId}\n`);

  console.log("Buscando tasks...");
  const pages = await fetchAllPages(dbId);
  console.log(`Total de tasks encontradas: ${pages.length}`);

  const needsBackfill = pages.filter(p => {
    const lastMovedAt = getDate(p.properties?.["Última movimentação"]);
    return !lastMovedAt;
  });

  console.log(`Tasks sem lastMovedAt: ${needsBackfill.length}`);

  if (needsBackfill.length === 0) {
    console.log("Nada a fazer. Todas as tasks já têm Última movimentação.");
    return;
  }

  console.log(`\nIniciando backfill de ${needsBackfill.length} tasks...\n`);

  let ok = 0;
  let fail = 0;

  const patchTasks = needsBackfill.map(page => async () => {
    const createdAt = getDate(page.properties?.["Criado em"]);
    // Fallback: se não tiver "Criado em" no Notion, usa created_time da página
    const value = createdAt || page.created_time;

    if (!value) {
      console.warn(`  SKIP ${page.id} — sem data de criação disponível`);
      return;
    }

    try {
      await patchLastMovedAt(page.id, value);
      ok++;
      const title = page.properties?.["Título"]?.title?.[0]?.plain_text || "(sem título)";
      console.log(`  OK  ${page.id.slice(0, 8)}... | ${value.slice(0, 10)} | ${title.slice(0, 50)}`);
    } catch (e) {
      fail++;
      console.error(`  ERR ${page.id.slice(0, 8)}... | ${e.message}`);
    }
  });

  // Rate limit Notion: ~3 req/s — usa concorrência 2 para margem de segurança
  await withConcurrencyLimit(patchTasks, 2);

  console.log(`\nConcluído. OK: ${ok} | Falhas: ${fail}`);
  if (fail > 0) {
    console.log("Tarefas com falha podem ser reexecutadas rodando o script novamente (idempotente).");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("\nErro fatal:", e.message);
  process.exit(1);
});
