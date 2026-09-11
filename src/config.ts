/**
 * Lecture de la configuration (variables d'environnement).
 * Les clés ne quittent JAMAIS le serveur : elles ne sont ni rendues dans le HTML ni renvoyées en JSON.
 */

export type ServiceId = "vercel" | "github" | "resend" | "porkbun" | "stripe";

export interface ServiceMeta {
  id: ServiceId;
  label: string;
  role: string;
  envVars: { name: string; required: boolean; hint: string }[];
  docsUrl: string;
}

export const SERVICES: ServiceMeta[] = [
  {
    id: "vercel",
    label: "Vercel",
    role: "Hébergement & déploiements",
    envVars: [
      { name: "VC_API_TOKEN", required: true, hint: "Jeton d'accès : vercel.com → Settings → Tokens (le préfixe VERCEL_ est réservé par Vercel, d'où VC_)" },
      { name: "VC_TEAM_ID", required: false, hint: "ID d'équipe (team_…) si les projets sont dans une équipe ; vide pour le compte personnel" },
    ],
    docsUrl: "https://vercel.com/docs/rest-api",
  },
  {
    id: "github",
    label: "GitHub",
    role: "Code source, PR & commits",
    envVars: [
      { name: "GITHUB_TOKEN", required: true, hint: "Jeton personnel (classic ou fine-grained) avec accès aux dépôts : github.com → Settings → Developer settings" },
      { name: "GITHUB_ORGS", required: false, hint: "Organisations à inclure, séparées par des virgules (ex. natais-inc). Vide = vos organisations détectées automatiquement" },
    ],
    docsUrl: "https://docs.github.com/rest",
  },
  {
    id: "resend",
    label: "Resend",
    role: "Courriels transactionnels",
    envVars: [
      { name: "RESEND_API_KEY", required: true, hint: "Clé API avec permission complète (pour lister ET envoyer) : resend.com → API Keys" },
    ],
    docsUrl: "https://resend.com/docs/api-reference",
  },
  {
    id: "porkbun",
    label: "Porkbun",
    role: "Domaines & DNS",
    envVars: [
      { name: "PORKBUN_API_KEY", required: true, hint: "porkbun.com → Account → API Access (pk1_…)" },
      { name: "PORKBUN_SECRET_KEY", required: true, hint: "Clé secrète associée (sk1_…). Activer aussi « API Access » sur chaque domaine dans Porkbun" },
    ],
    docsUrl: "https://porkbun.com/api/json/v3/documentation",
  },
  {
    id: "stripe",
    label: "Stripe",
    role: "Paiements, clients & factures",
    envVars: [
      { name: "STRIPE_SECRET_KEY", required: true, hint: "Clé secrète (sk_live_… ou sk_test_…) : dashboard.stripe.com → Developers → API keys. Une clé restreinte en lecture + création de liens est recommandée" },
    ],
    docsUrl: "https://docs.stripe.com/api",
  },
];

export function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export function isDemo(): boolean {
  const v = env("DEMO_MODE");
  return v === "1" || v === "true";
}

export function isConfigured(id: ServiceId): boolean {
  if (isDemo()) return true;
  const meta = SERVICES.find((s) => s.id === id)!;
  return meta.envVars.filter((e) => e.required).every((e) => env(e.name) !== undefined);
}

/** État de configuration sans jamais exposer les valeurs. */
export function configStatus(): { id: ServiceId; label: string; configured: boolean; vars: { name: string; present: boolean; required: boolean; hint: string }[] }[] {
  return SERVICES.map((s) => ({
    id: s.id,
    label: s.label,
    configured: isConfigured(s.id),
    vars: s.envVars.map((e) => ({ name: e.name, present: env(e.name) !== undefined, required: e.required, hint: e.hint })),
  }));
}

export class ServiceError extends Error {
  constructor(public service: ServiceId, message: string, public status?: number) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotConfiguredError extends ServiceError {
  constructor(service: ServiceId) {
    super(service, "Service non configuré : ajoutez les variables d'environnement dans la page Configuration.");
    this.name = "NotConfiguredError";
  }
}
