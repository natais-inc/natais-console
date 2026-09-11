import { env, isDemo, isConfigured, NotConfiguredError } from "../config.js";
import { apiCall } from "./fetch.js";
import { demoGithub } from "../demo/fixtures.js";

const BASE = "https://api.github.com";

export interface GhRepo {
  fullName: string; // owner/name
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  pushedAt: string;
  openIssues: number; // issues + PR (compteur GitHub)
  url: string;
  description: string | null;
}

export interface GhPullRequest {
  number: number;
  title: string;
  repo: string; // owner/name
  author: string;
  url: string;
  createdAt: string;
  draft: boolean;
}

export interface GhCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GhIssue {
  number: number;
  title: string;
  author: string;
  url: string;
  createdAt: string;
}

function headers(): Record<string, string> {
  return {
    authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "natais-console",
  };
}

function ensure(): void {
  if (!isConfigured("github")) throw new NotConfiguredError("github");
}

interface RawRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  pushed_at: string;
  open_issues_count: number;
  html_url: string;
  description: string | null;
}

function mapRepo(r: RawRepo): GhRepo {
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    private: r.private,
    defaultBranch: r.default_branch,
    pushedAt: r.pushed_at,
    openIssues: r.open_issues_count,
    url: r.html_url,
    description: r.description,
  };
}

export async function currentLogin(): Promise<string> {
  ensure();
  if (isDemo()) return demoGithub.login;
  const u = await apiCall<{ login: string }>("github", `${BASE}/user`, { headers: headers() });
  return u.login;
}

/** Organisations : GITHUB_ORGS si défini, sinon celles de l'utilisateur. */
export async function orgs(): Promise<string[]> {
  ensure();
  const configured = env("GITHUB_ORGS");
  if (configured) return configured.split(",").map((s) => s.trim()).filter(Boolean);
  if (isDemo()) return demoGithub.orgs;
  const list = await apiCall<{ login: string }[]>("github", `${BASE}/user/orgs?per_page=50`, { headers: headers() });
  return list.map((o) => o.login);
}

/** Dépôts personnels + des organisations, triés par dernier push. */
export async function listRepos(): Promise<GhRepo[]> {
  ensure();
  if (isDemo()) return demoGithub.repos;
  const own = await apiCall<RawRepo[]>("github", `${BASE}/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator`, { headers: headers() });
  const orgNames = await orgs();
  const orgRepos = await Promise.all(
    orgNames.map((o) =>
      apiCall<RawRepo[]>("github", `${BASE}/orgs/${encodeURIComponent(o)}/repos?sort=pushed&per_page=50`, { headers: headers() }).catch(() => [] as RawRepo[]),
    ),
  );
  const seen = new Set<string>();
  const all: GhRepo[] = [];
  for (const r of [...own, ...orgRepos.flat()]) {
    if (seen.has(r.full_name)) continue;
    seen.add(r.full_name);
    all.push(mapRepo(r));
  }
  all.sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1));
  return all;
}

interface RawSearchItem {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  draft?: boolean;
  user: { login: string };
  repository_url: string; // https://api.github.com/repos/owner/name
}

/** PR ouvertes sur tous les dépôts de l'utilisateur et de ses organisations (1 appel de recherche). */
export async function openPullRequests(): Promise<GhPullRequest[]> {
  ensure();
  if (isDemo()) return demoGithub.pulls;
  const login = await currentLogin();
  const orgNames = await orgs();
  // Syntaxe « recherche avancée » (par défaut depuis sept. 2025) : les périmètres doivent être reliés par OR explicitement.
  const scope = [`user:${login}`, ...orgNames.map((o) => `org:${o}`)].join(" OR ");
  const q = encodeURIComponent(`is:pr is:open (${scope})`);
  const data = await apiCall<{ items: RawSearchItem[] }>("github", `${BASE}/search/issues?q=${q}&advanced_search=true&sort=updated&per_page=50`, { headers: headers() });
  return (data.items ?? []).map((i) => ({
    number: i.number,
    title: i.title,
    repo: i.repository_url.replace(`${BASE}/repos/`, ""),
    author: i.user.login,
    url: i.html_url,
    createdAt: i.created_at,
    draft: !!i.draft,
  }));
}

export async function repoCommits(owner: string, name: string, limit = 15): Promise<GhCommit[]> {
  ensure();
  if (isDemo()) return demoGithub.commits;
  const data = await apiCall<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }[]>(
    "github",
    `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits?per_page=${limit}`,
    { headers: headers() },
  );
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0] ?? "",
    author: c.commit.author?.name ?? "?",
    date: c.commit.author?.date ?? "",
    url: c.html_url,
  }));
}

export async function repoPulls(owner: string, name: string): Promise<GhPullRequest[]> {
  ensure();
  if (isDemo()) return demoGithub.pulls.filter((p) => p.repo === `${owner}/${name}`);
  const data = await apiCall<{ number: number; title: string; html_url: string; created_at: string; draft: boolean; user: { login: string } }[]>(
    "github",
    `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=open&per_page=30`,
    { headers: headers() },
  );
  return data.map((p) => ({ number: p.number, title: p.title, repo: `${owner}/${name}`, author: p.user.login, url: p.html_url, createdAt: p.created_at, draft: p.draft }));
}

export async function repoIssues(owner: string, name: string): Promise<GhIssue[]> {
  ensure();
  if (isDemo()) return demoGithub.issues;
  const data = await apiCall<{ number: number; title: string; html_url: string; created_at: string; user: { login: string }; pull_request?: unknown }[]>(
    "github",
    `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?state=open&per_page=30`,
    { headers: headers() },
  );
  return data.filter((i) => !i.pull_request).map((i) => ({ number: i.number, title: i.title, author: i.user.login, url: i.html_url, createdAt: i.created_at }));
}
