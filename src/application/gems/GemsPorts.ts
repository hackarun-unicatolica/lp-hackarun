import type { GemColor, GemQuestion, QueueState } from '@domain/gems/GemQueue';

// portas da tela das gemas: a planilha (pela função da Cloudflare) e o que o aparelho guarda no navegador

export type GemsResult<T> =
  | { kind: 'ok'; value: T }
  // sessão vencida: a tela pede o login de novo (o que está pendente continua guardado)
  | { kind: 'login' }
  | { kind: 'unavailable'; message: string };

export interface GemsGateway {
  load(color: GemColor): Promise<GemsResult<{ questions: GemQuestion[]; state: QueueState }>>;
  sync(color: GemColor, state: QueueState): Promise<GemsResult<QueueState>>;
}

// por cor: as questões, a fila, a questão na tela e se a fila ainda não chegou na planilha
export interface ColorData {
  questions: GemQuestion[];
  state: QueueState;
  current: number | null;
  // true = a fila mudou aqui e a planilha ainda não confirmou
  pending: boolean;
}

export interface GemsDeviceStore {
  readonly available: boolean;
  color(): GemColor | null;
  setColor(color: GemColor | null): void;
  data(color: GemColor): ColorData | null;
  saveData(color: GemColor, data: ColorData): boolean;
}
