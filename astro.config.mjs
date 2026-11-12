// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import sorteio from './tools/sorteio/integration.mjs';

// endereço oficial (domínio próprio, servido pela Cloudflare Pages, projeto "hackarun"); o PUBLIC_SITE_URL troca (fork). Vazio
// conta como não definido. Igual ao DEFAULT_SITE_URL de src/shared/config/deploy.ts (um teste confere)
const site = process.env.PUBLIC_SITE_URL || 'https://hackarun.com.br';

// páginas fora do sitemap (também têm noindex no Seo.astro): /equipes fica escondida até o sorteio,
// /autorizacao é só o modelo para imprimir, /sorteio é da organização (com login) e /roleta é a tela da TV no evento
export const UNLISTED_PATHS = [
  '/equipes',
  '/autorizacao',
  '/sorteio',
  '/sorteio/nomes',
  '/sorteio/avaliacoes',
  '/feedback',
  '/inscricao-excecao',
  '/roleta',
];

// a página entra no sitemap? (o filtro recebe a URL completa)
/** @param {string} page */
export const isListedInSitemap = (page) =>
  !UNLISTED_PATHS.includes(new URL(page).pathname.replace(/\/$/, ''));

// cópia de teste do sorteio das equipes (só no `npm run sorteio`): sem SORTEIO=1 a integração nem é carregada. As telas
// /sorteio existem no site, atrás do login da organização (functions/_middleware.ts)
const draw = process.env.SORTEIO === '1' ? [sorteio({ file: process.env.SORTEIO_FILE })] : [];

export default defineConfig({
  site,
  integrations: [sitemap({ filter: isListedInSitemap }), ...draw],
  devToolbar: { enabled: false },
  // endereços sem barra no fim (/inscricao, /equipes): o build gera inscricao.html, que o Cloudflare Pages
  // serve em /inscricao direto (pasta/index.html custaria um redirect 308 pra /inscricao/ a cada clique) e o
  // sitemap fica igual ao canonical
  trailingSlash: 'never',
  build: {
    format: 'file',
    // css pequeno vai inline, evita request bloqueante no primeiro paint
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      target: 'es2022',
      // three fica num chunk separado, carregado só depois do primeiro paint
      chunkSizeWarningLimit: 700,
    },
  },
});
