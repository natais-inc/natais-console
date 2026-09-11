import type { Ctx } from "./ctx.js";
import { guarded } from "./ctx.js";
import { html } from "../http.js";
import { page } from "../ui/layout.js";
import { card, table, esc, badge, fmtRelative, fmtDate, extLink, truncate } from "../ui/html.js";
import * as github from "../services/github.js";

export async function codeIndex(ctx: Ctx) {
  const body = await guarded("github", async () => {
    const [repos, pulls] = await Promise.all([github.listRepos(), github.openPullRequests()]);
    const repoTable = table(
      ["Dépôt", "Visibilité", "Branche", "Issues + PR", "Dernier push"],
      repos.map((r) => [
        `<a href="/code/${esc(r.owner)}/${esc(r.name)}">${esc(r.fullName)}</a>${r.description ? `<div class="tag">${esc(truncate(r.description, 80))}</div>` : ""}`,
        r.private ? badge("privé") : badge("public", "info"),
        `<span class="mono">${esc(r.defaultBranch)}</span>`,
        String(r.openIssues),
        `<span title="${fmtDate(r.pushedAt)}">${fmtRelative(r.pushedAt)}</span>`,
      ]),
      "Aucun dépôt accessible avec ce jeton.",
    );
    const prTable = table(
      ["PR", "Dépôt", "Auteur", "Ouverte"],
      pulls.map((p) => [`${extLink(p.url, `#${p.number} ${p.title}`)}${p.draft ? " " + badge("brouillon") : ""}`, esc(p.repo), esc(p.author), fmtRelative(p.createdAt)]),
      "Aucune PR ouverte.",
    );
    return `<div class="stack">${card("Pull requests ouvertes", prTable, { sub: `${pulls.length} au total` })}${card("Dépôts", repoTable, { sub: `${repos.length} dépôt(s), triés par activité` })}</div>`;
  });
  return html(page({ title: "Code", path: ctx.path, body, csrf: ctx.csrf, lead: "Dépôts GitHub personnels et d'organisation." }));
}

export async function codeRepo(ctx: Ctx) {
  const owner = ctx.params["owner"] ?? "";
  const name = ctx.params["repo"] ?? "";
  const body = await guarded("github", async () => {
    const [commits, pulls, issues] = await Promise.all([github.repoCommits(owner, name), github.repoPulls(owner, name), github.repoIssues(owner, name)]);
    const c = table(
      ["Commit", "Message", "Auteur", "Date"],
      commits.map((x) => [`<span class="mono">${extLink(x.url, x.sha.slice(0, 7))}</span>`, esc(truncate(x.message, 90)), esc(x.author), `<span title="${fmtDate(x.date)}">${fmtRelative(x.date)}</span>`]),
      "Aucun commit.",
    );
    const p = table(["PR", "Auteur", "Ouverte"], pulls.map((x) => [`${extLink(x.url, `#${x.number} ${x.title}`)}${x.draft ? " " + badge("brouillon") : ""}`, esc(x.author), fmtRelative(x.createdAt)]), "Aucune PR ouverte.");
    const i = table(["Issue", "Auteur", "Ouverte"], issues.map((x) => [extLink(x.url, `#${x.number} ${x.title}`), esc(x.author), fmtRelative(x.createdAt)]), "Aucune issue ouverte.");
    return `<div class="stack">${card("Derniers commits", c)}<div class="grid">${card("Pull requests ouvertes", p)}${card("Issues ouvertes", i)}</div></div>`;
  });
  const full = `${owner}/${name}`;
  return html(
    page({
      title: `Dépôt · ${full}`,
      path: "/code",
      body: `<p><a href="/code">← Tous les dépôts</a> · ${extLink(`https://github.com/${full}`, "Ouvrir sur GitHub")}</p>` + body,
      csrf: ctx.csrf,
    }),
  );
}
