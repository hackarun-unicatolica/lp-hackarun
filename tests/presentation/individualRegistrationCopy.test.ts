// @vitest-environment node
// textos fora do formulário com as regras novas: FAQ (quem participa, inscrição, sorteio, menores), aviso de
// privacidade v4, regulamento em PDF só pra baixar e o modelo de autorização do responsável (/autorizacao)
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import faqData from '@infrastructure/content/faq.json';
import type { RawFaqItem } from '@infrastructure/content/schema';
import { CONSENT_VERSION } from '@application/index';
import { REGULATION_PDF, regulationLinkLabel } from '@presentation/components/layout/documents';
import { NAV_LINKS, footerLinksFor } from '@presentation/components/layout/navLinks';
import { faqLinks } from '@presentation/sections/faq/faqLinks';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const faq = faqData as RawFaqItem[];
const answer = (id: string) => faq.find((f) => f.id === id)?.answer ?? '';

describe('FAQ com as regras do regulamento', () => {
  it('ninguém mais lê que o hackathon é exclusivo para alunos da UniCatólica', () => {
    expect(JSON.stringify(faq)).not.toMatch(/exclusivo para alunos|uma pessoa inscreve a equipe/i);
  });

  it('quem participa: estudantes de outras instituições, profissionais e entusiastas (item 2.1)', () => {
    for (const id of ['who', 'what']) {
      expect(answer(id)).toContain('outras instituições');
      expect(answer(id)).toMatch(/profissionais/);
      expect(answer(id)).toMatch(/entusiastas/);
    }
  });

  it('inscrições encerradas: foram de 19/10 a 08/11 e o sorteio é só com quem estiver presente', () => {
    const signup = answer('signup');
    expect(signup).toContain('19/10 a 08/11');
    expect(signup).toContain('encerradas');
    expect(signup).not.toMatch(/\d+\s+vagas/);
    expect(signup).toContain('presente e credenciado');
  });

  it('formação das equipes: sorteio presencial em 12/11, 19h15 às 19h35, 4 de preferência, até 5', () => {
    const teams = answer('teams');
    expect(teams).toContain('sorteio presencial');
    expect(teams).toContain('12/11, das 19h15 às 19h35');
    expect(teams).toContain('Bloco II');
    expect(teams).toMatch(/de preferência, 4 pessoas, e no máximo 5/);
    expect(teams).toContain('representante');
  });

  it('menores de 18 anos levam a autorização do responsável (item 2.5)', () => {
    expect(answer('minors')).toContain('item 2.5 do regulamento');
    expect(answer('minors')).toContain('credenciamento');
  });

  it('avisos oficiais por e-mail e WhatsApp (o WhatsApp entrou na inscrição)', () => {
    expect(answer('contact')).toContain('e-mail');
    expect(answer('contact')).toContain('WhatsApp');
  });

  it('ids únicos e as perguntas novas no grupo de inscrição, depois de "Como faço a inscrição?"', () => {
    const ids = faq.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const signupGroup = faq.filter((f) => f.category === 'Inscrição').map((f) => f.id);
    expect(signupGroup).toEqual(['signup', 'teams', 'minors', 'contact']);
  });
});

describe('atalhos no fim das respostas do FAQ', () => {
  it('inscrição aberta: a pergunta da inscrição leva pra /inscricao com a origem faq', () => {
    expect(faqLinks('open')['signup']).toEqual({
      href: '/inscricao?origem=faq',
      label: 'Ir para a página de inscrição',
    });
  });

  it('inscrição encerrada: sem atalho pra inscrição, o resto continua', () => {
    const links = faqLinks('closed');
    expect(links['signup']).toBeUndefined();
    expect(links['rulebook']).toBeDefined();
    expect(links['minors']).toBeDefined();
  });

  it('o regulamento só baixa (download) e o rótulo traz o tamanho', () => {
    expect(faqLinks('soon')['rulebook']).toEqual({
      href: '/regulamento-hackarun-2026.pdf',
      label: 'Baixar o regulamento (PDF), 196 KB',
      download: 'regulamento-hackarun-2026.pdf',
    });
  });

  it('menores: atalho pro modelo de autorização', () => {
    expect(faqLinks('open')['minors']?.href).toBe('/autorizacao');
  });

  it('o FaqEntry passa o download pro <a>', () => {
    expect(read('src/presentation/sections/faq/FaqEntry.astro')).toContain('download={link.download}');
  });
});

describe('regulamento em PDF (só download)', () => {
  it('o arquivo existe em public/ e o tamanho do rótulo bate com o arquivo', () => {
    const bytes = statSync(join(ROOT, 'public', REGULATION_PDF.fileName)).size;
    expect(REGULATION_PDF.href).toBe(`/${REGULATION_PDF.fileName}`);
    expect(REGULATION_PDF.size).toBe(`${Math.round(bytes / 1024)} KB`);
    expect(regulationLinkLabel()).toBe(`Baixar o regulamento (PDF), ${REGULATION_PDF.size}`);
  });

  it('o rodapé oferece o download com o atributo download e o tamanho', () => {
    const footer = read('src/presentation/components/layout/footer/FooterNav.astro');
    expect(footer).toContain('href={REGULATION_PDF.href}');
    expect(footer).toContain('download={REGULATION_PDF.fileName}');
    expect(footer).toContain('{REGULATION_PDF.size}');
  });

  it('a Cloudflare manda o PDF como anexo (não abre dentro do site)', () => {
    const headers = read('public/_headers');
    expect(headers).toMatch(
      /\/regulamento-hackarun-2026\.pdf\n {2}Content-Disposition: attachment; filename="regulamento-hackarun-2026\.pdf"/,
    );
  });

  it('a seção de regulamento da LP não renderiza o PDF', () => {
    expect(read('src/presentation/sections/RulebookSection.astro')).not.toMatch(/<(iframe|embed|object)/);
  });
});

describe('aviso de privacidade v4 (inscrição individual)', () => {
  // texto corrido: a quebra de linha do prettier não conta
  const notice = read('src/presentation/components/privacy/PrivacyNotice.astro').replace(/\s+/g, ' ');
  const page = read('src/pages/privacidade.astro');

  it('versão v4, outubro de 2026', () => {
    expect(CONSENT_VERSION).toBe('2026-10-v5');
    expect(page).toContain('LGPD · versão {CONSENT_VERSION} · outubro de 2026');
  });

  it('lista os dados novos: WhatsApp, perfil, curso, período, instituição, matrícula, área e 18+', () => {
    for (const text of [
      'nome completo, e-mail e WhatsApp',
      'curso, período, instituição',
      'matrícula da UniCatólica',
      'área',
      'tem 18 anos ou mais',
    ]) {
      expect(notice).toContain(text);
    }
  });

  it('finalidades: organização, e-mail e WhatsApp, credenciamento, sorteio e avaliação', () => {
    expect(notice).toContain('Falar com você por e-mail e WhatsApp');
    expect(notice).toContain('sorteio e a formação das equipes');
    expect(notice).toMatch(/credenciamento/);
    expect(notice).toMatch(/avaliação/);
  });

  it('a página de equipes mostra nome da equipe, insígnia, número e nome dos integrantes, nunca contato', () => {
    expect(notice).toMatch(
      /o nome da equipe, a insígnia, o número de integrantes e o nome de cada integrante/,
    );
    expect(notice).toContain('E-mail, WhatsApp e matrícula nunca aparecem no site');
  });

  it('sem foto de equipe, sem "não usamos WhatsApp" e sem exclusividade', () => {
    expect(notice).not.toMatch(/foto ou logo|foto da equipe|Não usamos WhatsApp|exclusivo|Integrante 1/i);
    expect(notice).not.toContain('href="/equipes"');
  });
});

describe('modelo de autorização do responsável (/autorizacao)', () => {
  const page = read('src/pages/autorizacao.astro');
  const term = read('src/presentation/components/authorization/AuthorizationTerm.astro');
  const print = read('src/presentation/components/authorization/authorization-print.css');

  it('página leve, fora dos buscadores e fora do menu e do rodapé', () => {
    expect(page).toContain("import PageLayout from '@presentation/layouts/PageLayout.astro'");
    expect(page).toContain('noindex: true');
    expect(page).toContain('path: AUTHORIZATION_PATH');
    expect(NAV_LINKS.some((l) => l.href.includes('autorizacao'))).toBe(false);
    expect(footerLinksFor('home').some((l) => l.href.includes('autorizacao'))).toBe(false);
  });

  it('versão final: nenhum aviso de "pendente" ou "aguardando aprovação"', () => {
    expect(`${page}${term}`).not.toMatch(/pendente|aprova[çc][ãa]o|rascunho/i);
  });

  it('campos pra preencher à mão: participante, nascimento, responsável, CPF ou RG, parentesco, telefone', () => {
    for (const field of [
      'Nome completo do participante',
      'Data de nascimento',
      'Nome completo do responsável legal',
      'CPF ou RG do responsável',
      'Parentesco ou vínculo com o participante',
      'Telefone (WhatsApp) do responsável',
    ]) {
      expect(term).toContain(`'${field}'`);
    }
  });

  it('autoriza as atividades de 11 a 14/11 na UniCatólica (Bloco II) e a final no Capim Dourado', () => {
    expect(term).toContain('11 a 14 de novembro de 2026');
    expect(term).toContain('UniCatólica (Bloco II)');
    expect(term).toContain('Capim Dourado Shopping');
    expect(term).toContain('regulamento oficial');
    expect(term).toContain('Lei nº 13.709/2018');
    expect(term).toMatch(/imagem, voz/);
  });

  it('local, data e as duas assinaturas', () => {
    expect(term).toContain('Palmas – TO,');
    expect(term).toContain('Assinatura do responsável legal');
    expect(term).toContain('Assinatura do participante');
  });

  it('diz onde entregar: credenciamento de 12/11', () => {
    expect(page).toContain('credenciamento de {TEAM_DRAW.date}');
    expect(term).toContain('Entregar no credenciamento');
  });

  it('imprimir sem script inline: botão escondido que o JS liga + dica do Ctrl+P', () => {
    expect(page).toMatch(/<button type="button" class="auth__print" data-print hidden>/);
    expect(page).toContain('<kbd>Ctrl</kbd> + <kbd>P</kbd>');
    expect(page).not.toMatch(/<script|onclick/i);
    expect(read('src/presentation/app/LightApp.ts')).toContain(
      "boot.add('print', () => new PrintButtons().mount())",
    );
  });

  it('impressão: preto no branco, sem header, rodapé, fundo nem instruções', () => {
    expect(print).toContain('@media print');
    expect(print).toMatch(/body > :not\(main\) \{\s*display: none !important;/);
    expect(print).toMatch(/\.auth__intro,[\s\S]*display: none !important/);
    expect(print).toMatch(/background: #fff !important;\s*color: #000 !important;/);
  });
});
