// tela de um NPC: sorteia na hora mesmo sem internet, guarda a fila no aparelho e reenvia sem prazo até a planilha
// confirmar
import { describe, expect, it } from 'vitest';
import type { GemQuestion, QueueState } from '@domain/gems/GemQueue';
import { GemsStore, type KeyValueStorage } from '@infrastructure/gems/GemsStore';
import type { GemsGateway, GemsResult } from '@application/gems/GemsPorts';
import { GemsSession, RETRY_STEPS_MS, type GemsView } from '@presentation/view-models/gems/GemsSession';

const QUESTIONS: GemQuestion[] = [1, 2, 3].map((n) => ({
  n,
  question: `Questão ${n}?`,
  options: ['a', 'b', 'c', 'd'],
  answer: 'A',
}));

class MemoryStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

class FakeGateway implements GemsGateway {
  online = true;
  loginNeeded = false;
  server: QueueState = { round: 1, used: [], updatedAt: 0 };
  syncs = 0;
  async load(): Promise<GemsResult<{ questions: GemQuestion[]; state: QueueState }>> {
    if (!this.online) return { kind: 'unavailable', message: 'offline' };
    return { kind: 'ok', value: { questions: QUESTIONS, state: this.server } };
  }
  async sync(_color: unknown, state: QueueState): Promise<GemsResult<QueueState>> {
    this.syncs += 1;
    if (this.loginNeeded) return { kind: 'login' };
    if (!this.online) return { kind: 'unavailable', message: 'offline' };
    this.server = state;
    return { kind: 'ok', value: state };
  }
}

function harness(storage = new MemoryStorage(), gateway = new FakeGateway()) {
  const timers: { fn: () => void; ms: number }[] = [];
  let views: GemsView[] = [];
  const session = new GemsSession(
    'azul',
    gateway,
    new GemsStore(storage),
    {
      now: () => 1_000,
      random: () => 0,
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
      clearTimeout: () => {},
    },
    (view) => views.push(view),
  );
  const last = () => views[views.length - 1] as GemsView;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { session, gateway, storage, timers, last, settle, reset: () => (views = []) };
}

describe('tela do NPC', () => {
  it('carrega, sorteia e a fila chega na planilha', async () => {
    const { session, gateway, last, settle } = harness();
    await session.start();
    expect(last().load).toBe('ready');
    expect(session.draw()?.n).toBe(1);
    await settle();
    expect(gateway.server.used).toEqual([1]);
    expect(last().sync).toBe('saved');
    expect(last().remaining).toBe(2);
  });

  it('sem internet o sorteio continua, a fila fica guardada e não repete', async () => {
    const { session, gateway, storage, last, settle } = harness();
    await session.start();
    gateway.online = false;
    const drawn = [session.draw()?.n, session.draw()?.n, session.draw()?.n];
    await settle();
    expect(new Set(drawn).size).toBe(3);
    expect(last().sync).toBe('pending');
    const saved = JSON.parse(storage.getItem('hackarun:gemas:azul') ?? '{}') as { pending: boolean };
    expect(saved.pending).toBe(true);
  });

  it('reenvia sem prazo: depois de muitas falhas continua tentando a cada minuto e manda quando volta', async () => {
    const { session, gateway, timers, last, settle } = harness();
    await session.start();
    gateway.online = false;
    session.draw();
    await settle();
    for (let i = 0; i < 200; i += 1) {
      const timer = timers.shift();
      if (!timer) throw new Error('parou de tentar');
      timer.fn();
      await settle();
    }
    expect(timers[0]?.ms).toBe(RETRY_STEPS_MS[RETRY_STEPS_MS.length - 1]);
    gateway.online = true;
    timers.shift()?.fn();
    await settle();
    expect(last().sync).toBe('saved');
    expect(gateway.server.used).toEqual([1]);
  });

  it('fechou o navegador com fila pendente: ao abrir de novo, manda e continua de onde parou', async () => {
    const first = harness();
    await first.session.start();
    first.gateway.online = false;
    first.session.draw();
    first.session.draw();
    await first.settle();
    const gateway = new FakeGateway();
    const second = harness(first.storage, gateway);
    expect(second.last).toBeDefined();
    await second.session.start();
    await second.settle();
    expect(gateway.server.used).toEqual([1, 2]);
    expect(second.session.draw()?.n).toBe(3);
  });

  it('sessão vencida: avisa para entrar de novo e não perde a fila', async () => {
    const { session, gateway, last, settle } = harness();
    await session.start();
    gateway.loginNeeded = true;
    session.draw();
    await settle();
    expect(last().sync).toBe('login');
    gateway.loginNeeded = false;
    session.retryNow();
    await settle();
    expect(last().sync).toBe('saved');
  });

  it('sem internet e sem nada guardado: mostra o erro em vez de travar', async () => {
    const gateway = new FakeGateway();
    gateway.online = false;
    const { session, last } = harness(new MemoryStorage(), gateway);
    await session.start();
    expect(last().load).toBe('error');
  });
});
