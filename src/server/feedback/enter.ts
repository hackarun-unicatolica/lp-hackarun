// identificação: confere e-mail + WhatsApp na lista guardada e diz o que a pessoa pode fazer agora
import type { FeedbackConfig } from './config';
import { currentWindow, identityKey, loadRoster, nextWindow, type RosterPerson } from './roster';
import { colleaguesOf, json, windowView, type FeedbackDeps } from './shared';
import { createTicket } from './ticket';

const FAILURE_DELAY_MS = 500;
// por e-mail: quem digitou errado algumas vezes. Por IP bem mais alto: a turma inteira sai pelo mesmo Wi-Fi da faculdade
export const EMAIL_MAX_FAILURES = 8;
export const IP_MAX_FAILURES = 80;

const firstName = (person: RosterPerson) => person.name.split(/\s+/)[0] ?? person.name;

export async function enter(
  request: Request,
  fields: Record<string, unknown>,
  config: FeedbackConfig,
  deps: FeedbackDeps,
): Promise<Response> {
  const email = typeof fields['email'] === 'string' ? fields['email'].slice(0, 200).trim().toLowerCase() : '';
  const whatsapp = typeof fields['whatsapp'] === 'string' ? fields['whatsapp'].slice(0, 40) : '';
  const ipKey = `feedback-ip|${request.headers.get('CF-Connecting-IP') ?? 'local'}`;
  const emailKey = `feedback-email|${email}`;
  const [ipFailures, emailFailures] = await Promise.all([
    deps.attempts.failures(ipKey),
    deps.attempts.failures(emailKey),
  ]);
  if (ipFailures >= IP_MAX_FAILURES || emailFailures >= EMAIL_MAX_FAILURES) {
    return json(429, { ok: false, error: 'rate-limited' });
  }
  const roster = await loadRoster(config, deps);
  if (!roster) return json(503, { ok: false, error: 'unavailable' });

  const key = await identityKey(config.token, email, whatsapp);
  const person = roster.people.find((p) => p.key === key);
  if (!person) {
    await Promise.all([deps.attempts.fail(ipKey), deps.attempts.fail(emailKey)]);
    await deps.sleep(FAILURE_DELAY_MS);
    return json(401, { ok: false, error: 'not-found' });
  }
  await deps.attempts.clear(emailKey);

  const now = deps.now();
  const current = currentWindow(roster.windows, now);
  const next = windowView(nextWindow(roster.windows, now));
  const who = { name: firstName(person), team: person.team };
  if (!current) return json(200, { ok: true, status: 'closed', person: who, next });
  if (person.done.includes(current.day)) {
    return json(200, { ok: true, status: 'done', person: who, day: windowView(current), next });
  }
  const colleagues = colleaguesOf(roster, person);
  if (colleagues.length === 0) return json(200, { ok: true, status: 'alone', person: who, next });
  return json(200, {
    ok: true,
    status: 'open',
    person: who,
    day: windowView(current),
    next,
    colleagues: colleagues
      .map((c) => ({ id: c.ref, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    ticket: await createTicket(config.token, person.ref, current.day, now),
  });
}
