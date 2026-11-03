// as duas telas do sorteio vivem na mesma página: o endereço escolhe qual aparece (e links para outros caminhos
// seguem normais, recarregando)
import { describe, expect, it } from 'vitest';
import { stepOf } from '@presentation/views/draw/drawApp';

describe('telas do sorteio pelo endereço', () => {
  it('/sorteio é Equipes e /sorteio/nomes é Nomes, com ou sem .html e barra no fim', () => {
    expect(['/sorteio', '/sorteio/', '/sorteio.html'].map(stepOf)).toEqual(['teams', 'teams', 'teams']);
    expect(['/sorteio/nomes', '/sorteio/nomes/', '/sorteio/nomes.html'].map(stepOf)).toEqual([
      'names',
      'names',
      'names',
    ]);
  });

  it('outros caminhos não são telas do sorteio (o link recarrega a página normalmente)', () => {
    expect(['/equipes', '/', '/sorteio/sair', '/sorteios'].map(stepOf)).toEqual([null, null, null, null]);
  });
});
