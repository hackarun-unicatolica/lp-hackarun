// porteiro do sorteio no site: /sorteio, /sorteio/nomes e /sorteio/avaliacoes (painel das avaliações entre colegas) só
// abrem com o login da organização; /api/sorteio repassa
// as ações do sorteio ao Apps Script com a chave secreta (que nunca chega ao navegador). Desligado = 404
import { MAX_FAILURES, type AttemptStore } from './attempts';
import { readConfig, type SorteioConfig, type SorteioEnv } from './config';
import { LOGIN_HEADERS, loginPage, messagePage, PAGE_HEADERS } from './pages';
import {
  checkLogin,
  clearedCookie,
  createSession,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  validSession,
} from './session';

// /gemas = tela dos NPCs das gemas (questões com gabarito): mesmo login da organização
export const DRAW_PAGES = ['/sorteio', '/sorteio/nomes', '/sorteio/avaliacoes', '/gemas'] as const;
export const API_PATH = '/api/sorteio';
// feedback-report = dados do painel de avaliações (só leitura); gems-* = questões e fila dos NPCs
const ALLOWED_ACTIONS = [
  'draw-list',
  'draw-save',
  'draw-names',
  'draw-publish',
  'feedback-report',
  'gems-load',
  'gems-sync',
];
const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
// atraso fixo em login errado: tentativa em massa fica lenta
const FAILURE_DELAY_MS = 700;

export interface SorteioDeps {
  // a página estática (o que viria sem a função)
  next(): Promise<Response>;
  // a página 404 do site
  notFound(): Promise<Response>;
  attempts: AttemptStore;
  fetch: typeof fetch;
  now(): number;
  sleep(ms: number): Promise<void>;
}

// o caminho é do sorteio? (/sorteio, /sorteio/..., /sorteio.html, /gemas, /api/sorteio)
export function isSorteioPath(pathname: string): boolean {
  return (
    pathname === '/gemas' ||
    pathname.startsWith('/gemas/') ||
    pathname.startsWith('/gemas.') ||
    pathname === '/sorteio' ||
    pathname.startsWith('/sorteio/') ||
    pathname.startsWith('/sorteio.') ||
    pathname === API_PATH ||
    pathname.startsWith(`${API_PATH}/`)
  );
}

// /sorteio/ e /sorteio.html viram /sorteio; caminho que não é uma das telas vira null
function drawPage(pathname: string): string | null {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return (DRAW_PAGES as readonly string[]).includes(clean) ? clean : null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const html = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...PAGE_HEADERS, ...extra } });

// tela de login: a única com script (o olho da senha), liberado pelo hash na CSP
const loginHtml = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...LOGIN_HEADERS, ...extra } });

const redirect = (location: string, cookie?: string) => {
  const headers: Record<string, string> = { Location: location, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
};

// pedido que muda algo tem que vir do próprio site (o navegador manda Origin em todo POST)
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

const clientIp = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'local';

async function notFound(deps: SorteioDeps): Promise<Response> {
  const page = await deps.notFound();
  return new Response(page.body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleSorteio(request: Request, env: SorteioEnv, deps: SorteioDeps): Promise<Response> {
  const url = new URL(request.url);
  const state = readConfig(env);
  if (state.kind === 'off') {
    return url.pathname.startsWith(API_PATH) ? json(404, { ok: false, error: 'not-found' }) : notFound(deps);
  }
  if (state.kind === 'broken') {
    console.error(`sorteio ligado, mas faltam: ${state.missing.join(', ')}`);
    if (url.pathname.startsWith(API_PATH)) return json(503, { ok: false, error: 'misconfigured' });
    return html(503, messagePage('Sorteio indisponível', 'A configuração do sorteio está incompleta.'));
  }
  const { config } = state;
  const session = await validSession(config, readCookie(request, SESSION_COOKIE), deps.now());

  if (url.pathname === API_PATH) return api(request, config, session, deps);
  if (url.pathname === '/sorteio/entrar') return login(request, config, deps);
  if (url.pathname === '/sorteio/sair') {
    if (request.method !== 'POST' || !sameOrigin(request))
      return html(405, messagePage('Ops', 'Use o botão Sair.'));
    // volta pro login da tela de onde saiu (sorteio ou gemas)
    const form = await request.formData().catch(() => null);
    const back = form?.get('voltar');
    return redirect((typeof back === 'string' && drawPage(back)) || '/sorteio', clearedCookie());
  }

  const page = drawPage(url.pathname);
  if (!page || (request.method !== 'GET' && request.method !== 'HEAD')) return notFound(deps);
  if (!session) return loginHtml(200, loginPage({ back: page }));
  const response = await deps.next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, headers });
}

async function login(request: Request, config: SorteioConfig, deps: SorteioDeps): Promise<Response> {
  if (request.method !== 'POST') return redirect('/sorteio');
  if (!sameOrigin(request)) return html(403, messagePage('Acesso negado', 'Entre pela página do sorteio.'));
  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);
    return typeof value === 'string' ? value.slice(0, 200) : '';
  };
  const back = drawPage(field('voltar')) ?? '/sorteio';
  const user = field('usuario');
  const ip = clientIp(request);
  if ((await deps.attempts.failures(ip)) >= MAX_FAILURES) {
    return loginHtml(
      429,
      loginPage({ back, user, error: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.' }),
      { 'Retry-After': '900' },
    );
  }
  if (await checkLogin(config, user, field('senha'))) {
    await deps.attempts.clear(ip);
    return redirect(back, sessionCookie(await createSession(config, deps.now())));
  }
  await deps.attempts.fail(ip);
  await deps.sleep(FAILURE_DELAY_MS);
  return loginHtml(401, loginPage({ back, user, error: 'Login ou senha incorretos.' }));
}

async function api(
  request: Request,
  config: SorteioConfig,
  session: boolean,
  deps: SorteioDeps,
): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!sameOrigin(request)) return json(403, { ok: false, error: 'forbidden' });
  if (!session) return json(401, { ok: false, error: 'unauthorized' });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too-large' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'bad-request' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json(400, { ok: false, error: 'bad-request' });
  const action = (body as { action?: unknown }).action;
  if (typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
    return json(400, { ok: false, error: 'unknown-action' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    // text/plain como o formulário de inscrição; o Apps Script responde com 302 para o googleusercontent
    const upstream = await deps.fetch(config.endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: config.token }),
      signal: controller.signal,
    });
    const text = await upstream.text();
    const parsed: unknown = upstream.ok ? JSON.parse(text) : null;
    if (!parsed || typeof parsed !== 'object') return json(502, { ok: false, error: 'server' });
    // a planilha recusou a chave: o problema é a configuração (o navegador não tem como resolver)
    if ((parsed as { error?: unknown }).error === 'unauthorized') {
      console.error('sorteio: o Apps Script recusou a chave (SORTEIO_TOKEN diferente nas duas pontas?)');
      return json(502, { ok: false, error: 'server', message: 'A planilha recusou a chave do sorteio.' });
    }
    return json(200, parsed);
  } catch {
    return json(504, { ok: false, error: 'network', message: 'A planilha não respondeu a tempo.' });
  } finally {
    clearTimeout(timer);
  }
}
