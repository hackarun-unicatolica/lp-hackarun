import { Phone } from '@domain/value-objects/Phone';

const MAX_DIGITS = 11;
const LANDLINE_LENGTH = 8;

export interface MaskedInput {
  value: string;
  // posição do cursor no texto já com a máscara
  caret: number;
}

// "(63) 99999-9999": aceita só dígitos, corta o que passa de 11 e tira o 0 ou o +55 de quem cola o número completo
export function formatPhone(raw: string): string {
  const digits = Phone.digitsOf(raw).slice(0, MAX_DIGITS);
  if (!digits) return '';
  const ddd = digits.slice(0, 2);
  if (digits.length <= 2) return `(${ddd}`;
  const rest = digits.slice(2);
  const split = rest.length > LANDLINE_LENGTH ? rest.length - 4 : 4;
  const head = rest.slice(0, split);
  const tail = rest.slice(split);
  return tail ? `(${ddd}) ${head}-${tail}` : `(${ddd}) ${head}`;
}

// aplica a máscara mantendo o cursor junto do mesmo dígito (editar no meio do número não pula para o fim)
export function maskPhoneInput(raw: string, caret: number): MaskedInput {
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
  const value = formatPhone(raw);
  if (digitsBefore === 0) return { value, caret: 0 };
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value.charAt(i))) seen++;
    if (seen === digitsBefore) return { value, caret: i + 1 };
  }
  return { value, caret: value.length };
}
