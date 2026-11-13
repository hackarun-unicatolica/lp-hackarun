import type { TeamSync } from './DeliverySession';

// o que a tela da entrega final mostra: quem completou (ordem de chegada, com a posição, a hora e se já foi salvo na
// planilha) e quem falta

export interface DeliveryInput {
  teams: string[];
  done: { team: string; at: string; sync?: TeamSync }[];
}

export interface DeliveryView {
  count: number;
  total: number;
  done: { position: number; team: string; time: string; sync: TeamSync }[];
  pending: string[];
}

const key = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function deliveryView(state: DeliveryInput, formatTime: (iso: string) => string): DeliveryView {
  const done = [...state.done]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((d, i) => ({ position: i + 1, team: d.team, time: formatTime(d.at), sync: d.sync ?? 'saved' }));
  const finished = new Set(done.map((d) => key(d.team)));
  const pending = state.teams.filter((team) => !finished.has(key(team)));
  return { count: done.length, total: state.teams.length, done, pending };
}

// nome digitado (com ou sem maiúsculas e espaços) -> o nome exato da equipe que ainda falta, ou null
export function matchPending(view: DeliveryView, typed: string): string | null {
  const wanted = key(typed);
  return view.pending.find((team) => key(team) === wanted) ?? null;
}

export const clockTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Araguaina' });
};
