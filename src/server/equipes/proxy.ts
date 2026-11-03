// lista pública de equipes (/api/equipes), servida pela Cloudflare: guarda a resposta do Apps Script por uns segundos e
// entrega a mesma cópia a quem chegar, então 200 pessoas abrindo /equipes juntas viram 1 chamada ao Apps Script (que
// aceita só 30 execuções simultâneas por conta). Se o Apps Script falhar, devolve a última lista boa em vez de erro.
// Só roda no servidor da Cloudflare: imports relativos, sem os aliases do Astro

export interface TeamsEnv {
  PUBLIC_TEAMS_ENDPOINT?: string;
  PUBLIC_REGISTRATION_ENDPOINT?: string;
}

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface TeamsDeps {
  fetch: typeof fetch;
  // sem Cache API (teste local sem a Cloudflare): sempre busca
  cache: EdgeCache | null;
}

// quanto tempo a lista boa vale como "fresca" e por quanto tempo serve de reserva se o Apps Script cair
export const FRESH_SECONDS = 45;
export const STALE_SECONDS = 60 * 60;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_BYTES = 512 * 1024;
const FRESH_KEY = 'https://equipes-cache.invalid/fresh';
const STALE_KEY = 'https://equipes-cache.invalid/stale';

const json = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });

const failure = (status: number, error: string) =>
  json(JSON.stringify({ ok: false, error }), status, { 'Cache-Control': 'no-store' });

export function teamsEndpoint(env: TeamsEnv): string | null {
  const url = (env.PUBLIC_TEAMS_ENDPOINT || env.PUBLIC_REGISTRATION_ENDPOINT || '').trim();
  return url.startsWith('https://script.google.com/') ? url : null;
}

// várias requisições juntas durante a mesma busca dividem a mesma chamada ao Apps Script
let inflight: Promise<string | null> | null = null;

async function fromUpstream(endpoint: string, deps: TeamsDeps): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const url = new URL(endpoint);
    url.searchParams.set('action', 'teams');
    const response = await deps.fetch(url.toString(), { redirect: 'follow', signal: controller.signal });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > MAX_BYTES) return null;
    const parsed = JSON.parse(text) as { ok?: unknown; teams?: unknown };
    if (parsed.ok !== true || !Array.isArray(parsed.teams)) return null;
    return JSON.stringify({ ok: true, teams: parsed.teams });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function remember(cache: EdgeCache, body: string): Promise<void> {
  const keep = (key: string, seconds: number) =>
    cache.put(new Request(key), json(body, 200, { 'Cache-Control': `public, max-age=${seconds}` }));
  await Promise.all([keep(FRESH_KEY, FRESH_SECONDS), keep(STALE_KEY, STALE_SECONDS)]);
}

export async function handleTeams(request: Request, env: TeamsEnv, deps: TeamsDeps): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return failure(405, 'method');
  const endpoint = teamsEndpoint(env);
  if (!endpoint) return failure(503, 'not-configured');

  const fresh = await deps.cache?.match(new Request(FRESH_KEY));
  if (fresh)
    return json(await fresh.text(), 200, { 'Cache-Control': 'public, max-age=15', 'X-Cache': 'HIT' });

  inflight ??= fromUpstream(endpoint, deps).finally(() => {
    inflight = null;
  });
  const body = await inflight;
  if (body) {
    if (deps.cache) await remember(deps.cache, body).catch(() => undefined);
    return json(body, 200, { 'Cache-Control': 'public, max-age=15', 'X-Cache': 'MISS' });
  }

  const stale = await deps.cache?.match(new Request(STALE_KEY));
  if (stale)
    return json(await stale.text(), 200, { 'Cache-Control': 'public, max-age=5', 'X-Cache': 'STALE' });
  return failure(502, 'upstream');
}
