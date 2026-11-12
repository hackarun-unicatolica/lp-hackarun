import { DomainError } from '@domain/shared/DomainError';

// catálogo da roleta das tecnologias (missão do dia 12/11): cada categoria é uma fatia da roda e guarda as
// ferramentas e práticas que podem sair nela
export interface Tool {
  readonly name: string;
  readonly description: string;
}

export interface ToolCategory {
  readonly id: string;
  readonly name: string;
  // nome quebrado em linhas curtas, para caber na fatia da roda
  readonly wheelLabel: readonly string[];
  readonly tools: readonly Tool[];
}

// cada equipe gira até três vezes, e cada giro cai numa categoria diferente
export const MAX_SPINS = 3;

const blank = (text: string): boolean => text.trim().length === 0;

export class ToolCatalog {
  private constructor(readonly categories: readonly ToolCategory[]) {}

  static create(categories: readonly ToolCategory[]): ToolCatalog {
    if (categories.length < MAX_SPINS) {
      throw new DomainError(`A roleta precisa de pelo menos ${MAX_SPINS} categorias.`);
    }
    const ids = new Set<string>();
    const toolNames = new Set<string>();
    for (const category of categories) {
      if (blank(category.id) || blank(category.name)) {
        throw new DomainError('Toda categoria da roleta precisa de id e nome.');
      }
      if (ids.has(category.id)) throw new DomainError(`Categoria repetida na roleta: ${category.id}.`);
      ids.add(category.id);
      if (category.wheelLabel.length === 0 || category.wheelLabel.some(blank)) {
        throw new DomainError(`A categoria ${category.name} está sem o rótulo da roda.`);
      }
      if (category.tools.length === 0) {
        throw new DomainError(`A categoria ${category.name} está sem ferramentas.`);
      }
      for (const tool of category.tools) {
        if (blank(tool.name) || blank(tool.description)) {
          throw new DomainError(`Ferramenta sem nome ou descrição em ${category.name}.`);
        }
        const key = tool.name.trim().toLowerCase();
        if (toolNames.has(key)) throw new DomainError(`Ferramenta repetida na roleta: ${tool.name}.`);
        toolNames.add(key);
      }
    }
    return new ToolCatalog(categories.map((category) => ({ ...category, tools: [...category.tools] })));
  }

  get toolCount(): number {
    return this.categories.reduce((total, category) => total + category.tools.length, 0);
  }
}
