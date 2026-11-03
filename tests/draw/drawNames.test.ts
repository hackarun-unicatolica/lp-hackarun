// @vitest-environment node
// o sorteio dos nomes (tela 2) de ponta a ponta, com a "planilha" local de teste
import { describe, expect, it } from 'vitest';
import { DrawTeamNames } from '@application/draw/TeamDrawUseCases';
import { createRandom } from '@domain/index';
import { SheetDrawGateway } from '@infrastructure/draw/SheetDrawGateway';
import type { WireResponse } from '@infrastructure/draw/DrawTransport';
import { handleDrawAction } from '../../tools/sorteio/xlsx-handler.mjs';
import { CATALOG, FileTransport, setup } from './drawSetup';
import { makeWorkbook, OTHER, readSheet, UNICATOLICA } from './xlsxFixture';

const teamCells = async (file: string) => (await readSheet(file, 'Inscritos')).slice(1).map((row) => row[6]);

describe('sorteio dos nomes · tela 2', () => {
  async function saved(count = 24) {
    const ctx = await setup(count);
    const preview = await ctx.generate.execute('base');
    if (!preview.ok) throw new Error(preview.error);
    await ctx.save.execute(preview.value.result);
    return ctx;
  }

  it('sorteia o Pokémon de uma equipe e renomeia nas três abas', async () => {
    const { names, gateway, file } = await saved();
    const drawn = await names.drawOne(3);
    if (!drawn.ok) throw new Error(drawn.error);
    const { pokemon } = drawn.value;
    expect(drawn.value.team.name).toBe(`Equipe ${pokemon.name}`);

    const team = (await gateway.loadSavedTeams()).find((t) => t.number === 3);
    expect(team).toMatchObject({ name: `Equipe ${pokemon.name}`, pokemonId: pokemon.id });
    expect(team?.members).toHaveLength(4);
    expect((await teamCells(file)).filter((c) => c === `Equipe ${pokemon.name}`)).toHaveLength(4);
    expect(
      (await readSheet(file, 'Equipes')).slice(1).some((row) => row[0] === `Equipe ${pokemon.name}`),
    ).toBe(true);
    expect((await readSheet(file, 'Equipes')).slice(1).some((row) => row[0] === 'Equipe 3')).toBe(false);
  });

  it('o número da equipe continua o mesmo depois de ganhar nome', async () => {
    const { names, gateway } = await saved();
    await names.drawOne(2);
    expect((await gateway.loadSavedTeams()).map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('sortear todas dá um Pokémon diferente a cada equipe, sem repetir', async () => {
    const { names, gateway } = await saved();
    const all = await names.drawAll();
    if (!all.ok) throw new Error(all.error);
    expect(all.value).toHaveLength(6);
    const teams = await gateway.loadSavedTeams();
    expect(new Set(teams.map((t) => t.pokemonId)).size).toBe(6);
    expect(new Set(teams.map((t) => t.name)).size).toBe(6);
    expect(teams.every((t) => t.name.startsWith('Equipe ') && !/\d$/.test(t.name))).toBe(true);
  });

  it('equipe que já tem nome não é sorteada de novo, e acabando o catálogo avisa', async () => {
    const { names } = await saved();
    await names.drawOne(1);
    expect(await names.drawOne(1)).toMatchObject({ ok: false });
    expect(await names.drawOne(99)).toMatchObject({ ok: false });
    // 5 pendentes e 5 Pokémon livres: cabe; com catálogo menor não
    const small = new DrawTeamNames((await saved()).gateway, CATALOG.slice(0, 3), createRandom('x'));
    expect(await small.drawAll()).toMatchObject({ ok: false });
  });

  it('depois que alguma equipe tem nome, as equipes não podem mais ser refeitas', async () => {
    const { names, generate, save } = await saved();
    await names.drawOne(1);
    const again = await generate.execute('novo');
    expect(again.ok && again.value.locked).toBe(true);
    if (!again.ok) return;
    expect(await save.execute(again.value.result)).toMatchObject({ ok: false });
  });

  it('sortear todas grava num pedido só (rápido também no Apps Script), e um lote com conflito não grava nada', async () => {
    const { names, file } = await saved();
    const calls: string[] = [];
    const counting = new DrawTeamNames(
      new SheetDrawGateway({
        call: (body) => {
          calls.push(String(body.action));
          return handleDrawAction(file, body) as Promise<WireResponse>;
        },
      }),
      CATALOG,
      createRandom('lote'),
    );
    expect((await counting.drawAll()).ok).toBe(true);
    expect(calls.filter((a) => a === 'draw-names')).toHaveLength(1);
    expect(names).toBeDefined();

    // lote com um Pokémon repetido: a planilha recusa e nenhuma equipe é renomeada
    const fresh = await saved();
    const before = JSON.stringify(await fresh.gateway.loadSavedTeams());
    const bad = await handleDrawAction(fresh.file, {
      action: 'draw-names',
      items: [
        { number: 1, name: 'Equipe A', pokemonId: 25 },
        { number: 2, name: 'Equipe B', pokemonId: 25 },
      ],
    });
    expect(bad).toMatchObject({ ok: false, error: 'conflict' });
    expect(JSON.stringify(await fresh.gateway.loadSavedTeams())).toBe(before);
  });

  it('o handler recusa o mesmo Pokémon para duas equipes mesmo se a tela mandar', async () => {
    const { file } = await saved();
    expect(
      await handleDrawAction(file, {
        action: 'draw-names',
        items: [{ number: 1, name: 'Equipe Pikachu', pokemonId: 25 }],
      }),
    ).toMatchObject({ ok: true });
    expect(
      await handleDrawAction(file, {
        action: 'draw-names',
        items: [{ number: 2, name: 'Equipe Outro', pokemonId: 25 }],
      }),
    ).toMatchObject({
      ok: false,
      error: 'conflict',
    });
    expect(
      await handleDrawAction(file, {
        action: 'draw-names',
        items: [{ number: 2, name: 'Equipe Pikachu', pokemonId: 26 }],
      }),
    ).toMatchObject({
      ok: false,
      error: 'conflict',
    });
  });
});

describe('o que a planilha recebe de quem não é de outra instituição', () => {
  it('perfil e instituição viram nível e grupo certos (UniCatólica x de fora)', async () => {
    const file = await makeWorkbook([
      { protocol: 'HR26-A', name: 'A', profile: UNICATOLICA, period: '2º' },
      { protocol: 'HR26-B', name: 'B', profile: OTHER, institution: 'Fasec', period: '4º' },
      { protocol: 'HR26-C', name: 'C', profile: 'Já se formou' },
      { protocol: 'HR26-D', name: 'D', profile: 'Trabalha ou estuda por conta própria' },
    ]);
    const people = await new SheetDrawGateway(new FileTransport(file)).loadAccredited();
    expect(people.map((p) => [p.level, p.institution.key, p.institution.external])).toEqual([
      ['p2', 'unicatolica', false],
      ['p4', 'fasec', true],
      ['graduate', 'sem-instituicao', false],
      ['self-taught', 'sem-instituicao', false],
    ]);
  });
});

describe('"Recomeçar teste" (só na cópia local)', () => {
  it('desfaz equipes e nomes, mantém os credenciados, e dá para sortear de novo', async () => {
    const { names, gateway, generate, save, file } = await setup(24);
    const first = await generate.execute('a');
    if (!first.ok) throw new Error(first.error);
    await save.execute(first.value.result);
    await names.drawAll();
    expect(await handleDrawAction(file, { action: 'draw-reset' })).toMatchObject({ ok: true });
    expect(await gateway.loadSavedTeams()).toEqual([]);
    expect((await teamCells(file)).every((cell) => !cell)).toBe(true);
    expect(await gateway.loadAccredited()).toHaveLength(24);
    const again = await generate.execute('b');
    if (!again.ok) throw new Error(again.error);
    expect(again.value.locked).toBe(false);
    expect((await save.execute(again.value.result)).ok).toBe(true);
  });
});

describe('"Sortear os nomes de novo" (só na cópia local)', () => {
  it('as equipes continuam iguais e voltam a se chamar Equipe N, sem Pokémon', async () => {
    const { names, gateway, generate, save, file } = await setup(24);
    const first = await generate.execute('a');
    if (!first.ok) throw new Error(first.error);
    await save.execute(first.value.result);
    const members = (await gateway.loadSavedTeams()).map((t) => t.members.map((m) => m.id).sort());
    await names.drawAll();
    expect(await handleDrawAction(file, { action: 'draw-reset-names' })).toMatchObject({ ok: true });
    const teams = await gateway.loadSavedTeams();
    expect(teams.map((t) => [t.name, t.pokemonId])).toEqual(
      Array.from({ length: 6 }, (_, i) => [`Equipe ${i + 1}`, null]),
    );
    expect(teams.map((t) => t.members.map((m) => m.id).sort())).toEqual(members);
    // e o sorteio dos nomes funciona de novo
    expect((await names.drawAll()).ok).toBe(true);
  });
});

describe('"Publicar no site"', () => {
  it('só publica com todos os nomes; depois as equipes ficam confirmadas na aba Equipes', async () => {
    const ctx = await setup(24);
    const preview = await ctx.generate.execute('base');
    if (!preview.ok) throw new Error(preview.error);
    await ctx.save.execute(preview.value.result);
    expect(await ctx.publish.execute()).toEqual({
      ok: false,
      error: 'Ainda há equipe sem nome: sorteie todos os nomes antes de publicar.',
    });
    await ctx.names.drawAll();
    expect((await ctx.gateway.loadSavedTeams()).some((t) => t.published)).toBe(false);
    expect(await ctx.publish.execute()).toEqual({ ok: true, value: 6 });
    const teams = await ctx.gateway.loadSavedTeams();
    expect(teams.every((t) => t.published)).toBe(true);
    const status = (await readSheet(ctx.file, 'Equipes')).slice(1).filter((row) => row[0]);
    expect(status.every((row) => row.includes('confirmado'))).toBe(true);
  });
});

describe('sem reler a planilha quando a tela já sabe as equipes', () => {
  it('sortear, nomear e publicar com a lista conhecida não fazem nenhuma leitura extra', async () => {
    const ctx = await setup(24);
    const preview = await ctx.generate.execute('base');
    if (!preview.ok) throw new Error(preview.error);
    await ctx.save.execute(preview.value.result);
    const known = await ctx.gateway.loadSavedTeams();
    let reads = 0;
    const original = ctx.gateway.loadSavedTeams.bind(ctx.gateway);
    ctx.gateway.loadSavedTeams = async () => {
      reads++;
      return original();
    };
    const drawn = await ctx.names.drawAll(known);
    if (!drawn.ok) throw new Error(drawn.error);
    expect(drawn.value).toHaveLength(6);
    const named = known.map((t) => drawn.value.find((d) => d.team.number === t.number)?.team ?? t);
    expect(await ctx.publish.execute(named)).toEqual({ ok: true, value: 6 });
    expect(reads).toBe(0);
    expect((await original()).every((t) => t.published && t.pokemonId !== null)).toBe(true);
  });

  it('lista conhecida velha não engana a planilha: Pokémon repetido ainda é recusado', async () => {
    const ctx = await setup(24);
    const preview = await ctx.generate.execute('base');
    if (!preview.ok) throw new Error(preview.error);
    await ctx.save.execute(preview.value.result);
    const stale = await ctx.gateway.loadSavedTeams();
    expect((await ctx.names.drawOne(1)).ok).toBe(true);
    // a tela ainda acha que ninguém tem nome: o sorteio pode escolher o mesmo Pokémon, mas a planilha confere
    for (let n = 2; n <= 6; n++) await ctx.names.drawOne(n, stale).catch(() => undefined);
    const final = await ctx.gateway.loadSavedTeams();
    const ids = final.map((t) => t.pokemonId).filter((id) => id !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
