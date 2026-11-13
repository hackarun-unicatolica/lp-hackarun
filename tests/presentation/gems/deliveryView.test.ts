// entrega final: ordem de chegada, quem falta e o nome digitado de qualquer jeito
import { describe, expect, it } from 'vitest';
import { deliveryView, matchPending } from '@presentation/view-models/gems/deliveryView';

const STATE = {
  teams: ['Equipe Muk', 'Equipe Poliwhirl', 'Equipe Golem'],
  done: [
    { team: 'Equipe Golem', at: '2026-11-13T23:10:00.000Z' },
    { team: 'Equipe Muk', at: '2026-11-13T23:05:00.000Z' },
  ],
};

describe('lista da entrega final', () => {
  it('quem completou sai em ordem de chegada, com a posição; quem falta mantém a ordem da planilha', () => {
    const view = deliveryView(STATE, (iso) => iso.slice(11, 16));
    expect(view.done).toEqual([
      { position: 1, team: 'Equipe Muk', time: '23:05', sync: 'saved' },
      { position: 2, team: 'Equipe Golem', time: '23:10', sync: 'saved' },
    ]);
    expect(view.pending).toEqual(['Equipe Poliwhirl']);
    expect([view.count, view.total]).toEqual([2, 3]);
  });

  it('acha a equipe digitada sem ligar para maiúsculas e espaços, e só entre as que faltam', () => {
    const view = deliveryView(STATE, () => '');
    expect(matchPending(view, '  equipe POLIWHIRL ')).toBe('Equipe Poliwhirl');
    expect(matchPending(view, 'Equipe Muk')).toBeNull();
    expect(matchPending(view, 'Poliwhirl')).toBeNull();
  });
});
