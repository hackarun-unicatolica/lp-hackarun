// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('página /roleta', () => {
  const read = (path: string): string =>
    readFileSync(fileURLToPath(new URL(`../../../src/${path}`, import.meta.url)), 'utf8');

  it('fica fora dos buscadores e não tem link em nenhuma outra página', () => {
    expect(read('pages/roleta.astro')).toContain('<meta name="robots" content="noindex, nofollow" />');
    for (const file of [
      'presentation/components/layout/SiteHeader.astro',
      'presentation/components/layout/SiteFooter.astro',
    ]) {
      expect(read(file)).not.toContain('/roleta');
    }
  });

  it('tem tudo o que a tela procura', () => {
    const html = read('pages/roleta.astro');
    for (const hook of [
      'data-spin',
      'data-spin-label',
      'data-counter',
      'data-hint',
      'data-slot',
      'data-confirm',
      'data-result',
      'data-next',
      'data-lightning',
    ]) {
      expect(html).toContain(hook);
    }
    expect(read('presentation/roulette/RouletteWheel.astro')).toContain('data-wheel');
  });
});
