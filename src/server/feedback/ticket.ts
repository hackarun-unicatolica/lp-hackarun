// comprovante de quem passou pela identificação: vale só para aquela pessoa, naquele dia, por pouco tempo. Fica na
// memória da página (sem cookie), então fechar a aba encerra. Assinado com HMAC a partir da chave da planilha
import { sameText } from '../sorteio/session';

export const TICKET_MINUTES = 90;

const encoder = new TextEncoder();

async function sign(token: string, payload: string): Promise<string> {
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(`feedback-comprovante|${token}`));
  const key = await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createTicket(token: string, ref: string, day: string, now: number): Promise<string> {
  const expires = Math.floor(now / 1000) + TICKET_MINUTES * 60;
  const payload = `v1.${ref}.${day}.${expires}`;
  return `${payload}.${await sign(token, payload)}`;
}

export async function readTicket(
  token: string,
  value: unknown,
  now: number,
): Promise<{ ref: string; day: string } | null> {
  const match = /^v1\.([0-9a-f]{16})\.(\d{4}-\d{2}-\d{2})\.(\d{1,12})\.([0-9a-f]{64})$/.exec(
    typeof value === 'string' ? value : '',
  );
  if (!match) return null;
  const [, ref, day, expires, signature] = match as unknown as [string, string, string, string, string];
  if (Number(expires) * 1000 <= now) return null;
  const expected = await sign(token, `v1.${ref}.${day}.${expires}`);
  return (await sameText(signature, expected)) ? { ref, day } : null;
}
