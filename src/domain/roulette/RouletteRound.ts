import { pickOne, type Random } from '@domain/draw/random';
import { DomainError } from '@domain/shared/DomainError';
import { MAX_SPINS, type Tool, type ToolCatalog, type ToolCategory } from './ToolCatalog';

// o que saiu num giro: a categoria em que a roda parou e a ferramenta sorteada dentro dela
export interface RouletteDraw {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly tool: Tool;
}

// rodada de uma equipe: até três giros, sempre em categorias diferentes, e uma única escolha entre o que saiu.
// Depois da escolha a rodada acaba (não dá para girar nem trocar). Imutável: cada ação devolve uma rodada nova
export class RouletteRound {
  private constructor(
    private readonly catalog: ToolCatalog,
    readonly draws: readonly RouletteDraw[],
    readonly chosen: RouletteDraw | null,
  ) {}

  static start(catalog: ToolCatalog): RouletteRound {
    return new RouletteRound(catalog, [], null);
  }

  get spinsLeft(): number {
    return this.chosen ? 0 : MAX_SPINS - this.draws.length;
  }

  get canSpin(): boolean {
    return this.spinsLeft > 0;
  }

  get canChoose(): boolean {
    return this.chosen === null && this.draws.length > 0;
  }

  get remainingCategories(): readonly ToolCategory[] {
    const used = new Set(this.draws.map((draw) => draw.categoryId));
    return this.catalog.categories.filter((category) => !used.has(category.id));
  }

  spin(random: Random): RouletteRound {
    if (this.chosen) throw new DomainError('A equipe já escolheu a ferramenta.');
    if (!this.canSpin) throw new DomainError(`A equipe já usou os ${MAX_SPINS} giros.`);
    const category = pickOne(this.remainingCategories, random);
    const tool = pickOne(category.tools, random);
    const draw: RouletteDraw = { categoryId: category.id, categoryName: category.name, tool };
    return new RouletteRound(this.catalog, [...this.draws, draw], null);
  }

  choose(index: number): RouletteRound {
    if (this.chosen) throw new DomainError('A equipe já escolheu a ferramenta.');
    const draw = Number.isInteger(index) ? this.draws[index] : undefined;
    if (!draw) throw new DomainError('Escolha uma das ferramentas sorteadas.');
    return new RouletteRound(this.catalog, this.draws, draw);
  }
}
