// insígnias dos NPCs (hackarun.com.br/insignias; no código, "gems"): cada NPC tem uma cor e sorteia só as questões da palestra dele. As questões
// e o gabarito ficam na aba "Questões" desta planilha (nunca no repositório, que é público). O site não fala direto
// com este script: a função da Cloudflare confere o login da organização e repassa com a chave SORTEIO_TOKEN.
// A fila de cada cor (quais questões já saíram na rodada) fica nas propriedades do script; o sorteio acontece no
// aparelho do NPC, que só manda a fila atualizada para cá (sem pressa: a tela não espera a resposta).

const GEMS_SHEET = 'Questões';
const GEMS_ACTIONS = ['gems-load', 'gems-sync', 'gems-teams', 'gems-finish', 'gems-undo'];
// ações da entrega final (Insignias.gs): não dependem de cor
const GEMS_DELIVERY_ACTIONS = ['gems-teams', 'gems-finish', 'gems-undo'];
const GEMS_COLORS = ['azul', 'amarelo', 'vermelho'];
const GEMS_HEADERS = ['Cor', 'Nº', 'Pergunta', 'A', 'B', 'C', 'D', 'Resposta'];
const GEMS_LETTERS = ['A', 'B', 'C', 'D'];
const GEMS_STATE_PREFIX = 'GEMAS_FILA_';
// folga sobre as 50 questões de cada palestra (a organização pode acrescentar algumas na aba)
const GEMS_MAX_QUESTIONS = 200;
const GEMS_LOCK_MS = 10000;

function gemsAction_(body) {
  if (!drawAuthorized_(body.token)) return json_({ ok: false, error: 'unauthorized' });
  if (GEMS_ACTIONS.indexOf(body.action) === -1) return json_({ ok: false, error: 'unknown-action' });
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    // formata as abas na primeira chamada de cada versão (Insignias.gs)
    if (
      PropertiesService.getScriptProperties().getProperty(INSIGNIAS_SETUP_PROPERTY) !==
      INSIGNIAS_SETUP_VERSION
    ) {
      gemsLocked_(() => insigniasSetup_(book));
    }
    if (GEMS_DELIVERY_ACTIONS.indexOf(body.action) !== -1) {
      if (body.action === 'gems-teams') return json_(insigniasState_(book));
      return json_(gemsLocked_(() => insigniasChange_(book, body.action, body.team)));
    }
    const color = gemsColor_(body.color);
    if (!color) return json_({ ok: false, error: 'invalid' });
    if (body.action === 'gems-load') {
      const questions = gemsQuestions_(book, color);
      return json_({ ok: true, color: color, questions: questions, state: gemsState_(color) });
    }
    const incoming = gemsCleanState_(body.state);
    if (!incoming) return json_({ ok: false, error: 'invalid' });
    return json_({ ok: true, color: color, state: gemsSave_(color, incoming) });
  } catch (err) {
    if (err && err.gemsBusy) return json_({ ok: false, error: 'busy' });
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

function gemsColor_(value) {
  const color = String(value || '')
    .trim()
    .toLowerCase();
  return GEMS_COLORS.indexOf(color) === -1 ? '' : color;
}

// questões da cor, na ordem do número; linha incompleta (sem pergunta, alternativa ou resposta válida) fica de fora
function gemsQuestions_(book, color) {
  const sheet = book.getSheetByName(GEMS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, GEMS_HEADERS.length).getValues();
  const seen = {};
  return rows
    .map((r) => ({
      color: gemsColor_(r[0]),
      n: Math.round(Number(r[1])),
      question: String(r[2] || '').trim(),
      options: [r[3], r[4], r[5], r[6]].map((o) => String(o || '').trim()),
      answer: String(r[7] || '')
        .trim()
        .toUpperCase(),
    }))
    .filter((q) => {
      if (q.color !== color || !(q.n > 0) || seen[q.n] || !q.question) return false;
      if (q.options.some((o) => !o) || GEMS_LETTERS.indexOf(q.answer) === -1) return false;
      seen[q.n] = true;
      return true;
    })
    .slice(0, GEMS_MAX_QUESTIONS)
    .sort((a, b) => a.n - b.n)
    .map((q) => ({ n: q.n, question: q.question, options: q.options, answer: q.answer }));
}

// fila guardada: rodada (começa em 1), números que já saíram nela e quando mudou
function gemsState_(color) {
  const raw = PropertiesService.getScriptProperties().getProperty(GEMS_STATE_PREFIX + color);
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (err) {
    parsed = null;
  }
  return gemsCleanState_(parsed) || { round: 1, used: [], updatedAt: 0 };
}

function gemsCleanState_(value) {
  if (!value || typeof value !== 'object') return null;
  const round = Math.round(Number(value.round));
  const updatedAt = Number(value.updatedAt);
  if (!(round >= 1) || !(updatedAt >= 0) || !Array.isArray(value.used)) return null;
  const used = [];
  value.used.forEach((n) => {
    const v = Math.round(Number(n));
    if (v > 0 && v <= 10000 && used.indexOf(v) === -1 && used.length < GEMS_MAX_QUESTIONS) used.push(v);
  });
  return { round: round, used: used, updatedAt: updatedAt };
}

// mesma regra do src/domain/gems/GemQueue.ts (mergeQueueStates): rodada maior vence; na mesma rodada junta o que
// já saiu nos dois lados (questão que saiu num aparelho não volta antes da hora em outro)
function gemsMerge_(a, b) {
  if (a.round !== b.round) return a.round > b.round ? a : b;
  const used = a.used.slice();
  b.used.forEach((n) => {
    if (used.indexOf(n) === -1) used.push(n);
  });
  return { round: a.round, used: used, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}

function gemsSave_(color, incoming) {
  return gemsLocked_(() => {
    const merged = gemsMerge_(gemsState_(color), incoming);
    PropertiesService.getScriptProperties().setProperty(GEMS_STATE_PREFIX + color, JSON.stringify(merged));
    return merged;
  });
}

function gemsLocked_(work) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(GEMS_LOCK_MS);
  } catch (err) {
    const busy = new Error('busy');
    busy.gemsBusy = true;
    throw busy;
  }
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}
