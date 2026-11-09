// quem pode avaliar: a lista vem da planilha e fica guardada na Cloudflare por 45 s, então 180 pessoas entrando juntas
// não viram 180 chamadas ao Apps Script (cada uma custa alguns segundos e ele aceita só 30 simultâneas). Se a planilha
// falhar, a última lista boa continua valendo. E-mail e WhatsApp chegam só como resumo (key), nunca o contato em si
import type { EdgeCache } from '../equipes/proxy';
import type { FeedbackConfig } from './config';

export interface FeedbackWindow {
  day: string;
  label: string;
  opens: string;
  closes: string;
}

export interface RosterPerson {
  key: string;
  ref: string;
  protocol: string;
  name: string;
  team: string;
  // dias (YYYY-MM-DD) já avaliados
  done: string[];
}

export interface Roster {
  windows: FeedbackWindow[];
  people: RosterPerson[];
}

export interface RosterDeps {
  fetch: typeof fetch;
  cache: EdgeCache | null;
}

export const ROSTER_FRESH_SECONDS = 45;
export const ROSTER_STALE_SECONDS = 60 * 60;
const UPSTREAM_TIMEOUT_MS = 30_000;
const FRESH_KEY = 'https://feedback-cache.invalid/fresh';
const STALE_KEY = 'https://feedback-cache.invalid/stale';

function validRoster(value: unknown): value is Roster {
  const roster = value as Partial<Roster> | null;
  return Boolean(roster) && Array.isArray(roster?.windows) && Array.isArray(roster?.people);
}

let inflight: Promise<Roster | null> | null = null;

async function fromUpstream(config: FeedbackConfig, deps: RosterDeps): Promise<Roster | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await deps.fetch(config.endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'feedback-roster', token: config.token }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const parsed = (await response.json()) as { ok?: unknown; windows?: unknown; people?: unknown };
    if (parsed.ok !== true || !validRoster(parsed)) {
      console.error('feedback: a planilha não devolveu a lista', (parsed as { error?: unknown }).error);
      return null;
    }
    return { windows: parsed.windows, people: parsed.people };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function remember(cache: EdgeCache, roster: Roster): Promise<void> {
  const body = JSON.stringify(roster);
  const keep = (key: string, seconds: number) =>
    cache.put(
      new Request(key),
      new Response(body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` },
      }),
    );
  await Promise.all([keep(FRESH_KEY, ROSTER_FRESH_SECONDS), keep(STALE_KEY, ROSTER_STALE_SECONDS)]);
}

async function cached(cache: EdgeCache | null, key: string): Promise<Roster | null> {
  const hit = await cache?.match(new Request(key));
  if (!hit) return null;
  const parsed: unknown = await hit.json();
  return validRoster(parsed) ? parsed : null;
}

export async function loadRoster(config: FeedbackConfig, deps: RosterDeps): Promise<Roster | null> {
  const fresh = await cached(deps.cache, FRESH_KEY);
  if (fresh) return fresh;
  inflight ??= fromUpstream(config, deps).finally(() => {
    inflight = null;
  });
  const roster = await inflight;
  if (roster) {
    if (deps.cache) await remember(deps.cache, roster).catch(() => undefined);
    return roster;
  }
  return cached(deps.cache, STALE_KEY);
}

// o que entra na conta: e-mail em minúsculas + DDD e 8 últimos dígitos (com ou sem o 9 da frente é a mesma pessoa).
// Igual ao feedbackRoster_ do Apps Script (um teste confere)
export function identityText(token: string, email: string, whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '').replace(/^0+/, '');
  const local =
    (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? digits.slice(2) : digits;
  return `${token}|${email.trim().toLowerCase()}|${local.slice(0, 2)}${local.slice(-8)}`;
}

export async function identityKey(token: string, email: string, whatsapp: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identityText(token, email, whatsapp)),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function currentWindow(windows: readonly FeedbackWindow[], now: number): FeedbackWindow | null {
  return windows.find((w) => now >= Date.parse(w.opens) && now <= Date.parse(w.closes)) ?? null;
}

export function nextWindow(windows: readonly FeedbackWindow[], now: number): FeedbackWindow | null {
  return windows.find((w) => Date.parse(w.opens) > now) ?? null;
}
