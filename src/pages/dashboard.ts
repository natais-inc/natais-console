import type { Ctx } from "./ctx.js";
import { guarded } from "./ctx.js";
import { html } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, stateBadge, badge, fmtRelative, fmtMoney, extLink, truncate, safeHref } from "../ui/html.js";
import * as vercel from "../services/vercel.js";
import * as github from "../services/github.js";
import * as resend from "../services/resend.js";
import * as porkbun from "../services/porkbun.js";
import * as stripe from "../services/stripe.js";

export async function dashboard(ctx: Ctx) {
  const [deploys, pulls, domains, emails, money] = await Promise.all([
    guarded("vercel", async () => {
      const d = await vercel.listDeployments(undefined, 8);
      return table(
        ["Projet", "État", "Cible", "Commit", "Quand"],
        d.map((x) => [
          `<a href="/deployments">${esc(x.projectName)}</a>`,
          stateBadge(x.state),
          badge(x.target === "production" ? "prod" : "aperçu", x.target === "production" ? "info" : "muted"),
          esc(truncate(x.commitMessage ?? "—", 50)),
          fmtRelative(x.createdAt),
        ]),
        "Aucun déploiement récent.",
      );
    }),
    guarded("github", async () => {
      const p = await github.openPullRequests();
      return table(
        ["PR", "Dépôt", "Auteur", "Ouverte"],
        p.slice(0, 8).map((x) => [
          `${extLink(x.url, `#${x.number} ${truncate(x.title, 45)}`)}${x.draft ? " " + badge("brouillon") : ""}`,
          esc(x.repo),
          esc(x.author),
          fmtRelative(x.createdAt),
        ]),
        "Aucune PR ouverte.",
      );
    }),
    guarded("porkbun", async () => {
      const d = await porkbun.listDomains();
      const soon = (exp: string) => {
        const ms = Date.parse(exp.replace(" ", "T"));
        if (Number.isNaN(ms)) return null;
        return Math.round((ms - Date.now()) / 86_400_000);
      };
      return table(
        ["Domaine", "Expire", "Renouvellement auto"],
        d.map((x) => {
          const days = soon(x.expireDate);
          const tone = days !== null && days < 30 ? "err" : days !== null && days < 90 ? "warn" : "ok";
          return [
            `<a href="/domains/${esc(x.domain)}">${esc(x.domain)}</a>`,
            days === null ? esc(x.expireDate) : badge(days < 0 ? "expiré" : `dans ${days} j`, tone),
            x.autoRenew ? badge("oui", "ok") : badge("non", "warn"),
          ];
        }),
        "Aucun domaine.",
      );
    }),
    guarded("resend", async () => {
      const e = await resend.listEmails(8);
      return table(
        ["Objet", "À", "État", "Quand"],
        e.map((x) => [esc(truncate(x.subject, 45)), esc(x.to.join(", ")), stateBadge(x.lastEvent), fmtRelative(x.createdAt)]),
        "Aucun courriel récent.",
      );
    }),
    guarded("stripe", async () => {
      const [b, inv] = await Promise.all([stripe.balance(), stripe.openInvoices(5)]);
      const sum = (arr: { amount: number; currency: string }[]) => arr.map((a) => fmtMoney(a.amount, a.currency)).join(" + ") || "0";
      const kpi = `<div class="kpi"><div><b>${esc(sum(b.available))}</b><span>disponible</span></div><div><b>${esc(sum(b.pending))}</b><span>en attente</span></div><div><b>${inv.length}</b><span>factures ouvertes</span></div></div>`;
      const mode = b.livemode ? "" : `<p class="tag" style="margin:8px 0 0">${badge("mode test", "warn")} clé de test Stripe — aucun argent réel.</p>`;
      const rows = inv.map((i) => [i.hostedUrl ? `<a href="${safeHref(i.hostedUrl)}" target="_blank" rel="noopener noreferrer">${esc(i.number ?? i.id)}</a>` : esc(i.number ?? i.id), esc(i.customerName ?? i.customerEmail ?? "—"), fmtMoney(i.amountDue, i.currency), i.dueDate ? fmtRelative(i.dueDate) : "—"]);
      return kpi + mode + (inv.length ? `<div style="margin-top:12px">${table(["Facture", "Client", "Montant dû", "Échéance"], rows)}</div>` : "");
    }),
  ]);

  const body = `<div class="grid">
    ${card("Déploiements", deploys, { sub: "Vercel — 8 derniers", actions: `<a class="btn btn-sm" href="/deployments">Tout voir</a>` })}
    ${card("Pull requests ouvertes", pulls, { sub: "GitHub — vos dépôts et organisations", actions: `<a class="btn btn-sm" href="/code">Dépôts</a>` })}
    ${card("Domaines", domains, { sub: "Porkbun — expirations", actions: `<a class="btn btn-sm" href="/domains">Gérer</a>` })}
    ${card("Courriels", emails, { sub: "Resend — 8 derniers envois", actions: `<a class="btn btn-sm" href="/email">Détails</a>` })}
    ${card("Trésorerie", money, { sub: "Stripe — solde et factures ouvertes", actions: `<a class="btn btn-sm" href="/payments">Paiements</a>` })}
  </div>`;
  return html(page({ title: "Tableau de bord", path: ctx.path, body, csrf: ctx.csrf, lead: "Vue d'ensemble des cinq services, en direct." }));
}
