// lista pública de equipes na Cloudflare: guarda a resposta do Apps Script, junta chamadas simultâneas e serve a última
// lista boa quando o Apps Script falha
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleTeams, type EdgeCache, type TeamsEnv } from '../../src/server/equipes/proxy';

const ENV: TeamsEnv = { PUBLIC_TEAMS_ENDPOINT: 'https://script.google.com/macros/s/AKfy/exec' };
const TEAMS = {
  ok: true,
  teams: [{ id: 'team-1', name: 'Equipe Charizard', memberCount: 4, members: ['Ana Souza'] }],
};

// Cache API de mentira: guarda o corpo por URL e respeita só "tem ou não tem" (o tempo é da Cloudflare)
function memoryCache(): EdgeCache & { store: Map<string, string>; expire(key: string): void } {
  const store = new Map<string, string>();
  return {
    store,
    expire: (key) => void store.delete(key),
    match: async (request) => (store.has(request.url) ? new Response(store.get(request.url)) : undefined),
    put: async (request, response) => void store.set(request.url, await response.text()),
  };
}

const ok = () => new Response(JSON.stringify(TEAMS));
const get = () => new Request('https://hackarun.com.br/api/equipes');

describe('/api/equipes', () => {
  it('a primeira chamada vai ao Apps Script e as seguintes saem do cache, sem nova chamada', async () => {
    const upstream = vi.fn(async () => ok());
    const cache = memoryCache();
    const deps = { fetch: upstream as unknown as typeof fetch, cache };
    const first = await handleTeams(get(), ENV, deps);
    expect(first.headers.get('X-Cache')).toBe('MISS');
    expect(await first.json()).toEqual(TEAMS);
    for (let i = 0; i < 20; i++) {
      const hit = await handleTeams(get(), ENV, deps);
      expect(hit.headers.get('X-Cache')).toBe('HIT');
      expect(await hit.json()).toEqual(TEAMS);
    }
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(String(upstream.mock.calls[0]?.[0])).toBe(
      'https://script.google.com/macros/s/AKfy/exec?action=teams',
    );
  });

  it('200 pedidos ao mesmo tempo com o cache frio viram uma chamada só ao Apps Script', async () => {
    const upstream = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return ok();
    });
    const deps = { fetch: upstream as unknown as typeof fetch, cache: memoryCache() };
    const responses = await Promise.all(Array.from({ length: 200 }, () => handleTeams(get(), ENV, deps)));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('se o Apps Script cai depois de uma lista boa, entrega a última lista boa (reserva)', async () => {
    const cache = memoryCache();
    const good = { fetch: (async () => ok()) as unknown as typeof fetch, cache };
    await handleTeams(get(), ENV, good);
    cache.expire('https://equipes-cache.invalid/fresh');
    const down = {
      fetch: (async () => new Response('erro', { status: 500 })) as unknown as typeof fetch,
      cache,
    };
    const stale = await handleTeams(get(), ENV, down);
    expect(stale.status).toBe(200);
    expect(stale.headers.get('X-Cache')).toBe('STALE');
    expect(await stale.json()).toEqual(TEAMS);
  });

  it('sem lista de reserva e com o Apps Script fora do ar, responde 502 e não guarda o erro', async () => {
    const cache = memoryCache();
    const down = vi.fn(async () => {
      throw new Error('offline');
    });
    const response = await handleTeams(get(), ENV, { fetch: down as unknown as typeof fetch, cache });
    expect(response.status).toBe(502);
    expect(cache.store.size).toBe(0);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('resposta que não é uma lista (HTML, ok:false, texto) nunca vai para o cache', async () => {
    for (const body of [
      '<html>erro</html>',
      JSON.stringify({ ok: false }),
      JSON.stringify({ ok: true, teams: 'x' }),
    ]) {
      const cache = memoryCache();
      const deps = { fetch: (async () => new Response(body)) as unknown as typeof fetch, cache };
      expect((await handleTeams(get(), ENV, deps)).status).toBe(502);
      expect(cache.store.size).toBe(0);
    }
  });

  it('só aceita endereço do Apps Script em https, só GET, e funciona sem Cache API', async () => {
    const upstream = vi.fn(async () => ok());
    const deps = { fetch: upstream as unknown as typeof fetch, cache: null };
    expect((await handleTeams(get(), {}, deps)).status).toBe(503);
    expect(
      (await handleTeams(get(), { PUBLIC_TEAMS_ENDPOINT: 'https://evil.example/exec' }, deps)).status,
    ).toBe(503);
    expect((await handleTeams(new Request(get(), { method: 'POST' }), ENV, deps)).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
    expect((await handleTeams(get(), ENV, deps)).status).toBe(200);
    // sem PUBLIC_TEAMS_ENDPOINT vale o das inscrições
    const viaRegistration = await handleTeams(
      get(),
      { PUBLIC_REGISTRATION_ENDPOINT: ENV.PUBLIC_TEAMS_ENDPOINT },
      deps,
    );
    expect(viaRegistration.status).toBe(200);
  });
});
