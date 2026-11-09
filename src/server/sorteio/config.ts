// configuração do sorteio no site (variáveis e segredos do projeto na Cloudflare Pages). Este código roda na função da
// Cloudflare, não no navegador: só imports relativos (o empacotador das Functions não conhece os aliases do Astro)

export interface AssetsBinding {
  fetch(request: Request | string | URL): Promise<Response>;
}

export interface SorteioEnv {
  // "sim" liga as telas; qualquer outra coisa (ou vazio) = /sorteio não existe (404)
  SORTEIO_ATIVO?: string;
  SORTEIO_USUARIO?: string;
  // segredo (Cloudflare: "Encrypt")
  SORTEIO_SENHA?: string;
  // segredo; o mesmo valor da propriedade SORTEIO_TOKEN do Apps Script
  SORTEIO_TOKEN?: string;
  // endereço /exec do Apps Script; sem ele, vale o mesmo da inscrição
  SORTEIO_PLANILHA_URL?: string;
  PUBLIC_REGISTRATION_ENDPOINT?: string;
  ASSETS?: AssetsBinding;
}

export interface SorteioConfig {
  user: string;
  password: string;
  token: string;
  endpoint: string;
}

export const TOKEN_MIN = 24;

export type ConfigState =
  { kind: 'off' } | { kind: 'broken'; missing: string[] } | { kind: 'on'; config: SorteioConfig };

const text = (value: string | undefined) => (value ?? '').trim();

// https sempre; http só para o próprio computador (teste local com o wrangler apontando para a cópia de teste)
export const validEndpoint = (url: string): boolean =>
  url.startsWith('https://') || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

export function readConfig(env: SorteioEnv): ConfigState {
  if (text(env.SORTEIO_ATIVO).toLowerCase() !== 'sim') return { kind: 'off' };
  const endpoint = text(env.SORTEIO_PLANILHA_URL) || text(env.PUBLIC_REGISTRATION_ENDPOINT);
  const missing: string[] = [];
  if (!text(env.SORTEIO_USUARIO)) missing.push('SORTEIO_USUARIO');
  // a senha vale como foi digitada (espaço no começo ou no fim conta)
  if (!env.SORTEIO_SENHA) missing.push('SORTEIO_SENHA');
  if (text(env.SORTEIO_TOKEN).length < TOKEN_MIN) missing.push('SORTEIO_TOKEN');
  if (!validEndpoint(endpoint)) missing.push('SORTEIO_PLANILHA_URL');
  if (missing.length > 0) return { kind: 'broken', missing };
  return {
    kind: 'on',
    config: {
      user: text(env.SORTEIO_USUARIO),
      password: env.SORTEIO_SENHA as string,
      token: text(env.SORTEIO_TOKEN),
      endpoint,
    },
  };
}
