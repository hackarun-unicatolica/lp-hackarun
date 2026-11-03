// nomes padronizados na tela: tudo em caixa alta, tudo minúsculo ou misturado vira "Nome Sobrenome"
import { describe, expect, it } from 'vitest';
import { personName } from '@presentation/formatters/personName';

describe('personName', () => {
  it.each([
    ['DIOGO DA SILVA FREITAS', 'Diogo da Silva Freitas'],
    ['arthur santos coelho', 'Arthur Santos Coelho'],
    ['LEONARDO DE SOUZA SILVA', 'Leonardo de Souza Silva'],
    ['Guilherme Bento Valeriano De Albuquerque', 'Guilherme Bento Valeriano de Albuquerque'],
    ['RAPHAEL OLIMPIO APARECIDO PEREIRA LIMA', 'Raphael Olimpio Aparecido Pereira Lima'],
    ['ana maria dos santos e silva', 'Ana Maria dos Santos e Silva'],
  ])('%s → %s', (raw, expected) => {
    expect(personName(raw)).toBe(expected);
  });

  it('acentos, hífen e apóstrofo', () => {
    expect(personName('ÉRICA ÂNGELA')).toBe('Érica Ângela');
    expect(personName('ana-maria d’ávila')).toBe('Ana-Maria D’Ávila');
    expect(personName("JOANA D'ARC")).toBe("Joana D'Arc");
  });

  it('espaços sobrando somem; partícula no começo vira maiúscula; vazio continua vazio', () => {
    expect(personName('  Stefani   Vitória  Teixeira ')).toBe('Stefani Vitória Teixeira');
    expect(personName('de souza')).toBe('De Souza');
    expect(personName('   ')).toBe('');
  });
});
