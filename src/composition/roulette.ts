// composition root da roleta das tecnologias (/roleta): entrega o catálogo já validado. Um dado inválido no JSON
// interrompe o build, porque a página monta a roda a partir daqui
import tools from '@infrastructure/content/tools.json';
import { ToolCatalog } from '@domain/roulette/ToolCatalog';

export function toolCatalog(): ToolCatalog {
  return ToolCatalog.create(tools);
}
