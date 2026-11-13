import type {
  DeliveryData,
  DeliveryOp,
  DeliveryState,
  GemsDeviceStore,
  GemsGateway,
} from '@application/gems/GemsPorts';

// entrega final sem esperar a planilha: marcar ou desmarcar muda a tela na hora e entra numa fila guardada no aparelho.
// A fila vai para a planilha em ordem, uma marcação de cada vez, e tenta de novo sem prazo quando a conexão cai
// (intervalo crescente até 1 minuto, e na hora em que a internet volta). A planilha é idempotente: reenviar a mesma
// marcação nunca duplica a equipe

export const RETRY_STEPS_MS = [2_000, 5_000, 10_000, 30_000, 60_000] as const;
// erros da planilha que não se resolvem tentando de novo: a marcação sai da fila e a tela avisa
const FINAL_ERRORS = ['unknown-team', 'invalid', 'unknown-action'];

export interface DeliveryClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  newId(): string;
}

export type TeamSync = 'saved' | 'saving' | 'waiting';
export type DeliverySync = 'saved' | 'saving' | 'waiting' | 'login';

export interface DeliveryScreen {
  loaded: boolean;
  loadMessage: string;
  teams: string[];
  done: { team: string; at: string; sync: TeamSync }[];
  sync: DeliverySync;
  pendingCount: number;
  // última marcação recusada pela planilha (equipe que não existe mais, por exemplo)
  rejected: string;
}

const key = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export class DeliverySession {
  private data: DeliveryData;
  private inFlight: string | null = null;
  private failures = 0;
  private needsLogin = false;
  private loadMessage = '';
  private rejected = '';
  private timer: unknown = null;

  constructor(
    private readonly gateway: GemsGateway,
    private readonly store: GemsDeviceStore,
    private readonly clock: DeliveryClock,
    private readonly onChange: (screen: DeliveryScreen) => void,
  ) {
    this.data = store.deliveryData();
  }

  // a lista da tela: o que a planilha confirmou + as marcações ainda na fila, em ordem
  screen(): DeliveryScreen {
    const server: DeliveryState = this.data.server ?? { teams: [], done: [] };
    const done = new Map(server.done.map((d) => [key(d.team), { team: d.team, at: d.at }]));
    for (const op of this.data.queue) {
      if (op.action === 'finish' && !done.has(key(op.team)))
        done.set(key(op.team), { team: op.team, at: op.at });
      if (op.action === 'undo') done.delete(key(op.team));
    }
    const queued = new Set(this.data.queue.map((op) => key(op.team)));
    const teamSync: TeamSync = this.failures > 0 || this.needsLogin ? 'waiting' : 'saving';
    return {
      loaded: this.data.server !== null,
      loadMessage: this.loadMessage,
      teams: server.teams,
      done: [...done.values()].map((d) => ({ ...d, sync: queued.has(key(d.team)) ? teamSync : 'saved' })),
      sync: this.syncStatus(),
      pendingCount: this.data.queue.length,
      rejected: this.rejected,
    };
  }

  isDone(team: string): boolean {
    return this.screen().done.some((d) => key(d.team) === key(team));
  }

  async open(): Promise<void> {
    this.emit();
    await this.refresh();
    void this.flush();
  }

  // busca a lista da planilha (as marcações na fila continuam valendo por cima dela)
  async refresh(): Promise<void> {
    const result = await this.gateway.delivery();
    if (result.kind === 'ok') {
      this.data = { ...this.data, server: result.value };
      this.loadMessage = '';
      this.persist();
    } else if (!this.data.server) {
      this.loadMessage =
        result.kind === 'login' ? 'A sessão venceu. Recarregue a página e entre de novo.' : result.message;
    }
    this.emit();
  }

  mark(team: string): boolean {
    if (this.isDone(team)) return false;
    this.enqueue('finish', team);
    return true;
  }

  unmark(team: string): boolean {
    if (!this.isDone(team)) return false;
    this.enqueue('undo', team);
    return true;
  }

  retryNow(): void {
    this.failures = 0;
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.inFlight !== null) return;
    const op = this.data.queue[0];
    if (!op) return;
    this.cancelTimer();
    this.inFlight = op.id;
    this.emit();
    const result =
      op.action === 'finish' ? await this.gateway.finish(op.team, op.at) : await this.gateway.undo(op.team);
    this.inFlight = null;
    if (result.kind === 'ok' || (result.kind === 'unavailable' && FINAL_ERRORS.includes(result.code ?? ''))) {
      if (result.kind === 'ok') this.data = { ...this.data, server: result.value };
      else this.rejected = `${op.team}: ${result.message}`;
      this.data = { ...this.data, queue: this.data.queue.filter((q) => q.id !== op.id) };
      this.failures = 0;
      this.needsLogin = false;
      this.persist();
      this.emit();
      void this.flush();
      return;
    }
    this.needsLogin = result.kind === 'login';
    const wait = RETRY_STEPS_MS[Math.min(this.failures, RETRY_STEPS_MS.length - 1)] as number;
    this.failures += 1;
    this.emit();
    this.timer = this.clock.setTimeout(() => void this.flush(), wait);
  }

  // marcação oposta ainda na fila (e não em envio) se anula com a nova: nada vai para a planilha à toa
  private enqueue(action: DeliveryOp['action'], team: string): void {
    const opposite = action === 'finish' ? 'undo' : 'finish';
    const last = this.data.queue[this.data.queue.length - 1];
    const cancels =
      last && last.id !== this.inFlight && last.action === opposite && key(last.team) === key(team);
    const queue = cancels
      ? this.data.queue.slice(0, -1)
      : [
          ...this.data.queue,
          { id: this.clock.newId(), action, team, at: new Date(this.clock.now()).toISOString() },
        ];
    this.data = { ...this.data, queue };
    this.rejected = '';
    this.persist();
    this.emit();
    void this.flush();
  }

  private syncStatus(): DeliverySync {
    if (this.data.queue.length === 0) return 'saved';
    if (this.needsLogin) return 'login';
    return this.failures > 0 ? 'waiting' : 'saving';
  }

  private persist(): void {
    this.store.saveDeliveryData(this.data);
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.onChange(this.screen());
  }
}
