// Local preview without Netlify: serves /public and the API with an in-memory store.
// Usage: ADMIN_PIN=1234 node dev-server.mjs   (then open http://localhost:8888)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createApp, servePhoto } from "./netlify/lib/app.mjs";

export function memoryStore() {
  const m = new Map();
  return {
    async get(k, o = {}) { if (!m.has(k)) return null; const v = m.get(k).data; return o.type === "json" ? JSON.parse(v) : v; },
    async getWithMetadata(k) { return m.has(k) ? { data: m.get(k).data, metadata: m.get(k).metadata } : null; },
    async set(k, data, o = {}) { m.set(k, { data, metadata: o.metadata || {} }); return { modified: true }; },
    async setJSON(k, v) { m.set(k, { data: JSON.stringify(v), metadata: {} }); return { modified: true }; },
    async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    async delete(k) { m.delete(k); },
  };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

export function startServer(port = 8888, env = { ADMIN_PIN: process.env.ADMIN_PIN || "1234" }) {
  const files = memoryStore();
  const app = createApp({ data: memoryStore(), files, env: (k) => env[k] });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      let r;
      if (url.pathname.startsWith("/api/")) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        r = await app(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body, duplex: "half" }));
      } else if (url.pathname.startsWith("/photo/item/")) {
        r = await servePhoto(files, url.pathname.split("/")[3]);
      } else {
        let p = url.pathname === "/" ? "/index.html" : url.pathname === "/admin" ? "/admin.html" : url.pathname;
        p = normalize(p).replace(/^(\.\.[/\\])+/, "");
        const f = await readFile(join(import.meta.dirname, "public", p)).catch(() => null);
        r = f ? new Response(f, { headers: { "content-type": TYPES[extname(p)] || "application/octet-stream" } }) : new Response("Not found", { status: 404 });
      }
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { console.error(e); res.writeHead(500); res.end("error"); }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer(Number(process.env.PORT) || 8888);
  console.log(`Pahina Rentals dev server on http://localhost:${process.env.PORT || 8888}`);
}
