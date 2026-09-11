import type { Ctx } from "./ctx.js";
import { html } from "../http.js";
import { page } from "../ui/layout.js";
import { card, esc, badge, extLink } from "../ui/html.js";
import { configStatus, SERVICES, env, isDemo } from "../config.js";

export async function settingsIndex(ctx: Ctx) {
  const status = configStatus();
  const cards = status
    .map((s) => {
      const meta = SERVICES.find((m) => m.id === s.id)!;
      const vars = s.vars
        .map(
          (v) =>
            `<div><code>${esc(v.name)}</code> ${v.present ? badge("définie", "ok") : v.required ? badge("manquante", "err") : badge("optionnelle", "muted")}<span class="tag">${esc(v.hint)}</span></div>`,
        )
        .join("");
      return card(meta.label, `<div class="env">${vars}</div><p class="tag" style="margin:12px 0 0">${extLink(meta.docsUrl, "Documentation de l'API")}</p>`, {
        sub: meta.role,
        actions: s.configured ? badge(isDemo() ? "démo" : "configuré", isDemo() ? "warn" : "ok") : badge("non configuré", "err"),
      });
    })
    .join("");

  const security = card(
    "Sécurité de la console",
    `<div class="env">
<div><code>CONSOLE_PASSWORD</code> ${env("CONSOLE_PASSWORD") ? badge("définie", "ok") : badge("manquante", "err")}<span class="tag">Mot de passe unique de connexion (v1 mono-utilisateur).</span></div>
<div><code>SESSION_SECRET</code> ${env("SESSION_SECRET") ? badge("définie", "ok") : badge("dérivée du mot de passe", "warn")}<span class="tag">Chaîne aléatoire longue pour signer les sessions. Recommandée : sans elle, changer le mot de passe déconnecte tout le monde (acceptable, mais moins propre).</span></div>
<div><code>DEMO_MODE</code> ${isDemo() ? badge("actif", "warn") : badge("inactif", "muted")}<span class="tag">Données fictives pour tester l'interface sans clés. À désactiver en usage réel.</span></div>
</div>`,
  );

  const howto = card(
    "Comment ajouter les clés",
    `<ol style="margin:0;padding-left:18px;line-height:1.8">
<li>Ouvrez votre projet sur Vercel → <b>Settings → Environment Variables</b> (ou un fichier <code>.env</code> en local).</li>
<li>Ajoutez chaque variable listée ci-dessus avec sa valeur (jamais dans le code, jamais dans Git).</li>
<li>Redéployez : les variables ne sont lues qu'au démarrage.</li>
<li>Revenez ici : chaque service passe en <b>configuré</b> et son point vert s'allume dans le menu.</li>
</ol>
<p class="tag" style="margin:12px 0 0">Les valeurs ne sont jamais affichées ni envoyées au navigateur : cette page indique seulement si elles sont présentes.</p>`,
  );

  return html(page({ title: "Configuration", path: ctx.path, body: `<div class="stack">${security}${howto}<div class="grid">${cards}</div></div>`, csrf: ctx.csrf, lead: "État des connexions aux cinq services. Les clés se définissent par variables d'environnement." }));
}
