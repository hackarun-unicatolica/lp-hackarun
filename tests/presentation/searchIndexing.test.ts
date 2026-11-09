// @vitest-environment node
// buscadores: o robots.txt gerado no build aponta o sitemap do endereço do site (PUBLIC_SITE_URL ou o oficial) e
// libera o rastreio; a prévia sai dos buscadores pelo noindex de cada página (Seo.astro), não por aqui
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { GET } from '../../src/pages/robots.txt';
import { UNLISTED_PATHS, isListedInSitemap } from '../../astro.config.mjs';

async function robots(site?: string): Promise<{ text: string; type: string | null }> {
  const context = { site: site ? new URL(site) : undefined } as unknown as APIContext;
  const response = await GET(context);
  return { text: await response.text(), type: response.headers.get('Content-Type') };
}

describe('robots.txt', () => {
  it('aponta o sitemap do endereço oficial e libera tudo', async () => {
    const { text, type } = await robots('https://hackarun.com.br');
    expect(text).toBe('User-agent: *\nAllow: /\n\nSitemap: https://hackarun.com.br/sitemap-index.xml\n');
    expect(type).toBe('text/plain; charset=utf-8');
  });

  it('segue o PUBLIC_SITE_URL (fork ou domínio próprio)', async () => {
    const { text } = await robots('https://meu-fork.pages.dev/');
    expect(text).toContain('Sitemap: https://meu-fork.pages.dev/sitemap-index.xml');
  });

  it('sem site no config cai no endereço oficial', async () => {
    const { text } = await robots();
    expect(text).toContain('Sitemap: https://hackarun.com.br/sitemap-index.xml');
  });
});

describe('meta robots do Seo.astro', () => {
  const seo = readFileSync(
    fileURLToPath(new URL('../../src/presentation/components/seo/Seo.astro', import.meta.url)),
    'utf8',
  );

  it('noindex quando o build não é indexável (prévia ou inscrição simulada) ou quando a página pede', () => {
    expect(seo).toContain('{(!indexable || noindex) && <meta name="robots" content="noindex" />}');
    expect(seo).toContain('noindex = false,');
    expect(seo).toMatch(/isIndexable\(\{\s*cfPages: import\.meta\.env\.CF_PAGES,/);
    expect(seo).toContain('branch: import.meta.env.CF_PAGES_BRANCH');
    expect(seo).toContain('simulationFlag: SIMULATION_FLAG');
  });

  it('o canonical cai no endereço oficial quando o config não tem site', () => {
    expect(seo).toContain('Astro.site ?? new URL(DEFAULT_SITE_URL)');
    expect(seo).not.toContain('lp-hackarun.pages.dev');
  });
});

describe('páginas escondidas: fora do sitemap e com noindex', () => {
  const SRC = new URL('../../src/', import.meta.url);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, SRC)), 'utf8');

  it('o sitemap deixa de fora /equipes (até o sorteio), /autorizacao e o sorteio, com ou sem barra no fim', () => {
    expect(UNLISTED_PATHS).toEqual(['/equipes', '/autorizacao', '/sorteio', '/sorteio/nomes', '/feedback']);
    expect(isListedInSitemap('https://hackarun.com.br/equipes')).toBe(false);
    expect(isListedInSitemap('https://hackarun.com.br/equipes/')).toBe(false);
    expect(isListedInSitemap('https://hackarun.com.br/autorizacao')).toBe(false);
  });

  it('o resto continua no sitemap (inclusive nomes parecidos)', () => {
    for (const path of ['/', '/inscricao', '/privacidade', '/equipes-2027']) {
      expect(isListedInSitemap(`https://hackarun.com.br${path}`)).toBe(true);
    }
  });

  it('as duas páginas pedem noindex ao Seo.astro', () => {
    expect(read('presentation/components/seo/teamsPageSeo.ts')).toContain('noindex: true');
    expect(read('pages/equipes.astro')).toContain('...TEAMS_PAGE');
    expect(read('pages/autorizacao.astro')).toContain('noindex: true');
  });
});
