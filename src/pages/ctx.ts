import type { AppResponse } from "../http.js";
import { ServiceError, NotConfiguredError, SERVICES, type ServiceId } from "../config.js";
import { errorBox, notConfigured, errMessage } from "../ui/html.js";

export interface Ctx {
  method: string;
  path: string;
  query: URLSearchParams;
  form: Record<string, string>;
  csrf: string;
  /** Segments de chemin capturés par le routeur */
  params: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<AppResponse>;

/** Exécute un chargement et renvoie soit le HTML produit, soit une boîte d'erreur adaptée. */
export async function guarded(service: ServiceId, load: () => Promise<string>): Promise<string> {
  try {
    return await load();
  } catch (e) {
    if (e instanceof NotConfiguredError) return notConfigured(SERVICES.find((s) => s.id === service)!.label);
    if (e instanceof ServiceError) return errorBox(`${SERVICES.find((s) => s.id === e.service)!.label} : ${e.message}`);
    return errorBox(`Erreur inattendue : ${errMessage(e)}`);
  }
}

export function csrfField(ctx: Ctx): string {
  return `<input type="hidden" name="csrf" value="${ctx.csrf}">`;
}

/** Redirection avec message flash dans la query (ok= / err=). */
export function withFlash(path: string, kind: "ok" | "err", message: string): string {
  const u = new URL(path, "http://x");
  u.searchParams.set(kind, message.slice(0, 300));
  return u.pathname + u.search;
}
