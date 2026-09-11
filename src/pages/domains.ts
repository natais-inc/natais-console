import type { Ctx } from "./ctx.js";
import { guarded, csrfField, withFlash } from "./ctx.js";
import { html, redirect } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, badge, flash, errMessage, fmtDate } from "../ui/html.js";
import * as porkbun from "../services/porkbun.js";

function daysUntil(dateStr: string): number | null {
  const ms = Date.parse(dateStr.replace(" ", "T"));
  return Number.isNaN(ms) ? null : Math.round((ms - Date.now()) / 86_400_000);
}

export async function domainsIndex(ctx: Ctx) {
  const q = (ctx.query.get("q") ?? "").trim();
  let availability = "";
  if (q) {
    availability = await guarded("porkbun", async () => {
      const a = await porkbun.checkAvailability(q);
      if (a.available) return `<div class="alert alert-ok"><b>${esc(a.domain)}</b> est disponible${a.price ? ` — ${esc(a.price)} $ US la première année${a.regularPrice && a.regularPrice !== a.price ? ` (puis ${esc(a.regularPrice)} $ US/an)` : ""}` : ""}${a.premium ? " · domaine premium" : ""}. L'achat se fait sur porkbun.com (non automatisé ici, volontairement).</div>`;
      return `<div class="alert alert-warn"><b>${esc(a.domain)}</b> n'est pas disponible.</div>`;
    });
  }
  const checkForm = `<form method="get" action="/domains" class="form" style="max-width:520px"><div class="row" style="grid-template-columns:1fr auto;align-items:end"><label>Nom de domaine<input name="q" value="${esc(q)}" placeholder="mon-projet.ca" required></label><button class="btn btn-primary" type="submit">Vérifier</button></div><span class="hint">Porkbun limite fortement la cadence de cette vérification : une requête à la fois.</span></form>${availability}`;

  const list = await guarded("porkbun", async () => {
    const domains = await porkbun.listDomains();
    return table(
      ["Domaine", "Statut", "Créé", "Expire", "Renouvellement auto", ""],
      domains.map((d) => {
        const days = daysUntil(d.expireDate);
        const tone = days !== null && days < 30 ? "err" : days !== null && days < 90 ? "warn" : "ok";
        return [
          `<a href="/domains/${esc(d.domain)}">${esc(d.domain)}</a>`,
          badge(d.status, d.status.toUpperCase() === "ACTIVE" ? "ok" : "warn"),
          fmtDate(d.createDate),
          `${fmtDate(d.expireDate)} ${days === null ? "" : badge(days < 0 ? "expiré" : `${days} j`, tone)}`,
          d.autoRenew ? badge("oui", "ok") : badge("non", "warn"),
          `<a class="btn btn-sm" href="/domains/${esc(d.domain)}">DNS</a>`,
        ];
      }),
      "Aucun domaine dans ce compte Porkbun.",
    );
  });
  const body = flash(ctx.query) + `<div class="stack">${card("Vérifier la disponibilité d'un domaine", checkForm)}${card("Mes domaines", list, { sub: "Porkbun" })}</div>`;
  return html(page({ title: "Domaines & DNS", path: ctx.path, body, csrf: ctx.csrf, lead: "Domaines enregistrés chez Porkbun et gestion complète des enregistrements DNS." }));
}

function recordForm(ctx: Ctx, domain: string, action: string, r?: porkbun.PbRecord, submitLabel = "Ajouter"): string {
  // Porkbun renvoie le nom complet ; on affiche le sous-domaine relatif pour l'édition.
  const relName = r ? (r.name === domain ? "" : r.name.endsWith("." + domain) ? r.name.slice(0, -(domain.length + 1)) : r.name) : "";
  const types = porkbun.DNS_TYPES.map((t) => `<option value="${t}" ${r?.type === t ? "selected" : ""}>${t}</option>`).join("");
  return `<form method="post" action="${esc(action)}" class="form">${csrfField(ctx)}
<div class="row">
<label>Type<select name="type">${types}</select></label>
<label>Nom <span class="hint">(vide ou @ = racine)</span><input name="name" value="${esc(relName)}" placeholder="www"></label>
<label>TTL <span class="hint">(≥ 600)</span><input name="ttl" value="${esc(r?.ttl ?? "600")}" inputmode="numeric"></label>
<label>Priorité <span class="hint">(MX/SRV)</span><input name="prio" value="${esc(r?.prio ?? "")}"></label>
</div>
<label>Contenu<input name="content" value="${esc(r?.content ?? "")}" placeholder="76.76.21.21 ou cname.vercel-dns.com" required></label>
<div><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></div>
</form>`;
}

export async function domainDetail(ctx: Ctx) {
  const domain = ctx.params["domain"] ?? "";
  const body = await guarded("porkbun", async () => {
    const d = porkbun.assertDomain(domain);
    const records = await porkbun.listRecords(d);
    const rows = records.map((r) => [
      badge(r.type, "info"),
      `<span class="mono">${esc(r.name)}</span>`,
      `<span class="mono" style="word-break:break-all">${esc(r.content)}</span>${r.notes ? `<div class="tag">${esc(r.notes)}</div>` : ""}`,
      esc(r.ttl),
      esc(r.prio ?? "—"),
      `<a class="btn btn-sm" href="/domains/${esc(d)}/records/${esc(r.id)}">Modifier</a> <form class="inline" method="post" action="/domains/${esc(d)}/records/${esc(r.id)}/delete" data-confirm="${esc(`Supprimer l'enregistrement ${r.type} ${r.name} ? Cette action est immédiate.`)}">${csrfField(ctx)}<button class="btn btn-sm btn-danger" type="submit">Supprimer</button></form>`,
    ]);
    return `<div class="stack">${card("Enregistrements DNS", table(["Type", "Nom", "Contenu", "TTL", "Prio", ""], rows, "Aucun enregistrement."), { sub: `${records.length} enregistrement(s)` })}${card("Ajouter un enregistrement", recordForm(ctx, d, `/domains/${d}/records`))}</div>`;
  });
  return html(page({ title: `DNS · ${domain}`, path: "/domains", body: `<p><a href="/domains">← Tous les domaines</a></p>` + flash(ctx.query) + body, csrf: ctx.csrf }));
}

export async function recordEditPage(ctx: Ctx) {
  const domain = ctx.params["domain"] ?? "";
  const id = ctx.params["id"] ?? "";
  const body = await guarded("porkbun", async () => {
    const d = porkbun.assertDomain(domain);
    const records = await porkbun.listRecords(d);
    const r = records.find((x) => x.id === id);
    if (!r) return `<div class="alert alert-err">Enregistrement introuvable (peut-être déjà supprimé).</div>`;
    return card(`Modifier l'enregistrement ${r.type} ${r.name}`, recordForm(ctx, d, `/domains/${d}/records/${id}/edit`, r, "Enregistrer"));
  });
  return html(page({ title: `Modifier · ${domain}`, path: "/domains", body: `<p><a href="/domains/${esc(domain)}">← Retour aux DNS de ${esc(domain)}</a></p>` + body, csrf: ctx.csrf }));
}

function inputFromForm(form: Record<string, string>): porkbun.RecordInput {
  return { type: form["type"] ?? "", name: form["name"] ?? "", content: form["content"] ?? "", ttl: form["ttl"], prio: form["prio"] };
}

export async function recordCreate(ctx: Ctx) {
  const domain = ctx.params["domain"] ?? "";
  try {
    await porkbun.createRecord(domain, inputFromForm(ctx.form));
    return redirect(withFlash(`/domains/${domain}`, "ok", "Enregistrement créé."));
  } catch (e) {
    return redirect(withFlash(`/domains/${domain}`, "err", errMessage(e)));
  }
}

export async function recordEdit(ctx: Ctx) {
  const domain = ctx.params["domain"] ?? "";
  const id = ctx.params["id"] ?? "";
  try {
    await porkbun.editRecord(domain, id, inputFromForm(ctx.form));
    return redirect(withFlash(`/domains/${domain}`, "ok", "Enregistrement modifié."));
  } catch (e) {
    return redirect(withFlash(`/domains/${domain}`, "err", errMessage(e)));
  }
}

export async function recordDelete(ctx: Ctx) {
  const domain = ctx.params["domain"] ?? "";
  const id = ctx.params["id"] ?? "";
  try {
    await porkbun.deleteRecord(domain, id);
    return redirect(withFlash(`/domains/${domain}`, "ok", "Enregistrement supprimé."));
  } catch (e) {
    return redirect(withFlash(`/domains/${domain}`, "err", errMessage(e)));
  }
}
