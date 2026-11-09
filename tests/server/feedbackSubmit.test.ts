// avaliação entre colegas na função do site: o que é aceito e o que chega à planilha
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TICKET_MINUTES } from '../../src/server/feedback/ticket';
import { GOOD, TOKEN, harness, hex, read } from '../helpers/feedbackHarness';

describe('feedback · envio', () => {
  it('o envio leva autor e nomes da lista oficial, não do que o navegador mandou', async () => {
    const { open, send, submitted } = await harness();
    const { ticket } = await open();
    const sneaky = GOOD.map((r) => ({ ...r, name: 'Outro', protocol: 'HR26-XXXXXX' }));
    expect((await send(ticket, sneaky)).status).toBe(200);
    const [body] = submitted();
    expect(body).toMatchObject({
      token: TOKEN,
      day: '2026-11-13',
      author: { protocol: 'HR26-AAAAAA', name: 'Ana', team: 'Mew' },
    });
    expect(
      (body?.['ratings'] as { name: string; protocol: string }[]).map((r) => [r.name, r.protocol]),
    ).toEqual([
      ['Bruno', 'HR26-BBBBBB'],
      ['Caio', 'HR26-CCCCCC'],
    ]);
  });

  it.each([
    ['faltou um colega', () => [GOOD[0]]],
    ['colega repetido', () => [GOOD[0], GOOD[0]]],
    ['colega de outra equipe', () => [GOOD[0], { ...GOOD[1], id: hex('d') }]],
    ['avaliou a si mesmo', () => [GOOD[0], { ...GOOD[1], id: hex('a') }]],
    ['nota baixa sem motivo', () => [GOOD[0], { ...GOOD[1], reason: '   ' }]],
    ['faltou sem motivo', () => [GOOD[0], { id: hex('c'), stars: null, absent: true, reason: '' }]],
    ['sete estrelas', () => [{ ...GOOD[0], stars: 7 }, GOOD[1]]],
    ['estrelas em texto', () => [{ ...GOOD[0], stars: '5' }, GOOD[1]]],
    ['não é lista', () => 'tudo 5'],
  ])('recusa sem chamar a planilha: %s', async (_label, ratings) => {
    const { open, send, submitted } = await harness();
    const { ticket } = await open();
    expect((await send(ticket, ratings())).status).toBe(400);
    expect(submitted()).toHaveLength(0);
  });

  it('comprovante alterado, de outra pessoa ou vencido não passa', async () => {
    const { open, send, clock, submitted } = await harness();
    const { ticket } = await open();
    expect((await send(ticket.replace(hex('a'), hex('b')), GOOD)).status).toBe(401);
    expect((await send('qualquer-coisa', GOOD)).status).toBe(401);
    clock.now += (TICKET_MINUTES + 1) * 60_000;
    expect((await send(ticket, GOOD)).status).toBe(401);
    expect(submitted()).toHaveLength(0);
  });

  it('formulário aberto até depois do prazo não grava', async () => {
    const { open, send, clock, submitted } = await harness();
    clock.now = Date.parse('2026-11-13T23:50:00-03:00');
    const { ticket } = await open();
    clock.now = Date.parse('2026-11-14T00:05:00-03:00');
    expect((await read(await send(ticket, GOOD)))['error']).toBe('closed');
    expect(submitted()).toHaveLength(0);
  });

  it.each([
    [{ ok: true }, 200, undefined],
    [{ ok: false, error: 'already' }, 200, 'already'],
    [{ ok: false, error: 'closed' }, 200, 'closed'],
    [{ ok: false, error: 'busy' }, 503, 'busy'],
    [{ ok: false, error: 'server' }, 502, 'unavailable'],
    [{ ok: false, error: 'unauthorized' }, 502, 'unavailable'],
  ])('resposta da planilha %j', async (submitReply, status, error) => {
    const { open, send } = await harness({ submitReply });
    const { ticket } = await open();
    const response = await send(ticket, GOOD);
    expect(response.status).toBe(status);
    expect((await read(response))['error']).toBe(error);
  });

  it('a resposta do envio nunca devolve as notas', async () => {
    const { open, send } = await harness();
    const { ticket } = await open();
    const text = await (await send(ticket, GOOD)).text();
    expect(text).not.toContain('Sumiu');
    expect(text).not.toContain('stars');
  });
});
