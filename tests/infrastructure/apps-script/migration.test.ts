// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  LEGACY_MEMBER_HEADERS,
  LEGACY_MEMBER_ROWS,
  LEGACY_TEAM_HEADERS,
  LEGACY_TEAM_ROWS,
  configure,
  legacyBook,
  snapshot,
} from '../../helpers/apps-script/legacyLayout';
import { AppsScriptSandbox, registrationBody } from '../../helpers/apps-script/sandbox';
import { FakeSheet } from '../../helpers/apps-script/sheetFakes';

describe('Apps Script · migração da inscrição por equipe para a individual', () => {
  it('guarda as abas antigas com outro nome, sem mexer em dado nem fórmula, e cria as novas', () => {
    const { script, teams, members } = legacyBook();
    const before = [snapshot(teams), snapshot(members)];
    configure(script);
    expect(teams.name).toBe('Equipes (inscrição antiga)');
    expect(members.name).toBe('Integrantes (inscrição antiga)');
    expect([snapshot(teams), snapshot(members)]).toEqual(before);
    expect(teams.rows).toEqual([LEGACY_TEAM_HEADERS, ...LEGACY_TEAM_ROWS]);
    expect(members.rows).toEqual([LEGACY_MEMBER_HEADERS, ...LEGACY_MEMBER_ROWS]);
    // filtro e aviso antigos continuam onde estavam (nada é removido)
    expect(teams.filter?.a1).toBe('A1:N1000');
    expect(teams.protections).toHaveLength(1);
    expect(script.book.sheets.map((s) => s.name)).toEqual([
      'Inscritos',
      'Equipes',
      'Equipes (inscrição antiga)',
      'Integrantes (inscrição antiga)',
      'Resumo',
    ]);
    expect(script.teams.rows[0]?.[0]).toBe('Equipe');
    expect(script.properties['PLANILHA_VERSAO']).toBe('7');
  });

  it('o Resumo (aba do script) é refeito para as abas novas', () => {
    const { script, summary } = legacyBook();
    configure(script);
    expect(script.summary).toBe(summary);
    expect(summary.formulaAt(5, 2)).toBe(
      '=COUNTIFS(\'Inscritos\'!A2:A;"<>";\'Inscritos\'!O2:O;"<>cancelado")',
    );
    expect([...summary.formulas.values()].join(' ')).not.toContain("'Equipes'!A2:A");
  });

  it('rodar de novo não renomeia de novo nem cria abas a mais', () => {
    const { script } = legacyBook();
    configure(script);
    const names = script.book.sheets.map((s) => s.name);
    const tabs = [snapshot(script.tab('Equipes (inscrição antiga)')), snapshot(script.teams)];
    configure(script);
    expect(script.book.sheets.map((s) => s.name)).toEqual(names);
    expect([snapshot(script.tab('Equipes (inscrição antiga)')), snapshot(script.teams)]).toEqual(tabs);
  });

  it('sem rodar o configurarPlanilha, a primeira inscrição migra sozinha e grava na aba nova', () => {
    const { script, teams } = legacyBook();
    const res = script.post(registrationBody());
    expect(res.ok).toBe(true);
    expect(teams.name).toBe('Equipes (inscrição antiga)');
    expect(script.registrations.data).toHaveLength(1);
    expect(script.row(script.registrations, 0)['Protocolo']).toBe(res.protocol);
    // o e-mail da Ana na inscrição antiga não segura a inscrição nova
    expect(script.row(script.registrations, 0)['E-mail']).toBe('ana@exemplo.com');
  });

  it('nome "(inscrição antiga)" já usado: a aba vai pra um nome livre, nunca por cima', () => {
    const { script, teams } = legacyBook();
    script.book.add(new FakeSheet('Equipes (inscrição antiga)')).appendRow(['cópia manual']);
    configure(script);
    expect(teams.name).toBe('Equipes (inscrição antiga) 2');
    expect(script.tab('Equipes (inscrição antiga)').rows).toEqual([['cópia manual']]);
  });

  it('aba Equipes ou Integrantes que não é do layout antigo não é renomeada', () => {
    const script = new AppsScriptSandbox();
    const notes = script.book.add(new FakeSheet('Integrantes'));
    notes.appendRow(['Nome', 'Observação']);
    configure(script);
    configure(script);
    expect(notes.name).toBe('Integrantes');
    expect(script.book.sheets.map((s) => s.name)).toEqual(['Inscritos', 'Equipes', 'Resumo', 'Integrantes']);
  });

  it('inscrição que esperou na fila enquanto a da frente migrava não refaz a formatação', () => {
    const { script } = legacyBook();
    const wait = script.lock.waitLock.bind(script.lock);
    // a config desta inscrição foi lida antes do lock (versão 6); a da frente migra enquanto ela espera
    script.lock.waitLock = () => {
      script.evaluate('setupBook_(SpreadsheetApp.getActiveSpreadsheet(), readConfig_())');
      script.registrations.calls.length = 0;
      wait();
    };
    expect(script.post(registrationBody()).ok).toBe(true);
    expect(script.registrations.calls).toEqual([]);
  });

  it('lista pública e vagas lidas antes da migração saem do cache quando a planilha migra', () => {
    const { script } = legacyBook();
    script.cache.put('teams:v6', '[{"name":"velho"}]');
    script.cache.put('slots:v1', '9');
    configure(script);
    expect(script.get('teams').teams).toEqual([]);
    expect(script.get('slots').taken).toBe(0);
  });
});
