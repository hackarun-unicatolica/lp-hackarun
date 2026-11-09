// planilha com duas equipes, relógio no horário aberto e atalhos para as ações do Feedback.gs
import { AppsScriptSandbox, type Row } from './sandbox';

export const TOKEN = 'k'.repeat(40);
export const REASON = 'Ficou no celular o tempo todo.';
export const OPEN = Date.parse('2026-11-13T20:00:00-03:00');

export function person(protocol: string, name: string, team: string, extra: Row = {}): Row {
  return {
    Protocolo: protocol,
    'Nome completo': name,
    'E-mail': `${protocol.toLowerCase()}@exemplo.com`,
    WhatsApp: '(63) 99999-0101',
    Status: 'credenciado',
    Equipe: team,
    ...extra,
  };
}

export const PEOPLE = [
  person('HR26-AAAAAA', 'Ana Souza', 'Equipe Mew'),
  person('HR26-BBBBBB', 'Bruno Lima', 'Equipe Mew'),
  person('HR26-CCCCCC', 'Caio Melo', 'Equipe Mew'),
  person('HR26-DDDDDD', 'Duda Reis', 'Equipe Onix'),
  person('HR26-EEEEEE', 'Eva Nunes', 'Equipe Mew', { Status: 'cancelado' }),
  person('HR26-FFFFFF', 'Fabi Rocha', ''),
];

export const AUTHOR = { protocol: 'HR26-AAAAAA', name: 'Ana Souza', team: 'Equipe Mew' };
export const target = (protocol: string, name: string, score: Record<string, unknown>) => ({
  protocol,
  name,
  absent: false,
  reason: '',
  ...score,
});
export const GOOD = [
  target('HR26-BBBBBB', 'Bruno Lima', { stars: 5 }),
  target('HR26-CCCCCC', 'Caio Melo', { stars: 2, reason: REASON }),
];

type Response = ReturnType<AppsScriptSandbox['post']> & Record<string, unknown>;

export function setup() {
  const script = new AppsScriptSandbox();
  script.seed(PEOPLE);
  script.properties['SORTEIO_TOKEN'] = TOKEN;
  script.now = OPEN;
  const call = (body: Record<string, unknown>) => script.post({ token: TOKEN, ...body }) as Response;
  const send = (ratings: unknown = GOOD, author: unknown = AUTHOR, day = '2026-11-13') =>
    call({ action: 'feedback-submit', day, author, ratings });
  const roster = () =>
    call({ action: 'feedback-roster' }) as unknown as {
      ok: boolean;
      windows: { day: string; label: string }[];
      people: { protocol: string; name: string; key: string; done: string[] }[];
    };
  return { script, call, send, roster };
}
