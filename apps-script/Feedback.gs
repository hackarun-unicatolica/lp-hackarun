// avaliação diária entre colegas de equipe (hackarun.com.br/feedback). O site não fala direto com este script: a função
// da Cloudflare confere a pessoa e repassa o envio com a chave SORTEIO_TOKEN (a mesma do sorteio).
// Serve só para a organização acompanhar as equipes: não entra na nota e nada daqui volta para o site público.
// Três abas: "Avaliações" (uma linha por colega avaliado), "Notas baixas" e "Acompanhamento" (as duas por fórmula).

const FEEDBACK_SHEET = 'Avaliações';
const FEEDBACK_LOW_SHEET = 'Notas baixas';
const FEEDBACK_TRACK_SHEET = 'Acompanhamento';
const FEEDBACK_ACTIONS = ['feedback-roster', 'feedback-submit'];
// mudou o layout? suba a versão: a próxima chamada refaz as abas (as avaliações ficam)
const FEEDBACK_SETUP_VERSION = '1';
const FEEDBACK_SETUP_PROPERTY = 'FEEDBACK_VERSAO';
// propriedade opcional: troca os horários sem mexer no código. JSON como FEEDBACK_DEFAULT_WINDOWS; inválido = fechado
const FEEDBACK_WINDOWS_PROPERTY = 'FEEDBACK_JANELAS';
const FEEDBACK_ABSENT = 'Não compareceu';
// mesmas regras do src/domain/value-objects/PeerReview.ts (um teste confere)
const FEEDBACK_LOW_STARS = 3;
const FEEDBACK_MAX_STARS = 5;
const FEEDBACK_REASON_MIN = 15;
const FEEDBACK_REASON_MAX = 600;
// a maior equipe tem 5 pessoas; a folga cobre uma troca feita à mão pela organização
const FEEDBACK_MAX_RATINGS = 8;
const FEEDBACK_LOCK_MS = 25000;
// 12/11 fica de fora: é a noite do sorteio, ninguém trabalhou junto ainda. 14/11 fecha antes de anunciar as finalistas
const FEEDBACK_DEFAULT_WINDOWS = [
  { day: '2026-11-13', opens: '2026-11-13T19:00:00-03:00', closes: '2026-11-13T23:59:59-03:00' },
  { day: '2026-11-14', opens: '2026-11-14T10:00:00-03:00', closes: '2026-11-14T16:30:00-03:00' },
];
// prettier-ignore
const FEEDBACK_COLUMNS = [
  { key: 'key', title: 'Chave', width: 60, format: '@' },
  { key: 'day', title: 'Dia', width: 100, format: '@', align: 'center' },
  { key: 'team', title: 'Equipe', width: 170, format: '@' },
  { key: 'target', title: 'Avaliado', width: 220, format: '@', wrap: true },
  { key: 'score', title: 'Nota', width: 130, align: 'center' },
  { key: 'reason', title: 'Justificativa', width: 380, format: '@', wrap: true },
  { key: 'author', title: 'Quem avaliou', width: 220, format: '@', wrap: true },
  { key: 'sentAt', title: 'Enviado em', width: 130, format: 'dd/MM/yyyy HH:mm' },
  { key: 'targetProtocol', title: 'Protocolo do avaliado', width: 130, format: '@' },
  { key: 'authorProtocol', title: 'Protocolo de quem avaliou', width: 130, format: '@' },
];
const FEEDBACK_HEADERS = FEEDBACK_COLUMNS.map((c) => c.title);
const FBCOL = columnIndex_(FEEDBACK_COLUMNS);
// prettier-ignore
const FEEDBACK_LOW_COLUMNS = [
  { title: 'Dia', width: 100, align: 'center' },
  { title: 'Equipe', width: 170 },
  { title: 'Avaliado', width: 220, wrap: true },
  { title: 'Nota', width: 130, align: 'center' },
  { title: 'Justificativa', width: 380, wrap: true },
  { title: 'Quem avaliou', width: 220, wrap: true },
  { title: 'Quantos avaliaram mal nesse dia', width: 130, align: 'center' },
];
const FEEDBACK_ALERT = ['#FDE1E8', '#8A1530'];
const FEEDBACK_STRONG_ALERT = ['#C2274D', '#FFFFFF'];
const FEEDBACK_OK = ['#D9F5E8', '#0B5A38'];

function feedbackAction_(body) {
  if (!drawAuthorized_(body.token)) return json_({ ok: false, error: 'unauthorized' });
  if (FEEDBACK_ACTIONS.indexOf(body.action) === -1) return json_({ ok: false, error: 'unknown-action' });
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const windows = feedbackWindows_();
    const token = String(body.token);
    if (body.action === 'feedback-roster') return json_(feedbackRoster_(book, windows, token));
    return json_(feedbackSubmit_(book, windows, body));
  } catch (err) {
    if (err && err.feedbackBusy) return json_({ ok: false, error: 'busy' });
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

// rode no editor para criar as abas antes do primeiro acesso (senão a primeira chamada do site cria)
function configurarFeedback() {
  return feedbackLocked_(() =>
    feedbackSetup_(SpreadsheetApp.getActiveSpreadsheet(), feedbackWindows_()).getName(),
  );
}

function feedbackLocked_(work) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(FEEDBACK_LOCK_MS);
  } catch (err) {
    const busy = new Error('busy');
    busy.feedbackBusy = true;
    throw busy;
  }
  try {
    const out = work();
    // a próxima pessoa da fila precisa enxergar estas linhas (duplicado e última linha)
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

// [{ day: '2026-11-13', label: '13/11', opens, closes }], em ordem. Propriedade torta fecha tudo: melhor errar pro lado
// seguro do que aceitar avaliação fora de hora
function feedbackWindows_() {
  const raw = String(
    PropertiesService.getScriptProperties().getProperty(FEEDBACK_WINDOWS_PROPERTY) || '',
  ).trim();
  let list = FEEDBACK_DEFAULT_WINDOWS;
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch (err) {
      console.error('Propriedade ' + FEEDBACK_WINDOWS_PROPERTY + ' inválida');
      return [];
    }
  }
  if (!Array.isArray(list) || !list.every(feedbackValidWindow_)) {
    console.error('Propriedade ' + FEEDBACK_WINDOWS_PROPERTY + ' inválida');
    return [];
  }
  return list
    .map((w) => ({ day: w.day, label: feedbackLabel_(w.day), opens: w.opens, closes: w.closes }))
    .sort((a, b) => Date.parse(a.opens) - Date.parse(b.opens));
}

const FEEDBACK_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

function feedbackValidWindow_(w) {
  return (
    Boolean(w) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(w.day)) &&
    FEEDBACK_ISO.test(String(w.opens)) &&
    FEEDBACK_ISO.test(String(w.closes)) &&
    Date.parse(w.opens) < Date.parse(w.closes)
  );
}

function feedbackLabel_(day) {
  const parts = String(day).split('-');
  return parts[2] + '/' + parts[1];
}

// "Dia 13/11": sozinho, "13/11" viraria data nos critérios do COUNTIFS e não bateria com o texto da coluna
const feedbackDayValue_ = (label) => 'Dia ' + label;
const feedbackKey_ = (label, protocol) => feedbackDayValue_(label) + '|' + protocol;

function feedbackCurrent_(windows, now) {
  return windows.find((w) => now >= Date.parse(w.opens) && now <= Date.parse(w.closes)) || null;
}

function feedbackVersion_(windows) {
  return FEEDBACK_SETUP_VERSION + '|' + windows.map((w) => w.day + '@' + w.closes).join(',');
}

function feedbackReady_(book, windows) {
  const sheet = book.getSheetByName(FEEDBACK_SHEET);
  const saved = PropertiesService.getScriptProperties().getProperty(FEEDBACK_SETUP_PROPERTY);
  return hasHeaders_(sheet, FEEDBACK_HEADERS) && saved === feedbackVersion_(windows) ? sheet : null;
}

// quem responde pelas chaves já gravadas: uma coluna só, leitura barata mesmo com a planilha cheia
function feedbackKeys_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const keys = {};
  sheet
    .getRange(2, FBCOL.key + 1, last - 1, 1)
    .getValues()
    .forEach((r) => {
      keys[String(r[0])] = true;
    });
  return keys;
}

// DDD + 8 últimos dígitos: quem digitou o número com ou sem o 9 da frente continua sendo a mesma pessoa
function feedbackPhone_(raw) {
  const digits = phoneDigits_(raw);
  return digits.slice(0, 2) + digits.slice(-8);
}

// lista de quem está em equipe. E-mail e WhatsApp saem só como resumo com a chave: nada de contato fica na Cloudflare
function feedbackRoster_(book, windows, token) {
  const sheet = feedbackReady_(book, windows) || feedbackLocked_(() => feedbackSetup_(book, windows));
  const registrations = book.getSheetByName(REGISTRATIONS_SHEET);
  if (!hasHeaders_(registrations, REGISTRATION_HEADERS)) return { ok: false, error: 'server' };
  const keys = feedbackKeys_(sheet);
  const people = readRows_(registrations, REGISTRATION_HEADERS.length)
    .filter(
      (r) =>
        drawText_(r[RCOL.protocol]) && drawText_(r[RCOL.team]) && drawStatus_(r[RCOL.status]) !== 'cancelado',
    )
    .map((r) => {
      const protocol = drawText_(r[RCOL.protocol]);
      const email = drawText_(r[RCOL.email]).toLowerCase();
      return {
        key: digest_(token + '|' + email + '|' + feedbackPhone_(r[RCOL.whatsapp])),
        ref: digest_(token + '|ref|' + protocol).slice(0, 16),
        protocol: protocol,
        name: drawText_(r[RCOL.name]),
        team: drawText_(r[RCOL.team]),
        done: windows.filter((w) => keys[feedbackKey_(w.label, protocol)]).map((w) => w.day),
      };
    });
  return { ok: true, windows: windows, people: people };
}

function feedbackSubmit_(book, windows, body) {
  const current = feedbackCurrent_(windows, Date.now());
  if (!current || body.day !== current.day) return { ok: false, error: 'closed' };
  const lines = feedbackLines_(body, current);
  if (!lines) return { ok: false, error: 'invalid' };
  return feedbackLocked_(() => {
    const sheet = feedbackReady_(book, windows) || feedbackSetup_(book, windows);
    if (feedbackKeys_(sheet)[lines[0][FBCOL.key]]) return { ok: false, error: 'already' };
    sheet.getRange(sheet.getLastRow() + 1, 1, lines.length, FEEDBACK_HEADERS.length).setValues(lines);
    return { ok: true };
  });
}

const feedbackClean_ = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();

// a função da Cloudflare já conferiu quem é a pessoa e quem são os colegas; aqui confere de novo a nota, que é o que
// fica gravado. null = envio torto (nada é gravado)
function feedbackLines_(body, current) {
  const author = body.author || {};
  const authorProtocol = feedbackClean_(author.protocol);
  const authorName = feedbackClean_(author.name);
  const team = feedbackClean_(author.team);
  const ratings = Array.isArray(body.ratings) ? body.ratings : [];
  if (!authorProtocol || !authorName || !team) return null;
  if (ratings.length === 0 || ratings.length > FEEDBACK_MAX_RATINGS) return null;
  const seen = {};
  const sentAt = new Date();
  const lines = ratings.map((rating) => {
    const line = feedbackLine_(rating, seen);
    if (!line || line.protocol === authorProtocol) return null;
    const row = FEEDBACK_COLUMNS.map(() => '');
    row[FBCOL.key] = feedbackKey_(current.label, authorProtocol);
    row[FBCOL.day] = feedbackDayValue_(current.label);
    row[FBCOL.team] = sheetSafe_(team);
    row[FBCOL.target] = sheetSafe_(line.name);
    row[FBCOL.score] = line.score;
    row[FBCOL.reason] = sheetSafe_(line.reason);
    row[FBCOL.author] = sheetSafe_(authorName);
    row[FBCOL.sentAt] = sentAt;
    row[FBCOL.targetProtocol] = line.protocol;
    row[FBCOL.authorProtocol] = authorProtocol;
    return row;
  });
  return lines.every(Boolean) ? lines : null;
}

function feedbackLine_(rating, seen) {
  if (!rating) return null;
  const protocol = feedbackClean_(rating.protocol);
  const name = feedbackClean_(rating.name);
  if (!protocol || !name || seen[protocol]) return null;
  seen[protocol] = true;
  const absent = rating.absent === true;
  const stars = rating.stars;
  const validStars = Number.isInteger(stars) && stars >= 1 && stars <= FEEDBACK_MAX_STARS;
  if (absent ? stars !== null && stars !== undefined : !validStars) return null;
  const low = absent || stars <= FEEDBACK_LOW_STARS;
  const reason = feedbackClean_(rating.reason);
  if (reason.length > FEEDBACK_REASON_MAX || (low && reason.length < FEEDBACK_REASON_MIN)) return null;
  return {
    protocol: protocol,
    name: name,
    score: absent ? FEEDBACK_ABSENT : stars,
    reason: low ? reason : '',
  };
}

// ---- abas da organização ----

function feedbackSetup_(book, windows) {
  const raw = ensureTab_(book, FEEDBACK_SHEET, book.getSheets().length);
  const low = ensureTab_(book, FEEDBACK_LOW_SHEET, book.getSheets().length);
  const track = ensureTab_(book, FEEDBACK_TRACK_SHEET, book.getSheets().length);
  styleTable_(raw, FEEDBACK_COLUMNS, 0, BRAND.violet);
  raw.hideColumns(FBCOL.key + 1);
  raw.setConditionalFormatRules([
    feedbackRule_(
      raw,
      feedbackLowRow_('$' + colLetter_(FBCOL.score) + '2'),
      FEEDBACK_ALERT,
      2,
      1,
      FEEDBACK_HEADERS.length,
    ),
  ]);
  feedbackWriteLow_(low);
  feedbackWriteTrack_(track, windows);
  PropertiesService.getScriptProperties().setProperty(FEEDBACK_SETUP_PROPERTY, feedbackVersion_(windows));
  return raw;
}

const feedbackLowRow_ = (cell) =>
  '=OR(' +
  cell +
  '="' +
  FEEDBACK_ABSENT +
  '",AND(ISNUMBER(' +
  cell +
  '),' +
  cell +
  '<=' +
  FEEDBACK_LOW_STARS +
  '))';

function feedbackRule_(sheet, formula, colors, row, col, width) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(localizeFormula_(formula, formulaSeparator_()))
    .setBackground(colors[0])
    .setFontColor(colors[1])
    .setRanges([sheet.getRange(row, col, sheet.getMaxRows() - row + 1, width)])
    .build();
}

// coluna da aba Avaliações como intervalo fixo: 'Avaliações'!$E$2:$E
function feedbackColumn_(key, lastKey) {
  const start = colLetter_(FBCOL[key]);
  const end = colLetter_(FBCOL[lastKey || key]);
  return "'" + FEEDBACK_SHEET + "'!$" + start + '$2:$' + end;
}

// uma linha por nota baixa, com as de cada pessoa juntas: dá para ver de uma vez todos os que avaliaram mal
function feedbackWriteLow_(sheet) {
  sheet.clear();
  styleTable_(sheet, FEEDBACK_LOW_COLUMNS, 3, BRAND.violet);
  const score = feedbackColumn_('score');
  const low =
    'ISNUMBER(' +
    score +
    ')*(' +
    score +
    '<=' +
    FEEDBACK_LOW_STARS +
    ')+(' +
    score +
    '="' +
    FEEDBACK_ABSENT +
    '")';
  setScriptFormula_(
    sheet.getRange(2, 1),
    '=IFERROR(SORT(FILTER(' + feedbackColumn_('day', 'author') + ',' + low + '),1,TRUE,2,TRUE,3,TRUE),"")',
  );
  setScriptFormula_(
    sheet.getRange(2, FEEDBACK_LOW_COLUMNS.length),
    '=ARRAYFORMULA(IF($C$2:$C="","",COUNTIFS($A$2:$A,$A$2:$A,$B$2:$B,$B$2:$B,$C$2:$C,$C$2:$C)))',
  );
  const width = FEEDBACK_LOW_COLUMNS.length;
  const count = '$' + colLetter_(width - 1) + '2';
  sheet.setConditionalFormatRules([
    feedbackRule_(
      sheet,
      '=AND(ISNUMBER(' + count + '),' + count + '>=2)',
      FEEDBACK_STRONG_ALERT,
      2,
      width,
      1,
    ),
    feedbackRule_(sheet, '=$C2<>""', FEEDBACK_ALERT, 2, 4, 1),
  ]);
}

// serial de planilha do horário de fechamento (o ISO já vem em -03:00, o fuso da planilha)
function feedbackCloseFormula_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  return (
    'DATE(' +
    Number(m[1]) +
    ',' +
    Number(m[2]) +
    ',' +
    Number(m[3]) +
    ')+TIME(' +
    Number(m[4]) +
    ',' +
    Number(m[5]) +
    ',' +
    Number(m[6]) +
    ')'
  );
}

function feedbackTrackColumns_(windows) {
  const columns = [
    { title: 'Equipe', width: 170 },
    { title: 'Participante', width: 240, wrap: true },
    { title: 'Protocolo', width: 110 },
  ];
  windows.forEach((w) => {
    columns.push({ title: w.label + ': avaliou?', width: 130, align: 'center' });
    columns.push({ title: w.label + ': média recebida', width: 100, align: 'center' });
    columns.push({ title: w.label + ': notas baixas', width: 90, align: 'center' });
  });
  columns.push({ title: 'Total de notas baixas', width: 100, align: 'center' });
  return columns;
}

// uma linha por participante em equipe. Passou o horário sem avaliar, aparece NÃO AVALIOU naquele dia
function feedbackWriteTrack_(sheet, windows) {
  sheet.clear();
  const columns = feedbackTrackColumns_(windows);
  styleTable_(sheet, columns, 2, BRAND.violet);
  sheet.hideColumns(3);
  const team = registrationsColumn_('team');
  const active = team + '<>"",LOWER(TRIM(' + registrationsColumn_('status') + '))<>"cancelado"';
  const pick = (key) => 'FILTER(' + registrationsColumn_(key) + ',' + active + ')';
  const spill = (key) =>
    '=IFERROR(SORT(' +
    pick(key) +
    ',' +
    pick('team') +
    ',TRUE,' +
    pick('name') +
    ',TRUE,' +
    pick('protocol') +
    ',TRUE),"")';
  setScriptFormula_(sheet.getRange(2, 1), spill('team'));
  setScriptFormula_(sheet.getRange(2, 2), spill('name'));
  setScriptFormula_(sheet.getRange(2, 3), spill('protocol'));
  const person = '$C$2:$C';
  const each = (body) => '=ARRAYFORMULA(IF(' + person + '="","",' + body + '))';
  const dayRange = feedbackColumn_('day');
  const target = feedbackColumn_('targetProtocol');
  const score = feedbackColumn_('score');
  const rules = [];
  const lowLetters = [];
  windows.forEach((w, i) => {
    const col = 4 + i * 3;
    const day = '"' + feedbackDayValue_(w.label) + '"';
    const lookup =
      'VLOOKUP(' +
      day +
      '&"|"&' +
      person +
      ',' +
      feedbackColumn_('key', 'sentAt') +
      ',' +
      (FBCOL.sentAt + 1) +
      ',FALSE)';
    setScriptFormula_(
      sheet.getRange(2, col),
      each(
        'IFNA("Avaliou às "&TEXT(' +
          lookup +
          ',"HH:mm"),IF(NOW()>' +
          feedbackCloseFormula_(w.closes) +
          ',"NÃO AVALIOU","Aguardando"))',
      ),
    );
    setScriptFormula_(
      sheet.getRange(2, col + 1),
      each(
        'IFERROR(ROUND(SUMIFS(' +
          score +
          ',' +
          target +
          ',' +
          person +
          ',' +
          dayRange +
          ',' +
          day +
          ')/COUNTIFS(' +
          target +
          ',' +
          person +
          ',' +
          dayRange +
          ',' +
          day +
          ',' +
          score +
          ',">0"),1),"")',
      ),
    );
    setScriptFormula_(
      sheet.getRange(2, col + 2),
      each(
        'COUNTIFS(' +
          target +
          ',' +
          person +
          ',' +
          dayRange +
          ',' +
          day +
          ',' +
          score +
          ',"<=' +
          FEEDBACK_LOW_STARS +
          '")+COUNTIFS(' +
          target +
          ',' +
          person +
          ',' +
          dayRange +
          ',' +
          day +
          ',' +
          score +
          ',"' +
          FEEDBACK_ABSENT +
          '")',
      ),
    );
    const status = '$' + colLetter_(col - 1) + '2';
    rules.push(feedbackRule_(sheet, '=' + status + '="NÃO AVALIOU"', FEEDBACK_STRONG_ALERT, 2, col, 1));
    rules.push(feedbackRule_(sheet, '=LEFT(' + status + ',6)="Avaliou"', FEEDBACK_OK, 2, col, 1));
    const low = '$' + colLetter_(col + 1) + '2';
    rules.push(
      feedbackRule_(sheet, '=AND(ISNUMBER(' + low + '),' + low + '>0)', FEEDBACK_ALERT, 2, col + 2, 1),
    );
    lowLetters.push(colLetter_(col + 1));
  });
  const totalCol = columns.length;
  if (lowLetters.length) {
    setScriptFormula_(sheet.getRange(2, totalCol), feedbackTotalFormula_(person, lowLetters));
  }
  const total = '$' + colLetter_(totalCol - 1) + '2';
  rules.push(
    feedbackRule_(
      sheet,
      '=AND(ISNUMBER(' + total + '),' + total + '>0)',
      FEEDBACK_STRONG_ALERT,
      2,
      totalCol,
      1,
    ),
  );
  sheet.setConditionalFormatRules(rules);
}

function feedbackTotalFormula_(person, letters) {
  const parts = letters.map((l) => '$' + l + '$2:$' + l);
  return '=ARRAYFORMULA(IF(' + person + '="","",' + parts.join('+') + '))';
}
