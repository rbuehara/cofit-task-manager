const requireAuth = require("./_auth");
const { polishTask } = require("./_polish");

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const parsed = await polishTask(req.body || {});
    return res.status(200).json(parsed);
  } catch (e) {
    console.error("ai-polish error:", e);
    const status = e.status || (e.message === "title is required" ? 400 : 500);
    return res.status(status).json({ error: e.message });
  }
}
