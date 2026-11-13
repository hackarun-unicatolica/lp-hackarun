import type { GemColor, GemQuestion, QueueState } from '@domain/gems/GemQueue';

// portas da tela das insígnias: a planilha (pela função da Cloudflare) e o que o aparelho guarda no navegador

export type GemsResult<T> =
  | { kind: 'ok'; value: T }
  // sessão vencida: a tela pede o login de novo (o que está pendente continua guardado)
  | { kind: 'login' }
  // code = o erro devolvido pela planilha (ex.: unknown-team); sem code = rede ou servidor fora
  | { kind: 'unavailable'; message: string; code?: string };

// o que cada aparelho faz: um NPC de uma cor ou a entrega final (confere as 3 fichas e marca a equipe)
export type GemsMode = GemColor | 'entrega';

// entrega final: todas as equipes confirmadas e quem já completou, em ordem de chegada (at = ISO)
export interface DeliveryState {
  teams: string[];
  done: { team: string; at: string }[];
}

export interface GemsGateway {
  load(color: GemColor): Promise<GemsResult<{ questions: GemQuestion[]; state: QueueState }>>;
  sync(color: GemColor, state: QueueState): Promise<GemsResult<QueueState>>;
  delivery(): Promise<GemsResult<DeliveryState>>;
  // at = hora da marcação no aparelho (ISO): vale ela, não a do envio
  finish(team: string, at: string): Promise<GemsResult<DeliveryState>>;
  undo(team: string): Promise<GemsResult<DeliveryState>>;
}

// por cor: as questões, a fila, a questão na tela e se a fila ainda não chegou na planilha
export interface ColorData {
  questions: GemQuestion[];
  state: QueueState;
  current: number | null;
  // true = a fila mudou aqui e a planilha ainda não confirmou
  pending: boolean;
}

// marcação feita na entrega final que ainda não chegou na planilha (a fila vai em ordem, uma de cada vez)
export interface DeliveryOp {
  id: string;
  action: 'finish' | 'undo';
  team: string;
  at: string;
}

// o que o aparelho da entrega guarda: a última lista da planilha e as marcações pendentes
export interface DeliveryData {
  server: DeliveryState | null;
  queue: DeliveryOp[];
}

export interface GemsDeviceStore {
  readonly available: boolean;
  mode(): GemsMode | null;
  setMode(mode: GemsMode | null): void;
  data(color: GemColor): ColorData | null;
  saveData(color: GemColor, data: ColorData): boolean;
  deliveryData(): DeliveryData;
  saveDeliveryData(data: DeliveryData): boolean;
}
