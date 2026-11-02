// sorteio das equipes no Apps Script (Draw.gs): só responde com a chave do sorteio, grava em lote nas três abas e
// segue as mesmas regras da cópia local de teste (tools/sorteio/xlsx-handler.mjs)
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AppsScriptSandbox, type Row } from '../../helpers/apps-script/sandbox';

const TOKEN = 'k'.repeat(40);

function person(protocol: string, name: string, status = 'credenciado', extra: Row = {}): Row {
  return {
    Protocolo: protocol,
    'Nome completo': name,
    Perfil: 'Estuda na UniCatólica',
    Instituição: 'UniCatólica',
    Período: '2º',
    Status: status,
    ...extra,
  };
}

const PEOPLE = [
  person('HR26-AAAAAA', 'Ana Souza'),
  person('HR26-BBBBBB', 'Bruno Lima'),
  person('HR26-CCCCCC', 'Caio Melo'),
  person('HR26-DDDDDD', 'Duda Reis'),
  person('HR26-EEEEEE', 'Eva Nunes', 'inscrito'),
  person('HR26-FFFFFF', 'Fabi Rocha', 'credenciado', { Equipe: 'Equipe Manual' }),
];

function setup(token: string | null = TOKEN) {
  const script = new AppsScriptSandbox();
  const tabs = script.seed(PEOPLE, [{ Equipe: 'Equipe Manual', Status: 'confirmado' }]);
  if (token !== null) script.properties['SORTEIO_TOKEN'] = token;
  const call = (body: Record<string, unknown>) =>
    script.post({ token: TOKEN, ...body }) as ReturnType<AppsScriptSandbox['post']> & Record<string, unknown>;
  return { script, ...tabs, call };
}

const TWO_TEAMS = [
  { number: 1, members: ['HR26-AAAAAA', 'HR26-BBBBBB'] },
  { number: 2, members: ['HR26-CCCCCC', 'HR26-DDDDDD'] },
];

const teamOf = (script: AppsScriptSandbox, index: number) =>
  script.row(script.registrations, index)['Equipe'];

describe('Apps Script · sorteio das equipes (Draw.gs)', () => {
  it('sem a chave certa (ou sem chave configurada) nada responde, e não passa pelo filtro do formulário', () => {
    expect(setup(null).call({ action: 'draw-list' }).error).toBe('unauthorized');
    // chave curta demais nas propriedades conta como desligado
    expect(setup('curta').call({ action: 'draw-list', token: 'curta' }).error).toBe('unauthorized');
    const { call } = setup();
    expect(call({ action: 'draw-list', token: 'errada' }).error).toBe('unauthorized');
    expect(call({ action: 'draw-list' }).ok).toBe(true);
    expect(call({ action: 'draw-reset' }).error).toBe('unknown-action');
  });

  it('gerarChaveSorteio cria uma chave longa uma vez só, e com ela o sorteio responde', () => {
    const { script } = setup(null);
    const token = script.evaluate<() => string>('gerarChaveSorteio')();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(script.properties['SORTEIO_TOKEN']).toBe(token);
    expect(script.evaluate<() => string>('gerarChaveSorteio')()).toBe(token);
    expect(script.post({ action: 'draw-list', token }).ok).toBe(true);
  });

  it('draw-list devolve só os credenciados, com os campos que o sorteio usa', () => {
    const res = setup().call({ action: 'draw-list' });
    const accredited = res['accredited'] as Record<string, string>[];
    expect(accredited.map((p) => p['protocol'])).toEqual([
      'HR26-AAAAAA',
      'HR26-BBBBBB',
      'HR26-CCCCCC',
      'HR26-DDDDDD',
      'HR26-FFFFFF',
    ]);
    expect(accredited[0]).toEqual({
      protocol: 'HR26-AAAAAA',
      name: 'Ana Souza',
      profile: 'Estuda na UniCatólica',
      institution: 'UniCatólica',
      period: '2º',
      team: '',
    });
    expect(res['teams']).toEqual([]);
  });

  it('draw-save grava as equipes nas três abas, pendentes, sem mexer na equipe montada à mão', () => {
    const { script, call } = setup();
    expect(call({ action: 'draw-save', teams: TWO_TEAMS, seed: 's1', levelRepeats: 0 })).toEqual({
      ok: true,
      saved: 2,
    });
    expect([0, 1, 2, 3, 4, 5].map((i) => teamOf(script, i))).toEqual([
      'Equipe 1',
      'Equipe 1',
      'Equipe 2',
      'Equipe 2',
      '',
      'Equipe Manual',
    ]);
    const teams = script.teams.data.map((r) => [r[0], r[script.column(script.teams, 'Status') - 1]]);
    expect(teams).toEqual([
      ['Equipe Manual', 'confirmado'],
      ['Equipe 1', 'pendente'],
      ['Equipe 2', 'pendente'],
    ]);
    // linhas novas da aba Equipes ganham as fórmulas de integrantes
    const count = script.column(script.teams, 'Integrantes (qtd)');
    expect(script.teams.formulaAt(3, count)).toContain('COUNTIFS');
    expect(script.tab('Sorteio').data.map((r) => r.slice(0, 6))).toEqual([
      [1, 'Equipe 1', '', 2, 's1', 0],
      [2, 'Equipe 2', '', 2, 's1', 0],
    ]);
    const listed = call({ action: 'draw-list' })['teams'] as { members: unknown[] }[];
    expect(listed[0]?.members).toEqual([
      { id: 'HR26-AAAAAA', name: 'Ana Souza' },
      { id: 'HR26-BBBBBB', name: 'Bruno Lima' },
    ]);
  });

  it('recusa quem não está credenciado, quem já tem equipe, repetido e sorteio por cima sem "replace"', () => {
    const { script, call } = setup();
    const conflict = (teams: unknown) => call({ action: 'draw-save', teams });
    expect(conflict([{ number: 1, members: ['HR26-EEEEEE'] }]).error).toBe('conflict');
    expect(conflict([{ number: 1, members: ['HR26-FFFFFF'] }]).error).toBe('conflict');
    expect(conflict([{ number: 1, members: ['HR26-AAAAAA', 'HR26-AAAAAA'] }]).error).toBe('conflict');
    expect(conflict([]).error).toBe('conflict');
    // nada foi gravado nas tentativas recusadas
    expect(teamOf(script, 0)).toBe('');
    expect(call({ action: 'draw-save', teams: TWO_TEAMS }).ok).toBe(true);
    expect(call({ action: 'draw-save', teams: TWO_TEAMS }).error).toBe('conflict');
  });

  it('"replace" troca o sorteio anterior inteiro (pessoas, aba Equipes e aba Sorteio)', () => {
    const { script, call } = setup();
    call({ action: 'draw-save', teams: TWO_TEAMS });
    const again = [{ number: 1, members: ['HR26-AAAAAA', 'HR26-CCCCCC', 'HR26-DDDDDD'] }];
    expect(call({ action: 'draw-save', teams: again, replace: true }).ok).toBe(true);
    expect([0, 1, 2, 3].map((i) => teamOf(script, i))).toEqual(['Equipe 1', '', 'Equipe 1', 'Equipe 1']);
    expect(script.teams.data.map((r) => r[0])).toEqual(['Equipe Manual', 'Equipe 1', '']);
    expect(script.tab('Sorteio').data.filter((r) => r[0] !== '')).toHaveLength(1);
  });

  it('draw-names dá nome a várias equipes de uma vez e troca o nome nas três abas', () => {
    const { script, call } = setup();
    call({ action: 'draw-save', teams: TWO_TEAMS });
    const res = call({
      action: 'draw-names',
      items: [
        { number: 1, pokemonId: 6, name: 'Equipe Charizard' },
        { number: 2, pokemonId: 9, name: 'Equipe Blastoise' },
      ],
    });
    expect(res).toEqual({ ok: true, named: 2 });
    expect([0, 1, 2, 3].map((i) => teamOf(script, i))).toEqual([
      'Equipe Charizard',
      'Equipe Charizard',
      'Equipe Blastoise',
      'Equipe Blastoise',
    ]);
    expect(script.teams.data.map((r) => r[0])).toEqual([
      'Equipe Manual',
      'Equipe Charizard',
      'Equipe Blastoise',
    ]);
    expect(script.tab('Sorteio').data.map((r) => r.slice(1, 3))).toEqual([
      ['Equipe Charizard', 6],
      ['Equipe Blastoise', 9],
    ]);
    // com nome, não dá mais para refazer as equipes
    expect(call({ action: 'draw-save', teams: TWO_TEAMS, replace: true }).error).toBe('conflict');
  });

  it('um lote com conflito (Pokémon repetido, equipe já nomeada) não grava nada', () => {
    const { script, call } = setup();
    call({ action: 'draw-save', teams: TWO_TEAMS });
    const repeated = call({
      action: 'draw-names',
      items: [
        { number: 1, pokemonId: 6, name: 'Equipe Charizard' },
        { number: 2, pokemonId: 6, name: 'Equipe Outra' },
      ],
    });
    expect(repeated.error).toBe('conflict');
    expect(teamOf(script, 0)).toBe('Equipe 1');
    call({ action: 'draw-names', items: [{ number: 1, pokemonId: 6, name: 'Equipe Charizard' }] });
    const again = call({
      action: 'draw-names',
      items: [{ number: 1, pokemonId: 7, name: 'Equipe Squirtle' }],
    });
    expect(again.error).toBe('conflict');
    expect(call({ action: 'draw-names', items: [{ number: 9, pokemonId: 7, name: 'X' }] }).error).toBe(
      'conflict',
    );
  });

  it('publicar exige todos os nomes; depois as equipes aparecem no site com o Pokémon', () => {
    const { script, call } = setup();
    call({ action: 'draw-save', teams: TWO_TEAMS });
    call({ action: 'draw-names', items: [{ number: 1, pokemonId: 6, name: 'Equipe Charizard' }] });
    expect(call({ action: 'draw-publish' }).error).toBe('conflict');
    // a lista pública ainda não tem as equipes do sorteio (pendentes)
    expect(script.get('teams').teams?.map((t) => t['name'])).toEqual(['Equipe Manual']);
    call({ action: 'draw-names', items: [{ number: 2, pokemonId: 9, name: 'Equipe Blastoise' }] });
    expect(call({ action: 'draw-publish' })).toEqual({ ok: true, published: 2 });
    const teams = script.get('teams').teams ?? [];
    expect(teams.map((t) => [t['name'], t['pokemonId'], t['memberCount']])).toEqual([
      ['Equipe Manual', null, 1],
      ['Equipe Charizard', 6, 1],
      ['Equipe Blastoise', 9, 1],
    ]);
  });

  it('só avisa que é planilha de ensaio quando o nome da planilha tem "cópia" ou "teste"', () => {
    const { script, call } = setup();
    expect(call({ action: 'draw-list' })['testSheet']).toBeNull();
    script.book.name = 'Cópia de Teste HackaRun · Inscrições';
    expect(call({ action: 'draw-list' })['testSheet']).toBe('Cópia de Teste HackaRun · Inscrições');
    script.book.name = 'HackaRun 2026 · Inscrições';
    expect(call({ action: 'draw-list' })['testSheet']).toBeNull();
  });

  it('a insígnia da equipe nomeada mostra a arte do Pokémon; a do Drive, se existir, ganha; sortear de novo volta ao padrão', () => {
    const { script, teams, call } = setup();
    call({ action: 'draw-save', teams: TWO_TEAMS });
    call({
      action: 'draw-names',
      items: [
        { number: 1, pokemonId: 6, name: 'Equipe Charizard' },
        { number: 2, pokemonId: 9, name: 'Equipe Blastoise' },
      ],
    });
    const badge = script.column(teams, 'Insígnia');
    const formula = (row: number) => teams.formulaAt(row, badge) ?? '';
    expect(formula(3)).toContain('official-artwork/6.png');
    expect(formula(4)).toContain('official-artwork/9.png');
    // Drive primeiro: o ID da insígnia (coluna ID da insígnia) vem antes da arte
    expect(formula(3)).toMatch(/^=IF\(H3<>"";?,?IMAGE\(/);
    expect(formula(3)).toContain('lh3.googleusercontent.com');
    // a equipe montada à mão (linha 2) não ganhou arte
    expect(formula(2)).not.toContain('official-artwork');
  });

  it('com o lock ocupado responde "busy" sem gravar', () => {
    const { script, call } = setup();
    script.lock.busy = true;
    expect(call({ action: 'draw-save', teams: TWO_TEAMS }).error).toBe('busy');
    expect(teamOf(script, 0)).toBe('');
  });
});
