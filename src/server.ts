import { createServer } from "node:http";
import { handle } from "./app.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const MAX_BODY = 256 * 1024;

createServer((req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on("data", (c: Buffer) => {
    size += c.length;
    if (size > MAX_BODY) {
      res.writeHead(413).end("Payload too large");
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", async () => {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
    try {
      const out = await handle({ method: req.method ?? "GET", url: req.url ?? "/", headers, body: Buffer.concat(chunks).toString("utf8") });
      res.writeHead(out.status, out.headers);
      res.end(out.body);
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Erreur interne");
    }
  });
}).listen(PORT, () => {
  console.log(`Console NATAIS : http://localhost:${PORT}${process.env["DEMO_MODE"] ? "  (mode démo)" : ""}`);
});
