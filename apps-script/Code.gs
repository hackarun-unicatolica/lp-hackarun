// HackaRun 2026: Web App que grava as inscrições individuais do site na planilha, informa as vagas ocupadas e
// publica as equipes confirmadas depois do sorteio. Cole no editor do Apps Script da planilha
// (Extensões > Apps Script) junto com os outros .gs desta pasta (passo a passo no README.md).

const TEAMS_CACHE_KEY = 'teams:v6';
const TEAMS_CACHE_SECONDS = 60;
// Propriedade do script com o segredo dos ids públicos das equipes (idSecret_)
const ID_SECRET_PROPERTY = 'ID_SEGREDO';
// colunas da aba Equipes que aparecem no site: mexeu numa delas, a lista pública atualiza na hora
const PUBLIC_TEAM_COLUMNS = ['name', 'badge', 'count', 'status', 'badgeId', 'link'];

function doPost(e) {
  const body = parseBody_(e);
  // sorteio das equipes (Draw.gs): vem da função do site com a chave do sorteio, não do formulário
  if (body && typeof body.action === 'string' && body.action.indexOf('draw-') === 0) return drawAction_(body);
  // avaliação entre colegas (Feedback.gs): mesma chave do sorteio, também vem só da função do site
  if (body && typeof body.action === 'string' && body.action.indexOf('feedback-') === 0) {
    return feedbackAction_(body);
  }
  // primeiro filtro, barato: honeypot preenchido ou formulário enviado rápido demais
  if (!body || isBot_(body)) return json_({ ok: false, error: 'invalid' });
  // cadastro de mentor: outro fluxo e outra aba (Mentors.gs); não passa pelo prazo nem pelas vagas da inscrição
  if (body.action === 'register-mentor') return registerMentor_(body);
  const config = readConfig_();
  if (closedByConfig_(config, Date.now())) return json_({ ok: false, error: 'closed' });
  const data = validateRegistration_(body);
  if (!data) return json_({ ok: false, error: 'invalid' });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'rate-limited' });
  }
  try {
    const output = registerLocked_(data, body, config);
    // grava a linha antes de soltar o lock: a próxima da fila já enxerga esta pessoa (duplicados e vagas)
    SpreadsheetApp.flush();
    return output;
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// a parte que precisa do lock: reenvio, limite, duplicados, capacidade e a linha nova
function registerLocked_(data, body, config) {
  const cache = CacheService.getScriptCache();
  // retry do mesmo envio recebe o mesmo protocolo (caminho rápido, sem ler a planilha)
  const retryKey = 'sub:' + digest_(submissionId_(data, body));
  const previous = cache.get(retryKey);
  if (previous) return json_({ ok: true, protocol: previous });
  if (rateLimited_(cache, digest_(data.participant.email), Date.now())) {
    return json_({ ok: false, error: 'rate-limited' });
  }

  const sheet = workbook_(config).registrations;
  const registry = loadRegistry_(sheet);
  // a resposta do primeiro envio se perdeu e o cache já foi: a chave gravada na linha reconhece o envio
  const saved = savedProtocol_(registry, data);
  if (saved) return accepted_(cache, retryKey, saved);
  const conflict = findConflict_(registry, data);
  if (conflict) return json_(conflict);
  if (capacityReached_(config, registry.active)) return json_({ ok: false, error: 'closed' });
  const protocol = newProtocol_(registry.rows);
  appendRegistration_(sheet, protocol, data);
  cache.remove(SLOTS_CACHE_KEY);
  return accepted_(cache, retryKey, protocol);
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  // open = prazo e propriedades ok (não lê a planilha); serve pra conferir a configuração
  if (action === 'health') return json_({ ok: true, open: !closedByConfig_(readConfig_(), Date.now()) });
  if (action === 'slots') return json_(slotsStatus_());
  if (action === 'teams') return json_({ ok: true, teams: confirmedTeams_() });
  return json_({ ok: false, error: 'unknown-action' });
}

// gatilho simples: mudou o que o site mostra, o cache sai na hora (sem esperar os 30/60 s)
function onEdit(e) {
  try {
    const range = e && e.range;
    if (!range) return;
    const name = range.getSheet().getName();
    const touches = (col) => range.getColumn() <= col + 1 && range.getLastColumn() >= col + 1;
    const cache = CacheService.getScriptCache();
    if (name === TEAMS_SHEET && PUBLIC_TEAM_COLUMNS.some((key) => touches(TCOL[key]))) {
      cache.remove(TEAMS_CACHE_KEY);
    }
    if (name !== REGISTRATIONS_SHEET) return;
    // Status muda a vaga e a contagem de integrantes; Equipe muda só a contagem
    if (touches(RCOL.status)) cache.remove(SLOTS_CACHE_KEY);
    // nome e Equipe também: a lista pública mostra quem está em cada equipe
    if (touches(RCOL.status) || touches(RCOL.team) || touches(RCOL.name)) cache.remove(TEAMS_CACHE_KEY);
  } catch (err) {
    // gatilho simples não pode quebrar a edição da planilha
  }
}

// o que a página /equipes mostra: id derivado do nome, nome da equipe, quantidade e nomes dos integrantes (para os
// competidores saberem com quem vão trabalhar), o id da insígnia e o Pokémon do sorteio dos nomes. Nunca e-mail,
// WhatsApp, matrícula nem outro dado de contato
function confirmedTeams_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(TEAMS_CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEAMS_SHEET);
  // aba da inscrição antiga ainda com o nome Equipes (configurarPlanilha não rodou): nada sai pro site
  const rows = hasHeaders_(sheet, TEAM_HEADERS) ? readRows_(sheet, TEAM_HEADERS.length) : [];
  // uma leitura das Propriedades por chamada (e não uma por equipe): a cota diária é contada por leitura
  const secret = rows.length ? idSecret_() : '';
  const pokemon = rows.length ? drawPokemonByTeam_(SpreadsheetApp.getActiveSpreadsheet()) : {};
  const members = rows.length ? teamMembers_(SpreadsheetApp.getActiveSpreadsheet()) : {};
  const teams = rows
    .filter((r) => isConfirmed_(r[TCOL.status]) && nameKey_(r[TCOL.name]))
    .map((r) => ({
      id: publicTeamId_(nameKey_(r[TCOL.name]), secret),
      name: cellText_(r[TCOL.name]).trim().slice(0, 40),
      memberCount: Math.max(1, Math.round(Number(r[TCOL.count]) || 1)),
      imageId: publicImageId_(r[TCOL.badgeId]),
      pokemonId: pokemon[nameKey_(r[TCOL.name])] || null,
      members: members[nameKey_(r[TCOL.name])] || [],
    }));
  cache.put(TEAMS_CACHE_KEY, JSON.stringify(teams), TEAMS_CACHE_SECONDS);
  return teams;
}

// nomes de quem está em cada equipe (aba Inscritos, coluna Equipe), sem quem cancelou, em ordem alfabética
function teamMembers_(book) {
  const sheet = book.getSheetByName(REGISTRATIONS_SHEET);
  const map = {};
  if (!hasHeaders_(sheet, REGISTRATION_HEADERS)) return map;
  readRows_(sheet, REGISTRATION_HEADERS.length).forEach((r) => {
    const key = nameKey_(r[RCOL.team]);
    const name = cellText_(r[RCOL.name]).trim().slice(0, 80);
    if (!key || !name || String(r[RCOL.status]).trim().toLowerCase() === 'cancelado') return;
    (map[key] = map[key] || []).push(name);
  });
  Object.keys(map).forEach((key) => map[key].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  return map;
}

// mesmo envio = mesma chave do formulário + mesmo e-mail; site antigo sem chave: e-mail + horário do cliente
function submissionId_(data, body) {
  const email = data.participant.email;
  if (data.idempotencyKey) return 'key|' + data.idempotencyKey + '|' + email;
  return email + '|' + String(body.submittedAt || '');
}

function accepted_(cache, retryKey, protocol) {
  cache.put(retryKey, protocol, 600);
  return json_({ ok: true, protocol: protocol });
}

// sem 0/O/1/I pra ninguém confundir ao ditar
function newProtocol_(rows) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used = rows.map((r) => String(r[RCOL.protocol]));
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    const protocol = 'HR26-' + code;
    if (used.indexOf(protocol) === -1) return protocol;
  }
  throw new Error('Could not generate a unique protocol');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// id público da equipe na lista do site: hash do nome (sem acento e sem caixa) com o segredo do script.
// Corrigir a caixa ou um acento do nome não muda o id; trocar o nome muda
function publicTeamId_(teamKey, secret) {
  return 'team-' + digest_(secret + '|' + teamKey).slice(0, 10);
}

// criado sozinho na 1ª vez e guardado nas Propriedades do script; trocar ou apagar muda os ids públicos
function idSecret_() {
  const props = PropertiesService.getScriptProperties();
  const saved = String(props.getProperty(ID_SECRET_PROPERTY) || '');
  if (saved) return saved;
  const secret = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty(ID_SECRET_PROPERTY, secret);
  return secret;
}

function digest_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
