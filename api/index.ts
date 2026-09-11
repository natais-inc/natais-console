import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "../src/app.js";

/**
 * Point d'entrée Vercel (fonction serverless Node). Toutes les routes y sont réécrites (vercel.json).
 * Vercel peut avoir déjà analysé le corps (req.body) : on le remet en chaîne x-www-form-urlencoded.
 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;

  let body = "";
  if (typeof req.body === "string") body = req.body;
  else if (Buffer.isBuffer(req.body)) body = req.body.toString("utf8");
  else if (req.body && typeof req.body === "object") {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) p.set(k, String(v));
    body = p.toString();
  } else if (req.body === undefined && !req.readableEnded) {
    // Flux non encore lu (helpers Node de Vercel désactivés) : on le lit nous-mêmes.
    body = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", () => resolve(""));
    });
  }

  try {
    const out = await handle({ method: req.method ?? "GET", url: req.url ?? "/", headers, body });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
  } catch (e) {
    console.error("Erreur non gérée :", e instanceof Error ? e.message : e);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Erreur interne");
  }
}
