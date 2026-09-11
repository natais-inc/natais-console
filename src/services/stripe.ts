import { env, isDemo, isConfigured, NotConfiguredError, ServiceError } from "../config.js";
import { apiCall } from "./fetch.js";
import { demoStripe } from "../demo/fixtures.js";

const BASE = "https://api.stripe.com/v1";

export interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
  livemode: boolean;
}

export interface StripePayment {
  id: string;
  amount: number; // en cents
  currency: string;
  status: string; // succeeded | processing | requires_payment_method | canceled …
  description: string | null;
  customerEmail: string | null;
  created: number; // epoch seconds
}

export interface StripeCustomer {
  id: string;
  name: string | null;
  email: string | null;
  created: number;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amountDue: number;
  currency: string;
  status: string; // draft | open | paid | uncollectible | void
  dueDate: number | null;
  hostedUrl: string | null;
}

export interface StripePaymentLink {
  id: string;
  url: string;
  active: boolean;
}

function headers(): Record<string, string> {
  return {
    authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
    "content-type": "application/x-www-form-urlencoded",
    "stripe-version": "2024-06-20",
  };
}

function ensure(): void {
  if (!isConfigured("stripe")) throw new NotConfiguredError("stripe");
}

export function isTestMode(): boolean {
  if (isDemo()) return true;
  return (env("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_") || (env("STRIPE_SECRET_KEY") ?? "").startsWith("rk_test_");
}

export async function balance(): Promise<StripeBalance> {
  ensure();
  if (isDemo()) return demoStripe.balance;
  const b = await apiCall<{ available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[]; livemode: boolean }>("stripe", `${BASE}/balance`, { headers: headers() });
  return { available: b.available ?? [], pending: b.pending ?? [], livemode: !!b.livemode };
}

export async function recentPayments(limit = 20): Promise<StripePayment[]> {
  ensure();
  if (isDemo()) return demoStripe.payments.slice(0, limit);
  const data = await apiCall<{ data: { id: string; amount: number; currency: string; status: string; description: string | null; receipt_email: string | null; created: number }[] }>(
    "stripe",
    `${BASE}/payment_intents?limit=${limit}`,
    { headers: headers() },
  );
  return (data.data ?? []).map((p) => ({ id: p.id, amount: p.amount, currency: p.currency, status: p.status, description: p.description, customerEmail: p.receipt_email, created: p.created }));
}

export async function customers(limit = 20): Promise<StripeCustomer[]> {
  ensure();
  if (isDemo()) return demoStripe.customers.slice(0, limit);
  const data = await apiCall<{ data: { id: string; name: string | null; email: string | null; created: number }[] }>("stripe", `${BASE}/customers?limit=${limit}`, { headers: headers() });
  return (data.data ?? []).map((c) => ({ id: c.id, name: c.name, email: c.email, created: c.created }));
}

export async function openInvoices(limit = 20): Promise<StripeInvoice[]> {
  ensure();
  if (isDemo()) return demoStripe.invoices.slice(0, limit);
  const data = await apiCall<{ data: { id: string; number: string | null; customer_name: string | null; customer_email: string | null; amount_due: number; currency: string; status: string; due_date: number | null; hosted_invoice_url: string | null }[] }>(
    "stripe",
    `${BASE}/invoices?status=open&limit=${limit}`,
    { headers: headers() },
  );
  return (data.data ?? []).map((i) => ({
    id: i.id,
    number: i.number,
    customerName: i.customer_name,
    customerEmail: i.customer_email,
    amountDue: i.amount_due,
    currency: i.currency,
    status: i.status,
    dueDate: i.due_date,
    hostedUrl: i.hosted_invoice_url,
  }));
}

export async function paymentLinks(limit = 20): Promise<StripePaymentLink[]> {
  ensure();
  if (isDemo()) return demoStripe.links.slice(0, limit);
  const data = await apiCall<{ data: { id: string; url: string; active: boolean }[] }>("stripe", `${BASE}/payment_links?limit=${limit}&active=true`, { headers: headers() });
  return (data.data ?? []).map((l) => ({ id: l.id, url: l.url, active: l.active }));
}

export interface PaymentLinkInput {
  name: string;
  amountCents: number;
  currency: string; // cad, usd…
}

/** Crée produit + prix + lien de paiement en 3 appels. */
export async function createPaymentLink(input: PaymentLinkInput): Promise<StripePaymentLink> {
  ensure();
  const name = input.name.trim();
  if (!name) throw new ServiceError("stripe", "Le nom du produit est requis.");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) throw new ServiceError("stripe", "Le montant doit être d'au moins 0,50.");
  const currency = input.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new ServiceError("stripe", "Devise invalide (code ISO à 3 lettres, ex. cad).");
  if (isDemo()) return { id: "plink_demo_" + Date.now(), url: "https://buy.stripe.com/test_demo", active: true };

  const product = await apiCall<{ id: string }>("stripe", `${BASE}/products`, { method: "POST", headers: headers(), body: new URLSearchParams({ name }).toString() });
  const price = await apiCall<{ id: string }>("stripe", `${BASE}/prices`, {
    method: "POST",
    headers: headers(),
    body: new URLSearchParams({ product: product.id, unit_amount: String(input.amountCents), currency }).toString(),
  });
  const link = await apiCall<{ id: string; url: string; active: boolean }>("stripe", `${BASE}/payment_links`, {
    method: "POST",
    headers: headers(),
    body: new URLSearchParams({ "line_items[0][price]": price.id, "line_items[0][quantity]": "1" }).toString(),
  });
  return { id: link.id, url: link.url, active: link.active };
}
