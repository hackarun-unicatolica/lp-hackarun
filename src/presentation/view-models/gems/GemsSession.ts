import {
  drawNext,
  EMPTY_QUEUE,
  mergeQueueStates,
  remainingIn,
  sameQueue,
  type GemColor,
  type GemQuestion,
} from '@domain/gems/GemQueue';
import type { ColorData, GemsDeviceStore, GemsGateway } from '@application/gems/GemsPorts';

// estado da tela de um NPC: o sorteio é local (na hora, sem esperar a internet) e a fila vai para a planilha em
// segundo plano. Falhou o envio? Tenta de novo sem prazo (com intervalo crescente até 1 minuto) e na hora em que a
// conexão volta

export type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';
export type SyncStatus = 'saved' | 'pending' | 'sending' | 'login';

export interface Clock {
  now(): number;
  random(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const RETRY_STEPS_MS = [2_000, 5_000, 10_000, 30_000, 60_000] as const;

export interface GemsView {
  color: GemColor;
  load: LoadStatus;
  loadMessage: string;
  sync: SyncStatus;
  question: GemQuestion | null;
  round: number;
  total: number;
  remaining: number;
}

export class GemsSession {
  private data: ColorData;
  private load: LoadStatus = 'loading';
  private loadMessage = '';
  private sending = false;
  private needsLogin = false;
  private failures = 0;
  private timer: unknown = null;

  constructor(
    readonly color: GemColor,
    private readonly gateway: GemsGateway,
    private readonly store: GemsDeviceStore,
    private readonly clock: Clock,
    private readonly onChange: (view: GemsView) => void,
  ) {
    this.data = store.data(color) ?? { questions: [], state: EMPTY_QUEUE, current: null, pending: false };
    if (this.data.questions.length > 0) this.load = 'ready';
  }

  view(): GemsView {
    const numbers = this.data.questions.map((q) => q.n);
    return {
      color: this.color,
      load: this.load,
      loadMessage: this.loadMessage,
      sync: this.syncStatus(),
      question: this.data.questions.find((q) => q.n === this.data.current) ?? null,
      round: this.data.state.round,
      total: numbers.length,
      remaining: remainingIn(numbers, this.data.state),
    };
  }

  // busca as questões e a fila da planilha; com cópia guardada, a tela já funciona enquanto isso
  async start(): Promise<void> {
    this.emit();
    const result = await this.gateway.load(this.color);
    if (result.kind === 'ok') {
      const merged = mergeQueueStates(this.data.state, result.value.state);
      const current = result.value.questions.some((q) => q.n === this.data.current)
        ? this.data.current
        : null;
      this.data = {
        questions: result.value.questions,
        state: merged,
        current,
        pending: this.data.pending || !sameQueue(merged, result.value.state),
      };
      this.load = result.value.questions.length > 0 ? 'ready' : 'empty';
      this.persist();
    } else if (this.data.questions.length === 0) {
      this.load = 'error';
      this.needsLogin = result.kind === 'login';
      this.loadMessage = result.kind === 'login' ? 'A sessão venceu. Entre de novo.' : result.message;
    }
    this.emit();
    if (this.data.pending) void this.flush();
  }

  // próxima questão: na hora, sem esperar a planilha
  draw(): GemQuestion | null {
    const numbers = this.data.questions.map((q) => q.n);
    const next = drawNext(numbers, this.data.state, () => this.clock.random(), this.clock.now());
    if (!next) return null;
    this.data = { ...this.data, state: next.state, current: next.n, pending: true };
    this.persist();
    this.emit();
    void this.flush();
    return this.data.questions.find((q) => q.n === next.n) ?? null;
  }

  // a conexão voltou (ou a pessoa entrou de novo): manda o que estiver pendente agora
  retryNow(): void {
    this.failures = 0;
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.sending || !this.data.pending) return;
    this.cancelTimer();
    this.sending = true;
    this.emit();
    const sent = this.data.state;
    const result = await this.gateway.sync(this.color, sent);
    this.sending = false;
    if (result.kind === 'ok') {
      this.failures = 0;
      this.needsLogin = false;
      const merged = mergeQueueStates(this.data.state, result.value);
      // mudou aqui enquanto enviava? continua pendente e manda de novo
      this.data = { ...this.data, state: merged, pending: !sameQueue(merged, result.value) };
      this.persist();
      this.emit();
      if (this.data.pending) void this.flush();
      return;
    }
    this.needsLogin = result.kind === 'login';
    const wait = RETRY_STEPS_MS[Math.min(this.failures, RETRY_STEPS_MS.length - 1)] as number;
    this.failures += 1;
    this.emit();
    this.timer = this.clock.setTimeout(() => void this.flush(), wait);
  }

  private syncStatus(): SyncStatus {
    if (this.needsLogin && this.data.pending) return 'login';
    if (this.sending) return 'sending';
    return this.data.pending ? 'pending' : 'saved';
  }

  private persist(): void {
    this.store.saveData(this.color, this.data);
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.onChange(this.view());
  }
}
