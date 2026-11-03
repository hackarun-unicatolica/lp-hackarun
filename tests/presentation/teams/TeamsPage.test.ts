import { describe, expect, it } from 'vitest';
import {
  confirmedLabel,
  memberCountLabel,
  teamImageAlt,
  teamInitials,
} from '@presentation/formatters/TeamLabels';
import { NAV_LINKS, navLinksFor, pageHref, topHref } from '@presentation/components/layout/navLinks';
import { TEAMS_PAGE, teamsPageJsonLd } from '@presentation/components/seo/teamsPageSeo';
import { RegistrationCopy } from '@presentation/formatters/RegistrationCopy';
import { pickFaces, type PublicTeam } from '@presentation/view-models/teams/TeamsViewModel';

describe('textos do card de equipe', () => {
  it.each([
    ['Bug Busters', 'BB'],
    ['café com código', 'CC'],
    ['404', '40'],
    ['Ágil', 'AG'],
    ['  ', '?'],
  ])('iniciais de "%s" = %s', (name, initials) => {
    expect(teamInitials(name)).toBe(initials);
  });

  it('alt e quantidade no padrão da página', () => {
    expect(teamImageAlt('Bug Busters')).toBe('Foto ou logo da equipe Bug Busters');
    expect([memberCountLabel(1), memberCountLabel(4)]).toEqual(['1 integrante', '4 integrantes']);
    expect([confirmedLabel(1), confirmedLabel(0)]).toEqual(['equipe confirmada', 'equipes confirmadas']);
  });

  it('vitrine prioriza quem tem foto e respeita o limite', () => {
    const t = (id: string, imageUrl: string | null): PublicTeam => ({
      id,
      name: id,
      memberCount: 2,
      imageUrl,
      mascot: null,
      members: [],
    });
    const picked = pickFaces([t('a', null), t('b', 'https://x'), t('c', null)], 2);
    expect(picked.map((x) => x.id)).toEqual(['b', 'a']);
    expect(pickFaces([t('a', null)], 0)).toEqual([]);
  });
});

describe('/equipes escondida até o sorteio', () => {
  it('o menu não tem "Equipes" nem link de página: só âncoras da LP', () => {
    expect(NAV_LINKS.find((l) => l.label === 'Equipes')).toBeUndefined();
    expect(NAV_LINKS.every((l) => l.href.startsWith('#'))).toBe(true);
  });

  it('na LP nada é página atual, as âncoras continuam #secao e nenhum link usa o nav spy', () => {
    const links = navLinksFor('home');
    expect(links.every((l) => l.ariaCurrent === undefined)).toBe(true);
    expect(links.find((l) => l.label === 'Sobre')?.href).toBe('#sobre');
    expect(topHref('home')).toBe('#inicio');
    expect(links.filter((l) => l.spy)).toEqual([]);
  });

  it('a página continua no ar: em /equipes as âncoras voltam pra LP e nada fica aria-current', () => {
    const links = navLinksFor('teams');
    expect(links.find((l) => l.label === 'Sobre')?.href).toBe('/#sobre');
    expect(links.filter((l) => l.ariaCurrent === 'page')).toEqual([]);
    expect(pageHref('#inscricao', 'teams')).toBe('/#inscricao');
    expect(pageHref('/equipes', 'teams')).toBe('/equipes');
    expect(topHref('teams')).toBe('#conteudo');
  });

  it('inscrição encerrada: o CTA não leva pra página de equipes', () => {
    expect(new RegistrationCopy().cta('closed', 'teams')).toMatchObject({
      href: '/inscricao',
      isRegistration: false,
    });
  });
});

describe('SEO da página /equipes', () => {
  it('fica fora dos buscadores (noindex) e não fala mais em "exclusivo" nem em foto', () => {
    expect(TEAMS_PAGE.noindex).toBe(true);
    expect(TEAMS_PAGE.description).not.toMatch(/exclusiv|foto/i);
    expect(TEAMS_PAGE.description).toContain('sorteio');
  });

  it('título e descrição no tamanho que a busca mostra inteiro', () => {
    expect(TEAMS_PAGE.path).toBe('/equipes');
    expect(TEAMS_PAGE.title.length).toBeLessThanOrEqual(60);
    expect(TEAMS_PAGE.description.length).toBeGreaterThanOrEqual(70);
    expect(TEAMS_PAGE.description.length).toBeLessThanOrEqual(160);
  });

  it('JSON-LD com a trilha Início > Equipes e URLs absolutas', () => {
    const graph = teamsPageJsonLd('https://hackarun.pages.dev/')['@graph'] as Record<string, unknown>[];
    expect(graph[0]).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://hackarun.pages.dev/equipes',
    });
    expect(JSON.stringify(graph[1])).toContain('"item":"https://hackarun.pages.dev/"');
  });
});
