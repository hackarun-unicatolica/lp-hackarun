// Cloudflare Pages Function: só o sorteio da organização (/sorteio*, /api/sorteio*), a lista pública de equipes
// (/api/equipes) e a avaliação entre colegas (/feedback, /api/feedback/*) passam por aqui (public/_routes.json); o resto
// do site continua estático. A lógica fica em src/server (testada no Vitest)
import { CacheAttemptStore, MemoryAttemptStore, type AttemptStore } from '../src/server/sorteio/attempts';
import type { SorteioEnv } from '../src/server/sorteio/config';
import { handleSorteio, isSorteioPath } from '../src/server/sorteio/handler';
import { handleTeams, type EdgeCache, type TeamsEnv } from '../src/server/equipes/proxy';
import type { FeedbackEnv } from '../src/server/feedback/config';
import { handleFeedback, isFeedbackPath } from '../src/server/feedback/handler';

interface PagesContext {
  request: Request;
  env: SorteioEnv & TeamsEnv & FeedbackEnv;
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
  const notFound = () =>
    context.env.ASSETS
      ? context.env.ASSETS.fetch(new URL('/404', url))
      : Promise.resolve(new Response('Não encontrado', { status: 404 }));
  if (isFeedbackPath(url.pathname)) {
    const edge = (globalThis as { caches?: { default?: unknown } }).caches?.default as EdgeCache | undefined;
    return handleFeedback(context.request, context.env, {
      next: () => context.next(),
      notFound,
      attempts: attemptStore(),
      fetch: (input, init) => fetch(input, init),
      cache: edge ?? null,
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
  }
  if (!isSorteioPath(url.pathname)) return context.next();
  return handleSorteio(context.request, context.env, {
    next: () => context.next(),
    notFound,
    attempts: attemptStore(),
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
};
