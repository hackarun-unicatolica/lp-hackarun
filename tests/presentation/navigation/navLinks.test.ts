// links entre a LP e /inscricao (a /equipes fica escondida até o sorteio): a SubNav das páginas leves, o CTA do
// header (atual na própria página), o rodapé e a origem de cada CTA (coluna "Origem" da planilha)
import { describe, expect, it } from 'vitest';
import {
  EVENT_RETURN_HREF,
  footerLinksFor,
  headerCtaAttrs,
  headerCtaLink,
  navLinksFor,
  subNavLinksFor,
  type SitePage,
} from '@presentation/components/layout/navLinks';
import { RegistrationCopy } from '@presentation/formatters/RegistrationCopy';
import {
  DIRECT_SOURCE,
  REGISTRATION_ORIGINS,
  registrationHref,
  sourceFromSearch,
} from '@presentation/view-models/registration/registrationOrigin';

describe('origem do CTA de inscrição', () => {
  it('cada CTA leva pra /inscricao com a origem; sem origem é o endereço limpo', () => {
    expect(registrationHref('hero')).toBe('/inscricao?origem=hero');
    expect(registrationHref()).toBe('/inscricao');
  });

  it.each([
    ['?origem=hero', 'hero'],
    ['?origem=FINAL', 'final'],
    ['?quality=high&origem=faq', 'faq'],
    ['?origem=404', '404'],
    ['', DIRECT_SOURCE],
    ['?origem=', DIRECT_SOURCE],
    ['?origem=instagram', DIRECT_SOURCE],
    ['?origem=%3Cscript%3E', DIRECT_SOURCE],
  ])('%s → %s', (search, source) => {
    expect(sourceFromSearch(search)).toBe(source);
  });

  it('toda origem da lista cabe no limite da coluna Origem do Apps Script (40)', () => {
    for (const origin of REGISTRATION_ORIGINS) {
      expect(origin.length).toBeLessThanOrEqual(40);
      expect(sourceFromSearch(`?origem=${origin}`)).toBe(origin);
    }
  });

  it('CTAs da LP: inscrição aberta ou em breve vai pra /inscricao; encerrada, vira "Ver equipes"', () => {
    const copy = new RegistrationCopy();
    expect(copy.cta('open', 'hero').href).toBe('/inscricao?origem=hero');
    expect(copy.cta('soon', 'about').href).toBe('/inscricao?origem=about');
    expect(copy.cta('closing', 'menu').href).toBe('/inscricao?origem=menu');
    // encerrada não marca origem (não é inscrição) e leva pra lista de equipes, já no ar depois do sorteio
    expect(copy.cta('closed', 'hero')).toEqual({
      label: 'Ver equipes',
      href: '/equipes',
      isRegistration: false,
    });
  });

  it('rótulos falam de inscrição individual, nunca de inscrever equipe', () => {
    const copy = new RegistrationCopy();
    expect(copy.actionLabel('soon')).toBe('Quero participar');
    expect(copy.actionLabel('open')).toBe('Fazer minha inscrição');
    expect(copy.actionLabel('closing')).toBe('Fazer minha inscrição');
    expect(copy.actionLabel('closed')).toBe('Ver equipes');
    expect(copy.headerLabel('closed')).toBe('Ver equipes');
    // encerrada o botão é "Ver equipes" (navegação); a regra vale enquanto a inscrição está de pé
    const statuses = ['soon', 'open', 'closing'] as const;
    for (const status of statuses) {
      const labels = [copy.actionLabel(status), copy.headerLabel(status), copy.cta(status, 'hero').label];
      expect(labels.join(' ')).not.toMatch(/equipe/i);
    }
  });

  it('linha de status: individual e equipes do sorteio com o máximo do event.json', () => {
    const copy = new RegistrationCopy();
    const registration = {
      status: 'open' as const,
      endpoint: null,
      closesAt: null,
      slots: { capacity: 75, taken: 0, remaining: 75, level: 'plenty' as const },
      teamSize: { min: 4, max: 5 },
    };
    expect(copy.statusLine(registration).split(' · ')).toEqual([
      'Inscrições abertas',
      'Individual',
      'Equipes de até 5 por sorteio',
    ]);
    expect(copy.statusLine({ ...registration, teamSize: { min: 3, max: 4 } })).toContain('até 4');
    expect(copy.statusLine({ ...registration, status: 'closed' })).not.toContain('sorteio');
  });
});

describe('SubNav de /inscricao e /equipes', () => {
  it('em /inscricao, "Inscrição" é a página atual (endereço limpo) e não há aba de equipes', () => {
    expect(subNavLinksFor('registration')).toEqual([
      { href: '/inscricao', label: 'Inscrição', short: 'Inscrição', ariaCurrent: 'page' },
    ]);
  });

  it('em /equipes (escondida), só "Inscrição", com a origem subnav e sem link pra própria página', () => {
    const links = subNavLinksFor('teams');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: '/inscricao?origem=subnav', ariaCurrent: undefined });
    expect(links.some((l) => l.href.includes('/equipes'))).toBe(false);
  });

  it('rótulo curto do celular é o começo do nome acessível (WCAG 2.5.3)', () => {
    for (const link of subNavLinksFor('teams')) expect(link.label.startsWith(link.short)).toBe(true);
  });

  it('sem JS, "Voltar ao evento" leva pro fim da LP', () => {
    expect(EVENT_RETURN_HREF).toBe('/#inscricao');
  });
});

describe('header, menu e rodapé', () => {
  const open = new RegistrationCopy().cta('open', 'header');
  const closed = new RegistrationCopy().cta('closed', 'header');

  it('o CTA do header é a página atual em /inscricao (e só lá)', () => {
    expect(headerCtaLink(open, 'registration')).toEqual({ href: '/inscricao', ariaCurrent: 'page' });
    expect(headerCtaLink(open, 'home')).toEqual({ href: '/inscricao?origem=header', ariaCurrent: undefined });
    expect(headerCtaLink(open, 'teams')).toEqual({
      href: '/inscricao?origem=header',
      ariaCurrent: undefined,
    });
  });

  it('inscrições encerradas: o CTA leva pra /equipes, atual só lá', () => {
    expect(headerCtaLink(closed, 'home')).toEqual({ href: '/equipes', ariaCurrent: undefined });
    expect(headerCtaLink(closed, 'registration')).toEqual({ href: '/equipes', ariaCurrent: undefined });
    expect(headerCtaLink(closed, 'teams')).toEqual({ href: '/equipes', ariaCurrent: 'page' });
  });

  it('na página atual o botão perde o preenchimento e não marca origem', () => {
    expect(headerCtaAttrs(open, 'registration', 'header')).toMatchObject({
      'aria-current': 'page',
      variant: 'ghost',
    });
    expect(headerCtaAttrs(open, 'home', 'header')).toMatchObject({
      variant: 'primary',
      registrationCta: 'header',
    });
    expect(headerCtaAttrs(closed, 'home', 'header').registrationCta).toBeUndefined();
  });

  it('em /inscricao as seções voltam pra LP e nenhum link de seção é o atual', () => {
    const links = navLinksFor('registration');
    expect(links.find((l) => l.label === 'FAQ')?.href).toBe('/#faq');
    expect(links.every((l) => l.ariaCurrent === undefined)).toBe(true);
  });

  it.each<SitePage>(['home', 'teams', 'registration', 'authorization'])(
    'em %s, nenhum link do header, menu ou rodapé leva pra /equipes',
    (page) => {
      const hrefs = [...navLinksFor(page), ...footerLinksFor(page)].map((l) => l.href);
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.filter((href) => href.includes('/equipes'))).toEqual([]);
      expect(navLinksFor(page).every((l) => l.spy === undefined)).toBe(true);
    },
  );

  it('em /autorizacao as seções voltam pra LP e nada é a página atual (ela fica fora do menu)', () => {
    const links = footerLinksFor('authorization');
    expect(links.find((l) => l.label === 'Sobre')?.href).toBe('/#sobre');
    expect(links.every((l) => l.ariaCurrent === undefined)).toBe(true);
    expect(links.some((l) => l.href.includes('/autorizacao'))).toBe(false);
    expect(headerCtaLink(open, 'authorization')).toEqual({
      href: '/inscricao?origem=header',
      ariaCurrent: undefined,
    });
  });

  it('o rodapé ganha "Inscrição" (atual na própria página, com a origem nas outras)', () => {
    expect(footerLinksFor('home').at(-2)).toMatchObject({
      label: 'Inscrição',
      href: '/inscricao?origem=footer',
    });
    expect(footerLinksFor('registration').at(-2)).toMatchObject({ href: '/inscricao', ariaCurrent: 'page' });
  });

  it('o rodapé fecha com "Seja mentor" (atual na própria página, com a origem nas outras)', () => {
    expect(footerLinksFor('home').at(-1)).toMatchObject({
      label: 'Seja mentor',
      href: '/seja-mentor?origem=footer',
      ariaCurrent: undefined,
    });
    expect(footerLinksFor('mentor').at(-1)).toMatchObject({ href: '/seja-mentor', ariaCurrent: 'page' });
    expect(footerLinksFor('mentor').at(-2)).toMatchObject({ label: 'Inscrição', ariaCurrent: undefined });
  });

  it('a barra de baixo de /seja-mentor tem a inscrição e o cadastro de mentor (este é o atual)', () => {
    expect(subNavLinksFor('mentor').map((l) => [l.label, l.ariaCurrent])).toEqual([
      ['Inscrição', undefined],
      ['Mentor', 'page'],
    ]);
    // o SubNav divide o rótulo no rótulo curto: o completo tem que começar com ele
    for (const page of ['registration', 'teams', 'mentor'] as const) {
      for (const link of subNavLinksFor(page)) expect(link.label.startsWith(link.short)).toBe(true);
    }
    // nas outras páginas a barra segue só com a inscrição
    expect(subNavLinksFor('registration')).toHaveLength(1);
    expect(subNavLinksFor('teams')).toHaveLength(1);
  });
});
