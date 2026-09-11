import type { Ctx } from "./ctx.js";
import { guarded, csrfField, withFlash } from "./ctx.js";
import { html, redirect } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, stateBadge, badge, fmtRelative, fmtDate, extLink, truncate, flash, errMessage } from "../ui/html.js";
import * as vercel from "../services/vercel.js";

export async function deploymentsIndex(ctx: Ctx) {
  const body = await guarded("vercel", async () => {
    const [projects, deploys] = await Promise.all([vercel.listProjects(), vercel.listDeployments(undefined, 20)]);
    const projTable = table(
      ["Projet", "Framework", "Dernier état", "Production", "Dépôt", "Mis à jour"],
      projects.map((p) => [
        `<a href="/deployments/${esc(p.id)}">${esc(p.name)}</a>`,
        esc(p.framework ?? "—"),
        stateBadge(p.latestState),
        p.productionUrl ? extLink(p.productionUrl, p.productionUrl.replace(/^https?:\/\//, "")) : "—",
        p.repo ? extLink(`https://github.com/${p.repo}`, p.repo) : "—",
        fmtRelative(p.updatedAt),
      ]),
      "Aucun projet Vercel.",
    );
    const depTable = table(
      ["Projet", "État", "Cible", "Branche", "Commit", "URL", "Quand", ""],
      deploys.map((d) => [
        esc(d.projectName),
        stateBadge(d.state),
        badge(d.target === "production" ? "prod" : "aperçu", d.target === "production" ? "info" : "muted"),
        esc(d.branch ?? "—"),
        esc(truncate(d.commitMessage ?? "—", 50)),
        extLink(`https://${d.url}`, "ouvrir"),
        `<span title="${fmtDate(d.createdAt)}">${fmtRelative(d.createdAt)}</span>`,
        redeployForm(ctx, d),
      ]),
      "Aucun déploiement.",
    );
    return `<div class="stack">${card("Projets", projTable, { sub: `${projects.length} projet(s)` })}${card("Derniers déploiements", depTable, { sub: "20 derniers, tous projets" })}</div>`;
  });
  return html(page({ title: "Déploiements", path: ctx.path, body: flash(ctx.query) + body, csrf: ctx.csrf, lead: "Projets et déploiements Vercel. Le redéploiement relance un build avec les mêmes réglages." }));
}

function redeployForm(ctx: Ctx, d: vercel.VercelDeployment): string {
  return `<form class="inline" method="post" action="/deployments/redeploy" data-confirm="${esc(`Redéployer ${d.projectName} (${d.target === "production" ? "PRODUCTION" : "aperçu"}) ?`)}">${csrfField(ctx)}<input type="hidden" name="deploymentId" value="${esc(d.id)}"><input type="hidden" name="projectName" value="${esc(d.projectName)}"><input type="hidden" name="target" value="${d.target}"><button class="btn btn-sm" type="submit">Redéployer</button></form>`;
}

export async function deploymentsProject(ctx: Ctx) {
  const projectId = ctx.params["projectId"] ?? "";
  let title = "Projet";
  const body = await guarded("vercel", async () => {
    const projects = await vercel.listProjects();
    const project = projects.find((p) => p.id === projectId || p.name === projectId);
    if (!project) return `<div class="alert alert-err">Projet introuvable.</div>`;
    title = project.name;
    const [deploys, domains] = await Promise.all([vercel.listDeployments(project.id, 20), vercel.listProjectDomains(project.id)]);
    const info = `<div class="kpi"><div><b>${stateBadge(project.latestState)}</b><span>dernier état</span></div><div><b>${esc(project.framework ?? "—")}</b><span>framework</span></div><div><b>${project.repo ? extLink(`https://github.com/${project.repo}`, project.repo) : "—"}</b><span>dépôt</span></div><div><b>${project.productionUrl ? extLink(project.productionUrl, project.productionUrl.replace(/^https?:\/\//, "")) : "—"}</b><span>production</span></div></div>`;
    const domTable = table(
      ["Domaine", "Vérifié", "Redirection"],
      domains.map((d) => [esc(d.name), d.verified ? badge("oui", "ok") : badge("non — DNS à corriger", "err"), esc(d.redirect ?? "—")]),
      "Aucun domaine rattaché.",
    );
    const depTable = table(
      ["État", "Cible", "Branche", "Commit", "URL", "Quand", ""],
      deploys.map((d) => [
        stateBadge(d.state),
        badge(d.target === "production" ? "prod" : "aperçu", d.target === "production" ? "info" : "muted"),
        esc(d.branch ?? "—"),
        esc(truncate(d.commitMessage ?? "—", 60)),
        extLink(`https://${d.url}`, "ouvrir"),
        `<span title="${fmtDate(d.createdAt)}">${fmtRelative(d.createdAt)}</span>`,
        redeployForm(ctx, d),
      ]),
      "Aucun déploiement.",
    );
    return `<div class="stack">${card("Résumé", info)}${card("Domaines rattachés (Vercel)", domTable, { sub: "Les enregistrements DNS eux-mêmes se gèrent dans Domaines & DNS" })}${card("Déploiements", depTable)}</div>`;
  });
  return html(page({ title: `Projet · ${title}`, path: "/deployments", body: flash(ctx.query) + `<p><a href="/deployments">← Tous les projets</a></p>` + body, csrf: ctx.csrf }));
}

export async function deploymentsRedeploy(ctx: Ctx) {
  const { deploymentId = "", projectName = "", target = "preview" } = ctx.form;
  try {
    const d = await vercel.redeploy(deploymentId, projectName, target === "production" ? "production" : "preview");
    return redirect(withFlash("/deployments", "ok", `Redéploiement lancé pour ${projectName} (${d.state.toLowerCase()}) : ${d.url}`));
  } catch (e) {
    return redirect(withFlash("/deployments", "err", `Redéploiement refusé : ${errMessage(e)}`));
  }
}
