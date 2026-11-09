// envio da avaliação: confere o comprovante e se a pessoa avaliou cada colega, e só então chama a planilha
import { cleanReason, ratingProblem } from '../../domain/value-objects/PeerReview';
import type { FeedbackConfig } from './config';
import { currentWindow, loadRoster, nextWindow, type RosterPerson } from './roster';
import { colleaguesOf, json, windowView, type FeedbackDeps } from './shared';
import { readTicket } from './ticket';

// a planilha segura o envio até 25 s na fila; a folga cobre a ida e a volta
const UPSTREAM_TIMEOUT_MS = 40_000;

interface ParsedRating {
  id: string;
  stars: number | null;
  absent: boolean;
  reason: string;
}

function parseRatings(value: unknown): ParsedRating[] | null {
  if (!Array.isArray(value)) return null;
  const ratings = value.map((item: unknown): ParsedRating | null => {
    const r = item as Record<string, unknown> | null;
    if (!r || typeof r['id'] !== 'string') return null;
    const stars = r['stars'] ?? null;
    if (stars !== null && typeof stars !== 'number') return null;
    return {
      id: r['id'],
      stars,
      absent: r['absent'] === true,
      reason: typeof r['reason'] === 'string' ? cleanReason(r['reason']) : '',
    };
  });
  return ratings.every((r): r is ParsedRating => r !== null) ? ratings : null;
}

export async function submit(
  fields: Record<string, unknown>,
  config: FeedbackConfig,
  deps: FeedbackDeps,
): Promise<Response> {
  const now = deps.now();
  const ticket = await readTicket(config.token, fields['ticket'], now);
  if (!ticket) return json(401, { ok: false, error: 'expired' });
  const roster = await loadRoster(config, deps);
  if (!roster) return json(503, { ok: false, error: 'unavailable' });
  const next = windowView(nextWindow(roster.windows, now));
  const current = currentWindow(roster.windows, now);
  if (!current || current.day !== ticket.day) return json(200, { ok: false, error: 'closed', next });
  const author = roster.people.find((p) => p.ref === ticket.ref);
  if (!author) return json(401, { ok: false, error: 'expired' });

  // tem que avaliar cada colega, uma vez: nem a mais, nem a menos
  const colleagues = new Map(colleaguesOf(roster, author).map((c) => [c.ref, c]));
  const ratings = parseRatings(fields['ratings']);
  const complete =
    ratings !== null &&
    ratings.length === colleagues.size &&
    new Set(ratings.map((r) => r.id)).size === ratings.length &&
    ratings.every((r) => colleagues.has(r.id) && ratingProblem(r) === null);
  if (!complete) return json(400, { ok: false, error: 'invalid' });

  return forward(
    {
      action: 'feedback-submit',
      token: config.token,
      day: current.day,
      author: { protocol: author.protocol, name: author.name, team: author.team },
      ratings: ratings.map((r) => {
        const target = colleagues.get(r.id) as RosterPerson;
        return {
          protocol: target.protocol,
          name: target.name,
          stars: r.absent ? null : r.stars,
          absent: r.absent,
          reason: r.reason,
        };
      }),
    },
    next,
    config,
    deps,
  );
}

async function forward(
  payload: unknown,
  next: unknown,
  config: FeedbackConfig,
  deps: FeedbackDeps,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await deps.fetch(config.endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const parsed = (upstream.ok ? await upstream.json() : null) as { ok?: unknown; error?: unknown } | null;
    if (parsed?.ok === true) return json(200, { ok: true, next });
    const error = parsed?.error;
    if (error === 'already' || error === 'closed') return json(200, { ok: false, error, next });
    if (error === 'busy') return json(503, { ok: false, error: 'busy' });
    if (error === 'invalid') return json(400, { ok: false, error: 'invalid' });
    if (error === 'unauthorized') console.error('feedback: o Apps Script recusou a chave (SORTEIO_TOKEN)');
    return json(502, { ok: false, error: 'unavailable' });
  } catch {
    return json(504, { ok: false, error: 'busy' });
  } finally {
    clearTimeout(timer);
  }
}
