// coluna auxiliar do sorteio na aba Inscritos
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AppsScriptSandbox, type Row } from '../../helpers/apps-script/sandbox';

const TOKEN = 'k'.repeat(40);
const person = (protocol: string, name: string): Row => ({
  Protocolo: protocol,
  'Nome completo': name,
  Perfil: 'Estuda na UniCatólica',
  Instituição: 'UniCatólica',
  Período: '2º',
  Status: 'credenciado',
});

function setup() {
  const script = new AppsScriptSandbox();
  const { registrations } = script.seed([
    person('HR26-AAAAAA', 'Ana Souza'),
    person('HR26-BBBBBB', 'Bruno Lima'),
    person('HR26-CCCCCC', 'Caio Melo'),
  ]);
  script.properties['SORTEIO_TOKEN'] = TOKEN;
  const suggest = () => script.evaluate<() => number>('sugerirGrupos')();
  return { script, registrations, suggest };
}

describe('Apps Script · coluna Menina', () => {
  it('sugere pelo primeiro nome e não mexe no que já foi corrigido', () => {
    const { script, registrations, suggest } = setup();
    suggest();
    const col = script.column(registrations, 'Menina');
    expect(registrations.rows.slice(1).map((r) => r[col - 1])).toEqual(['sim', 'não', 'não']);
    registrations.write(3, col, 'conferir');
    expect(suggest()).toBe(1);
    expect(registrations.rows[2]?.[col - 1]).toBe('conferir');
  });

  it('o sorteio recebe a marcação; sem a coluna, nada muda', () => {
    const { script, registrations, suggest } = setup();
    const list = () =>
      (script.post({ token: TOKEN, action: 'draw-list' }) as unknown as { accredited: Row[] }).accredited;
    expect(list()[0]).not.toHaveProperty('female');
    suggest();
    registrations.write(3, script.column(registrations, 'Menina'), 'conferir');
    expect(list()[0]).toMatchObject({ protocol: 'HR26-AAAAAA', female: true });
    expect(list()[1]).toMatchObject({ protocol: 'HR26-BBBBBB', review: true });
    expect(list()[1]).not.toHaveProperty('female');
    expect(list()[2]).not.toHaveProperty('female');
  });

  it('as colunas da inscrição continuam no mesmo lugar', () => {
    const { script, registrations, suggest } = setup();
    suggest();
    expect(script.column(registrations, 'Menina')).toBeGreaterThan(
      script.evaluate<string[]>('REGISTRATION_HEADERS').length,
    );
  });

  it.each([
    ['Kauã Silva', 'não'],
    ['Maria Clara', 'sim'],
    ['Beatriz Lima', 'sim'],
    ['João Pedro', 'não'],
    ['Alex Souza', 'conferir'],
    ['Luca Reis', 'não'],
    ['Jaqueline Melo', 'sim'],
    ['Felipe Costa', 'não'],
  ])('sugestão para %s: %s', (name, expected) => {
    const { script } = setup();
    expect(script.evaluate<(n: string) => string>('drawGuessGroup_')(name)).toBe(expected);
  });
});
