// composition root do browser: casos de uso + adapters do lado do cliente (three/gsap ficam de fora).
// A inscrição (envio e contagem de vagas) mora em registration.ts e só baixa quando o formulário chega perto da tela
import teamsData from '@infrastructure/content/teams.json';
import type { RawTeam } from '@infrastructure/content/schema';
// direto do arquivo (sem o barrel @application/index): o barrel puxaria a inscrição pro chunk comum
import { GetCountdown } from '@application/use-cases/GetCountdown';
import { ListTeams } from '@application/use-cases/ListTeams';
import type { Clock } from '@application/ports/Clock';
import type { PreferenceStore } from '@application/ports/PreferenceStore';
import type { AppConfig } from '@presentation/app/AppConfig';
import { SystemClock } from '@infrastructure/clock/SystemClock';
import { AppsScriptClient } from '@infrastructure/registration/AppsScriptClient';
import { AppsScriptTeamRepository } from '@infrastructure/repositories/AppsScriptTeamRepository';
import { FallbackTeamRepository } from '@infrastructure/repositories/FallbackTeamRepository';
import { StaticTeamRepository } from '@infrastructure/repositories/StaticContentRepositories';
import { LocalPreferenceStore } from '@infrastructure/storage/LocalPreferenceStore';
import { registrationMode, SIMULATION_ENABLED } from '@shared/config/registrationMode';
import type { MentorServices } from './mentors';
import type { RegistrationServices } from './registration';

export type { MentorServices } from './mentors';
export type { RegistrationServices } from './registration';

export interface ClientContainer {
  clock: Clock;
  getCountdown: GetCountdown;
  // envio da inscrição e contagem de vagas: chunk à parte (registration.ts), baixado uma vez na 1ª chamada
  loadRegistration(): Promise<RegistrationServices>;
  // cadastro de mentor (/seja-mentor): outro chunk (mentors.ts), baixado só nessa página
  loadMentors(): Promise<MentorServices>;
  // null = sem planilha configurada, fica só a lista do build
  listTeams: ListTeams | null;
  preferences: PreferenceStore;
}

// ?now=2026-11-14T16:00:00-03:00 desloca o relógio pra conferir a troca de marcos do contador
class ShiftedClock implements Clock {
  private readonly offsetMs: number;

  constructor(offsetMs: number) {
    this.offsetMs = offsetMs;
  }

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
}

function createClock(): Clock {
  const raw = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('now');
  const target = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(target) ? new SystemClock() : new ShiftedClock(target - Date.now());
}

// import tardio memorizado: quebrou (rede caiu), a próxima chamada tenta de novo
function registrationLoader(
  config: AppConfig,
  clock: Clock,
  simulated: boolean,
): () => Promise<RegistrationServices> {
  let loading: Promise<RegistrationServices> | null = null;
  return () => {
    loading ??= import('./registration')
      .then(({ createRegistrationServices }) => createRegistrationServices(config, clock, simulated))
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
    return loading;
  };
}

// idem pro cadastro de mentor
function mentorLoader(config: AppConfig, clock: Clock, simulated: boolean): () => Promise<MentorServices> {
  let loading: Promise<MentorServices> | null = null;
  return () => {
    loading ??= import('./mentors')
      .then(({ createMentorServices }) => createMentorServices(config, clock, simulated))
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
    return loading;
  };
}

// lista de equipes do sorteio (aba Equipes da planilha); sem planilha fica só a lista do build
function createListTeams(endpoint: string | null): ListTeams | null {
  if (!endpoint) return null;
  const direct = new AppsScriptTeamRepository(new AppsScriptClient(endpoint));
  const bundled = new StaticTeamRepository(teamsData as RawTeam[]);
  const live = new FallbackTeamRepository(direct, bundled);
  // no site publicado a lista vem do /api/equipes (cópia guardada pela Cloudflare, para muita gente não derrubar o
  // limite de execuções do Apps Script); sem ele (dev, teste) ou se ele falhar, busca direto no Apps Script
  if (typeof location === 'undefined') return new ListTeams(live);
  const proxy = new AppsScriptTeamRepository(
    new AppsScriptClient(new URL('/api/equipes', location.origin).href),
  );
  return new ListTeams(new FallbackTeamRepository(proxy, live));
}

// simulation: o build liberou a simulação (SIMULATION_ENABLED); os testes passam false pra ficar sem ela
export function createClientContainer(config: AppConfig, options: { simulation: boolean }): ClientContainer {
  const clock = createClock();
  // dev ou prévia sem planilha: inscrição simulada (nada é gravado). Build sem a flag: SIMULATION_ENABLED vira
  // false e a simulação nem entra no bundle
  const simulated =
    SIMULATION_ENABLED && registrationMode(config.registration.endpoint, options.simulation) === 'simulated';
  return {
    clock,
    getCountdown: new GetCountdown(clock, config.milestones),
    loadRegistration: registrationLoader(config, clock, simulated),
    loadMentors: mentorLoader(config, clock, simulated),
    listTeams: createListTeams(config.teamsEndpoint),
    preferences: new LocalPreferenceStore(),
  };
}
