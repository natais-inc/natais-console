/**
 * Abstractions HTTP minimales, indépendantes du serveur (Node http local ou fonction Vercel).
 */

export interface AppRequest {
  method: string;
  /** Chemin + query, ex. "/domains?x=1" */
  url: string;
  headers: Record<string, string | undefined>;
  body: string;
}

export interface AppResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      // cookie mal formé (autre application sur le même domaine) : on l'ignore
    }
  }
  return out;
}

export function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  for (const [k, v] of params) out[k] = v;
  return out;
}

export function html(body: string, status = 200, extraHeaders: Record<string, string | string[]> = {}): AppResponse {
  return {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      ...extraHeaders,
    },
    body,
  };
}

export function redirect(location: string, extraHeaders: Record<string, string | string[]> = {}): AppResponse {
  return { status: 303, headers: { location, "cache-control": "no-store", ...extraHeaders }, body: "" };
}

export function json(data: unknown, status = 200): AppResponse {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(data),
  };
}

export function text(body: string, status = 200): AppResponse {
  return { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }, body };
}
