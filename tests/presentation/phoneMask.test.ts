import { describe, expect, it } from 'vitest';
import { formatPhone, maskPhoneInput } from '../../src/presentation/formatters/phoneMask';

describe('formatPhone', () => {
  it.each([
    ['', ''],
    ['6', '(6'],
    ['63', '(63'],
    ['639', '(63) 9'],
    ['63999', '(63) 999'],
    ['639999', '(63) 9999'],
    ['6399999', '(63) 9999-9'],
    ['63999999999', '(63) 99999-9999'],
    ['6333334444', '(63) 3333-4444'],
  ])('%s vira %s enquanto digita', (typed, shown) => {
    expect(formatPhone(typed)).toBe(shown);
  });

  it('descarta letras, espaços e símbolos', () => {
    expect(formatPhone('a6 3b9-9.9x9/9 9+9ç9 9 9')).toBe('(63) 99999-9999');
  });

  it('corta o que passar de 11 dígitos', () => {
    expect(formatPhone('6399999999912345')).toBe('(63) 99999-9999');
  });

  it('tira o +55 e o 0 de quem cola o número completo', () => {
    expect(formatPhone('+55 63 99999-9999')).toBe('(63) 99999-9999');
    expect(formatPhone('063999999999')).toBe('(63) 99999-9999');
  });

  it('um número já formatado continua igual', () => {
    expect(formatPhone('(63) 99999-9999')).toBe('(63) 99999-9999');
  });

  it('DDD 55 digitado aos poucos não é confundido com o código do país', () => {
    expect(formatPhone('55')).toBe('(55');
    expect(formatPhone('55999999999')).toBe('(55) 99999-9999');
  });
});

describe('maskPhoneInput', () => {
  it('digitando no fim, o cursor fica no fim', () => {
    expect(maskPhoneInput('(63) 99', 7)).toEqual({ value: '(63) 99', caret: 7 });
    expect(maskPhoneInput('639999', 6)).toEqual({ value: '(63) 9999', caret: 9 });
  });

  it('editar no meio mantém o cursor junto do mesmo dígito', () => {
    // "(63) 99999-9999" com um dígito novo digitado depois do DDD
    const masked = maskPhoneInput('(63) 799999-9999', 6);
    expect(masked.value).toBe('(63) 79999-9999');
    expect(masked.caret).toBe(6);
  });

  it('letra digitada some e o cursor não anda', () => {
    expect(maskPhoneInput('(63) 9a', 7)).toEqual({ value: '(63) 9', caret: 6 });
  });

  it('campo apagado volta vazio com o cursor no começo', () => {
    expect(maskPhoneInput('', 0)).toEqual({ value: '', caret: 0 });
  });
});
