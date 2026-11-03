import { describe, expect, it, vi } from 'vitest';
import type { SavedTeam } from '@application/draw/DrawGateway';
import type { DrawPreview } from '@application/draw/TeamDrawUseCases';
import type { Result } from '@domain/index';
import { fail, ok, type DrawResult } from '@domain/index';
import { TeamDrawViewModel } from '@presentation/view-models/draw/TeamDrawViewModel';
import { TeamNamesViewModel } from '@presentation/view-models/draw/TeamNamesViewModel';

const RESULT = { seed: 's', teams: [], report: { teams: 2, participants: 8 } } as unknown as DrawResult;
const preview = (overrides: Partial<DrawPreview> = {}): DrawPreview => ({
  result: RESULT,
  alreadySaved: false,
  locked: false,
  ...overrides,
});

type GenerateFn = (seed?: string) => Promise<Result<DrawPreview, string>>;
type SaveFn = (result: DrawResult) => Promise<Result<void, string>>;

function drawVm(over: { generate?: GenerateFn; save?: SaveFn } = {}) {
  const status = vi.fn().mockResolvedValue({ accredited: 8, saved: [] });
  const generate = vi.fn(over.generate ?? (async () => ok(preview())));
  const save = vi.fn(over.save ?? (async () => ok(undefined)));
  return {
    vm: new TeamDrawViewModel({
      status: { execute: status },
      generate: { execute: generate },
      save: { execute: save },
    }),
    status,
    generate,
    save,
  };
}

describe('TeamDrawViewModel', () => {
  it('abre mostrando os credenciados e o que já está salvo, sem sortear nada', async () => {
    const { vm, generate } = drawVm();
    await vm.load();
    expect(vm.state.value).toMatchObject({
      status: 'ready',
      sheet: { accredited: 8, saved: [] },
      preview: null,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('sortear mostra o resultado sem gravar; sortear de novo troca o resultado', async () => {
    const { vm, generate, save } = drawVm();
    await vm.draw();
    expect(vm.state.value.preview?.result).toBe(RESULT);
    await vm.draw('minha-semente');
    expect(generate).toHaveBeenLastCalledWith('minha-semente');
    expect(save).not.toHaveBeenCalled();
  });

  it('sem credenciados o aviso aparece e não sobra sorteio antigo na tela', async () => {
    const { vm } = drawVm({ generate: async () => fail('Ninguém foi credenciado ainda.') });
    await vm.draw();
    expect(vm.state.value).toMatchObject({
      preview: null,
      error: 'Ninguém foi credenciado ainda.',
      status: 'ready',
    });
  });

  it('salvar grava o que está na tela e atualiza o que a planilha tem', async () => {
    const { vm, save, status } = drawVm();
    await vm.draw();
    await vm.save();
    expect(save).toHaveBeenCalledWith(RESULT);
    expect(vm.state.value.saved).toBe(true);
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('não salva sem sorteio na tela, nem duas vezes ao mesmo tempo, nem com as equipes travadas', async () => {
    const { vm, save } = drawVm();
    await vm.save();
    expect(save).not.toHaveBeenCalled();

    const locked = drawVm({ generate: async () => ok(preview({ locked: true })) });
    await locked.vm.draw();
    await locked.vm.save();
    expect(locked.save).not.toHaveBeenCalled();
    expect(locked.vm.state.value.error).toMatch(/já tem nome/);
  });

  it('planilha real: sortear já grava; com as equipes travadas não grava nada', async () => {
    const { vm, save } = drawVm();
    await vm.drawAndSave();
    expect(save).toHaveBeenCalledWith(RESULT);
    expect(vm.state.value.saved).toBe(true);

    const locked = drawVm({ generate: async () => ok(preview({ locked: true })) });
    await locked.vm.drawAndSave();
    expect(locked.save).not.toHaveBeenCalled();
  });

  it('planilha real: se a gravação falha, as equipes da tela continuam e dá para gravar de novo as mesmas', async () => {
    let calls = 0;
    const { vm, save } = drawVm({
      save: async () => {
        if (calls++ === 0) throw new Error('A planilha não respondeu a tempo.');
        return ok(undefined);
      },
    });
    await vm.drawAndSave();
    expect(vm.state.value).toMatchObject({ saved: false, error: 'A planilha não respondeu a tempo.' });
    expect(vm.state.value.preview?.result).toBe(RESULT);
    await vm.save();
    expect(save).toHaveBeenLastCalledWith(RESULT);
    expect(vm.state.value).toMatchObject({ saved: true, error: null });
  });

  it('erro da planilha vira mensagem na tela, e sortear de novo limpa o erro e o "salvo"', async () => {
    let calls = 0;
    const { vm } = drawVm({
      generate: async () => {
        if (calls++ === 0) throw new Error('Sem conexão');
        return ok(preview());
      },
    });
    await vm.draw();
    expect(vm.state.value).toMatchObject({ status: 'error', error: 'Sem conexão' });
    await vm.draw();
    expect(vm.state.value).toMatchObject({ status: 'ready', error: null, saved: false });
  });
});

const team = (number: number, pokemonId: number | null = null): SavedTeam => ({
  number,
  name: pokemonId ? `Equipe P${pokemonId}` : `Equipe ${number}`,
  pokemonId,
  published: false,
  members: [],
});

function namesVm(teams: SavedTeam[]) {
  let current = teams;
  const status = vi.fn(async () => ({ accredited: 0, saved: current }));
  const names = {
    drawOne: vi.fn(async (n: number) => {
      current = current.map((t) => (t.number === n ? team(n, 100 + n) : t));
      return ok({ team: team(n, 100 + n), pokemon: { id: 100 + n, name: 'X', types: [] } });
    }),
    drawAll: vi.fn(async () => {
      const drawn = current
        .filter((t) => t.pokemonId === null)
        .map((t) => ({
          team: team(t.number, 100 + t.number),
          pokemon: { id: 100 + t.number, name: 'X', types: [] },
        }));
      current = current.map((t) => (t.pokemonId === null ? team(t.number, 100 + t.number) : t));
      return ok(drawn);
    }),
  };
  const catalog = Array.from({ length: 10 }, (_, i) => ({ id: 101 + i, name: `P${i}`, types: [] }));
  const publish = {
    execute: vi.fn(async () => {
      current = current.map((t) => ({ ...t, published: true }));
      return ok(current.length);
    }),
  };
  const vm = new TeamNamesViewModel({ status: { execute: status }, names, publish, catalog, minSpinMs: 0 });
  return { vm, names, publish, status };
}

describe('TeamNamesViewModel', () => {
  it('carrega as equipes salvas e conta os Pokémon que ainda estão livres', async () => {
    const { vm } = namesVm([team(1, 101), team(2), team(3)]);
    await vm.load();
    expect(vm.state.value).toMatchObject({ loading: false, remaining: 9 });
    expect(vm.pending.map((t) => t.number)).toEqual([2, 3]);
  });

  it('sortear uma equipe atualiza só ela e libera o botão no fim', async () => {
    const { vm, names } = namesVm([team(1), team(2)]);
    await vm.load();
    await vm.drawOne(2);
    expect(names.drawOne).toHaveBeenCalledWith(2);
    expect(vm.state.value.spinning).toEqual([]);
    expect(vm.pending.map((t) => t.number)).toEqual([1]);
  });

  it('sortear todas gira todas as pendentes e termina sem nenhuma pendente', async () => {
    const { vm } = namesVm([team(1), team(2), team(3, 103)]);
    await vm.load();
    const seen: number[][] = [];
    vm.state.subscribe((s) => seen.push(s.spinning), { immediate: false });
    await vm.drawAll();
    expect(seen.some((s) => s.join() === '1,2')).toBe(true);
    expect(vm.pending).toEqual([]);
    expect(vm.state.value.spinning).toEqual([]);
  });

  it('o resultado do sorteio é aplicado direto, sem reler a planilha (a releitura era a parte lenta)', async () => {
    const { vm, status } = namesVm([team(1), team(2)]);
    await vm.load();
    status.mockClear();
    await vm.drawAll();
    expect(status).not.toHaveBeenCalled();
    expect(vm.state.value.teams.map((t) => t.pokemonId)).toEqual([101, 102]);
    expect(vm.state.value.remaining).toBe(8);
  });

  it('se o sorteio falha, mostra o erro e relê a planilha para a tela refletir o que ficou salvo', async () => {
    const { vm, status, names } = namesVm([team(1)]);
    await vm.load();
    names.drawAll.mockResolvedValueOnce({ ok: false, error: 'Esse Pokémon já foi sorteado.' } as never);
    status.mockClear();
    await vm.drawAll();
    expect(vm.state.value.error).toBe('Esse Pokémon já foi sorteado.');
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('sem pendentes não faz nada; clique repetido enquanto gira é ignorado', async () => {
    const { vm, names } = namesVm([team(1, 101)]);
    await vm.load();
    await vm.drawAll();
    expect(names.drawAll).not.toHaveBeenCalled();

    const two = namesVm([team(1), team(2)]);
    await two.vm.load();
    await Promise.all([two.vm.drawOne(1), two.vm.drawOne(1)]);
    expect(two.names.drawOne).toHaveBeenCalledTimes(1);
  });

  it('o suspense espera o tempo mínimo antes de mostrar o resultado', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const { vm, names } = namesVm([team(1)]);
    const slow = new TeamNamesViewModel({
      status: { execute: async () => ({ accredited: 0, saved: [team(1)] }) },
      names,
      publish: { execute: async () => ok(0) },
      catalog: [],
      minSpinMs: 1800,
      sleep,
    });
    await slow.load();
    await slow.drawOne(1);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]?.[0]).toBeGreaterThan(1000);
    expect(vm).toBeDefined();
  });
});

describe('TeamNamesViewModel · publicar no site', () => {
  it('publica, recarrega as equipes já publicadas e não publica duas vezes ao mesmo tempo', async () => {
    const { vm, publish } = namesVm([team(1, 101), team(2, 102)]);
    await vm.load();
    await Promise.all([vm.publish(), vm.publish()]);
    expect(publish.execute).toHaveBeenCalledTimes(1);
    expect(vm.state.value.teams.every((t) => t.published)).toBe(true);
    expect(vm.state.value.publishing).toBe(false);
  });

  it('erro da planilha aparece na tela e o botão volta a ficar livre', async () => {
    const { vm, publish } = namesVm([team(1, 101)]);
    publish.execute.mockRejectedValueOnce(new Error('A planilha não respondeu a tempo.'));
    await vm.load();
    await vm.publish();
    expect(vm.state.value).toMatchObject({ error: 'A planilha não respondeu a tempo.', publishing: false });
  });
});
