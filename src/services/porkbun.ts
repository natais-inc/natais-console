import { env, isDemo, isConfigured, NotConfiguredError, ServiceError } from "../config.js";
import { apiCall } from "./fetch.js";
import { demoPorkbun } from "../demo/fixtures.js";

const BASE = "https://api.porkbun.com/api/json/v3";

export interface PbDomain {
  domain: string;
  status: string;
  tld: string;
  createDate: string;
  expireDate: string;
  autoRenew: boolean;
}

export interface PbRecord {
  id: string;
  name: string; // FQDN renvoyé par Porkbun (ex. "www.exemple.ca")
  type: string;
  content: string;
  ttl: string;
  prio: string | null;
  notes: string | null;
}

export const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "ALIAS"] as const;

function ensure(): void {
  if (!isConfigured("porkbun")) throw new NotConfiguredError("porkbun");
}

/** Toutes les requêtes Porkbun sont des POST JSON avec les clés dans le corps. */
async function pb<T extends { status: string; message?: string }>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const payload = { apikey: env("PORKBUN_API_KEY"), secretapikey: env("PORKBUN_SECRET_KEY"), ...body };
  const data = await apiCall<T>("porkbun", `${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (data.status !== "SUCCESS") throw new ServiceError("porkbun", data.message ?? "Réponse Porkbun non valide.");
  return data;
}

const validDomain = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export function assertDomain(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (!validDomain.test(d)) throw new ServiceError("porkbun", `Nom de domaine invalide : « ${domain} ».`);
  return d;
}

export async function listDomains(): Promise<PbDomain[]> {
  ensure();
  if (isDemo()) return demoPorkbun.domains;
  const data = await pb<{ status: string; domains: { domain: string; status: string; tld: string; createDate: string; expireDate: string; autoRenew: string | number }[] }>("/domain/listAll", { start: 0 });
  return (data.domains ?? []).map((d) => ({
    domain: d.domain,
    status: d.status,
    tld: d.tld,
    createDate: d.createDate,
    expireDate: d.expireDate,
    autoRenew: String(d.autoRenew) === "1",
  }));
}

export async function listRecords(domain: string): Promise<PbRecord[]> {
  ensure();
  const d = assertDomain(domain);
  if (isDemo()) return demoPorkbun.records[d] ?? [];
  const data = await pb<{ status: string; records: { id: string; name: string; type: string; content: string; ttl: string; prio?: string; notes?: string }[] }>(`/dns/retrieve/${d}`);
  return (data.records ?? []).map((r) => ({ id: String(r.id), name: r.name, type: r.type, content: r.content, ttl: String(r.ttl), prio: r.prio ?? null, notes: r.notes ?? null }));
}

export interface RecordInput {
  type: string;
  name: string; // sous-domaine ou "" / "@" pour la racine
  content: string;
  ttl?: string;
  prio?: string;
}

function validateRecord(input: RecordInput): Record<string, string> {
  const type = input.type.toUpperCase();
  if (!(DNS_TYPES as readonly string[]).includes(type)) throw new ServiceError("porkbun", `Type d'enregistrement non pris en charge : ${input.type}.`);
  const content = input.content.trim();
  if (!content) throw new ServiceError("porkbun", "Le contenu de l'enregistrement est requis.");
  const ttl = (input.ttl ?? "600").trim() || "600";
  if (!/^\d+$/.test(ttl) || Number(ttl) < 600) throw new ServiceError("porkbun", "Le TTL doit être un entier ≥ 600 (minimum Porkbun).");
  const name = input.name.trim() === "@" ? "" : input.name.trim();
  const body: Record<string, string> = { type, name, content, ttl };
  if (input.prio && input.prio.trim()) body["prio"] = input.prio.trim();
  return body;
}

export async function createRecord(domain: string, input: RecordInput): Promise<string> {
  ensure();
  const d = assertDomain(domain);
  const body = validateRecord(input);
  if (isDemo()) return "demo-" + Date.now();
  const data = await pb<{ status: string; id: number | string }>(`/dns/create/${d}`, body);
  return String(data.id);
}

export async function editRecord(domain: string, id: string, input: RecordInput): Promise<void> {
  ensure();
  const d = assertDomain(domain);
  if (!/^\d+$/.test(id)) throw new ServiceError("porkbun", "Identifiant d'enregistrement invalide.");
  const body = validateRecord(input);
  if (isDemo()) return;
  await pb(`/dns/edit/${d}/${id}`, body);
}

export async function deleteRecord(domain: string, id: string): Promise<void> {
  ensure();
  const d = assertDomain(domain);
  if (!/^\d+$/.test(id) && !isDemo()) throw new ServiceError("porkbun", "Identifiant d'enregistrement invalide.");
  if (isDemo()) return;
  await pb(`/dns/delete/${d}/${id}`);
}

export interface Availability {
  domain: string;
  available: boolean;
  price: string | null; // prix de 1re année en USD tel que renvoyé
  regularPrice: string | null;
  premium: boolean;
}

/** Vérification de disponibilité (Porkbun limite fortement la cadence de cet appel). */
export async function checkAvailability(domain: string): Promise<Availability> {
  ensure();
  const d = assertDomain(domain);
  if (isDemo()) return demoPorkbun.availability(d);
  const data = await pb<{ status: string; response: { avail: string; price?: string; regularPrice?: string; premium?: string } }>(`/domain/checkDomain/${d}`);
  const r = data.response;
  return { domain: d, available: r.avail === "yes", price: r.price ?? null, regularPrice: r.regularPrice ?? null, premium: r.premium === "yes" };
}
