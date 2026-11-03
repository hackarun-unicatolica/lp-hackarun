import { Observable } from '@shared/core/Observable';
import { wait } from '@shared/utils/async';
import type { SavedTeam } from '@application/draw/DrawGateway';
import type {
  DrawTeamNames,
  GetDrawStatus,
  PokemonEntry,
  PublishTeams,
} from '@application/draw/TeamDrawUseCases';

export interface TeamNamesState {
  loading: boolean;
  teams: SavedTeam[];
  // equipes sendo sorteadas agora (a tela mostra as imagens girando)
  spinning: number[];
  // Pokémon do catálogo que ainda estão livres
  remaining: number;
  // "Publicar no site" em andamento
  publishing: boolean;
  error: string | null;
}

interface Deps {
  status: Pick<GetDrawStatus, 'execute'>;
  names: Pick<DrawTeamNames, 'drawOne' | 'drawAll'>;
  publish: Pick<PublishTeams, 'execute'>;
  catalog: readonly PokemonEntry[];
  // suspense: as imagens ficam girando pelo menos isto, mesmo que a planilha responda antes (testes passam 0)
  minSpinMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

// suspense mínimo: um sorteio só (o card gira um instante) e "Sortear" de todas (cobre a contagem 3-2-1 e deixa a
// roleta girar um pouco antes da cascata)
const DEFAULT_MIN_SPIN_ONE_MS = 1200;
const DEFAULT_MIN_SPIN_ALL_MS = 2600;

const message = (error: unknown) => (error instanceof Error ? error.message : 'Algo deu errado.');

// 2ª tela: sortear o Pokémon (e o nome) de cada equipe
export class TeamNamesViewModel {
  readonly state = new Observable<TeamNamesState>({
    loading: true,
    teams: [],
    spinning: [],
    remaining: 0,
    publishing: false,
    error: null,
  });

  constructor(private readonly deps: Deps) {}

  private patch(partial: Partial<TeamNamesState>): void {
    this.state.update((s) => ({ ...s, ...partial }));
  }

  private async refresh(): Promise<void> {
    const { saved } = await this.deps.status.execute();
    const used = new Set(saved.map((t) => t.pokemonId).filter((id): id is number => id !== null));
    this.patch({ teams: saved, remaining: this.deps.catalog.filter((p) => !used.has(p.id)).length });
  }

  async load(): Promise<void> {
    this.patch({ loading: true, error: null });
    try {
      await this.refresh();
    } catch (error) {
      this.patch({ error: message(error) });
    } finally {
      this.patch({ loading: false });
    }
  }

  get pending(): SavedTeam[] {
    return this.state.value.teams.filter((t) => t.pokemonId === null);
  }

  // espera o que falta do tempo mínimo de suspense, contado desde que o sorteio começou
  private async hold(startedAt: number, fallbackMs: number): Promise<void> {
    const wanted = this.deps.minSpinMs ?? fallbackMs;
    const left = wanted - (Date.now() - startedAt);
    if (left > 0) await (this.deps.sleep ?? wait)(left);
  }

  // o que o sorteio devolveu já diz como ficou cada equipe: aplica direto, sem reler a planilha (a leitura é a parte
  // mais lenta do Apps Script e fazia o suspense passar dos 10 s)
  private apply(drawn: readonly { team: SavedTeam }[]): void {
    const byNumber = new Map(drawn.map(({ team }) => [team.number, team]));
    const teams = this.state.value.teams.map((t) => byNumber.get(t.number) ?? t);
    const used = new Set(teams.map((t) => t.pokemonId).filter((id): id is number => id !== null));
    this.patch({ teams, remaining: this.deps.catalog.filter((p) => !used.has(p.id)).length });
  }

  async drawOne(number: number): Promise<void> {
    if (this.state.value.spinning.includes(number)) return;
    const startedAt = Date.now();
    this.patch({ spinning: [...this.state.value.spinning, number], error: null });
    try {
      const result = await this.deps.names.drawOne(number);
      await this.hold(startedAt, DEFAULT_MIN_SPIN_ONE_MS);
      if (result.ok) this.apply([result.value]);
      else {
        this.patch({ error: result.error });
        await this.refresh();
      }
    } catch (error) {
      this.patch({ error: message(error) });
    } finally {
      this.patch({ spinning: this.state.value.spinning.filter((n) => n !== number) });
    }
  }

  async drawAll(): Promise<void> {
    const pending = this.pending.map((t) => t.number);
    if (pending.length === 0 || this.state.value.spinning.length > 0) return;
    const startedAt = Date.now();
    this.patch({ spinning: pending, error: null });
    try {
      const result = await this.deps.names.drawAll();
      await this.hold(startedAt, DEFAULT_MIN_SPIN_ALL_MS);
      if (result.ok) this.apply(result.value);
      else {
        this.patch({ error: result.error });
        await this.refresh();
      }
    } catch (error) {
      this.patch({ error: message(error) });
    } finally {
      this.patch({ spinning: [] });
    }
  }

  // confirma as equipes na planilha: elas aparecem em /equipes com o Pokémon de logo
  async publish(): Promise<void> {
    if (this.state.value.publishing || this.state.value.spinning.length > 0) return;
    this.patch({ publishing: true, error: null });
    try {
      const result = await this.deps.publish.execute();
      if (result.ok) this.patch({ teams: this.state.value.teams.map((t) => ({ ...t, published: true })) });
      else {
        this.patch({ error: result.error });
        await this.refresh();
      }
    } catch (error) {
      this.patch({ error: message(error) });
    } finally {
      this.patch({ publishing: false });
    }
  }
}
