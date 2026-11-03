// nome de pessoa como vai para a tela: cada nome e sobrenome com a primeira letra maiúscula ("JOÃO DA SILVA" e
// "joão da silva" viram "João da Silva"). Preposições e o "e" do meio ficam minúsculos; nome composto com hífen ou
// apóstrofo também (Ana-Maria, D'Ávila). Espaços repetidos somem. A planilha continua com o que a pessoa digitou
const PARTICLES = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e']);

const capitalize = (word: string): string =>
  word.replace(
    /(^|[-'’])(\p{L})/gu,
    (_match, sep: string, letter: string) => sep + letter.toLocaleUpperCase('pt-BR'),
  );

export function personName(raw: string): string {
  const words = raw.trim().toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean);
  return words.map((word, i) => (i > 0 && PARTICLES.has(word) ? word : capitalize(word))).join(' ');
}
