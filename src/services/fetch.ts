import { ServiceError, type ServiceId } from "../config.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiCallOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/**
 * Appel HTTP vers une API tierce, avec délai maximal et message d'erreur lisible.
 * Ne journalise jamais les en-têtes (ils contiennent les clés).
 */
export async function apiCall<T>(service: ServiceId, url: string, opts: ApiCallOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers,
      body: opts.body,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error && e.name === "AbortError" ? "délai dépassé" : e instanceof Error ? e.message : String(e);
    throw new ServiceError(service, `Impossible de joindre l'API (${msg}).`);
  }
  clearTimeout(timer);
  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!res.ok) {
    throw new ServiceError(service, extractErrorMessage(data) ?? `HTTP ${res.status}`, res.status);
  }
  return data as T;
}

function extractErrorMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data.slice(0, 300);
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const err = d["error"];
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const m = (err as Record<string, unknown>)["message"];
    if (typeof m === "string") return m;
  }
  const m = d["message"];
  if (typeof m === "string") return m;
  return undefined;
}
