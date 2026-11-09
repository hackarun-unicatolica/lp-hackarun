// @vitest-environment node
// o sorteio no site é da organização: as telas só abrem com o login (função da Cloudflare), a chave da planilha nunca
// chega ao navegador e nada da cópia de teste (API local, botões de teste, xlsx) vai para o site público
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isListedInSitemap } from '../../astro.config.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('sorteio no site · o que vai e o que não vai para produção', () => {
  it('a cópia de teste só entra com SORTEIO=1 e só no astro dev', () => {
    const config = read('astro.config.mjs');
    expect(config).toMatch(/process\.env\.SORTEIO === '1'/);
    expect(config).not.toMatch(/integrations:\s*\[[^\]]*sorteio\(/);
    const integration = read('tools/sorteio/integration.mjs');
    expect(integration).toMatch(/if \(command !== 'dev'\) return;/);
    expect(integration).toMatch(/apply: 'serve'/);
  });

  it('a função da Cloudflare só roda nos caminhos do sorteio e da lista de equipes (o resto segue estático)', () => {
    const routes = JSON.parse(read('public/_routes.json')) as { include: string[]; exclude: string[] };
    expect(
      routes.include.every((path) => /^\/(api\/)?(sorteio|feedback)/.test(path) || path === '/api/equipes'),
    ).toBe(true);
    expect(routes.include).toContain('/api/equipes');
  });

  it('as telas ficam fora do sitemap e com noindex', () => {
    expect(isListedInSitemap('https://hackarun.com.br/sorteio')).toBe(false);
    expect(isListedInSitemap('https://hackarun.com.br/sorteio/nomes')).toBe(false);
    expect(read('src/presentation/draw/DrawLayout.astro')).toMatch(
      /name="robots" content="noindex, nofollow"/,
    );
  });

  it('o código do navegador nunca vê a chave da planilha nem o endereço do Apps Script', () => {
    const browserFiles = [
      ...walk(join(ROOT, 'src/presentation/views/draw')),
      ...walk(join(ROOT, 'src/infrastructure/draw')),
      join(ROOT, 'src/composition/draw.ts'),
    ];
    for (const file of browserFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/SORTEIO_TOKEN|token|script\.google\.com/i);
    }
  });

  it('o site público (fora das telas do sorteio) não importa o código do sorteio', () => {
    const forbidden =
      /composition\/draw|views\/draw\/|view-models\/draw\/|infrastructure\/draw\/|application\/draw\//;
    const publicFiles = walk(join(ROOT, 'src')).filter(
      (f) =>
        /\.(ts|astro)$/.test(f) &&
        !/[\\/](draw|sorteio)[\\/]/.test(f) &&
        !/pages[\\/]sorteio\.astro$/.test(f) &&
        !/composition[\\/]draw\.ts$/.test(f),
    );
    for (const file of publicFiles) expect(readFileSync(file, 'utf8'), file).not.toMatch(forbidden);
  });

  it('o servidor da cópia de teste só escuta o próprio computador', () => {
    expect(read('tools/sorteio/run.mjs')).toMatch(/'--host', '127\.0\.0\.1'/);
  });

  // a classe da cópia local (endereço /__sorteio) ainda viaja no pacote, mas sem servidor ela não faz nada no site:
  // o que não pode ir é a planilha local (exceljs) nem os botões de teste
  it('o build que já existe em dist/ (se houver) tem as telas, mas nada da cópia de teste', () => {
    const dist = join(ROOT, 'dist');
    if (!existsSync(dist)) return;
    const files = walk(dist).filter((f) => /\.(html|js|css)$/.test(f));
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /Recomeçar teste|Sortear os nomes de novo|exceljs|xlsx-handler|hackarun-teste/,
      );
    }
  });

  it('a cópia de teste da planilha (dados pessoais) está no .gitignore', () => {
    expect(read('.gitignore')).toMatch(/^\.local\/$/m);
  });
});

describe('planilha real: grava sozinho e sem botões de teste', () => {
  it('no site o sorteio salva automático e não há reset; no teste o botão "Salvar" e os resets continuam', async () => {
    const { createDrawServices } = await import('@composition/draw');
    const real = createDrawServices({ mode: 'site', label: 'x' });
    const test = createDrawServices({ mode: 'local', label: 'x' });
    expect(real.autoSave).toBe(true);
    expect(real.resetTest).toBeNull();
    expect(real.resetTestNames).toBeNull();
    expect(test.autoSave).toBe(false);
    expect(test.resetTest).toBeTypeOf('function');
    expect(test.resetTestNames).toBeTypeOf('function');
  });
});
