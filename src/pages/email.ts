import type { Ctx } from "./ctx.js";
import { guarded, csrfField, withFlash } from "./ctx.js";
import { html, redirect } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, stateBadge, flash, errMessage, fmtRelative, fmtDate, truncate } from "../ui/html.js";
import * as resend from "../services/resend.js";

export async function emailIndex(ctx: Ctx) {
  const body = await guarded("resend", async () => {
    const [domains, emails] = await Promise.all([resend.listDomains(), resend.listEmails(30)]);
    const domTable = table(
      ["Domaine", "Statut", "Région", "Ajouté"],
      domains.map((d) => [esc(d.name), stateBadge(d.status), esc(d.region), fmtDate(d.createdAt)]),
      "Aucun domaine expéditeur. Ajoutez-en un sur resend.com puis créez les enregistrements DNS (DKIM/SPF) dans Domaines & DNS.",
    );
    const unverified = domains.filter((d) => d.status !== "verified");
    const warn = unverified.length ? `<div class="alert alert-warn">${unverified.length} domaine(s) non vérifié(s) : aucun courriel ne partira depuis ${esc(unverified.map((d) => d.name).join(", "))} tant que les enregistrements DNS ne sont pas en place.</div>` : "";
    const emTable = table(
      ["Objet", "De", "À", "État", "Quand"],
      emails.map((e) => [esc(truncate(e.subject, 60)), esc(e.from), esc(e.to.join(", ")), stateBadge(e.lastEvent), `<span title="${fmtDate(e.createdAt)}">${fmtRelative(e.createdAt)}</span>`]),
      "Aucun courriel envoyé récemment.",
    );
    const verified = domains.filter((d) => d.status === "verified");
    const sendForm = `<form method="post" action="/email/send" class="form">${csrfField(ctx)}
<div class="row">
<label>De <span class="hint">(adresse sur un domaine vérifié)</span><input name="from" placeholder="${esc(verified[0] ? `Nom <no-reply@${verified[0].name}>` : "Nom <no-reply@votre-domaine.ca>")}" required></label>
<label>À<input name="to" type="email" placeholder="destinataire@exemple.ca" required></label>
</div>
<label>Objet<input name="subject" required></label>
<label>Message (texte brut)<textarea name="text" rows="5" required></textarea></label>
<div><button class="btn btn-primary" type="submit">Envoyer</button> <span class="hint">Envoi réel et immédiat via Resend.</span></div>
</form>`;
    return `<div class="stack">${warn}${card("Domaines expéditeurs", domTable, { sub: "Resend" })}${card("Derniers envois", emTable, { sub: "30 derniers" })}${card("Envoyer un courriel", sendForm, { sub: "Test rapide ou message ponctuel" })}</div>`;
  });
  return html(page({ title: "Courriels", path: ctx.path, body: flash(ctx.query) + body, csrf: ctx.csrf, lead: "Domaines expéditeurs, historique des envois et envoi manuel via Resend." }));
}

export async function emailSend(ctx: Ctx) {
  try {
    const r = await resend.sendEmail({ from: ctx.form["from"] ?? "", to: ctx.form["to"] ?? "", subject: ctx.form["subject"] ?? "", text: ctx.form["text"] ?? "" });
    return redirect(withFlash("/email", "ok", `Courriel accepté par Resend (id ${r.id}).`));
  } catch (e) {
    return redirect(withFlash("/email", "err", `Envoi refusé : ${errMessage(e)}`));
  }
}
