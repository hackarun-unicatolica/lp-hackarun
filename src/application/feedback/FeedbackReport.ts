// porta do painel de avaliações da organização (/sorteio/avaliacoes): o que a planilha devolve para montar as tabelas
import type { FeedbackDay } from './FeedbackGateway';

export interface ReportPerson {
  protocol: string;
  name: string;
  team: string;
}

export interface ReportRating {
  day: string;
  team: string;
  target: string;
  targetProtocol: string;
  author: string;
  authorProtocol: string;
  // null = marcou "não compareceu"
  stars: number | null;
  absent: boolean;
  reason: string;
  // ISO; vazio se a planilha não tiver a hora
  sentAt: string;
}

export interface FeedbackReport {
  windows: FeedbackDay[];
  people: ReportPerson[];
  ratings: ReportRating[];
}

export type ReportResult =
  | { kind: 'ok'; report: FeedbackReport }
  // sessão da organização venceu: volta para o login
  | { kind: 'login' }
  | { kind: 'unavailable'; message: string };

export interface FeedbackReportGateway {
  load(): Promise<ReportResult>;
}
