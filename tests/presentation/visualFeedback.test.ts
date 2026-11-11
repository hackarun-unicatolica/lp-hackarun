// ajustes de revisão visual: o seletor da inscrição sem trilho quadrado, o regulamento em destaque (na inscrição
// e no painel da LP), o título do painel sem a expressão antiga, o botão do sorteio levando à pergunta aberta, as
// abas e o "Detalhes" com cara de clicável
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

describe('seletor da inscrição', () => {
  it('o trilho retangular só aparece com mais de uma aba (uma aba só virava um quadrado fantasma)', () => {
    const subnav = read('presentation/components/layout/SubNav.astro');
    expect(subnav).toMatch(/\.subnav__switch:has\(li \+ li\) \{[^}]*padding: 3px/);
    const base = subnav.slice(
      subnav.indexOf('.subnav__switch {'),
      subnav.indexOf('}', subnav.indexOf('.subnav__switch {')),
    );
    expect(base).not.toMatch(/background|box-shadow|padding/);
  });
});

describe('página de inscrição', () => {
  it('o regulamento tem um cartão de download logo abaixo do título', () => {
    const page = read('presentation/sections/RegistrationPageSection.astro');
    expect(page).toContain('<RegulationLink');
    // com as inscrições encerradas o cartão não pede mais para se inscrever
    expect(page).toContain("title: 'Leia o regulamento do hackathon'");
    const link = read('presentation/components/registration/RegulationLink.astro');
    expect(link).toContain('download={REGULATION_PDF.fileName}');
    expect(link).toContain('Leia o regulamento antes de se inscrever');
  });

  it('o painel não usa mais "ter em mãos"', () => {
    for (const file of [
      'presentation/components/registration/PrepChecklist.astro',
      'presentation/sections/registration/RegistrationBriefToggle.astro',
    ]) {
      expect(read(file)).toContain('Antes de se inscrever');
      expect(read(file)).not.toMatch(/precisa ter em mãos|O que ter em mãos|Tenha em mãos/);
    }
  });
});

describe('botão "Como as equipes são formadas"', () => {
  it('leva à pergunta do FAQ, que o AnchorNavigator abre', () => {
    expect(read('presentation/sections/registration/ChargeCta.astro')).toContain('href="#faq-teams"');
    expect(read('presentation/sections/faq/FaqEntry.astro')).toContain('id={`faq-${item.id}`}');
    expect(read('presentation/motion/core/AnchorNavigator.ts')).toContain(
      'section instanceof HTMLDetailsElement',
    );
  });
});

describe('programação', () => {
  it('o rótulo comprido da aba ("Desenvolvimento") cabe na coluna estreita e nunca passa da borda inclinada', () => {
    const tabs = read('presentation/sections/schedule/DayTabs.astro');
    expect(tabs).toMatch(/\.day-tab__label \{[^}]*overflow-wrap: anywhere/);
    expect(tabs).toMatch(
      /@media \(min-width: 1024px\) and \(max-width: 1279px\) \{[\s\S]*letter-spacing: 0\.06em/,
    );
  });

  it('os painéis ficam dentro de um palco que o controlador segura na troca de dia', () => {
    const section = read('presentation/sections/ScheduleSection.astro');
    expect(section).toMatch(/data-day-stage[\s\S]*days__panels/);
    expect(read('presentation/controllers/DayTabsController.ts')).toContain("'[data-day-stage]'");
  });

  it('"Detalhes" tem contorno e fundo de botão', () => {
    const more = read('presentation/sections/schedule/ActivityMore.astro');
    expect(more).toMatch(/\.more__summary \{[^}]*border: 1px solid/);
    expect(more).toMatch(/\.more__summary \{[^}]*background:/);
  });
});

describe('regulamento e missões', () => {
  it('o painel do regulamento mostra só a pontuação: nada de bônus de missão-surpresa nem de finalistas', () => {
    const panel = read('presentation/sections/missions/RulebookPanel.astro');
    expect(panel).toContain('SCORING_WEIGHTS.map');
    expect(panel).not.toMatch(/\+\s?1 ponto|surpresa|Finalistas/i);
  });

  it('o PDF do regulamento é o cartão de download da inscrição, não um link de texto solto', () => {
    const panel = read('presentation/sections/missions/RulebookPanel.astro');
    expect(panel).toContain('<RegulationLink title="Confira o regulamento completo" />');
    expect(panel).not.toContain('rulebook__doc');
  });

  it('só o tópico da pontuação tem medidor; os outros ganham um fio divisor, sem trilho vazio', () => {
    const panel = read('presentation/sections/missions/RulebookPanel.astro');
    expect(panel).not.toContain('rule__track');
    expect(panel.match(/weights: true/g)).toHaveLength(1);
    expect(panel).toMatch(/\.rule \+ \.rule \{[^}]*border-top: 1px solid/);
  });

  it('o desempate final termina no pitch presencial, como no item 9.11 do regulamento', () => {
    const panel = read('presentation/sections/missions/RulebookPanel.astro');
    expect(panel).toContain('missões e evidências e pitch presencial');
  });

  it('o "Descrição" das missões tem a mesma cara de botão do "Detalhes"', () => {
    const more = read('presentation/sections/npc/QuestMore.astro');
    expect(more).toMatch(/\.more__summary \{[^}]*border: 1px solid/);
    expect(more).toMatch(/\.more__summary \{[^}]*background:/);
  });
});
