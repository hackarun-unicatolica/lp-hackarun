// avaliação entre colegas: as abas da organização deixam evidente quem recebeu nota baixa e quem não avaliou
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LOW_STARS } from '../../../src/domain/value-objects/PeerReview';
import { AppsScriptSandbox } from '../../helpers/apps-script/sandbox';
import { PEOPLE, TOKEN, setup } from '../../helpers/apps-script/feedbackSetup';

describe('Apps Script · o que a organização vê na avaliação', () => {
  const tabs = () => {
    const { script, roster } = setup();
    roster();
    return script;
  };

  it('Notas baixas puxa 3 estrelas ou menos e as faltas, juntando as de cada pessoa', () => {
    const script = tabs();
    const sheet = script.tab('Notas baixas');
    expect(sheet.rows[0]).toEqual([
      'Dia',
      'Equipe',
      'Avaliado',
      'Nota',
      'Justificativa',
      'Quem avaliou',
      'Quantos avaliaram mal nesse dia',
    ]);
    const list = sheet.formulaAt(2, 1) ?? '';
    expect(list).toContain("FILTER('Avaliações'!$B$2:$G");
    expect(list).toContain(`<=${LOW_STARS}`);
    expect(list).toContain('="Não compareceu"');
    expect(list).toContain('SORT(');
    // conta TODOS os que avaliaram mal a mesma pessoa no mesmo dia
    expect(sheet.formulaAt(2, 7)).toContain('COUNTIFS($A$2:$A,$A$2:$A,$B$2:$B,$B$2:$B,$C$2:$C,$C$2:$C)');
  });

  it('Acompanhamento marca NÃO AVALIOU depois do horário, em cada dia', () => {
    const script = tabs();
    const sheet = script.tab('Acompanhamento');
    const titles = sheet.rows[0]?.map(String) ?? [];
    expect(titles).toContain('12/11: avaliou?');
    expect(titles).toContain('13/11: avaliou?');
    expect(titles).toContain('14/11: notas baixas');
    expect(titles.at(-1)).toBe('Total de notas baixas');
    const column = (title: string) => titles.indexOf(title) + 1;
    expect(sheet.formulaAt(2, column('12/11: avaliou?'))).toContain('DATE(2026,11,12)+TIME(23,59,59)');
    const friday = sheet.formulaAt(2, column('13/11: avaliou?')) ?? '';
    expect(friday).toContain('NÃO AVALIOU');
    expect(friday).toContain('DATE(2026,11,13)+TIME(23,59,59)');
    expect(sheet.formulaAt(2, column('14/11: avaliou?'))).toContain('DATE(2026,11,14)+TIME(16,30,0)');
  });

  it('destaca as linhas ruins e esconde a coluna técnica', () => {
    const script = tabs();
    expect(script.tab('Avaliações').conditionalRules).toHaveLength(1);
    expect(script.tab('Notas baixas').conditionalRules.length).toBeGreaterThan(0);
    expect(script.tab('Avaliações').hiddenColumns.has(1)).toBe(true);
  });

  it('planilha em pt-BR separa os argumentos com ponto e vírgula', () => {
    const script = new AppsScriptSandbox();
    script.book.locale = 'pt_BR';
    script.seed(PEOPLE);
    script.properties['SORTEIO_TOKEN'] = TOKEN;
    script.post({ token: TOKEN, action: 'feedback-roster' });
    expect(script.tab('Notas baixas').formulaAt(2, 1)).toContain(';1;TRUE;2;TRUE;3;TRUE');
  });

  it('mudar os horários refaz os resumos e mantém as avaliações', () => {
    const { script, send, roster } = setup();
    send();
    script.properties['FEEDBACK_JANELAS'] = JSON.stringify([
      { day: '2026-11-13', opens: '2026-11-13T18:00:00-03:00', closes: '2026-11-13T22:00:00-03:00' },
    ]);
    roster();
    expect(script.tab('Avaliações').data).toHaveLength(2);
    expect(script.tab('Acompanhamento').formulaAt(2, 4)).toContain('TIME(22,0,0)');
  });
});
