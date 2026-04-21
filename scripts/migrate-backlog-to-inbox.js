/**
 * Fase 2.3 — Migração Backlog → Inbox
 *
 * O que faz:
 *   1. Busca todas as tarefas com Status = "Backlog"
 *   2. Para cada uma:
 *      - Define Status = "Inbox"
 *      - Copia o valor de "Prioridade" para "Ordem" (se existir)
 *   3. Processa em batches de 10 (paralelo controlado)
 *   4. Imprime relatório final com sucesso/falha por tarefa
 *
 * Pré-requisitos:
 *   - Node.js instalado
 *   - Arquivo .env na raiz do projeto com NOTION_API_KEY e NOTION_DATABASE_ID
 *   - npm install dotenv (só se ainda não tiver)
 *
 * Como rodar:
 *   node scripts/migrate-backlog-to-inbox.js
 *
 * Para desfazer (se necessário):
 *   node scripts/migrate-backlog-to-inbox.js --rollback
 *   (usa o arquivo backups/migration-log-<timestamp>.json gerado na migração)
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_VERSION = "2022-06-28";
const BATCH_SIZE = 10;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error("❌ NOTION_API_KEY e NOTION_DATABASE_ID precisam estar no .env");
  process.exit(1);
}

// ─── Helpers HTTP ────────────────────────────────────────────────────────────

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.notion.com",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${json.message || raw}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Parse error: ${raw}`));
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Notion API ───────────────────────────────────────────────────────────────

async function fetchBacklogTasks() {
  const tasks = [];
  let cursor = undefined;

  do {
    const body = {
      filter: {
        property: "Status",
        select: { equals: "Backlog" },
      },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };

    const res = await request("POST", `/v1/databases/${NOTION_DATABASE_ID}/query`, body);
    tasks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return tasks;
}

async function patchTask(pageId, properties) {
  return request("PATCH", `/v1/pages/${pageId}`, { properties });
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function migrate() {
  console.log("🔍 Buscando tarefas com Status = 'Backlog'...\n");

  const pages = await fetchBacklogTasks();

  if (pages.length === 0) {
    console.log("✅ Nenhuma tarefa com Status 'Backlog' encontrada. Nada a fazer.");
    return;
  }

  console.log(`📋 ${pages.length} tarefa(s) encontrada(s). Iniciando migração...\n`);

  // Monta log de migração (serve de rollback)
  const log = {
    timestamp: new Date().toISOString(),
    total: pages.length,
    entries: [],
  };

  const results = { ok: [], fail: [] };

  // Processa em batches
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (page) => {
        const prioridade = page.properties["Prioridade"]?.number ?? null;
        const titulo =
          page.properties["Título"]?.title?.[0]?.plain_text || "(sem título)";

        const properties = {
          Status: { select: { name: "Inbox" } },
          ...(prioridade !== null
            ? { Ordem: { number: prioridade } }
            : {}),
        };

        await patchTask(page.id, properties);

        log.entries.push({
          id: page.id,
          titulo,
          statusAntes: "Backlog",
          statusDepois: "Inbox",
          ordemDefinida: prioridade,
        });

        return { id: page.id, titulo };
      })
    );

    batchResults.forEach((r, idx) => {
      const page = batch[idx];
      const titulo =
        page.properties["Título"]?.title?.[0]?.plain_text || "(sem título)";
      if (r.status === "fulfilled") {
        results.ok.push(titulo);
        console.log(`  ✅ ${titulo}`);
      } else {
        results.fail.push({ titulo, erro: r.reason?.message });
        console.log(`  ❌ ${titulo} — ${r.reason?.message}`);
      }
    });
  }

  // Salva log de migração
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

  const logFile = path.join(
    backupsDir,
    `migration-log-${Date.now()}.json`
  );
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));

  // Relatório final
  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Sucesso: ${results.ok.length} tarefa(s)`);
  if (results.fail.length > 0) {
    console.log(`❌ Falha:   ${results.fail.length} tarefa(s)`);
    results.fail.forEach((f) => console.log(`   • ${f.titulo}: ${f.erro}`));
  }
  console.log(`\n📄 Log salvo em: ${logFile}`);
  console.log("─────────────────────────────────────────\n");
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

async function rollback() {
  const backupsDir = path.join(__dirname, "..", "backups");

  if (!fs.existsSync(backupsDir)) {
    console.error("❌ Pasta backups/ não encontrada.");
    process.exit(1);
  }

  // Pega o log mais recente
  const logs = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith("migration-log-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (logs.length === 0) {
    console.error("❌ Nenhum log de migração encontrado em backups/.");
    process.exit(1);
  }

  const logFile = path.join(backupsDir, logs[0]);
  const log = JSON.parse(fs.readFileSync(logFile, "utf-8"));

  console.log(`🔄 Revertendo migração de ${log.timestamp}...\n`);
  console.log(`   Arquivo de log: ${logs[0]}\n`);

  for (let i = 0; i < log.entries.length; i += BATCH_SIZE) {
    const batch = log.entries.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (entry) => {
        await patchTask(entry.id, {
          Status: { select: { name: entry.statusAntes } },
        });
        console.log(`  ↩️  ${entry.titulo} → ${entry.statusAntes}`);
      })
    );
  }

  console.log("\n✅ Rollback concluído.\n");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const isRollback = process.argv.includes("--rollback");

(isRollback ? rollback() : migrate()).catch((err) => {
  console.error("\n💥 Erro fatal:", err.message);
  process.exit(1);
});
