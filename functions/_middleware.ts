// Cloudflare Pages Function: só o sorteio da organização (/sorteio*, /api/sorteio*) e a lista pública de equipes
// (/api/equipes) passam por aqui (public/_routes.json); o resto do site continua estático. A lógica fica em
// src/server/sorteio e src/server/equipes (testadas no Vitest)
import { CacheAttemptStore, MemoryAttemptStore, type AttemptStore } from '../src/server/sorteio/attempts';
import type { SorteioEnv } from '../src/server/sorteio/config';
import { handleSorteio, isSorteioPath } from '../src/server/sorteio/handler';
import { handleTeams, type EdgeCache, type TeamsEnv } from '../src/server/equipes/proxy';

interface PagesContext {
  request: Request;
  env: SorteioEnv & TeamsEnv;
  next(): Promise<Response>;
}

// a Cache API existe na Cloudflare (caches.default); fora dela o limite fica na memória do processo
const memory = new MemoryAttemptStore();

function attemptStore(): AttemptStore {
  const edge = (globalThis as { caches?: { default?: unknown } }).caches?.default;
  return edge ? new CacheAttemptStore(edge as ConstructorParameters<typeof CacheAttemptStore>[0]) : memory;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  if (url.pathname === '/api/equipes') {
    const edge = (globalThis as { caches?: { default?: unknown } }).caches?.default as EdgeCache | undefined;
    return handleTeams(context.request, context.env, {
      fetch: (input, init) => fetch(input, init),
      cache: edge ?? null,
    });
  }
  if (!isSorteioPath(url.pathname)) return context.next();
  return handleSorteio(context.request, context.env, {
    next: () => context.next(),
    notFound: () =>
      context.env.ASSETS
        ? context.env.ASSETS.fetch(new URL('/404', url))
        : Promise.resolve(new Response('Não encontrado', { status: 404 })),
    attempts: attemptStore(),
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
};
