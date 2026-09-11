import type { Ctx } from "./ctx.js";
import { guarded, csrfField, withFlash } from "./ctx.js";
import { html, redirect } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, stateBadge, badge, flash, errMessage, fmtRelative, fmtDate, fmtMoney, safeHref } from "../ui/html.js";
import * as stripe from "../services/stripe.js";

export async function paymentsIndex(ctx: Ctx) {
  const body = await guarded("stripe", async () => {
    const [b, payments, customers, invoices, links] = await Promise.all([stripe.balance(), stripe.recentPayments(20), stripe.customers(20), stripe.openInvoices(20), stripe.paymentLinks(20)]);
    const sum = (arr: { amount: number; currency: string }[]) => arr.map((a) => fmtMoney(a.amount, a.currency)).join(" + ") || "0";
    const kpi = `<div class="kpi"><div><b>${esc(sum(b.available))}</b><span>disponible</span></div><div><b>${esc(sum(b.pending))}</b><span>en attente</span></div><div><b>${customers.length}${customers.length === 20 ? "+" : ""}</b><span>clients</span></div><div><b>${invoices.length}</b><span>factures ouvertes</span></div></div>`;
    const mode = b.livemode ? `<p class="tag" style="margin:8px 0 0">${badge("mode réel", "ok")} transactions réelles.</p>` : `<p class="tag" style="margin:8px 0 0">${badge("mode test", "warn")} clé de test — aucun argent réel ne circule.</p>`;

    const payTable = table(
      ["Montant", "État", "Description", "Client", "Quand"],
      payments.map((p) => [fmtMoney(p.amount, p.currency), stateBadge(p.status), esc(p.description ?? "—"), esc(p.customerEmail ?? "—"), `<span title="${fmtDate(p.created)}">${fmtRelative(p.created)}</span>`]),
      "Aucun paiement.",
    );
    const invTable = table(
      ["Facture", "Client", "Montant dû", "Échéance", ""],
      invoices.map((i) => [esc(i.number ?? i.id), esc(i.customerName ?? i.customerEmail ?? "—"), fmtMoney(i.amountDue, i.currency), i.dueDate ? fmtDate(i.dueDate) : "—", i.hostedUrl ? `<a class="btn btn-sm" href="${safeHref(i.hostedUrl)}" target="_blank" rel="noopener noreferrer">Ouvrir</a>` : ""]),
      "Aucune facture ouverte.",
    );
    const custTable = table(["Nom", "Courriel", "Depuis"], customers.map((c) => [esc(c.name ?? "—"), esc(c.email ?? "—"), fmtDate(c.created)]), "Aucun client.");
    const linkTable = table(["Lien", "Actif"], links.map((l) => [`<a href="${safeHref(l.url)}" target="_blank" rel="noopener noreferrer" class="mono">${esc(l.url)}</a>`, l.active ? badge("oui", "ok") : badge("non")]), "Aucun lien de paiement actif.");
    const linkForm = `<form method="post" action="/payments/links" class="form">${csrfField(ctx)}
<div class="row">
<label>Nom du produit / service<input name="name" placeholder="Abonnement mensuel — 1 site" required></label>
<label>Montant<input name="amount" placeholder="500.00" inputmode="decimal" required></label>
<label>Devise<select name="currency"><option value="cad">CAD</option><option value="usd">USD</option><option value="eur">EUR</option></select></label>
</div>
<div><button class="btn btn-primary" type="submit">Créer le lien</button> <span class="hint">Crée un produit, un prix et un lien de paiement Stripe (paiement unique).</span></div>
</form>`;
    return `<div class="stack">${card("Solde", kpi + mode, { sub: "Stripe" })}${card("Factures ouvertes", invTable)}${card("Derniers paiements", payTable, { sub: "20 derniers PaymentIntents" })}<div class="grid">${card("Clients", custTable, { sub: "20 derniers" })}${card("Liens de paiement", linkTable + `<div style="margin-top:14px">${linkForm}</div>`)}</div></div>`;
  });
  return html(page({ title: "Paiements", path: ctx.path, body: flash(ctx.query) + body, csrf: ctx.csrf, lead: "Solde, factures, paiements et clients Stripe." }));
}

export async function paymentsCreateLink(ctx: Ctx) {
  try {
    const raw = (ctx.form["amount"] ?? "").replace(",", ".").trim();
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount)) throw new Error("Montant invalide.");
    const cents = Math.round(amount * 100);
    const link = await stripe.createPaymentLink({ name: ctx.form["name"] ?? "", amountCents: cents, currency: ctx.form["currency"] ?? "cad" });
    return redirect(withFlash("/payments", "ok", `Lien créé : ${link.url}`));
  } catch (e) {
    return redirect(withFlash("/payments", "err", `Création refusée : ${errMessage(e)}`));
  }
}
