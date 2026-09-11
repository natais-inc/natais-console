import { env, isDemo, isConfigured, NotConfiguredError, ServiceError } from "../config.js";
import { apiCall } from "./fetch.js";
import { demoResend } from "../demo/fixtures.js";

const BASE = "https://api.resend.com";

export interface ResendDomain {
  id: string;
  name: string;
  status: string; // verified | pending | not_started | failure | temporary_failure
  region: string;
  createdAt: string;
}

export interface ResendEmail {
  id: string;
  to: string[];
  from: string;
  subject: string;
  lastEvent: string; // delivered | sent | bounced | complained | delivery_delayed | …
  createdAt: string;
}

function headers(): Record<string, string> {
  return { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" };
}

function ensure(): void {
  if (!isConfigured("resend")) throw new NotConfiguredError("resend");
}

export async function listDomains(): Promise<ResendDomain[]> {
  ensure();
  if (isDemo()) return demoResend.domains;
  const data = await apiCall<{ data: { id: string; name: string; status: string; region: string; created_at: string }[] }>("resend", `${BASE}/domains`, { headers: headers() });
  return (data.data ?? []).map((d) => ({ id: d.id, name: d.name, status: d.status, region: d.region, createdAt: d.created_at }));
}

export async function listEmails(limit = 25): Promise<ResendEmail[]> {
  ensure();
  if (isDemo()) return demoResend.emails.slice(0, limit);
  const data = await apiCall<{ data: { id: string; to: string[] | string; from: string; subject: string; last_event: string; created_at: string }[] }>(
    "resend",
    `${BASE}/emails?limit=${Math.min(100, Math.max(1, limit))}`,
    { headers: headers() },
  );
  return (data.data ?? []).map((e) => ({
    id: e.id,
    to: Array.isArray(e.to) ? e.to : [e.to],
    from: e.from,
    subject: e.subject,
    lastEvent: e.last_event,
    createdAt: e.created_at,
  }));
}

export interface SendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(input: SendInput): Promise<{ id: string }> {
  ensure();
  if (!input.from || !input.to || !input.subject || !input.text) throw new ServiceError("resend", "Tous les champs (de, à, objet, message) sont requis.");
  if (isDemo()) return { id: "demo_" + Date.now() };
  return apiCall<{ id: string }>("resend", `${BASE}/emails`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ from: input.from, to: [input.to], subject: input.subject, text: input.text }),
  });
}
