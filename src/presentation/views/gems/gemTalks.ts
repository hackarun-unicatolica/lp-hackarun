import type { GemColor } from '@domain/gems/GemQueue';

// cor do NPC -> palestra de onde saem as questões (mensagens da organização, 13/11)
export const GEM_TALKS: Record<GemColor, { label: string; talk: string }> = {
  azul: { label: 'Azul', talk: 'Git e GitHub' },
  amarelo: { label: 'Amarelo', talk: 'Destravando ideias com IA' },
  vermelho: { label: 'Vermelho', talk: 'Design Thinking e Scrum' },
};
