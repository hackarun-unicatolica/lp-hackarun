import { beforeEach, describe, expect, it } from 'vitest';
import { ListTeams, type SlotsDTO } from '@application/index';
import { Team } from '@domain/index';
import { TeamsViewModel, type PublicTeam } from '@presentation/view-models/teams/TeamsViewModel';
import { TeamsView } from '@presentation/views/TeamsView';
import { teamName } from '../../helpers/fixtures';

const SLOTS: SlotsDTO = { capacity: null, taken: 0, remaining: null, level: 'unknown' };
const PHOTO = 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_-012=w600';

// o mínimo do TeamCard.astro (+ TeamCardFrame) que o TeamCardRenderer preenche
const card = `<li class="team-card" data-team-card>
  <div data-team-frame><span data-team-initials></span></div>
  <h2 data-team-name></h2><span data-team-pips></span><span data-team-count></span>
</li>`;

const gallery = (ssr = '') => `
  <div data-teams>
    <span data-teams-count></span><span data-teams-count-label></span>
    <div data-teams-search-wrap hidden><input data-teams-search /></div>
    <ol data-teams-list>${ssr}</ol>
    <div data-teams-empty></div>
    <template data-teams-template>${card}</template>
  </div>`;

const teaser = `
  <div data-teams>
    <span data-teams-count></span>
    <ol data-teams-faces hidden></ol><span data-teams-more hidden></span>
    <span data-teams-empty></span>
    <template data-teams-face-template><li data-team-card><span data-team-frame><span data-team-initials></span></span></li></template>
  </div>`;

const team = (id: string, name: string, imageUrl: string | null = null) =>
  Team.create({
    id,
    name: teamName(name),
    memberCount: 3,
    status: 'confirmed',
    imageUrl,
  });

function mount(html: string, live: Team[], initial: PublicTeam[] = []) {
  document.body.innerHTML = html;
  const root = document.querySelector<HTMLElement>('[data-teams]') as HTMLElement;
  const vm = new TeamsViewModel({
    initial,
    slots: SLOTS,
    listTeams: new ListTeams({ list: async () => live }),
  });
  new TeamsView(root, vm).mount();
  return { root, vm };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('TeamsView · página /equipes', () => {
  it('lista ao vivo vira cards com foto (lazy, com tamanho e alt) ou com as iniciais', async () => {
    const { root, vm } = mount(gallery(), [team('a', 'Bug Busters', PHOTO), team('b', 'Café com Código')]);
    await vm.refresh();
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-team-card]'));
    expect(cards.map((c) => c.querySelector('[data-team-name]')?.textContent)).toEqual([
      'Bug Busters',
      'Café com Código',
    ]);
    const img = cards[0]?.querySelector<HTMLImageElement>('img[data-team-img]');
    expect(img?.getAttribute('src')).toBe(PHOTO);
    expect(img?.alt).toBe('Foto ou logo da equipe Bug Busters');
    expect([img?.loading, img?.decoding, img?.width, img?.height]).toEqual(['lazy', 'async', 600, 600]);
    // cópia borrada de fundo é decorativa
    expect(cards[0]?.querySelector('.team-card__backdrop')?.getAttribute('aria-hidden')).toBe('true');
    expect(cards[1]?.classList.contains('is-image-missing')).toBe(true);
    expect(cards[1]?.querySelector('img')).toBeNull();
    expect(cards[1]?.querySelector('[data-team-initials]')?.textContent).toBe('CC');
    expect(root.querySelector('[data-teams-count-label]')?.textContent).toBe('equipes confirmadas');
  });

  it('foto que não carrega troca pelas iniciais', async () => {
    const { root, vm } = mount(gallery(), [team('a', 'Bug Busters', PHOTO)]);
    await vm.refresh();
    const first = root.querySelector<HTMLElement>('[data-team-card]');
    first?.querySelector('img[data-team-img]')?.dispatchEvent(new Event('error'));
    expect(first?.classList.contains('is-image-missing')).toBe(true);
  });

  it('cards do build (sem JS) também caem nas iniciais se a foto falhar', () => {
    const ssr = `<li class="team-card" data-team-card><div data-team-frame>
      <img data-team-img src="${PHOTO}" alt="Foto ou logo da equipe X" /></div></li>`;
    const { root } = mount(gallery(ssr), []);
    const first = root.querySelector<HTMLElement>('[data-team-card]');
    first?.querySelector('img')?.dispatchEvent(new Event('error'));
    expect(first?.classList.contains('is-image-missing')).toBe(true);
  });

  it('busca refaz a lista sem perder a foto: o card nasce no documento da página, não no do <template>', async () => {
    const { root, vm } = mount(gallery(), [
      team('a', 'Bug Busters', PHOTO),
      team('b', 'Cerrado Devs', PHOTO),
    ]);
    await vm.refresh();
    const input = root.querySelector<HTMLInputElement>('[data-teams-search]') as HTMLInputElement;
    input.value = 'cerrado';
    input.dispatchEvent(new Event('input'));
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-team-card]'));
    expect(cards.map((c) => c.querySelector('[data-team-name]')?.textContent)).toEqual(['Cerrado Devs']);
    expect(cards[0]?.ownerDocument).toBe(document);
    expect(cards[0]?.classList.contains('is-image-missing')).toBe(false);
    expect(cards[0]?.querySelector('img[data-team-img]')?.getAttribute('src')).toBe(PHOTO);
  });

  it('foto que carrega depois de um falso "sem foto" volta a aparecer', () => {
    const ssr = `<li class="team-card is-image-missing" data-team-card><div data-team-frame>
      <img data-team-img src="${PHOTO}" alt="Foto ou logo da equipe X" /></div></li>`;
    const { root } = mount(gallery(ssr), []);
    const first = root.querySelector<HTMLElement>('[data-team-card]');
    first?.querySelector('img')?.dispatchEvent(new Event('load'));
    expect(first?.classList.contains('is-image-missing')).toBe(false);
  });

  it('o número de equipes na raiz não usa o mesmo nome do contador da tela', async () => {
    const { root, vm } = mount(gallery(), [team('a', 'Bug Busters')]);
    await vm.refresh();
    expect(root.dataset['teamTotal']).toBe('1');
    expect(root.hasAttribute('data-teams-count')).toBe(false);
  });

  it('nome longo ganha hífen opcional nas sílabas (o card estreito não parte a palavra no meio)', async () => {
    const name = 'Os Desenvolvedores do Cerrado';
    const { root, vm } = mount(gallery(), [team('a', name)]);
    await vm.refresh();
    const text = root.querySelector('[data-team-name]')?.textContent ?? '';
    const soft = String.fromCharCode(0xad);
    expect(text.split(soft)).toEqual(['Os Desen', 'vol', 've', 'do', 'res do Cerrado']);
    expect(text.replaceAll(soft, '')).toBe(name);
  });

  it('nome vindo da planilha nunca vira HTML', async () => {
    const { root, vm } = mount(gallery(), [team('a', '<img src=x onerror=alert(1)>')]);
    await vm.refresh();
    expect(root.querySelector('[data-team-name]')?.innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('TeamsView · vitrine da LP', () => {
  it('sem equipes mostra as vagas fantasma', () => {
    const { root } = mount(teaser, []);
    expect(root.querySelector<HTMLElement>('[data-teams-faces]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-teams-empty]')?.hidden).toBe(false);
  });

  it('mostra até 5 rostos (com foto primeiro) e o "+N" do resto', async () => {
    const live = ['Alfa', 'Beta', 'Gama', 'Delta', 'Eta', 'Teta', 'Iota'].map((n, i) =>
      team(String(i), `${n} Squad`, i === 6 ? PHOTO : null),
    );
    const { root, vm } = mount(teaser, live);
    await vm.refresh();
    const faces = root.querySelectorAll('[data-teams-faces] [data-team-card]');
    expect(faces).toHaveLength(5);
    expect(faces[0]?.querySelector('img')?.getAttribute('src')).toBe(PHOTO);
    expect(root.querySelector('[data-teams-more]')?.textContent).toBe('+2');
    expect(root.querySelector<HTMLElement>('[data-teams-empty]')?.hidden).toBe(true);
    expect(root.querySelector('[data-teams-count]')?.textContent).toBe('7');
  });

  it('a nova busca da lista (a cada minuto) refaz os rostos sem trocar as fotos pelas iniciais', async () => {
    const live = [team('a', 'Bug Busters', PHOTO), team('b', 'Cerrado Devs', PHOTO)];
    const { root, vm } = mount(teaser, live);
    await vm.refresh();
    live.push(team('c', 'Neural Ninjas', PHOTO));
    await vm.refresh();
    const faces = Array.from(root.querySelectorAll<HTMLElement>('[data-teams-faces] [data-team-card]'));
    expect(faces).toHaveLength(3);
    expect(faces.every((f) => f.ownerDocument === document)).toBe(true);
    expect(faces.some((f) => f.classList.contains('is-image-missing'))).toBe(false);
  });
});

// página /equipes com os blocos de carregando / erro / vazio (TeamGallery.astro)
const page = `
  <div data-teams>
    <div data-teams-bar hidden><span data-teams-count></span><span data-teams-count-label></span></div>
    <div data-teams-search-wrap hidden><input data-teams-search /></div>
    <ol data-teams-list hidden></ol>
    <div data-teams-loading></div>
    <div data-teams-error hidden><button data-teams-retry>Tentar de novo</button></div>
    <div data-teams-empty hidden></div>
    <template data-teams-template>${card}</template>
  </div>`;

const shown = (root: HTMLElement, sel: string) => root.querySelector<HTMLElement>(sel)?.hidden === false;

describe('TeamsView · carregando, erro e vazio na página /equipes', () => {
  it('enquanto a lista ao vivo não chega: "Carregando", sem contador em 0 nem "nenhuma equipe"', () => {
    const { root } = mount(page, []);
    expect(shown(root, '[data-teams-loading]')).toBe(true);
    expect(shown(root, '[data-teams-empty]')).toBe(false);
    expect(shown(root, '[data-teams-bar]')).toBe(false);
  });

  it('na página de equipes a busca começa na hora, sem esperar a lista chegar perto da tela', async () => {
    const { root } = mount(page, [team('a', 'Equipe Charizard')]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.querySelectorAll('[data-team-card]')).toHaveLength(1);
    expect(shown(root, '[data-teams-loading]')).toBe(false);
  });

  it('chegou vazia: some o carregando e aparece o aviso de que as equipes vêm depois do sorteio', async () => {
    const { root, vm } = mount(page, []);
    await vm.refresh();
    expect(shown(root, '[data-teams-loading]')).toBe(false);
    expect(shown(root, '[data-teams-empty]')).toBe(true);
    expect(shown(root, '[data-teams-error]')).toBe(false);
  });

  it('chegou com equipes: grade e contador aparecem', async () => {
    const { root, vm } = mount(page, [team('a', 'Equipe Charizard')]);
    await vm.refresh();
    expect(shown(root, '[data-teams-list]')).toBe(true);
    expect(shown(root, '[data-teams-bar]')).toBe(true);
    expect(shown(root, '[data-teams-loading]')).toBe(false);
  });

  it('planilha fora do ar: aviso com "Tentar de novo", que busca de novo e mostra as equipes', async () => {
    document.body.innerHTML = page;
    const root = document.querySelector<HTMLElement>('[data-teams]') as HTMLElement;
    let fail = true;
    const vm = new TeamsViewModel({
      initial: [],
      slots: SLOTS,
      listTeams: new ListTeams({
        list: async () => {
          if (fail) throw new Error('offline');
          return [team('a', 'Equipe Charizard')];
        },
      }),
    });
    new TeamsView(root, vm).mount();
    await vm.refresh();
    expect(shown(root, '[data-teams-error]')).toBe(true);
    expect(shown(root, '[data-teams-loading]')).toBe(false);
    fail = false;
    root.querySelector<HTMLButtonElement>('[data-teams-retry]')?.click();
    await vm.refresh();
    expect(shown(root, '[data-teams-error]')).toBe(false);
    expect(root.querySelectorAll('[data-team-card]')).toHaveLength(1);
  });
});
