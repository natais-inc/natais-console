import { env, isDemo, isConfigured, NotConfiguredError } from "../config.js";
import { apiCall } from "./fetch.js";
import { demoVercel } from "../demo/fixtures.js";

const BASE = "https://api.vercel.com";

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  repo: string | null; // "owner/name"
  productionUrl: string | null;
  latestState: string | null; // READY, ERROR, BUILDING…
}

export interface VercelDeployment {
  id: string;
  url: string;
  state: string; // READY | ERROR | BUILDING | QUEUED | CANCELED | INITIALIZING
  target: "production" | "preview";
  createdAt: number;
  commitMessage: string | null;
  branch: string | null;
  projectName: string;
}

export interface VercelDomain {
  name: string;
  verified: boolean;
  redirect: string | null;
}

function headers(): Record<string, string> {
  return { authorization: `Bearer ${env("VC_API_TOKEN")}`, "content-type": "application/json" };
}

function teamQuery(prefix = "?"): string {
  const team = env("VC_TEAM_ID");
  return team ? `${prefix}teamId=${encodeURIComponent(team)}` : "";
}

function ensure(): void {
  if (!isConfigured("vercel")) throw new NotConfiguredError("vercel");
}

interface RawProject {
  id: string;
  name: string;
  framework?: string | null;
  updatedAt?: number;
  link?: { type?: string; org?: string; repo?: string } | null;
  latestDeployments?: { readyState?: string; state?: string; url?: string; target?: string | null }[];
  targets?: { production?: { url?: string; alias?: string[]; readyState?: string } };
}

export async function listProjects(): Promise<VercelProject[]> {
  ensure();
  if (isDemo()) return demoVercel.projects;
  const q = new URLSearchParams({ limit: "50" });
  const team = env("VC_TEAM_ID");
  if (team) q.set("teamId", team);
  const data = await apiCall<{ projects: RawProject[] }>("vercel", `${BASE}/v9/projects?${q}`, { headers: headers() });
  return (data.projects ?? []).map((p) => {
    const prod = p.targets?.production;
    const alias = prod?.alias?.[0] ?? prod?.url ?? null;
    const latest = p.latestDeployments?.[0];
    return {
      id: p.id,
      name: p.name,
      framework: p.framework ?? null,
      updatedAt: p.updatedAt ?? 0,
      repo: p.link?.org && p.link?.repo ? `${p.link.org}/${p.link.repo}` : null,
      productionUrl: alias ? `https://${alias}` : null,
      latestState: latest?.readyState ?? latest?.state ?? prod?.readyState ?? null,
    };
  });
}

interface RawDeployment {
  uid: string;
  name: string;
  url: string;
  state?: string;
  readyState?: string;
  target?: string | null;
  created?: number;
  createdAt?: number;
  meta?: Record<string, string | undefined>;
}

function mapDeployment(d: RawDeployment): VercelDeployment {
  return {
    id: d.uid,
    url: d.url,
    state: d.readyState ?? d.state ?? "UNKNOWN",
    target: d.target === "production" ? "production" : "preview",
    createdAt: d.createdAt ?? d.created ?? 0,
    commitMessage: d.meta?.["githubCommitMessage"] ?? d.meta?.["gitlabCommitMessage"] ?? null,
    branch: d.meta?.["githubCommitRef"] ?? d.meta?.["gitlabCommitRef"] ?? null,
    projectName: d.name,
  };
}

export async function listDeployments(projectId?: string, limit = 10): Promise<VercelDeployment[]> {
  ensure();
  if (isDemo()) {
    const name = demoVercel.projects.find((p) => p.id === projectId)?.name ?? projectId;
    return demoVercel.deployments.filter((d) => !projectId || d.projectName === name).slice(0, limit);
  }
  const q = new URLSearchParams({ limit: String(limit) });
  if (projectId) q.set("projectId", projectId);
  const team = env("VC_TEAM_ID");
  if (team) q.set("teamId", team);
  const data = await apiCall<{ deployments: RawDeployment[] }>("vercel", `${BASE}/v6/deployments?${q}`, { headers: headers() });
  return (data.deployments ?? []).map(mapDeployment);
}

export async function listProjectDomains(projectId: string): Promise<VercelDomain[]> {
  ensure();
  if (isDemo()) return demoVercel.domains[projectId] ?? [];
  const data = await apiCall<{ domains: { name: string; verified: boolean; redirect?: string | null }[] }>(
    "vercel",
    `${BASE}/v9/projects/${encodeURIComponent(projectId)}/domains${teamQuery()}`,
    { headers: headers() },
  );
  return (data.domains ?? []).map((d) => ({ name: d.name, verified: !!d.verified, redirect: d.redirect ?? null }));
}

/** Redéploie un déploiement existant (mêmes réglages, nouveau build). */
export async function redeploy(deploymentId: string, projectName: string, target: "production" | "preview"): Promise<VercelDeployment> {
  ensure();
  if (isDemo()) {
    return { id: "dpl_demo_new", url: `${projectName}-redeploy.vercel.app`, state: "QUEUED", target, createdAt: Date.now(), commitMessage: "(démo) redéploiement", branch: "main", projectName };
  }
  const body: Record<string, unknown> = { name: projectName, deploymentId };
  if (target === "production") body["target"] = "production";
  const q = new URLSearchParams({ forceNew: "1" });
  const team = env("VC_TEAM_ID");
  if (team) q.set("teamId", team);
  const d = await apiCall<RawDeployment & { id?: string }>("vercel", `${BASE}/v13/deployments?${q}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return mapDeployment({ ...d, uid: d.uid ?? d.id ?? "" });
}
