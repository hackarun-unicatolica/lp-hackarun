// painel de avaliações (/sorteio/avaliacoes): mesma porta do sorteio. Sem login, só a tela de login; com login, a
// página e a ação de leitura feedback-report. Enviar ou listar avaliações pela API do sorteio continua proibido
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { MemoryAttemptStore } from '../../src/server/sorteio/attempts';
import type { SorteioEnv } from '../../src/server/sorteio/config';
import { handleSorteio, type SorteioDeps } from '../../src/server/sorteio/handler';

const ORIGIN = 'https://hackarun.com.br';
const ENV: SorteioEnv = {
  SORTEIO_ATIVO: 'sim',
  SORTEIO_USUARIO: 'org',
  SORTEIO_SENHA: 'Senha#Teste1',
  SORTEIO_TOKEN: 't'.repeat(32),
  SORTEIO_PLANILHA_URL: 'https://script.google.com/macros/s/x/exec',
};
const REPORT = { ok: true, windows: [], people: [], ratings: [] };

function harness() {
  const now = Date.parse('2026-11-12T21:00:00-03:00');
  const upstream = vi.fn(() => Promise.resolve(new Response(JSON.stringify(REPORT))));
  const deps: SorteioDeps = {
    next: () => Promise.resolve(new Response('<h1>painel</h1>')),
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
      body: new URLSearchParams({
        usuario: 'org',
        senha: 'Senha#Teste1',
        voltar: '/sorteio/avaliacoes',
      }).toString(),
    });
    return { response, cookie: (response.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '' };
  };
  const api = (action: string, cookie: string) =>
    send('/api/sorteio', {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  return { send, login, api, upstream };
}

describe('painel de avaliações atrás do login do sorteio', () => {
  it('sem sessão mostra o login e volta para o painel depois de entrar', async () => {
    const { send, login } = harness();
    const page = await send('/sorteio/avaliacoes');
    expect(await page.text()).toContain('value="/sorteio/avaliacoes"');
    const { response, cookie } = await login();
    expect(response.headers.get('Location')).toBe('/sorteio/avaliacoes');
    const panel = await send('/sorteio/avaliacoes', { headers: { Cookie: cookie } });
    expect(await panel.text()).toContain('painel');
    expect(panel.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('com sessão, feedback-report chega na planilha; sem sessão, não', async () => {
    const { login, api, upstream } = harness();
    expect((await api('feedback-report', '')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    const { cookie } = await login();
    const response = await api('feedback-report', cookie);
    expect(await response.json()).toEqual(REPORT);
  });

  it('a API do sorteio não envia nem lista avaliações (isso é só do /feedback)', async () => {
    const { login, api, upstream } = harness();
    const { cookie } = await login();
    expect((await api('feedback-submit', cookie)).status).toBe(400);
    expect((await api('feedback-roster', cookie)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
