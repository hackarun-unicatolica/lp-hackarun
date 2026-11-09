// o que a identificação e o envio usam em comum
import type { AttemptStore } from '../sorteio/attempts';
import type { FeedbackWindow, Roster, RosterDeps, RosterPerson } from './roster';

export interface FeedbackDeps extends RosterDeps {
  next(): Promise<Response>;
  notFound(): Promise<Response>;
  attempts: AttemptStore;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export const windowView = (w: FeedbackWindow | null) =>
  w ? { day: w.day, label: w.label, opens: w.opens, closes: w.closes } : null;

export const colleaguesOf = (roster: Roster, person: RosterPerson) =>
  roster.people.filter((p) => p.team === person.team && p.ref !== person.ref);
