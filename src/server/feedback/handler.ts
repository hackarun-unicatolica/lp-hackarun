// avaliação entre colegas no site: /feedback é público, mas só entra quem está em uma equipe (e-mail + WhatsApp da
// inscrição). Identificar acontece aqui, com a lista guardada; a planilha só é chamada para gravar um envio.
// As notas nunca voltam ao navegador. Desligado (FEEDBACK_ATIVO) = 404
import { readFeedbackConfig, type FeedbackConfig, type FeedbackEnv } from './config';
import { enter } from './enter';
import { json, type FeedbackDeps } from './shared';
import { submit } from './submit';

export type { FeedbackDeps } from './shared';
export { EMAIL_MAX_FAILURES, IP_MAX_FAILURES } from './enter';

export const FEEDBACK_PAGE = '/feedback';
export const ENTER_PATH = '/api/feedback/entrar';
export const SUBMIT_PATH = '/api/feedback/enviar';
const API_PREFIX = '/api/feedback';
const MAX_BODY_BYTES = 32 * 1024;
export function isFeedbackPath(pathname: string): boolean {
  return (
    pathname === FEEDBACK_PAGE ||
    pathname.startsWith(`${FEEDBACK_PAGE}/`) ||
    pathname.startsWith(`${FEEDBACK_PAGE}.`) ||
    pathname === API_PREFIX ||
    pathname.startsWith(`${API_PREFIX}/`)
  );
}

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
};

async function notFound(deps: FeedbackDeps): Promise<Response> {
  const page = await deps.notFound();
  return new Response(page.body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleFeedback(
  request: Request,
  env: FeedbackEnv,
  deps: FeedbackDeps,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const isApi = pathname.startsWith(API_PREFIX);
  const state = readFeedbackConfig(env);
  if (state.kind === 'off') return isApi ? json(404, { ok: false, error: 'not-found' }) : notFound(deps);
  if (state.kind === 'broken') {
    console.error(`feedback ligado, mas faltam: ${state.missing.join(', ')}`);
    return isApi
      ? json(503, { ok: false, error: 'unavailable' })
      : new Response('Avaliação indisponível no momento.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
  }
  if (isApi) return api(request, pathname, state.config, deps);

  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  if (clean !== FEEDBACK_PAGE || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return notFound(deps);
  }
  const response = await deps.next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, headers });
}

async function api(
  request: Request,
  pathname: string,
  config: FeedbackConfig,
  deps: FeedbackDeps,
): Promise<Response> {
  if (pathname !== ENTER_PATH && pathname !== SUBMIT_PATH)
    return json(404, { ok: false, error: 'not-found' });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!sameOrigin(request)) return json(403, { ok: false, error: 'forbidden' });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too-large' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'bad-request' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'bad-request' });
  }
  const fields = body as Record<string, unknown>;
  return pathname === ENTER_PATH ? enter(request, fields, config, deps) : submit(fields, config, deps);
}
