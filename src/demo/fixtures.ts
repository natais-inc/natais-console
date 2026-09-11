/**
 * Données fictives pour le mode démo (DEMO_MODE=1) : permet de tester l'interface sans aucune clé.
 * Rien ici n'est réel.
 */
import type { VercelProject, VercelDeployment, VercelDomain } from "../services/vercel.js";
import type { GhRepo, GhPullRequest, GhCommit, GhIssue } from "../services/github.js";
import type { ResendDomain, ResendEmail } from "../services/resend.js";
import type { PbDomain, PbRecord, Availability } from "../services/porkbun.js";
import type { StripeBalance, StripePayment, StripeCustomer, StripeInvoice, StripePaymentLink } from "../services/stripe.js";

const now = Date.now();
const h = 3600_000;
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

export const demoVercel: { projects: VercelProject[]; deployments: VercelDeployment[]; domains: Record<string, VercelDomain[]> } = {
  projects: [
    { id: "prj_demo_site", name: "exemple-site", framework: "nextjs", updatedAt: now - 2 * h, repo: "exemple-inc/exemple-site", productionUrl: "https://exemple.ca", latestState: "READY" },
    { id: "prj_demo_api", name: "exemple-api", framework: null, updatedAt: now - 30 * h, repo: "exemple-inc/exemple-api", productionUrl: "https://exemple-api.vercel.app", latestState: "ERROR" },
    { id: "prj_demo_docs", name: "docs", framework: "astro", updatedAt: now - 200 * h, repo: null, productionUrl: "https://docs-demo.vercel.app", latestState: "READY" },
  ],
  deployments: [
    { id: "dpl_1", url: "exemple-site-abc123.vercel.app", state: "READY", target: "production", createdAt: now - 2 * h, commitMessage: "Corrige le libellé du mois", branch: "main", projectName: "exemple-site" },
    { id: "dpl_2", url: "exemple-site-def456.vercel.app", state: "READY", target: "preview", createdAt: now - 5 * h, commitMessage: "Ajoute la page tarifs", branch: "feat/tarifs", projectName: "exemple-site" },
    { id: "dpl_3", url: "exemple-api-ghi789.vercel.app", state: "ERROR", target: "production", createdAt: now - 30 * h, commitMessage: "Migration base de données", branch: "main", projectName: "exemple-api" },
    { id: "dpl_4", url: "exemple-api-jkl012.vercel.app", state: "READY", target: "production", createdAt: now - 80 * h, commitMessage: "Version initiale", branch: "main", projectName: "exemple-api" },
    { id: "dpl_5", url: "docs-mno345.vercel.app", state: "BUILDING", target: "preview", createdAt: now - 0.1 * h, commitMessage: "Docs : section API", branch: "docs-api", projectName: "docs" },
  ],
  domains: {
    prj_demo_site: [
      { name: "exemple.ca", verified: true, redirect: null },
      { name: "www.exemple.ca", verified: false, redirect: null },
      { name: "exemple.com", verified: true, redirect: "exemple.ca" },
    ],
    prj_demo_api: [{ name: "exemple-api.vercel.app", verified: true, redirect: null }],
    prj_demo_docs: [{ name: "docs-demo.vercel.app", verified: true, redirect: null }],
  },
};

export const demoGithub: { login: string; orgs: string[]; repos: GhRepo[]; pulls: GhPullRequest[]; commits: GhCommit[]; issues: GhIssue[] } = {
  login: "demo-user",
  orgs: ["exemple-inc"],
  repos: [
    { fullName: "exemple-inc/exemple-site", owner: "exemple-inc", name: "exemple-site", private: false, defaultBranch: "main", pushedAt: iso(2 * h), openIssues: 3, url: "https://github.com/exemple-inc/exemple-site", description: "Site principal (Next.js)" },
    { fullName: "exemple-inc/exemple-api", owner: "exemple-inc", name: "exemple-api", private: true, defaultBranch: "main", pushedAt: iso(30 * h), openIssues: 1, url: "https://github.com/exemple-inc/exemple-api", description: "API interne" },
    { fullName: "demo-user/notes", owner: "demo-user", name: "notes", private: true, defaultBranch: "main", pushedAt: iso(500 * h), openIssues: 0, url: "https://github.com/demo-user/notes", description: null },
  ],
  pulls: [
    { number: 12, title: "Ajoute la page tarifs", repo: "exemple-inc/exemple-site", author: "demo-user", url: "https://github.com/exemple-inc/exemple-site/pull/12", createdAt: iso(5 * h), draft: false },
    { number: 13, title: "Refonte du pied de page", repo: "exemple-inc/exemple-site", author: "collab", url: "https://github.com/exemple-inc/exemple-site/pull/13", createdAt: iso(26 * h), draft: true },
    { number: 4, title: "Corrige la migration Prisma", repo: "exemple-inc/exemple-api", author: "demo-user", url: "https://github.com/exemple-inc/exemple-api/pull/4", createdAt: iso(28 * h), draft: false },
  ],
  commits: [
    { sha: "a1b2c3d4e5f6", message: "Corrige le libellé du mois", author: "Demo User", date: iso(2 * h), url: "https://github.com/exemple-inc/exemple-site/commit/a1b2c3d" },
    { sha: "b2c3d4e5f6a1", message: "Ajoute la page tarifs", author: "Demo User", date: iso(5 * h), url: "https://github.com/exemple-inc/exemple-site/commit/b2c3d4e" },
    { sha: "c3d4e5f6a1b2", message: "Mise à jour des dépendances", author: "dependabot[bot]", date: iso(40 * h), url: "https://github.com/exemple-inc/exemple-site/commit/c3d4e5f" },
  ],
  issues: [
    { number: 9, title: "Le formulaire de contact n'envoie pas d'accusé", author: "client-test", url: "https://github.com/exemple-inc/exemple-site/issues/9", createdAt: iso(50 * h) },
  ],
};

export const demoResend: { domains: ResendDomain[]; emails: ResendEmail[] } = {
  domains: [
    { id: "dom_1", name: "exemple.ca", status: "verified", region: "us-east-1", createdAt: iso(400 * h) },
    { id: "dom_2", name: "exemple.app", status: "pending", region: "us-east-1", createdAt: iso(10 * h) },
  ],
  emails: [
    { id: "em_1", to: ["client@exemple.ca"], from: "Exemple <no-reply@exemple.ca>", subject: "Confirmez votre courriel", lastEvent: "delivered", createdAt: iso(1 * h) },
    { id: "em_2", to: ["rh@entreprise-test.ca"], from: "Exemple <no-reply@exemple.ca>", subject: "Votre demande de démo", lastEvent: "bounced", createdAt: iso(7 * h) },
    { id: "em_3", to: ["contact@partenaire.ca"], from: "Exemple <no-reply@exemple.ca>", subject: "Facture septembre 2026", lastEvent: "sent", createdAt: iso(20 * h) },
  ],
};

export const demoPorkbun: { domains: PbDomain[]; records: Record<string, PbRecord[]>; availability: (d: string) => Availability } = {
  domains: [
    { domain: "exemple.ca", status: "ACTIVE", tld: "ca", createDate: "2026-08-28 10:00:00", expireDate: "2027-08-28 10:00:00", autoRenew: true },
    { domain: "exemple.com", status: "ACTIVE", tld: "com", createDate: "2026-08-28 10:00:00", expireDate: "2026-10-05 10:00:00", autoRenew: false },
  ],
  records: {
    "exemple.ca": [
      { id: "1001", name: "exemple.ca", type: "A", content: "76.76.21.21", ttl: "600", prio: null, notes: null },
      { id: "1002", name: "www.exemple.ca", type: "CNAME", content: "cname.vercel-dns.com", ttl: "600", prio: null, notes: null },
      { id: "1003", name: "resend._domainkey.exemple.ca", type: "TXT", content: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC…", ttl: "600", prio: null, notes: "DKIM Resend" },
      { id: "1004", name: "exemple.ca", type: "MX", content: "feedback-smtp.us-east-1.amazonses.com", ttl: "600", prio: "10", notes: null },
    ],
    "exemple.com": [
      { id: "2001", name: "exemple.com", type: "A", content: "76.76.21.21", ttl: "600", prio: null, notes: null },
      { id: "2002", name: "www.exemple.com", type: "CNAME", content: "cname.vercel-dns.com", ttl: "600", prio: null, notes: null },
    ],
  },
  availability: (d) => (d.endsWith(".ca") ? { domain: d, available: true, price: "12.98", regularPrice: "12.98", premium: false } : { domain: d, available: false, price: null, regularPrice: null, premium: false }),
};

export const demoStripe: { balance: StripeBalance; payments: StripePayment[]; customers: StripeCustomer[]; invoices: StripeInvoice[]; links: StripePaymentLink[] } = {
  balance: { available: [{ amount: 125000, currency: "cad" }], pending: [{ amount: 50000, currency: "cad" }], livemode: false },
  payments: [
    { id: "pi_1", amount: 50000, currency: "cad", status: "succeeded", description: "Abonnement septembre — Test Oshawa", customerEmail: "rh@entreprise-test.ca", created: Math.floor((now - 3 * h) / 1000) },
    { id: "pi_2", amount: 75000, currency: "cad", status: "processing", description: "Abonnement septembre — Usine Durham", customerEmail: null, created: Math.floor((now - 26 * h) / 1000) },
    { id: "pi_3", amount: 2500, currency: "cad", status: "canceled", description: null, customerEmail: "essai@exemple.ca", created: Math.floor((now - 100 * h) / 1000) },
  ],
  customers: [
    { id: "cus_1", name: "Entreprise Test Oshawa", email: "rh@entreprise-test.ca", created: Math.floor((now - 700 * h) / 1000) },
    { id: "cus_2", name: "Usine Durham inc.", email: "compta@usine-durham.ca", created: Math.floor((now - 300 * h) / 1000) },
  ],
  invoices: [
    { id: "in_1", number: "F-0004", customerName: "Usine Durham inc.", customerEmail: "compta@usine-durham.ca", amountDue: 75000, currency: "cad", status: "open", dueDate: Math.floor((now + 240 * h) / 1000), hostedUrl: "https://invoice.stripe.com/i/demo" },
  ],
  links: [{ id: "plink_1", url: "https://buy.stripe.com/test_demo1", active: true }],
};
