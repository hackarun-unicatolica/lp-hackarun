// /gemas (tela dos NPCs, com gabarito): mesma porta do sorteio. Sem login, só a tela de login (com o olho da senha);
// com login, a página e as ações gems-*. A CSP libera só scripts do próprio site (o do olho)
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MemoryAttemptStore } from '../../src/server/sorteio/attempts';
import type { SorteioEnv } from '../../src/server/sorteio/config';
import { handleSorteio, isSorteioPath, type SorteioDeps } from '../../src/server/sorteio/handler';
import { PASSWORD_TOGGLE_SRC } from '../../src/server/sorteio/pages';

const ORIGIN = 'https://hackarun.com.br';
const ENV: SorteioEnv = {
  SORTEIO_ATIVO: 'sim',
  SORTEIO_USUARIO: 'org',
  SORTEIO_SENHA: 'Senha#Teste1',
  SORTEIO_TOKEN: 't'.repeat(32),
  SORTEIO_PLANILHA_URL: 'https://script.google.com/macros/s/x/exec',
};

function harness() {
  const now = Date.parse('2026-11-13T19:00:00-03:00');
  const upstream = vi.fn((_url: unknown, init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ ok: true, echo: JSON.parse(String(init?.body)) }))),
  );
  const deps: SorteioDeps = {
    next: () => Promise.resolve(new Response('<h1>gemas</h1>')),
    notFound: () => Promise.resolve(new Response('<h1>404</h1>')),
    attempts: new MemoryAttemptStore(() => now),
    fetch: upstream as unknown as typeof fetch,
    now: () => now,
    sleep: () => Promise.resolve(),
  };
  const send = (path: string, init: RequestInit = {}) =>
    handleSorteio(new Request(ORIGIN + path, init), ENV, deps);
  const login = async () => {
    const response = await send('/sorteio/entrar', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ usuario: 'org', senha: 'Senha#Teste1', voltar: '/gemas' }).toString(),
    });
    return { response, cookie: (response.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '' };
  };
  const api = (body: Record<string, unknown>, cookie: string) =>
    send('/api/sorteio', {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { send, login, api, upstream };
}

describe('/gemas atrás do login da organização', () => {
  it('o caminho passa pela função (com e sem .html)', () => {
    expect(isSorteioPath('/gemas')).toBe(true);
    expect(isSorteioPath('/gemas.html')).toBe(true);
    expect(isSorteioPath('/gemasx')).toBe(false);
  });

  it('sem sessão mostra o login com o título das gemas e volta para /gemas depois de entrar', async () => {
    const { send, login } = harness();
    const page = await send('/gemas');
    const html = await page.text();
    expect(html).toContain('<h1>Gemas dos NPCs</h1>');
    expect(html).toContain('value="/gemas"');
    expect(html).not.toContain('gemas</h1>');
    const { response, cookie } = await login();
    expect(response.headers.get('Location')).toBe('/gemas');
    const screen = await send('/gemas', { headers: { Cookie: cookie } });
    expect(await screen.text()).toContain('<h1>gemas</h1>');
    expect(screen.headers.get('Cache-Control')).toBe('no-store');
  });

  it('login tem o botão de olho, que vem de um arquivo do próprio site (a CSP só libera o site)', async () => {
    const { send } = harness();
    const page = await send('/gemas');
    const html = await page.text();
    expect(html).toContain('data-eye');
    expect(html).toContain('aria-label="Mostrar senha"');
    expect(html).toContain(`<script src="${PASSWORD_TOGGLE_SRC}" defer></script>`);
    expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    // o arquivo existe em public/ e fora das rotas da função (é servido como estático)
    const file = readFileSync(new URL(`../../public${PASSWORD_TOGGLE_SRC}`, import.meta.url), 'utf8');
    expect(file).toContain('data-eye');
    const routes = JSON.parse(
      readFileSync(new URL('../../public/_routes.json', import.meta.url), 'utf8'),
    ) as {
      include: string[];
    };
    expect(routes.include).not.toContain(PASSWORD_TOGGLE_SRC);
  });

  it('gems-load e gems-sync só chegam na planilha com sessão, e com a chave do sorteio', async () => {
    const { login, api, upstream } = harness();
    expect((await api({ action: 'gems-load', color: 'azul' }, '')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    const { cookie } = await login();
    const response = await api({ action: 'gems-sync', color: 'azul', state: { round: 1 } }, cookie);
    const body = (await response.json()) as { echo: Record<string, unknown> };
    expect(body.echo).toMatchObject({ action: 'gems-sync', color: 'azul', token: 't'.repeat(32) });
  });

  it('sair da tela das gemas volta pro login das gemas', async () => {
    const { send } = harness();
    const response = await send('/sorteio/sair', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ voltar: '/gemas' }).toString(),
    });
    expect(response.headers.get('Location')).toBe('/gemas');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
