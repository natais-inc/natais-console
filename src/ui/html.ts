/** Aides HTML : échappement systématique, mise en page, composants. */

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Attribut href sûr : n'autorise que http(s) et les chemins relatifs. */
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return esc(url);
  return "#";
}

export function fmtDate(input: number | string | null | undefined): string {
  if (input === null || input === undefined || input === "" || input === 0) return "—";
  const ms = typeof input === "number" ? (input < 1e12 ? input * 1000 : input) : Date.parse(input.replace(" ", "T"));
  if (Number.isNaN(ms)) return esc(String(input));
  return new Date(ms).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
}

export function fmtRelative(input: number | string | null | undefined): string {
  if (input === null || input === undefined || input === "" || input === 0) return "—";
  const ms = typeof input === "number" ? (input < 1e12 ? input * 1000 : input) : Date.parse(input.replace(" ", "T"));
  if (Number.isNaN(ms)) return esc(String(input));
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const units: [number, string][] = [
    [60_000, "min"],
    [3_600_000, "h"],
    [86_400_000, "j"],
  ];
  if (abs < 60_000) return '<span class="nw">à l\'instant</span>';
  let label = "";
  if (abs < 3_600_000) label = `${Math.round(abs / units[0]![0])} ${units[0]![1]}`;
  else if (abs < 86_400_000) label = `${Math.round(abs / units[1]![0])} ${units[1]![1]}`;
  else label = `${Math.round(abs / units[2]![0])} ${units[2]![1]}`;
  return `<span class="nw">${future ? `dans ${label}` : `il y a ${label}`}</span>`;
}

/** Montant en unité minimale (cents) → texte. Gère les devises sans décimales (JPY, KRW…). */
export function fmtMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: code });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(minor / Math.pow(10, digits));
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

export type Tone = "ok" | "warn" | "err" | "muted" | "info";

export function badge(label: string, tone: Tone = "muted"): string {
  return `<span class="badge badge-${tone}">${esc(label)}</span>`;
}

export function stateTone(state: string): Tone {
  const s = state.toLowerCase();
  if (["ready", "succeeded", "verified", "delivered", "active", "paid"].includes(s)) return "ok";
  if (["error", "failed", "bounced", "complained", "canceled", "cancelled", "failure", "uncollectible", "void"].includes(s)) return "err";
  if (["building", "queued", "initializing", "pending", "processing", "open", "sent", "delivery_delayed", "temporary_failure", "requires_payment_method", "requires_action"].includes(s)) return "warn";
  return "muted";
}

export function stateBadge(state: string | null | undefined): string {
  if (!state) return badge("inconnu");
  return badge(state, stateTone(state));
}

export function card(title: string, body: string, opts: { sub?: string; actions?: string } = {}): string {
  return `<section class="card">
  <header class="card-h"><div><h2>${esc(title)}</h2>${opts.sub ? `<p class="sub">${esc(opts.sub)}</p>` : ""}</div>${opts.actions ?? ""}</header>
  <div class="card-b">${body}</div>
</section>`;
}

export function table(headers: string[], rows: string[][], emptyMsg = "Aucune donnée."): string {
  if (rows.length === 0) return `<p class="empty">${esc(emptyMsg)}</p>`;
  return `<div class="tbl-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function errorBox(message: string, tone: Tone = "err"): string {
  return `<div class="alert alert-${tone}">${esc(message)}</div>`;
}

export function notConfigured(label: string): string {
  return `<div class="alert alert-info">${esc(label)} n'est pas configuré. <a href="/settings">Ajouter les clés dans Configuration →</a></div>`;
}

export function flash(query: URLSearchParams): string {
  const ok = query.get("ok");
  const err = query.get("err");
  let out = "";
  if (ok) out += errorBox(ok, "ok");
  if (err) out += errorBox(err, "err");
  return out;
}

export function extLink(url: string | null | undefined, label: string): string {
  if (!url) return esc(label);
  return `<a href="${safeHref(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/** Résumé d'erreur sûr pour l'affichage (jamais de clé dedans). */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
