import type { RegistrationDTO } from '@application/index';

// página /inscricao-excecao: abre o formulário para quem recebeu o link direto, mesmo com o prazo vencido.
// Só vale com planilha de verdade (endpoint); sem ela o status do build segue. Sem prazo e sem teto no navegador:
// quem decide se ainda cabe gente é o script da planilha (INSCRICOES_FECHADAS, CLOSES_AT e CAPACITY)
export function exceptionRegistration(registration: RegistrationDTO): RegistrationDTO {
  if (!registration.endpoint) return registration;
  return {
    ...registration,
    status: 'open',
    closesAt: null,
    slots: { capacity: null, taken: 0, remaining: null, level: 'unknown' },
  };
}
