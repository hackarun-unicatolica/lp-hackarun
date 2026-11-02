// @vitest-environment node
// regulamento novo: inscrição individual e equipes por sorteio. A seção de equipes da LP explica o sorteio (sem a
// vitrine ao vivo, que volta com a /equipes), e nenhum link do site leva pra /equipes enquanto ela está escondida
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RegistrationDTO } from '@application/index';
import { TEAM_DRAW, teamDrawSteps, teamSizeLabel } from '@presentation/formatters/TeamDrawCopy';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

const registration = (capacity: number | null, teamSize = { min: 4, max: 5 }) =>
  ({
    slots: { capacity, taken: 0, remaining: capacity, level: capacity ? 'plenty' : 'unknown' },
    teamSize,
  }) as Pick<RegistrationDTO, 'slots' | 'teamSize'>;

describe('etapas do sorteio (TeamDrawCopy)', () => {
  it('três etapas na ordem: inscrição, credenciamento e sorteio, equipes', () => {
    const steps = teamDrawSteps(registration(75));
    expect(steps.map((s) => s.title)).toEqual([
      'Inscrição individual',
      'Credenciamento e sorteio',
      'Equipes de 4 pessoas, até 5',
    ]);
  });

  it('período, data, horário e local do regulamento (itens 2.2 e 3.1)', () => {
    expect(TEAM_DRAW).toEqual({
      registrationPeriod: '19/10 a 08/11',
      date: '12/11',
      time: '19h15 às 19h35',
      place: 'UniCatólica, Bloco II',
    });
    const [signup, draw] = teamDrawSteps(registration(75));
    expect(signup?.text).toContain('De 19/10 a 08/11, só pelo site oficial');
    expect(draw?.text).toContain('Em 12/11, das 19h15 às 19h35, na UniCatólica, Bloco II');
    expect(draw?.text).toContain('presente e credenciado');
  });

  it('as vagas saem do event.json; sem capacidade definida, o texto não inventa número', () => {
    expect(teamDrawSteps(registration(75))[0]?.text).toContain('Por enquanto, são 75 vagas.');
    expect(teamDrawSteps(registration(120))[0]?.text).toContain('120 vagas');
    expect(teamDrawSteps(registration(null))[0]?.text).not.toMatch(/vagas|null/);
  });

  it('tamanho das equipes segue o teamSize (de preferência o mínimo, até o máximo)', () => {
    expect(teamDrawSteps(registration(75))[2]?.text).toBe(
      'As equipes têm de preferência 4 pessoas, no máximo 5. Cada equipe escolhe um representante.',
    );
    expect(teamSizeLabel({ min: 3, max: 4 })).toBe('3 pessoas, até 4');
    // mínimo igual ao máximo: um número só, sem "até"
    expect(teamSizeLabel({ min: 5, max: 5 })).toBe('5 pessoas');
    expect(teamDrawSteps(registration(75, { min: 5, max: 5 }))[2]?.text).not.toContain('preferência');
  });
});

describe('seção de equipes da LP', () => {
  const section = read('presentation/sections/TeamsSection.astro');
  const draw = read('presentation/sections/teams/TeamDraw.astro');

  it('mantém os ganchos da cena 3D e do scroll (id, cena, checkpoint, título)', () => {
    expect(section).toContain('id="equipes"');
    expect(section).toContain('data-scene="dust"');
    expect(section).toContain('data-checkpoint="Equipes"');
    expect(section).toContain('aria-labelledby="equipes-title"');
  });

  it('explica o sorteio, sem a vitrine ao vivo nem link pra /equipes', () => {
    expect(section).toContain('<TeamDraw registration={registration} />');
    expect(section).toContain('A inscrição não garante vaga numa equipe.');
    for (const source of [section, draw]) {
      expect(source).not.toContain('data-teams');
      expect(source).not.toMatch(/href=["'{`]+\/equipes/);
    }
  });

  it('o CTA vai pra /inscricao com a origem "teams" e some com a inscrição encerrada', () => {
    expect(draw).toContain("copy.cta(registration.status, 'teams')");
    expect(draw).toContain('{cta.isRegistration && (');
    expect(draw).toContain('registrationCta="teams"');
  });

  it('avisa quem tem menos de 18 anos e leva pro modelo de autorização', () => {
    expect(draw).toContain('Menor de 18 anos?');
    expect(draw).toMatch(/item\s+2\.5 do regulamento/);
    expect(draw).toContain('href={AUTHORIZATION_PATH}');
  });
});

describe('/equipes escondida: nenhum link do site leva pra lá', () => {
  // só a própria página e o código das equipes (que volta depois do sorteio) podem citar o endereço
  const ALLOWED = [
    'pages/equipes.astro',
    'presentation/components/teams/',
    'presentation/sections/TeamsDirectorySection.astro',
    'presentation/components/seo/teamsPageSeo.ts',
    // telas do sorteio (só a organização, com login): depois de publicar, o link leva à página pública
    'presentation/views/draw/',
    'presentation/draw/',
    'pages/sorteio/',
  ];
  const LINK = /(href=["'{`]+\/equipes\b|href\s*=\s*['"`]\/equipes\b|['"`]\/equipes['"`])/;

  const files = ['pages', 'presentation']
    .flatMap((dir) =>
      readdirSync(join(SRC, dir), { recursive: true, encoding: 'utf8' }).map((file) =>
        `${dir}/${file}`.split(/[\\/]/).join('/'),
      ),
    )
    .filter((file) => /\.(astro|ts)$/.test(file));

  it('a busca enxerga páginas, layout e seções', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'pages/404.astro',
        'presentation/components/layout/navLinks.ts',
        'presentation/sections/registration/ChargeCta.astro',
      ]),
    );
  });

  it('só a página e o código das equipes citam /equipes como link (fora o PAGE_PATHS do header)', () => {
    const offenders = files
      .filter((file) => !ALLOWED.some((allowed) => file.startsWith(allowed)))
      .filter((file) => {
        const source = read(file)
          .split('\n')
          .filter((line) => !line.trim().startsWith('//') && !line.includes("teams: '/equipes'"))
          .join('\n');
        return LINK.test(source);
      });
    expect(offenders).toEqual([]);
  });
});
