import type { EventOverviewDTO, MilestoneDTO, RegistrationDTO } from '@application/index';

// dados que o build injeta na página (script#app-config) pro código do browser
export interface AppConfig {
  milestones: MilestoneDTO[];
  registration: RegistrationDTO;
  // mesmo Web App do Apps Script, rota GET ?action=teams
  teamsEndpoint: string | null;
}

export const APP_CONFIG_ID = 'app-config';

// lista de equipes: o mesmo Web App das inscrições, a menos que PUBLIC_TEAMS_ENDPOINT aponte outro (só a lista muda,
// as inscrições continuam no endereço de sempre; serve para ensaiar o sorteio numa cópia da planilha)
export function teamsEndpointFor(registrationEndpoint: string | null): string | null {
  const override = (import.meta.env.PUBLIC_TEAMS_ENDPOINT as string | undefined)?.trim();
  return override?.startsWith('https://') ? override : registrationEndpoint;
}

// roda no build (index e 404 montam o mesmo config)
export function buildAppConfig(event: Pick<EventOverviewDTO, 'milestones' | 'registration'>): AppConfig {
  return {
    milestones: event.milestones,
    registration: event.registration,
    teamsEndpoint: teamsEndpointFor(event.registration.endpoint),
  };
}

export function readAppConfig(): AppConfig | null {
  const el = document.getElementById(APP_CONFIG_ID);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as AppConfig;
  } catch {
    return null;
  }
}
