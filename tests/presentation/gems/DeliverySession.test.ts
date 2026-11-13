// entrega final: a marcação aparece na hora, vai para a planilha em segundo plano e, se a conexão cair, é reenviada
// sem prazo e sem nunca duplicar a equipe
import { describe, expect, it } from 'vitest';
import type {
  DeliveryData,
  DeliveryState,
  GemsDeviceStore,
  GemsGateway,
  GemsResult,
} from '@application/gems/GemsPorts';
import {
  DeliverySession,
  RETRY_STEPS_MS,
  type DeliveryScreen,
} from '@presentation/view-models/gems/DeliverySession';

const TEAMS = ['Equipe Muk', 'Equipe Poliwhirl', 'Equipe Golem'];

// planilha falsa com a mesma regra do Apps Script: marcar e desmarcar são idempotentes
class FakeSheetGateway implements GemsGateway {
  online = true;
  loginNeeded = false;
  rows: { team: string; at: string }[] = [];
  calls: string[] = [];
  private state = (): DeliveryState => ({ teams: TEAMS, done: [...this.rows] });
  private gate<T>(work: () => T): Promise<GemsResult<T>> {
    if (this.loginNeeded) return Promise.resolve({ kind: 'login' });
    if (!this.online) return Promise.resolve({ kind: 'unavailable', message: 'sem conexão' });
    return Promise.resolve({ kind: 'ok', value: work() });
  }
  load() {
    return Promise.resolve({ kind: 'unavailable', message: 'fora do teste' } as const);
  }
  sync() {
    return this.load();
  }
  delivery() {
    return this.gate(() => this.state());
  }
  finish(team: string, at: string) {
    this.calls.push(`finish ${team}`);
    if (team === 'Equipe Fantasma' && this.online) {
      return Promise.resolve({
        kind: 'unavailable',
        message: 'Equipe não encontrada.',
        code: 'unknown-team',
      } as const);
    }
    return this.gate(() => {
      if (!this.rows.some((r) => r.team === team)) this.rows.push({ team, at });
      return this.state();
    });
  }
  undo(team: string) {
    this.calls.push(`undo ${team}`);
    return this.gate(() => {
      this.rows = this.rows.filter((r) => r.team !== team);
      return this.state();
    });
  }
}

class MemoryStore implements Pick<GemsDeviceStore, 'deliveryData' | 'saveDeliveryData'> {
  saved: DeliveryData = { server: null, queue: [] };
  deliveryData() {
    return JSON.parse(JSON.stringify(this.saved)) as DeliveryData;
  }
  saveDeliveryData(data: DeliveryData) {
    this.saved = JSON.parse(JSON.stringify(data)) as DeliveryData;
    return true;
  }
}

function harness(gateway = new FakeSheetGateway(), store = new MemoryStore()) {
  const timers: { fn: () => void; ms: number }[] = [];
  let last: DeliveryScreen | null = null;
  let id = 0;
  let clock = Date.parse('2026-11-13T20:00:00-03:00');
  const session = new DeliverySession(
    gateway,
    store as unknown as GemsDeviceStore,
    {
      now: () => clock,
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
      clearTimeout: () => {},
      newId: () => `op-${(id += 1)}`,
    },
    (screen) => (last = screen),
  );
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  };
  const tick = (ms: number) => (clock += ms);
  return { session, gateway, store, timers, settle, tick, screen: () => last as unknown as DeliveryScreen };
}

describe('entrega final em segundo plano', () => {
  it('marca na hora e a planilha recebe em seguida, com a hora da marcação', async () => {
    const { session, gateway, settle, screen } = harness();
    await session.open();
    session.mark('Equipe Muk');
    expect(screen().done.map((d) => d.team)).toEqual(['Equipe Muk']);
    await settle();
    expect(gateway.rows).toEqual([
      { team: 'Equipe Muk', at: new Date('2026-11-13T20:00:00-03:00').toISOString() },
    ]);
    expect(screen().done[0]?.sync).toBe('saved');
    expect(screen().sync).toBe('saved');
  });

  it('várias marcações seguidas vão em ordem, uma de cada vez', async () => {
    const { session, gateway, settle, tick } = harness();
    await session.open();
    session.mark('Equipe Muk');
    tick(1_000);
    session.mark('Equipe Golem');
    tick(1_000);
    session.mark('Equipe Poliwhirl');
    await settle();
    expect(gateway.rows.map((r) => r.team)).toEqual(['Equipe Muk', 'Equipe Golem', 'Equipe Poliwhirl']);
  });

  it('sem internet: a tela continua marcando, guarda no aparelho e envia tudo quando volta, horas depois', async () => {
    const { session, gateway, store, timers, settle, screen } = harness();
    await session.open();
    gateway.online = false;
    session.mark('Equipe Muk');
    session.mark('Equipe Golem');
    await settle();
    expect(screen().sync).toBe('waiting');
    expect(screen().done.map((d) => d.sync)).toEqual(['waiting', 'waiting']);
    expect(store.saved.queue).toHaveLength(2);
    for (let i = 0; i < 300; i += 1) {
      const timer = timers.shift();
      if (!timer) throw new Error('parou de tentar');
      timer.fn();
      await settle();
    }
    expect(timers[0]?.ms).toBe(RETRY_STEPS_MS[RETRY_STEPS_MS.length - 1]);
    gateway.online = true;
    session.retryNow();
    await settle();
    expect(gateway.rows.map((r) => r.team)).toEqual(['Equipe Muk', 'Equipe Golem']);
    expect(store.saved.queue).toEqual([]);
    expect(screen().sync).toBe('saved');
  });

  it('fechou o navegador com marcações na fila: ao abrir de novo envia, e a planilha nunca duplica', async () => {
    const first = harness();
    await first.session.open();
    first.gateway.online = false;
    first.session.mark('Equipe Muk');
    await first.settle();
    // a planilha recebeu de outro jeito (resposta perdida no caminho): o reenvio não pode duplicar
    first.gateway.rows.push({ team: 'Equipe Muk', at: 'x' });
    first.gateway.online = true;
    const second = harness(first.gateway, first.store);
    await second.session.open();
    await second.settle();
    expect(first.gateway.rows.filter((r) => r.team === 'Equipe Muk')).toHaveLength(1);
    expect(first.store.saved.queue).toEqual([]);
  });

  it('marcar e desfazer antes de enviar se anulam: nada vai para a planilha', async () => {
    const { session, gateway, settle } = harness();
    await session.open();
    gateway.online = false;
    session.mark('Equipe Muk');
    await settle();
    gateway.calls = [];
    gateway.online = true;
    session.mark('Equipe Golem');
    session.unmark('Equipe Golem');
    expect(session.screen().done.map((d) => d.team)).toEqual(['Equipe Muk']);
    await settle();
    expect(gateway.calls).toEqual(['finish Equipe Muk']);
  });

  it('desmarcar tira da tela na hora e apaga na planilha', async () => {
    const { session, gateway, settle, screen } = harness();
    await session.open();
    session.mark('Equipe Muk');
    await settle();
    session.unmark('Equipe Muk');
    expect(screen().done).toEqual([]);
    await settle();
    expect(gateway.rows).toEqual([]);
  });

  it('não marca duas vezes a mesma equipe', async () => {
    const { session, settle, store } = harness();
    await session.open();
    expect(session.mark('Equipe Muk')).toBe(true);
    expect(session.mark('equipe muk')).toBe(false);
    await settle();
    expect(store.saved.queue).toEqual([]);
  });

  it('equipe recusada pela planilha sai da fila e a tela avisa, sem travar as próximas', async () => {
    const { session, gateway, settle, screen } = harness();
    await session.open();
    session.mark('Equipe Fantasma');
    session.mark('Equipe Muk');
    await settle();
    expect(screen().rejected).toContain('Equipe Fantasma');
    expect(gateway.rows.map((r) => r.team)).toEqual(['Equipe Muk']);
  });

  it('sessão vencida: avisa para entrar de novo e não perde a fila', async () => {
    const { session, gateway, settle, screen, store } = harness();
    await session.open();
    gateway.loginNeeded = true;
    session.mark('Equipe Muk');
    await settle();
    expect(screen().sync).toBe('login');
    expect(store.saved.queue).toHaveLength(1);
  });
});
