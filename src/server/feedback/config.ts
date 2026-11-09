// configuração da avaliação entre colegas (variáveis da Cloudflare Pages). Usa a mesma chave e a mesma planilha do
// sorteio: virar o sorteio para a planilha oficial também vira o feedback. Só imports relativos (ver sorteio/config.ts)
import { TOKEN_MIN, validEndpoint, type AssetsBinding } from '../sorteio/config';

export interface FeedbackEnv {
  // "sim" liga /feedback; qualquer outra coisa (ou vazio) = a página não existe (404)
  FEEDBACK_ATIVO?: string;
  SORTEIO_TOKEN?: string;
  SORTEIO_PLANILHA_URL?: string;
  PUBLIC_REGISTRATION_ENDPOINT?: string;
  ASSETS?: AssetsBinding;
}

export interface FeedbackConfig {
  token: string;
  endpoint: string;
}

export type FeedbackConfigState =
  { kind: 'off' } | { kind: 'broken'; missing: string[] } | { kind: 'on'; config: FeedbackConfig };

const text = (value: string | undefined) => (value ?? '').trim();

export function readFeedbackConfig(env: FeedbackEnv): FeedbackConfigState {
  if (text(env.FEEDBACK_ATIVO).toLowerCase() !== 'sim') return { kind: 'off' };
  const token = text(env.SORTEIO_TOKEN);
  const endpoint = text(env.SORTEIO_PLANILHA_URL) || text(env.PUBLIC_REGISTRATION_ENDPOINT);
  const missing: string[] = [];
  if (token.length < TOKEN_MIN) missing.push('SORTEIO_TOKEN');
  if (!validEndpoint(endpoint)) missing.push('SORTEIO_PLANILHA_URL');
  if (missing.length > 0) return { kind: 'broken', missing };
  return { kind: 'on', config: { token, endpoint } };
}
