import { getStore } from "@netlify/blobs";
import { BOARDS, cleanName, pub, upsert } from "../lib/lbcore.mjs";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...cors}});
const ID_RE=/^[a-f0-9]{16,40}$/;

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  // preview and branch deploys (deploy-preview-3--site.netlify.app) get their own board, so test scores never reach the real one
  const live = !url.hostname.includes("--");
  const store = getStore({ name: live ? "leaderboard" : "leaderboard-preview", consistency: "strong" });

  if (req.method === "GET") {
    const board = url.searchParams.get("board"), id = url.searchParams.get("id") || "";
    if (!BOARDS[board]) return json({ error: "unknown board" }, 400);
    const list = (await store.get(board, { type: "json" })) || [];
    const yi = ID_RE.test(id) ? list.findIndex(e => e.id === id) : -1;
    return json({ board, total: list.length, top: list.slice(0, 50).map(pub), you: yi >= 0 ? pub(list[yi], yi) : null });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b; try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const B = BOARDS[b && b.board];
  if (!B) return json({ error: "unknown board" }, 400);
  if (!ID_RE.test(String(b.id || ""))) return json({ error: "bad id" }, 400);
  const name = cleanName(b.name);
  if (!name) return json({ error: "Pick a different callsign: 2 to 16 letters or numbers" }, 400);
  const x = B.clean(b.stats || {});
  if (!x) return json({ error: "Those flight stats don't look right" }, 400);

  // gentle rate limit per player
  const rk = "rl-" + b.board + "-" + b.id, last = await store.get(rk, { type: "json" });
  if (last && Date.now() - last.t < 8000) return json({ error: "Slow down a moment, then try again" }, 429);
  await store.setJSON(rk, { t: Date.now() });

  const entry = { id: b.id, n: name, s: B.score(x), x, t: Date.now(), d: new Date().toISOString().slice(0, 10) };
  const list = (await store.get(b.board, { type: "json" })) || [];
  const r = upsert(list, entry);
  await store.setJSON(b.board, r.list);
  return json({ board: b.board, score: entry.s, best: r.best, rank: r.rank, improved: r.improved, total: r.list.length, top: r.list.slice(0, 10).map(pub) });
};

export const config = { path: "/api/leaderboard" };
