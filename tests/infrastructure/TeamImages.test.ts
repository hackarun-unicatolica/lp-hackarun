import { describe, expect, it, vi } from 'vitest';
import { driveImageUrl, pokemonImageUrl } from '@infrastructure/repositories/driveImageUrl';
import { AppsScriptClient } from '@infrastructure/registration/AppsScriptClient';
import { AppsScriptTeamRepository } from '@infrastructure/repositories/AppsScriptTeamRepository';
import { ContentMapper } from '@infrastructure/mappers/ContentMapper';

const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-012';

describe('driveImageUrl', () => {
  it('id com cara de Drive vira a URL pública do CDN em 600 px', () => {
    expect(driveImageUrl(DRIVE_ID)).toBe(`https://lh3.googleusercontent.com/d/${DRIVE_ID}=w600`);
  });

  it.each([
    null,
    undefined,
    42,
    '',
    'curto',
    `${DRIVE_ID}/../x`,
    'javascript:alert(1)aaaaaaaaaaaa',
    `${DRIVE_ID}?x=1`,
  ])('id torto (%s) vira sem foto', (id) => {
    expect(driveImageUrl(id)).toBeNull();
  });
});

describe('foto na lista ao vivo', () => {
  it('AppsScriptTeamRepository monta a URL a partir do imageId e ignora o resto', async () => {
    const body = {
      ok: true,
      teams: [
        { id: 'a', name: 'Com Foto', memberCount: 3, imageId: DRIVE_ID },
        { id: 'b', name: 'Sem Foto', memberCount: 2, imageId: null },
        { id: 'c', name: 'Foto Torta', memberCount: 2, imageId: 'https://evil.example/x.png' },
      ],
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body)));
    const repo = new AppsScriptTeamRepository(
      new AppsScriptClient('https://script.google.com/x/exec', fetchFn),
    );
    const teams = await repo.list();
    expect(teams.map((t) => t.imageUrl)).toEqual([driveImageUrl(DRIVE_ID), null, null]);
  });

  it('o domínio só aceita https ou data:image no src da foto', () => {
    const team = (imageUrl: string) => ContentMapper.toTeam({ id: 't', name: 'Os Brabos', imageUrl });
    expect(team('https://lh3.googleusercontent.com/d/x=w600').imageUrl).toMatch(/^https:/);
    expect(team('data:image/webp;base64,AAAA').imageUrl).toMatch(/^data:image\/webp/);
    expect(team('javascript:alert(1)').imageUrl).toBeNull();
    expect(team('http://inseguro.example/a.png').imageUrl).toBeNull();
    expect(team('data:text/html;base64,AAAA').imageUrl).toBeNull();
    // arte local do Pokémon do sorteio; caminho torto não passa
    expect(team('/pokemon/6.webp').imageUrl).toBe('/pokemon/6.webp');
    expect(team('/pokemon/../x.webp').imageUrl).toBeNull();
    expect(team('/pokemon/6.webp?x=1').imageUrl).toBeNull();
  });

  it('equipe do sorteio usa a arte do Pokémon (mesmo com insígnia no Drive); número torto fica sem', async () => {
    const body = {
      ok: true,
      teams: [
        { id: 'a', name: 'Equipe Charizard', memberCount: 4, imageId: DRIVE_ID, pokemonId: 6 },
        { id: 'b', name: 'Equipe Manual', memberCount: 4, imageId: DRIVE_ID, pokemonId: null },
        { id: 'c', name: 'Equipe Torta', memberCount: 4, imageId: null, pokemonId: '6/../x' },
      ],
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body)));
    const repo = new AppsScriptTeamRepository(
      new AppsScriptClient('https://script.google.com/x/exec', fetchFn),
    );
    expect((await repo.list()).map((t) => t.imageUrl)).toEqual([
      '/pokemon/6.webp',
      driveImageUrl(DRIVE_ID),
      null,
    ]);
    expect(pokemonImageUrl(0)).toBeNull();
    expect(pokemonImageUrl(1.5)).toBeNull();
  });
});

describe('mascote da equipe (Pokémon do sorteio dos nomes)', () => {
  it('só Pokémon do catálogo vira mascote, com os tipos dele; fora da lista fica sem', async () => {
    const body = {
      ok: true,
      teams: [
        { id: 'a', name: 'Equipe Charizard', memberCount: 4, pokemonId: 6 },
        { id: 'b', name: 'Equipe Manual', memberCount: 4, pokemonId: null },
        { id: 'c', name: 'Equipe Fora', memberCount: 4, pokemonId: 999 },
      ],
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body)));
    const repo = new AppsScriptTeamRepository(
      new AppsScriptClient('https://script.google.com/x/exec', fetchFn),
    );
    const teams = await repo.list();
    expect(teams.map((t) => t.mascot)).toEqual([{ pokemonId: 6, types: ['fire', 'flying'] }, null, null]);
  });
});

describe('nomes dos integrantes na lista pública', () => {
  it('vêm do script como texto; entrada torta (não-texto, vazio, repetido, gigante) é ignorada', async () => {
    const body = {
      ok: true,
      teams: [
        {
          id: 'a',
          name: 'Equipe Charizard',
          memberCount: 4,
          members: ['Ana Souza', 'Ana Souza', '', 7, null, `${'x'.repeat(200)}`, 'Bruno Lima'],
        },
        { id: 'b', name: 'Equipe Sem Lista', memberCount: 4 },
      ],
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body)));
    const repo = new AppsScriptTeamRepository(
      new AppsScriptClient('https://script.google.com/x/exec', fetchFn),
    );
    const [first, second] = await repo.list();
    expect(first?.members).toEqual(['Ana Souza', 'x'.repeat(80), 'Bruno Lima']);
    expect(second?.members).toEqual([]);
  });
});
