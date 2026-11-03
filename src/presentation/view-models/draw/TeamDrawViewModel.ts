import { Observable } from '@shared/core/Observable';
import type {
  DrawPreview,
  DrawStatus,
  GenerateTeamDraw,
  GetDrawStatus,
  SaveTeamDraw,
} from '@application/draw/TeamDrawUseCases';

export type TeamDrawStatus = 'loading' | 'ready' | 'drawing' | 'saving' | 'error';

export interface TeamDrawState {
  status: TeamDrawStatus;
  // credenciados e equipes já salvas na planilha
  sheet: DrawStatus | null;
  // o sorteio mostrado na tela (ainda não salvo, a menos que `saved` seja verdadeiro)
  preview: DrawPreview | null;
  saved: boolean;
  error: string | null;
}

interface Deps {
  status: Pick<GetDrawStatus, 'execute'>;
  generate: Pick<GenerateTeamDraw, 'execute'>;
  save: Pick<SaveTeamDraw, 'execute'>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Algo deu errado.');

// 1ª tela: sortear as equipes, conferir o relatório e salvar na planilha
export class TeamDrawViewModel {
  readonly state = new Observable<TeamDrawState>({
    status: 'loading',
    sheet: null,
    preview: null,
    saved: false,
    error: null,
  });

  constructor(private readonly deps: Deps) {}

  private patch(partial: Partial<TeamDrawState>): void {
    this.state.update((s) => ({ ...s, ...partial }));
  }

  async load(): Promise<void> {
    this.patch({ status: 'loading', error: null });
    try {
      this.patch({ status: 'ready', sheet: await this.deps.status.execute() });
    } catch (error) {
      this.patch({ status: 'error', error: message(error) });
    }
  }

  // forma as equipes (sem gravar). Pode ser chamado de novo para sortear outra vez
  async draw(seed?: string): Promise<void> {
    if (this.state.value.status === 'drawing' || this.state.value.status === 'saving') return;
    this.patch({ status: 'drawing', error: null, saved: false });
    try {
      const preview = await this.deps.generate.execute(seed);
      if (!preview.ok) return this.patch({ status: 'ready', preview: null, error: preview.error });
      this.patch({ status: 'ready', preview: preview.value });
    } catch (error) {
      this.patch({ status: 'error', error: message(error) });
    }
  }

  // planilha real: sorteia e já grava (sem botão "Salvar"). Refazer só vale enquanto nenhuma equipe tem nome
  async drawAndSave(seed?: string): Promise<void> {
    await this.draw(seed);
    const { preview } = this.state.value;
    if (preview && !preview.locked) await this.save();
  }

  async save(): Promise<void> {
    const { preview, status } = this.state.value;
    if (!preview || status === 'saving' || status === 'drawing') return;
    if (preview.locked) {
      return this.patch({ error: 'Alguma equipe já tem nome: não dá mais para refazer as equipes.' });
    }
    this.patch({ status: 'saving', error: null });
    try {
      const saved = await this.deps.save.execute(preview.result, this.state.value.sheet?.saved);
      if (!saved.ok) return this.patch({ status: 'ready', error: saved.error });
      this.patch({ status: 'ready', saved: true, sheet: await this.deps.status.execute() });
    } catch (error) {
      this.patch({ status: 'error', error: message(error) });
    }
  }
}
