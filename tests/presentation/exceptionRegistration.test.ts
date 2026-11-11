import { describe, expect, it } from 'vitest';
import type { RegistrationDTO } from '@application/index';
import { exceptionRegistration } from '../../src/presentation/components/registration/exceptionWindow';

const closed: RegistrationDTO = {
  status: 'closed',
  endpoint: 'https://script.google.com/macros/s/x/exec',
  closesAt: '2026-11-08T22:20:00-03:00',
  slots: { capacity: 200, taken: 200, remaining: 0, level: 'full' },
  teamSize: { min: 4, max: 5 },
};

describe('exceptionRegistration', () => {
  it('abre o formulário e tira o prazo e o teto que o navegador usaria para fechar', () => {
    const open = exceptionRegistration(closed);
    expect(open.status).toBe('open');
    expect(open.closesAt).toBeNull();
    expect(open.slots).toEqual({ capacity: null, taken: 0, remaining: null, level: 'unknown' });
  });

  it('mantém o endereço da planilha e o tamanho das equipes', () => {
    const open = exceptionRegistration(closed);
    expect(open.endpoint).toBe(closed.endpoint);
    expect(open.teamSize).toEqual(closed.teamSize);
  });

  it('sem planilha configurada não abre nada: segue o status do build', () => {
    const offline = { ...closed, endpoint: null };
    expect(exceptionRegistration(offline)).toBe(offline);
  });
});
