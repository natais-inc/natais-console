import { esc } from "./html.js";
import { isDemo, configStatus } from "../config.js";

export const APP_NAME = "Console NATAIS";

const NAV: { href: string; label: string; icon: string; service?: string }[] = [
  { href: "/", label: "Tableau de bord", icon: "◫" },
  { href: "/deployments", label: "Déploiements", icon: "▲", service: "vercel" },
  { href: "/code", label: "Code", icon: "⌥", service: "github" },
  { href: "/domains", label: "Domaines & DNS", icon: "◎", service: "porkbun" },
  { href: "/email", label: "Courriels", icon: "✉", service: "resend" },
  { href: "/payments", label: "Paiements", icon: "$", service: "stripe" },
  { href: "/settings", label: "Configuration", icon: "⚙" },
];

const CSS = `
:root{--bg:#f5f6f8;--panel:#fff;--ink:#16181d;--muted:#6b7280;--line:#e5e7eb;--brand:#1f4fd8;--brand-ink:#fff;--side:#111827;--side-ink:#d1d5db;--ok:#137a3a;--ok-bg:#e6f6ec;--warn:#8a5a00;--warn-bg:#fff4d6;--err:#a3212b;--err-bg:#fde8ea;--info:#1e4f9e;--info-bg:#e6effb;--muted-bg:#eef0f3}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.shell{display:flex;min-height:100vh}
.side{width:230px;flex:0 0 230px;background:var(--side);color:var(--side-ink);padding:18px 14px;display:flex;flex-direction:column;gap:6px}
.side .brand{color:#fff;font-weight:700;font-size:16px;padding:6px 10px 14px;letter-spacing:.2px}
.side .brand small{display:block;font-weight:400;color:#9ca3af;font-size:11px;margin-top:2px}
.side a.nav{display:flex;align-items:center;gap:10px;color:var(--side-ink);padding:9px 10px;border-radius:8px}
.side a.nav:hover{background:#1f2937;text-decoration:none}
.side a.nav.active{background:#1f2937;color:#fff}
.side a.nav .ic{width:18px;text-align:center;opacity:.8}
.side a.nav .dot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:#4b5563}
.side a.nav .dot.on{background:#22c55e}
.side .foot{margin-top:auto;font-size:12px;color:#9ca3af;padding:10px}
.side .foot form{margin:8px 0 0}
main{flex:1;min-width:0;padding:28px 32px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:0}
.lead{color:var(--muted);margin:0 0 20px}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(400px,1fr))}
.nw{white-space:nowrap}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.card-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.card-h .sub{margin:2px 0 0;color:var(--muted);font-size:12px}
.card-b{padding:14px 16px}
.stack{display:grid;gap:16px}
.tbl-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-weight:600;font-size:12px;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:var(--muted-bg);color:var(--muted);white-space:nowrap}
.badge-ok{background:var(--ok-bg);color:var(--ok)}.badge-warn{background:var(--warn-bg);color:var(--warn)}.badge-err{background:var(--err-bg);color:var(--err)}.badge-info{background:var(--info-bg);color:var(--info)}
.alert{padding:10px 12px;border-radius:8px;margin:0 0 14px;font-size:13px}
.alert-ok{background:var(--ok-bg);color:var(--ok)}.alert-err{background:var(--err-bg);color:var(--err)}.alert-warn{background:var(--warn-bg);color:var(--warn)}.alert-info{background:var(--info-bg);color:var(--info)}
.empty{color:var(--muted);margin:0;font-size:13px}
.kpi{display:flex;flex-wrap:wrap;gap:16px}.kpi div{min-width:120px}.kpi b{display:block;font-size:22px;font-weight:700}.kpi span{color:var(--muted);font-size:12px}
form.inline{display:inline}
.btn{display:inline-block;border:1px solid var(--line);background:#fff;color:var(--ink);padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit}
.btn:hover{background:#f3f4f6;text-decoration:none}.btn-primary{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}.btn-primary:hover{background:#1a43b8}
.btn-danger{color:var(--err);border-color:#f3c5c9}.btn-danger:hover{background:var(--err-bg)}.btn-sm{padding:3px 8px;font-size:12px}
.form{display:grid;gap:10px;max-width:640px}.form label{display:grid;gap:4px;font-size:13px;font-weight:600}
.form input,.form select,.form textarea{font:inherit;padding:8px 10px;border:1px solid #cfd3da;border-radius:8px;background:#fff}
.form .row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.form .hint{font-weight:400;color:var(--muted);font-size:12px}
.login{max-width:380px;margin:12vh auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px}
.login h1{margin-bottom:12px}
.tag{font-size:11px;color:var(--muted)}
.env{display:grid;gap:8px}.env div{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.env code{background:var(--muted-bg);padding:2px 6px;border-radius:6px;font-size:12px}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
@media(max-width:820px){.grid{grid-template-columns:1fr}.shell{flex-direction:column}.side{width:auto;flex:none;flex-direction:row;flex-wrap:wrap;align-items:center}.side .brand{width:100%;padding-bottom:6px}.side .foot{margin:0 0 0 auto}main{padding:18px 16px}}
`;

export interface PageOptions {
  title: string;
  path: string;
  body: string;
  lead?: string;
  csrf?: string;
}

export function page(opts: PageOptions): string {
  const status = new Map(configStatus().map((s) => [s.id, s.configured]));
  const nav = NAV.map((n) => {
    const active = n.href === "/" ? opts.path === "/" : opts.path.startsWith(n.href);
    const dot = n.service ? `<span class="dot ${status.get(n.service as never) ? "on" : ""}" title="${status.get(n.service as never) ? "configuré" : "non configuré"}"></span>` : "";
    return `<a class="nav ${active ? "active" : ""}" href="${n.href}"><span class="ic">${n.icon}</span>${esc(n.label)}${dot}</a>`;
  }).join("");
  const demo = isDemo() ? `<div class="alert alert-warn" style="margin:0 0 16px">Mode démo : toutes les données affichées sont fictives. Désactivez <code>DEMO_MODE</code> et ajoutez vos clés pour piloter vos vrais services.</div>` : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(opts.title)} · ${APP_NAME}</title>
<style>${CSS}</style>
</head>
<body>
<div class="shell">
  <aside class="side">
    <div class="brand">${APP_NAME}<small>Vercel · GitHub · Porkbun · Resend · Stripe</small></div>
    ${nav}
    <div class="foot">Session de 12 h<form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(opts.csrf ?? "")}"><button class="btn btn-sm" type="submit">Se déconnecter</button></form></div>
  </aside>
  <main>
    ${demo}
    <h1>${esc(opts.title)}</h1>
    ${opts.lead ? `<p class="lead">${esc(opts.lead)}</p>` : ""}
    ${opts.body}
  </main>
</div>
<script>
document.addEventListener("submit",function(e){var f=e.target;if(f&&f.dataset&&f.dataset.confirm&&!window.confirm(f.dataset.confirm))e.preventDefault();});
</script>
</body>
</html>`;
}

export function loginPage(error?: string, demo = false): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connexion · ${APP_NAME}</title><style>${CSS}</style></head>
<body><div class="login">
<h1>${APP_NAME}</h1>
<p class="lead">Une seule tour de contrôle pour vos déploiements, votre code, vos domaines, vos courriels et vos paiements.</p>
${error ? `<div class="alert alert-err">${esc(error)}</div>` : ""}
${demo ? `<div class="alert alert-warn">Mode démo — mot de passe : <b>demo</b></div>` : ""}
<form method="post" action="/login" class="form">
<label>Mot de passe<input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button class="btn btn-primary" type="submit">Se connecter</button>
</form>
</div></body></html>`;
}

export function setupPage(): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Installation · ${APP_NAME}</title><style>${CSS}</style></head>
<body><div class="login" style="max-width:560px">
<h1>${APP_NAME} — installation</h1>
<div class="alert alert-warn">Aucun mot de passe n'est défini : l'application refuse de démarrer sans protection.</div>
<p>Définissez la variable d'environnement <code>CONSOLE_PASSWORD</code> (et idéalement <code>SESSION_SECRET</code>, une chaîne aléatoire longue), puis redéployez. Pour essayer l'interface avec des données fictives, définissez <code>DEMO_MODE=1</code> (mot de passe « demo »).</p>
<p class="tag">Les clés des services (Vercel, GitHub, Resend, Porkbun, Stripe) se configurent ensuite, aussi par variables d'environnement — la liste complète est dans la page Configuration.</p>
</div></body></html>`;
}
