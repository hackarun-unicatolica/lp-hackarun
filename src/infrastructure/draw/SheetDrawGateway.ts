import {
  DrawGatewayError,
  type DrawGateway,
  type SavedTeam,
  type TeamNameAssignment,
} from '@application/draw/DrawGateway';
import type { DrawParticipant, DrawResult } from '@domain/index';
import type { DrawTransport, WireResponse } from './DrawTransport';
import { toParticipant, type AccreditedRow } from './sheetRows';

interface ListResponse {
  accredited: AccreditedRow[];
  teams: SavedTeam[];
  testSheet?: string | null;
}

// adapter: a porta DrawGateway sobre o protocolo da planilha (draw-list, draw-save, draw-name)
export class SheetDrawGateway implements DrawGateway {
  // leituras que chegam juntas (credenciados + equipes salvas) viram um pedido só
  private pending: Promise<ListResponse> | null = null;

  constructor(private readonly transport: DrawTransport) {}

  private async send(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response: WireResponse = await this.transport.call(body);
    if (response.ok) return response;
    const message = response.message ?? 'A planilha recusou o pedido.';
    if (response.error === 'unauthorized')
      throw new DrawGatewayError('unauthorized', 'A sessão expirou. Entre de novo.');
    if (response.error === 'conflict') throw new DrawGatewayError('conflict', message);
    throw new DrawGatewayError('server', message);
  }

  // a lista é lida de novo a cada chamada (a planilha é a verdade e a organização pode mexer nela entre uma tela e outra),
  // mas duas leituras ao mesmo tempo dividem o mesmo pedido
  private list(): Promise<ListResponse> {
    this.pending ??= (this.send({ action: 'draw-list' }) as unknown as Promise<ListResponse>).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async loadAccredited(): Promise<DrawParticipant[]> {
    return (await this.list()).accredited.map(toParticipant);
  }

  async loadTestLabel(): Promise<string | null> {
    const label = (await this.list()).testSheet;
    return typeof label === 'string' && label !== '' ? label : null;
  }

  async loadSavedTeams(): Promise<SavedTeam[]> {
    return (await this.list()).teams.map((team) => ({ ...team, published: team.published === true }));
  }

  async saveTeams(result: DrawResult, options: { replace: boolean }): Promise<void> {
    await this.send({
      action: 'draw-save',
      replace: options.replace,
      seed: result.seed,
      levelRepeats: result.report.levelRepeatsTotal,
      teams: result.teams.map((team) => ({ number: team.number, members: team.members.map((m) => m.id) })),
    });
  }

  async saveTeamNames(items: readonly TeamNameAssignment[]): Promise<void> {
    await this.send({ action: 'draw-names', items });
  }

  async publishTeams(): Promise<void> {
    await this.send({ action: 'draw-publish' });
  }
}
