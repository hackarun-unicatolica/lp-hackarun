// telas que a própria função monta (sem JavaScript): login da organização e os avisos de bloqueio/configuração.
// Visual no tom do sorteio (fundo escuro, ciano e magenta), com as fontes do sistema

export const PAGE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

const STYLE = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef2ff;
background:radial-gradient(circle at 20% 10%,rgb(18 100 255/.35),transparent 45%),radial-gradient(circle at 85% 90%,rgb(237 40 232/.25),transparent 45%),#05081a}
main{width:min(26rem,100%);padding:2rem;border:1px solid rgb(130 160 255/.25);border-radius:1.25rem;background:rgb(10 14 40/.85);box-shadow:0 20px 60px rgb(0 0 0/.45)}
.kicker{margin:0 0 .4rem;font:600 .75rem/1 ui-monospace,monospace;letter-spacing:.25em;text-transform:uppercase;color:#00e5ff}
h1{margin:0 0 1.5rem;font-size:1.6rem;letter-spacing:.02em}
label{display:grid;gap:.4rem;margin-bottom:1rem;font-size:.9rem;color:#b9c3ea}
input{width:100%;padding:.8rem .9rem;border:1px solid rgb(130 160 255/.35);border-radius:.7rem;background:#070b22;color:#fff;font-size:1rem}
input:focus{outline:2px solid #00e5ff;outline-offset:1px}
button{width:100%;margin-top:.5rem;padding:.9rem;border:0;border-radius:.8rem;font-weight:700;font-size:1rem;color:#05081a;cursor:pointer;background:linear-gradient(90deg,#00e5ff,#ed28e8)}
.error{margin:0 0 1rem;padding:.7rem .9rem;border-radius:.6rem;background:rgb(255 70 90/.15);border:1px solid rgb(255 70 90/.5);color:#ffd0d6;font-size:.9rem}
p.note{margin:1.25rem 0 0;font-size:.8rem;color:#8d97c4}
label[for]{margin-bottom:.4rem}
.pass{position:relative;margin-bottom:1rem}
.pass input{padding-right:3.2rem}
button.eye{position:absolute;top:50%;right:.35rem;width:2.6rem;height:2.6rem;margin:0;padding:0;display:grid;place-items:center;transform:translateY(-50%);background:transparent;color:#b9c3ea;border-radius:.5rem}
button.eye[aria-pressed=true]{color:#00e5ff}
button.eye:focus-visible{outline:2px solid #00e5ff}
`;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function page(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · HackaRun 2026</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

// botão de olho da senha: o único script destas telas, num arquivo estático do site (public/login-senha.js). Escrito
// aqui dentro da função, a Cloudflare recusava publicar ("Unknown internal error")
export const PASSWORD_TOGGLE_SRC = '/login-senha.js';

// headers das telas com o login (as outras ficam sem script nenhum): só scripts do próprio site
export const LOGIN_HEADERS: Record<string, string> = {
  ...PAGE_HEADERS,
  'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
};

const EYE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

// título da tela de login conforme a tela de destino
const LOGIN_TITLES: Record<string, string> = { '/gemas': 'Gemas dos NPCs' };

export function loginPage(options: { back: string; error?: string; user?: string }): string {
  const error = options.error ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>` : '';
  const title = LOGIN_TITLES[options.back] ?? 'Sorteio das equipes';
  return page(
    title,
    `<p class="kicker">HackaRun 2026 · organização</p><h1>${escapeHtml(title)}</h1>${error}
<form method="post" action="/sorteio/entrar">
<input type="hidden" name="voltar" value="${escapeHtml(options.back)}">
<label>Login<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(options.user ?? '')}"></label>
<label for="senha">Senha</label>
<div class="pass"><input id="senha" name="senha" type="password" autocomplete="current-password" required><button type="button" class="eye" data-eye aria-controls="senha" aria-pressed="false" aria-label="Mostrar senha" hidden>${EYE_ICON}</button></div>
<button type="submit">Entrar</button>
</form><p class="note">Acesso só da organização. A sessão vale por 12 horas neste navegador.</p><script src="${PASSWORD_TOGGLE_SRC}" defer></script>`,
  );
}

export function messagePage(title: string, text: string): string {
  return page(
    title,
    `<p class="kicker">HackaRun 2026 · organização</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`,
  );
}
