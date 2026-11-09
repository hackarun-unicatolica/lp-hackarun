// avaliação entre colegas na função do site: quem entra e o que volta para o navegador
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_MAX_FAILURES,
  handleFeedback,
  IP_MAX_FAILURES,
  isFeedbackPath,
} from '../../src/server/feedback/handler';
import { ENV, ORIGIN, PHONE, emailOf, harness, hex, member, read } from '../helpers/feedbackHarness';

describe('feedback na função do site', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reconhece só os caminhos dele', () => {
    expect(isFeedbackPath('/feedback')).toBe(true);
    expect(isFeedbackPath('/api/feedback/entrar')).toBe(true);
    expect(isFeedbackPath('/feedbacks-de-alguem')).toBe(false);
    expect(isFeedbackPath('/sorteio')).toBe(false);
  });

  it('desligado, a página é 404 e a planilha nem é chamada', async () => {
    const { enter, upstream, deps } = await harness({ env: { ...ENV, FEEDBACK_ATIVO: 'nao' } });
    expect((await enter()).status).toBe(404);
    const page = await handleFeedback(
      new Request(`${ORIGIN}/feedback`),
      { ...ENV, FEEDBACK_ATIVO: '' },
      deps,
    );
    expect(page.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('ligado sem a chave certa não abre', async () => {
    const { enter } = await harness({ env: { ...ENV, SORTEIO_TOKEN: 'curta' } });
    expect((await enter()).status).toBe(503);
  });

  it('abre a página sem cache e sem indexar', async () => {
    const { deps } = await harness();
    const page = await handleFeedback(new Request(`${ORIGIN}/feedback`), ENV, deps);
    expect(page.status).toBe(200);
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    expect(page.headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('caminho desconhecido em /feedback/ é 404', async () => {
    const { deps } = await harness();
    expect((await handleFeedback(new Request(`${ORIGIN}/feedback/admin`), ENV, deps)).status).toBe(404);
  });

  it('POST de outro site é recusado', async () => {
    const { enter } = await harness();
    expect((await enter(undefined, undefined, { Origin: 'https://golpe.example' })).status).toBe(403);
  });

  it('entra e recebe só os colegas da própria equipe, sem protocolo nem resumo de identidade', async () => {
    const { open } = await harness();
    const body = await open();
    expect(body['status']).toBe('open');
    expect(body['person']).toEqual({ name: 'Ana', team: 'Mew' });
    expect(body['colleagues']).toEqual([
      { id: hex('b'), name: 'Bruno' },
      { id: hex('c'), name: 'Caio' },
    ]);
    const text = JSON.stringify(body);
    expect(text).not.toContain('HR26-');
    expect(text).not.toContain('Duda');
  });

  it('e-mail certo com WhatsApp de outra pessoa não entra, e a resposta é a mesma de quem não existe', async () => {
    const { enter } = await harness();
    const wrongPhone = await enter(emailOf('ana'), '(63) 98888-7777');
    const unknown = await enter('ninguem@exemplo.com', PHONE);
    expect(wrongPhone.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrongPhone.json()).toEqual(await unknown.json());
  });

  it('trava o e-mail depois de muitas tentativas erradas', async () => {
    const { enter, clock } = await harness();
    for (let i = 0; i < EMAIL_MAX_FAILURES; i++) await enter(emailOf('ana'), '(63) 98888-7777');
    expect((await enter()).status).toBe(429);
    clock.now += 16 * 60_000;
    expect((await enter()).status).toBe(200);
  });

  it('um erro de digitação não trava a turma inteira que sai pelo mesmo Wi-Fi', async () => {
    const { enter } = await harness();
    for (let i = 0; i < EMAIL_MAX_FAILURES * 3; i++) await enter(`pessoa${i}@exemplo.com`, '6300000000');
    expect(IP_MAX_FAILURES).toBeGreaterThan(EMAIL_MAX_FAILURES * 3);
    expect((await enter()).status).toBe(200);
  });

  it('fora do horário não entrega formulário e diz quando abre', async () => {
    const { enter, clock } = await harness();
    clock.now = Date.parse('2026-11-12T21:00:00-03:00');
    const body = await read(await enter());
    expect(body['status']).toBe('closed');
    expect(body['ticket']).toBeUndefined();
    expect((body['next'] as { label: string }).label).toBe('13/11');
  });

  it('depois do último dia não há próxima', async () => {
    const { enter, clock } = await harness();
    clock.now = Date.parse('2026-11-14T17:00:00-03:00');
    expect((await read(await enter()))['next']).toBeNull();
  });

  it('quem já avaliou hoje não recebe o formulário de novo', async () => {
    const people = [await member('a', 'Ana', 'Mew', ['2026-11-13']), await member('b', 'Bruno', 'Mew')];
    const { enter } = await harness({ people });
    const body = await read(await enter());
    expect(body['status']).toBe('done');
    expect(body['ticket']).toBeUndefined();
  });

  it('equipe de uma pessoa só não tem o que avaliar', async () => {
    const { enter } = await harness({ people: [await member('a', 'Ana', 'Mew')] });
    expect((await read(await enter()))['status']).toBe('alone');
  });

  it('180 pessoas entrando viram uma chamada só à planilha', async () => {
    const { enter, upstream } = await harness();
    await Promise.all(Array.from({ length: 180 }, () => enter()));
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('planilha fora do ar com lista guardada continua deixando entrar', async () => {
    const people = [await member('a', 'Ana', 'Mew'), await member('b', 'Bruno', 'Mew')];
    const ok = await harness({ people });
    await ok.enter();
    const stale = await ok.cache.match(new Request('https://feedback-cache.invalid/stale'));
    const down = await harness({ people, rosterFails: true });
    await down.cache.put(new Request('https://feedback-cache.invalid/stale'), stale as Response);
    expect((await down.enter()).status).toBe(200);
  });

  it('planilha fora do ar sem lista: avisa', async () => {
    const { enter } = await harness({ rosterFails: true });
    expect((await enter()).status).toBe(503);
  });
});
