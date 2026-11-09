// a função do site com planilha, cache e relógio falsos
import { vi } from 'vitest';
import type { FeedbackEnv } from '../../src/server/feedback/config';
import { handleFeedback, type FeedbackDeps } from '../../src/server/feedback/handler';
import type { EdgeCache } from '../../src/server/equipes/proxy';
import { identityKey, type RosterPerson } from '../../src/server/feedback/roster';
import { MemoryAttemptStore } from '../../src/server/sorteio/attempts';

export const ORIGIN = 'https://hackarun.com.br';
export const TOKEN = 't'.repeat(32);
export const ENV: FeedbackEnv = {
  FEEDBACK_ATIVO: 'sim',
  SORTEIO_TOKEN: TOKEN,
  SORTEIO_PLANILHA_URL: 'https://script.google.com/macros/s/x/exec',
};
const WINDOWS = [
  {
    day: '2026-11-13',
    label: '13/11',
    opens: '2026-11-13T19:00:00-03:00',
    closes: '2026-11-13T23:59:59-03:00',
  },
  {
    day: '2026-11-14',
    label: '14/11',
    opens: '2026-11-14T10:00:00-03:00',
    closes: '2026-11-14T16:30:00-03:00',
  },
];
export const OPEN = Date.parse('2026-11-13T20:00:00-03:00');
export const hex = (c: string) => c.repeat(16);
export const PHONE = '(63) 99999-0101';
export const emailOf = (name: string) => `${name}@exemplo.com`;

export async function member(
  id: string,
  name: string,
  team: string,
  done: string[] = [],
): Promise<RosterPerson> {
  return {
    key: await identityKey(TOKEN, emailOf(name.toLowerCase()), PHONE),
    ref: hex(id),
    protocol: `HR26-${id.toUpperCase().repeat(6)}`,
    name,
    team,
    done,
  };
}

class MemoryCache implements EdgeCache {
  readonly store = new Map<string, string>();
  match = (request: Request) => {
    const body = this.store.get(request.url);
    return Promise.resolve(body === undefined ? undefined : new Response(body));
  };

  put = async (request: Request, response: Response) => {
    this.store.set(request.url, await response.text());
  };
}

interface Options {
  people?: RosterPerson[];
  env?: FeedbackEnv;
  submitReply?: unknown;
  rosterFails?: boolean;
}

export async function harness(options: Options = {}) {
  const people = options.people ?? [
    await member('a', 'Ana', 'Mew'),
    await member('b', 'Bruno', 'Mew'),
    await member('c', 'Caio', 'Mew'),
    await member('d', 'Duda', 'Onix'),
  ];
  const clock = { now: OPEN };
  const cache = new MemoryCache();
  const upstream = vi.fn((_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { action: string };
    if (body.action === 'feedback-roster') {
      if (options.rosterFails) return Promise.reject(new Error('fora do ar'));
      return Promise.resolve(new Response(JSON.stringify({ ok: true, windows: WINDOWS, people })));
    }
    return Promise.resolve(new Response(JSON.stringify(options.submitReply ?? { ok: true })));
  });
  const deps: FeedbackDeps = {
    next: () => Promise.resolve(new Response('<h1>avaliação</h1>')),
    notFound: () => Promise.resolve(new Response('<h1>404</h1>')),
    attempts: new MemoryAttemptStore(() => clock.now),
    fetch: upstream as unknown as typeof fetch,
    cache,
    now: () => clock.now,
    sleep: () => Promise.resolve(),
  };
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    handleFeedback(
      new Request(ORIGIN + path, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'CF-Connecting-IP': '1.1.1.1', ...headers },
        body: JSON.stringify(body),
      }),
      options.env ?? ENV,
      deps,
    );
  const enter = (email = emailOf('ana'), whatsapp = PHONE, headers?: Record<string, string>) =>
    post('/api/feedback/entrar', { email, whatsapp }, headers);
  const submitted = () =>
    upstream.mock.calls
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)
      .filter((body) => body['action'] === 'feedback-submit');
  const open = async () => (await (await enter()).json()) as Record<string, unknown> & { ticket: string };
  const send = (ticket: string, ratings: unknown) => post('/api/feedback/enviar', { ticket, ratings });
  return { clock, cache, upstream, deps, post, enter, open, send, submitted };
}

export const GOOD = [
  { id: hex('b'), stars: 5, absent: false, reason: '' },
  { id: hex('c'), stars: 2, absent: false, reason: 'Sumiu na hora do deploy.' },
];

export const read = async (response: Response) => (await response.json()) as Record<string, unknown>;
