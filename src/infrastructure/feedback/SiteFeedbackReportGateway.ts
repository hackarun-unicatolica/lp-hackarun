import type {
  FeedbackReport,
  FeedbackReportGateway,
  ReportResult,
} from '@application/feedback/FeedbackReport';

// mesma rota das ações do sorteio: a função da Cloudflare confere a sessão da organização e repassa com a chave
const API = '/api/sorteio';
const TIMEOUT_MS = 40_000;

interface ApiBody extends Partial<FeedbackReport> {
  ok?: boolean;
  error?: string;
  message?: string;
}

function validReport(body: ApiBody): body is ApiBody & FeedbackReport {
  return Array.isArray(body.windows) && Array.isArray(body.people) && Array.isArray(body.ratings);
}

export class SiteFeedbackReportGateway implements FeedbackReportGateway {
  async load(): Promise<ReportResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback-report' }),
        signal: controller.signal,
      });
      if (response.status === 401) return { kind: 'login' };
      const body = (await response.json()) as ApiBody;
      if (body.ok === true && validReport(body)) {
        return { kind: 'ok', report: { windows: body.windows, people: body.people, ratings: body.ratings } };
      }
      return { kind: 'unavailable', message: body.message ?? 'A planilha não devolveu as avaliações.' };
    } catch {
      return { kind: 'unavailable', message: 'A planilha não respondeu a tempo.' };
    } finally {
      clearTimeout(timer);
    }
  }
}
