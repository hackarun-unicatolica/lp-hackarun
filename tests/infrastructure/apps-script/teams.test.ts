// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AppsScriptSandbox } from '../../helpers/apps-script/sandbox';
import { FakeSheet } from '../../helpers/apps-script/sheetFakes';

const BADGE = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-012';
// as colunas de integrantes vêm por fórmula; aqui já com o valor que a planilha calcularia
const SEEDED_TEAMS = [
  {
    Equipe: '  Equipe Pikachu ',
    'Integrantes (qtd)': 4,
    Integrantes: 'Ana Souza\nBruno Lima',
    'E-mails': 'ana@exemplo.com; bruno@exemplo.com',
    WhatsApps: '(63) 99999-0001, (63) 99999-0002',
    Status: 'Confirmado',
    'ID da insígnia': BADGE,
  },
  { Equipe: 'Equipe Bulbasaur', 'Integrantes (qtd)': 5, Status: 'pendente' },
  { Equipe: 'Equipe Squirtle', 'Integrantes (qtd)': 5, Status: '' },
  // linha pré-formatada sem nome: nunca sai, mesmo marcada
  { Equipe: '', Status: 'confirmado' },
];
const SEEDED_PEOPLE = [
  { Protocolo: 'HR26-AAAAAA', 'Nome completo': 'Ana Souza', Equipe: 'Equipe Pikachu', Status: 'credenciado' },
  {
    Protocolo: 'HR26-BBBBBB',
    'Nome completo': 'Bruno Lima',
    Equipe: 'equipe pikachu',
    Status: 'credenciado',
  },
  {
    Protocolo: 'HR26-CCCCCC',
    'Nome completo': 'Caio Cancelado',
    Equipe: 'Equipe Pikachu',
    Status: 'cancelado',
  },
  { Protocolo: 'HR26-DDDDDD', 'Nome completo': 'Duda Sem Equipe', Equipe: '', Status: 'credenciado' },
];

describe('Apps Script · lista pública de equipes (aba Equipes)', () => {
  it('expõe só {id, name, memberCount, imageId, pokemonId, members} das equipes confirmadas', () => {
    const script = new AppsScriptSandbox();
    script.seed(SEEDED_PEOPLE, SEEDED_TEAMS);
    const res = script.get('teams');
    expect(res.ok).toBe(true);
    expect(res.teams).toHaveLength(1);
    const [team] = res.teams ?? [];
    expect(Object.keys(team ?? {}).sort()).toEqual([
      'id',
      'imageId',
      'memberCount',
      'members',
      'name',
      'pokemonId',
    ]);
    // sem aba Sorteio (equipe montada à mão), sem Pokémon
    expect(team).toMatchObject({ name: 'Equipe Pikachu', memberCount: 4, imageId: BADGE, pokemonId: null });
    expect(team?.['id']).toMatch(/^team-[0-9a-f]{10}$/);
    // os competidores veem quem está na equipe (sem quem cancelou nem quem é de outra equipe), só o nome
    expect(team?.['members']).toEqual(['Ana Souza', 'Bruno Lima']);
    // nenhum dado de contato escapa
    const raw = JSON.stringify(res);
    ['ana@exemplo.com', '99999', 'HR26-', 'Caio', 'Duda'].forEach((secret) =>
      expect(raw).not.toContain(secret),
    );
  });

  it('o id público usa o segredo do script (não dá pra achar pelo hash do nome) e é estável', () => {
    const script = new AppsScriptSandbox();
    const { teams } = script.seed([], SEEDED_TEAMS);
    const id = script.get('teams').teams?.[0]?.['id'];
    const plain = createHash('sha256').update('equipe pikachu', 'utf8').digest('hex').slice(0, 10);
    expect(id).not.toBe(`team-${plain}`);
    const secret = script.properties['ID_SEGREDO'] ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(64);
    // corrigir caixa ou acento não muda o id; outro nome muda
    script.edit(teams, 0, 'Equipe', 'EQUIPE PIKACHÚ');
    script.cache.store.clear();
    expect(script.get('teams').teams?.[0]?.['id']).toBe(id);
    script.edit(teams, 0, 'Equipe', 'Equipe Charmander');
    script.cache.store.clear();
    expect(script.get('teams').teams?.[0]?.['id']).not.toBe(id);
  });

  it.each([
    ['', null],
    ['curto', null],
    ['https://evil.example/x.png', null],
    ['=IMAGE("x")', null],
    [` ${BADGE} `, BADGE],
  ])('célula ID da insígnia "%s" vira %s', (value, expected) => {
    const script = new AppsScriptSandbox();
    script.seed([], [{ ...SEEDED_TEAMS[0], 'ID da insígnia': value }]);
    expect(script.get('teams').teams?.[0]?.['imageId']).toBe(expected);
  });

  it('equipe confirmada sem ninguém ainda aparece com memberCount 1 (nunca 0 ou NaN)', () => {
    const script = new AppsScriptSandbox();
    script.seed([], [{ Equipe: 'Equipe Mew', 'Integrantes (qtd)': '', Status: 'confirmado' }]);
    expect(script.get('teams').teams).toEqual([
      expect.objectContaining({ name: 'Equipe Mew', memberCount: 1 }),
    ]);
  });

  it('nome comprido é cortado em 40 caracteres', () => {
    const script = new AppsScriptSandbox();
    script.seed([], [{ Equipe: 'Equipe '.repeat(10), Status: 'confirmado' }]);
    expect(String(script.get('teams').teams?.[0]?.['name'])).toHaveLength(40);
  });

  it.each(['Status', 'Equipe', 'ID da insígnia', 'Integrantes (qtd)'])(
    'usa o cache e o onEdit da coluna %s da aba Equipes limpa ele na hora',
    (column) => {
      const script = new AppsScriptSandbox();
      const { teams } = script.seed([], SEEDED_TEAMS);
      expect(script.get('teams').teams).toHaveLength(1);
      script.edit(teams, 1, 'Status', 'confirmado');
      expect(script.get('teams').teams).toHaveLength(1);
      script.onEdit(teams, column);
      expect(script.get('teams').teams).toHaveLength(2);
    },
  );

  it.each(['Equipe', 'Status'])(
    'o onEdit da coluna %s da aba Inscritos também limpa (muda a contagem)',
    (column) => {
      const script = new AppsScriptSandbox();
      const { registrations } = script.seed(SEEDED_PEOPLE, SEEDED_TEAMS);
      script.get('teams');
      script.onEdit(registrations, column);
      expect(script.cache.store.has('teams:v6')).toBe(false);
    },
  );

  it('editar uma coluna interna (e-mails, curso) não mexe no cache', () => {
    const script = new AppsScriptSandbox();
    const { registrations, teams } = script.seed(SEEDED_PEOPLE, SEEDED_TEAMS);
    script.get('teams');
    script.onEdit(teams, 'E-mails');
    script.onEdit(registrations, 'Curso');
    expect(script.cache.store.has('teams:v6')).toBe(true);
  });

  it('sem a aba Equipes (planilha nova) a lista vem vazia, sem criar nada nem gerar segredo', () => {
    const script = new AppsScriptSandbox();
    expect(script.get('teams')).toEqual({ ok: true, teams: [] });
    expect(script.book.sheets).toHaveLength(0);
    expect(script.properties['ID_SEGREDO']).toBeUndefined();
  });

  it('aba Equipes ainda no layout da inscrição por equipe não vaza nada pro site', () => {
    const script = new AppsScriptSandbox();
    const legacy = script.book.add(new FakeSheet('Equipes'));
    legacy.appendRow(['Protocolo', 'Data/hora', 'Equipe', 'Integrantes (qtd)', 'Foto', 'Status']);
    legacy.appendRow(['HR26-AAAAAA', '', 'Os Brabos', 2, '', 'confirmado']);
    expect(script.get('teams')).toEqual({ ok: true, teams: [] });
  });

  it('ação desconhecida não devolve nada', () => {
    expect(new AppsScriptSandbox().get('rows')).toEqual({ ok: false, error: 'unknown-action' });
  });
});
