import type { AppRequest, AppResponse } from "./http.js";
import { parseCookies, parseForm, html, redirect, text } from "./http.js";
import { SESSION_COOKIE, verifySession, createSession, checkPassword, sessionCookie, clearSessionCookie, expectedPassword } from "./auth.js";
import { loginPage, setupPage } from "./ui/layout.js";
import { isDemo, env } from "./config.js";
import type { Ctx, Handler } from "./pages/ctx.js";
import { dashboard } from "./pages/dashboard.js";
import { deploymentsIndex, deploymentsProject, deploymentsRedeploy } from "./pages/deployments.js";
import { codeIndex, codeRepo } from "./pages/code.js";
import { domainsIndex, domainDetail, recordEditPage, recordCreate, recordEdit, recordDelete } from "./pages/domains.js";
import { emailIndex, emailSend } from "./pages/email.js";
import { paymentsIndex, paymentsCreateLink } from "./pages/payments.js";
import { settingsIndex } from "./pages/settings.js";

interface Route {
  method: "GET" | "POST";
  pattern: string;
  handler: Handler;
}

const ROUTES: Route[] = [
  { method: "GET", pattern: "/", handler: dashboard },
  { method: "GET", pattern: "/deployments", handler: deploymentsIndex },
  { method: "POST", pattern: "/deployments/redeploy", handler: deploymentsRedeploy },
  { method: "GET", pattern: "/deployments/:projectId", handler: deploymentsProject },
  { method: "GET", pattern: "/code", handler: codeIndex },
  { method: "GET", pattern: "/code/:owner/:repo", handler: codeRepo },
  { method: "GET", pattern: "/domains", handler: domainsIndex },
  { method: "GET", pattern: "/domains/:domain", handler: domainDetail },
  { method: "POST", pattern: "/domains/:domain/records", handler: recordCreate },
  { method: "GET", pattern: "/domains/:domain/records/:id", handler: recordEditPage },
  { method: "POST", pattern: "/domains/:domain/records/:id/edit", handler: recordEdit },
  { method: "POST", pattern: "/domains/:domain/records/:id/delete", handler: recordDelete },
  { method: "GET", pattern: "/email", handler: emailIndex },
  { method: "POST", pattern: "/email/send", handler: emailSend },
  { method: "GET", pattern: "/payments", handler: paymentsIndex },
  { method: "POST", pattern: "/payments/links", handler: paymentsCreateLink },
  { method: "GET", pattern: "/settings", handler: settingsIndex },
];

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = s[i]!;
    if (seg.startsWith(":")) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(val);
      } catch {
        return null;
      }
      if (!/^[A-Za-z0-9._-]{1,200}$/.test(decoded)) return null;
      params[seg.slice(1)] = decoded;
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}

function isSecure(req: AppRequest): boolean {
  const proto = req.headers["x-forwarded-proto"];
  return proto === "https" || (process.env["VERCEL"] === "1");
}

/** Vérifie que les requêtes POST proviennent bien de cette origine (défense CSRF n°1). */
function sameOrigin(req: AppRequest): boolean {
  const origin = req.headers["origin"];
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"];
  if (!origin || !host) return !origin; // pas d'en-tête Origin : formulaires anciens ; le jeton CSRF reste exigé
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function handle(req: AppRequest): Promise<AppResponse> {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();
  const secure = isSecure(req);

  if (path === "/healthz") return text("ok");
  if (path === "/favicon.ico") return { status: 204, headers: {}, body: "" };

  if (!expectedPassword()) return html(setupPage(), 503);

  const cookies = parseCookies(req.headers["cookie"]);
  const session = verifySession(cookies[SESSION_COOKIE]);

  if (path === "/login") {
    // L'indice « mot de passe : demo » n'est vrai que si aucun CONSOLE_PASSWORD n'est défini.
    const demoHint = isDemo() && !env("CONSOLE_PASSWORD");
    if (method === "GET") return session ? redirect("/") : html(loginPage(undefined, demoHint));
    if (method === "POST") {
      if (!sameOrigin(req)) return html(loginPage("Requête refusée (origine)."), 403);
      const form = parseForm(req.body);
      if (!checkPassword(form["password"] ?? "")) {
        await new Promise((r) => setTimeout(r, 400)); // ralentit un peu les essais séquentiels ; choisir un mot de passe long reste la vraie défense
        return html(loginPage("Mot de passe incorrect.", demoHint), 401);
      }
      const { token } = createSession();
      return redirect("/", { "set-cookie": sessionCookie(token, secure) });
    }
  }

  if (path === "/logout" && method === "POST") {
    return redirect("/login", { "set-cookie": clearSessionCookie(secure) });
  }

  if (!session) return redirect("/login");

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const params = match(route.pattern, path);
    if (!params) continue;
    const form = method === "POST" ? parseForm(req.body) : {};
    if (method === "POST") {
      if (!sameOrigin(req) || form["csrf"] !== session.csrf) {
        return html(`<!doctype html><meta charset="utf-8"><p>Requête refusée (jeton CSRF invalide ou expiré). <a href="${path}">Recharger</a></p>`, 403);
      }
    }
    const ctx: Ctx = { method, path, query: url.searchParams, form, csrf: session.csrf, params };
    try {
      return await route.handler(ctx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return html(`<!doctype html><meta charset="utf-8"><h1>Erreur</h1><p>${msg.replace(/[<>&]/g, "")}</p><p><a href="/">Retour</a></p>`, 500);
    }
  }
  return html(`<!doctype html><meta charset="utf-8"><h1>Page introuvable</h1><p><a href="/">Retour au tableau de bord</a></p>`, 404);
}
