import { Observable } from '@shared/core/Observable';
import { normalizeSearch } from '@shared/utils/text';
import { Slots } from '@domain/index';
import type { ListTeams, SlotsDTO, TeamDTO } from '@application/index';

// o que a página pública mostra de uma equipe: nome, quantidade, nomes dos integrantes e foto. Nunca matrícula, e-mail nem WhatsApp
export interface PublicTeam {
  id: string;
  name: string;
  memberCount: number;
  // foto/logo aprovada junto com a equipe; null = card com as iniciais
  imageUrl: string | null;
  // Pokémon do sorteio dos nomes: o card vira o círculo com a cor do tipo, como no telão do sorteio
  mascot: { pokemonId: number; types: readonly string[] } | null;
  // nomes de quem está na equipe (a página é dos competidores: saber com quem vai trabalhar)
  members: readonly string[];
}

export type TeamsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TeamsState {
  teams: PublicTeam[];
  visible: PublicTeam[];
  query: string;
  status: TeamsStatus;
  slots: SlotsDTO;
}

export interface TeamsDeps {
  initial: PublicTeam[];
  slots: SlotsDTO;
  listTeams: ListTeams | null;
  now?: () => number;
}

export const toPublicTeam = (t: TeamDTO): PublicTeam => ({
  id: t.id,
  name: t.name,
  memberCount: t.memberCount,
  imageUrl: t.imageUrl,
  mascot: t.mascot,
  members: t.members,
});

// vitrine da LP: até `limit` equipes, as com foto primeiro (a ordem entre elas se mantém)
export function pickFaces(teams: readonly PublicTeam[], limit: number): PublicTeam[] {
  const withImage = teams.filter((t) => t.imageUrl);
  return [...withImage, ...teams.filter((t) => !t.imageUrl)].slice(0, Math.max(0, limit));
}

const matches = (team: PublicTeam, needle: string): boolean =>
  !needle || normalizeSearch(team.name).includes(needle);

// vagas recalculadas com a lista ao vivo (a do build pode estar velha)
function slotsWith(base: SlotsDTO, taken: number): SlotsDTO {
  if (base.capacity === null) return { ...base, taken, remaining: null, level: 'unknown' };
  const slots = Slots.create(base.capacity, taken);
  return { capacity: base.capacity, taken, remaining: slots.remaining, level: slots.level };
}

export class TeamsViewModel {
  readonly state: Observable<TeamsState>;
  private readonly listTeams: ListTeams | null;
  private readonly now: () => number;
  private readonly baseSlots: SlotsDTO;
  private lastRefresh = 0;
  private inflight: Promise<void> | null = null;

  constructor(deps: TeamsDeps) {
    this.listTeams = deps.listTeams;
    this.now = deps.now ?? Date.now;
    this.baseSlots = deps.slots;
    this.state = new Observable<TeamsState>({
      teams: deps.initial,
      visible: deps.initial,
      query: '',
      status: 'idle',
      slots: deps.slots,
    });
  }

  get isLive(): boolean {
    return this.listTeams !== null;
  }

  setQuery(query: string): void {
    const { teams } = this.state.value;
    const needle = normalizeSearch(query);
    this.state.update((s) => ({ ...s, query, visible: teams.filter((t) => matches(t, needle)) }));
  }

  // falha é silenciosa: a lista atual continua na tela
  refresh(): Promise<void> {
    if (!this.listTeams) return Promise.resolve();
    this.inflight ??= this.load(this.listTeams).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  // a planilha tem cache de 60s, não adianta perguntar antes disso
  refreshIfStale(maxAgeMs = 60_000): Promise<void> {
    if (this.lastRefresh && this.now() - this.lastRefresh < maxAgeMs) return Promise.resolve();
    return this.refresh();
  }

  private async load(listTeams: ListTeams): Promise<void> {
    this.state.update((s) => ({ ...s, status: 'loading' }));
    // conta a tentativa (mesmo com erro) pra não martelar a planilha
    this.lastRefresh = this.now();
    try {
      const teams = (await listTeams.execute()).filter((t) => t.status === 'confirmed').map(toPublicTeam);
      this.state.update((s) => {
        const needle = normalizeSearch(s.query);
        return {
          ...s,
          teams,
          visible: teams.filter((t) => matches(t, needle)),
          status: 'ready',
          slots: slotsWith(this.baseSlots, teams.length),
        };
      });
    } catch {
      this.state.update((s) => ({ ...s, status: 'error' }));
    }
  }
}
