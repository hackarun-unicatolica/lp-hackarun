// sorteio das equipes no dia do evento (telas /sorteio e /sorteio/nomes do site, atrás do login da organização).
// O site não fala direto com este script: a função da Cloudflare confere o login e repassa o pedido com a chave
// SORTEIO_TOKEN (Propriedades do script). Sem essa propriedade, nenhuma ação do sorteio responde.
// Mesmo protocolo da cópia local de teste (tools/sorteio/xlsx-handler.mjs): draw-list, draw-save, draw-names e
// draw-publish. Grava sempre em lote (uma leitura e uma escrita por coluna), com o lock do script

const DRAW_SHEET = 'Sorteio';
const DRAW_HEADERS = [
  'Nº',
  'Equipe',
  'Pokémon (nº)',
  'Integrantes',
  'Semente',
  'Repetições de nível',
  'Data/hora',
];
const DRAW_TOKEN_PROPERTY = 'SORTEIO_TOKEN';
// chave curta demais não vale (evita ligar o sorteio com uma senha fraca por engano)
const DRAW_TOKEN_MIN = 24;
const DRAW_ACTIONS = ['draw-list', 'draw-save', 'draw-names', 'draw-publish'];
// arte oficial dos Pokémon (repositório público da PokeAPI): vira a insígnia da equipe na aba Equipes
const DRAW_ARTWORK_URL =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
// planilha de ensaio: o nome tem "cópia" ou "teste" e as telas do sorteio avisam. A oficial não mostra nada
const DRAW_TEST_SHEET = /c[oó]pia|teste/i;
const DRAW_GROUP_TITLE = 'Menina';
const DRAW_GROUP_OPTIONS = ['sim', 'não', 'conferir'];
const DRAW_GROUP_OTHER =
  /^(joshua|josua|luca|lucca|gianluca|nicola|nikola|mustafa|jonata|jonatha|isaia|jeremia|ezequia|barnaba|kaua|caua)$/;
const DRAW_GROUP_EXTRA =
  /^(stefani|stephani|beatriz|raquel|isabel|ester|esther|rute|ruth|carmen|ingrid|kelly|kelli|thais|tais|lais|agnes|ines|mirian|miriam|myriam|yasmin|yasmim|jasmin|jasmine|vivian|emily|emilly|emilli|emilie|evelyn|evellyn|jocelyn|nicole|nicolle|sarah)$/;
const DRAW_GROUP_ENDINGS = /(ane|ene|elle|ele|ine|yne|ice|ise|ete|ette|ilde|any|anny|iny|elly|illy|olly)$/;
const DRAW_GROUP_UNSURE =
  /^(alex|ariel|darci|darcy|jordan|andrea|sasha|juracy|jaci|dominique|kim|cris|robin|taylor|morgan|valdeci|noa|ira|iran|isa|lua|eri|yuri|iuri|gabi|rafa|jean|mika|elis|deni|rene|renee)$/;

function drawAction_(body) {
  if (!drawAuthorized_(body.token)) return json_({ ok: false, error: 'unauthorized' });
  if (DRAW_ACTIONS.indexOf(body.action) === -1) return json_({ ok: false, error: 'unknown-action' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy', message: 'A planilha está ocupada. Tente de novo.' });
  }
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const ctx = drawContext_(book);
    let out;
    if (body.action === 'draw-list') out = drawList_(ctx);
    else if (body.action === 'draw-save') out = drawSave_(ctx, body);
    else if (body.action === 'draw-names') out = drawNames_(ctx, body);
    else out = drawPublish_(ctx);
    // só quem grava precisa esperar as escritas assentarem (a leitura não: o flush custava segundos à toa)
    if (body.action !== 'draw-list') SpreadsheetApp.flush();
    return json_(out);
  } catch (err) {
    if (err && err.drawConflict) return json_({ ok: false, error: 'conflict', message: err.message });
    console.error(err);
    return json_({ ok: false, error: 'server', message: 'Erro ao gravar na planilha.' });
  } finally {
    lock.releaseLock();
  }
}

// rode uma vez no editor (selecione gerarChaveSorteio e clique em Executar): cria a chave SORTEIO_TOKEN, se ainda não
// existir, e mostra no registro de execução para copiar no segredo SORTEIO_TOKEN da Cloudflare. Apagar a propriedade
// desliga o sorteio pelo site na hora
function gerarChaveSorteio() {
  const props = PropertiesService.getScriptProperties();
  let token = String(props.getProperty(DRAW_TOKEN_PROPERTY) || '');
  if (token.length < DRAW_TOKEN_MIN) {
    token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty(DRAW_TOKEN_PROPERTY, token);
  }
  console.log('Chave do sorteio (copie no segredo SORTEIO_TOKEN da Cloudflare): ' + token);
  return token;
}

function drawAuthorized_(token) {
  const expected = String(PropertiesService.getScriptProperties().getProperty(DRAW_TOKEN_PROPERTY) || '');
  if (expected.length < DRAW_TOKEN_MIN) return false;
  // compara os resumos, não os textos: o tempo da comparação não entrega quantos caracteres bateram
  return digest_(String(token || '')) === digest_(expected);
}

function drawGroupColumn_(sheet) {
  const width = sheet.getLastColumn();
  if (width < 1) return 0;
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(drawText_).indexOf(DRAW_GROUP_TITLE) + 1;
}

function drawGroupValues_(sheet) {
  const column = drawGroupColumn_(sheet);
  const last = sheet.getLastRow();
  const map = {};
  if (!column || last < 2) return map;
  const values = sheet.getRange(2, column, last - 1, 1).getValues();
  sheet
    .getRange(2, RCOL.protocol + 1, last - 1, 1)
    .getValues()
    .forEach((r, i) => {
      map[drawText_(r[0])] = drawText_(values[i][0]).toLowerCase();
    });
  return map;
}

function drawGuessGroup_(fullName) {
  const raw = drawText_(fullName).toLowerCase().split(/\s+/)[0] || '';
  const first = drawStatus_(raw);
  if (!first || DRAW_GROUP_UNSURE.test(first)) return 'conferir';
  if (raw.slice(-1) === 'ã' || DRAW_GROUP_OTHER.test(first)) return 'não';
  if (first.slice(-1) === 'a' || DRAW_GROUP_EXTRA.test(first) || DRAW_GROUP_ENDINGS.test(first)) return 'sim';
  return 'não';
}

// rode no editor: cria a coluna na aba Inscritos e sugere o valor de quem ainda está em branco (o que foi corrigido à
// mão não muda). Depois é só revisar as linhas marcadas com "conferir"
function sugerirGrupos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REGISTRATIONS_SHEET);
  const existing = drawGroupColumn_(sheet);
  const column = existing || Math.max(sheet.getLastColumn(), REGISTRATION_HEADERS.length) + 1;
  if (!existing) drawCreateGroupColumn_(sheet, column);
  const count = sheet.getLastRow() - 1;
  if (count < 1) return 0;
  const names = sheet.getRange(2, RCOL.name + 1, count, 1).getValues();
  const range = sheet.getRange(2, column, count, 1);
  const filled = range.getValues().map((r, i) => [drawText_(r[0]) || drawGuessGroup_(names[i][0])]);
  range.setValues(filled);
  const pending = filled.filter((r) => r[0] === 'conferir').length;
  console.log('Preenchido: ' + count + ' linhas, ' + pending + ' para conferir');
  return pending;
}

function drawCreateGroupColumn_(sheet, column) {
  if (sheet.getMaxColumns() < column) sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet
    .getRange(1, column)
    .setValue(DRAW_GROUP_TITLE)
    .setFontWeight('bold')
    .setFontColor(BRAND.ice)
    .setBackground(BRAND.night);
  sheet.setColumnWidth(column, 100);
  const body = sheet.getRange(2, column, sheet.getMaxRows() - 1, 1);
  body.setHorizontalAlignment('center');
  body.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(DRAW_GROUP_OPTIONS, true)
      .setAllowInvalid(false)
      .build(),
  );
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + colLetter_(column - 1) + '2="conferir"')
    .setBackground('#FFF1CC')
    .setFontColor('#6B4400')
    .setRanges([body])
    .build();
  sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat([rule]));
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.getRange(1, 1, sheet.getMaxRows(), column).createFilter();
}

function drawConflict_(message) {
  const err = new Error(message);
  err.drawConflict = true;
  return err;
}

const drawText_ = (value) => String(value === null || value === undefined ? '' : value).trim();
const drawStatus_ = (value) => drawText_(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// aba Equipes: só as colunas Equipe e Status. As outras (integrantes, e-mails, WhatsApps, contagem) são fórmulas que
// recalculam a cada leitura e deixavam o sorteio dos nomes lento. O resto da linha fica vazio (nada daqui usa)
function drawReadTeamRows_(teams) {
  const last = teams.getLastRow();
  if (last < 2) return [];
  const count = last - 1;
  const names = teams.getRange(2, TCOL.name + 1, count, 1).getValues();
  const status = teams.getRange(2, TCOL.status + 1, count, 1).getValues();
  return names.map((n, i) => {
    const row = TEAM_HEADERS.map(() => '');
    row[TCOL.name] = n[0];
    row[TCOL.status] = status[i][0];
    return row;
  });
}

// as três abas, já lidas: Inscritos (pessoas), Equipes (nome e status) e Sorteio (o registro do sorteio)
function drawContext_(book) {
  const registrations = book.getSheetByName(REGISTRATIONS_SHEET);
  const teams = book.getSheetByName(TEAMS_SHEET);
  if (!hasHeaders_(registrations, REGISTRATION_HEADERS) || !hasHeaders_(teams, TEAM_HEADERS)) {
    throw drawConflict_('A planilha não está no formato atual (rode o configurarPlanilha).');
  }
  let draw = book.getSheetByName(DRAW_SHEET);
  if (!draw) {
    draw = book.insertSheet(DRAW_SHEET);
    draw.getRange(1, 1, 1, DRAW_HEADERS.length).setValues([DRAW_HEADERS]).setFontWeight('bold');
    draw.setFrozenRows(1);
  }
  return {
    bookName: String(book.getName ? book.getName() : ''),
    registrations: registrations,
    teams: teams,
    draw: draw,
    people: readRows_(registrations, REGISTRATION_HEADERS.length),
    group: drawGroupValues_(registrations),
    teamRows: drawReadTeamRows_(teams),
    drawRows: readRows_(draw, DRAW_HEADERS.length),
  };
}

// equipes do sorteio salvo (aba Sorteio), na ordem: número, nome atual e o Pokémon (null até o sorteio dos nomes)
function drawTeams_(ctx) {
  return ctx.drawRows
    .map((r) => ({
      number: Number(r[0]) || 0,
      name: drawText_(r[1]),
      pokemonId: Number(r[2]) || null,
    }))
    .filter((t) => t.number > 0 && t.name);
}

function drawList_(ctx) {
  const people = ctx.people.filter((r) => drawText_(r[RCOL.protocol]));
  const accredited = people
    .filter((r) => drawStatus_(r[RCOL.status]) === 'credenciado')
    .map((r) => {
      const row = {
        protocol: drawText_(r[RCOL.protocol]),
        name: drawText_(r[RCOL.name]),
        profile: drawText_(r[RCOL.profile]),
        institution: drawText_(r[RCOL.institution]),
        period: drawText_(r[RCOL.period]),
        team: drawText_(r[RCOL.team]),
      };
      if (ctx.group[row.protocol] === 'sim') row.female = true;
      if (ctx.group[row.protocol] === 'conferir') row.review = true;
      return row;
    });
  const confirmed = ctx.teamRows
    .filter((r) => drawStatus_(r[TCOL.status]) === 'confirmado')
    .map((r) => drawText_(r[TCOL.name]));
  const teams = drawTeams_(ctx).map((t) => ({
    number: t.number,
    name: t.name,
    pokemonId: t.pokemonId,
    // já aparece em /equipes (o "Publicar no site" confirmou)
    published: confirmed.indexOf(t.name) > -1,
    members: people
      .filter((r) => drawText_(r[RCOL.team]) === t.name && drawStatus_(r[RCOL.status]) !== 'cancelado')
      .map((r) => ({ id: drawText_(r[RCOL.protocol]), name: drawText_(r[RCOL.name]) })),
  }));
  return {
    ok: true,
    accredited: accredited,
    teams: teams,
    // só nas planilhas de ensaio: o nome da planilha, para a tela avisar que não é a oficial
    testSheet: DRAW_TEST_SHEET.test(ctx.bookName) ? ctx.bookName : null,
  };
}

// grava as equipes do sorteio. `replace` troca um sorteio salvo antes, desde que nenhuma equipe tenha nome ainda
function drawSave_(ctx, body) {
  const teams = Array.isArray(body.teams) ? body.teams : [];
  if (teams.length === 0) throw drawConflict_('Nenhuma equipe para salvar.');
  const previous = drawTeams_(ctx);
  if (previous.length > 0 && !body.replace) throw drawConflict_('Já existe um sorteio salvo.');
  if (previous.some((t) => t.pokemonId !== null)) {
    throw drawConflict_('Alguma equipe já tem nome: não dá para refazer.');
  }
  const oldNames = previous.map((t) => t.name);
  const memberTeam = drawCheckMembers_(ctx, teams, oldNames);
  const names = teams.map((t) => 'Equipe ' + Number(t.number));

  // coluna Equipe da aba Inscritos: limpa o sorteio anterior e grava o novo, numa escrita só
  const teamColumn = ctx.people.map((r) => {
    const protocol = drawText_(r[RCOL.protocol]);
    if (memberTeam[protocol]) return [memberTeam[protocol]];
    return [oldNames.indexOf(drawText_(r[RCOL.team])) > -1 ? '' : r[RCOL.team]];
  });

  drawWriteTeamRows_(ctx, oldNames, names);
  if (teamColumn.length) {
    ctx.registrations.getRange(2, RCOL.team + 1, teamColumn.length, 1).setValues(teamColumn);
  }

  // aba Sorteio: só o sorteio atual (o anterior sai)
  const stamp = new Date();
  const rows = teams.map((t, i) => [
    Number(t.number),
    names[i],
    '',
    t.members.length,
    drawText_(body.seed),
    Number(body.levelRepeats) || 0,
    stamp,
  ]);
  // linhas a mais do sorteio anterior ficam em branco (mesma escrita)
  while (rows.length < ctx.drawRows.length) rows.push(DRAW_HEADERS.map(() => ''));
  ctx.draw.getRange(2, 1, rows.length, DRAW_HEADERS.length).setValues(rows);
  CacheService.getScriptCache().remove(TEAMS_CACHE_KEY);
  return { ok: true, saved: teams.length };
}

// cada pessoa: existe, está credenciada, não está em outra equipe (fora do sorteio que vai ser trocado) e aparece uma vez
function drawCheckMembers_(ctx, teams, oldNames) {
  const byProtocol = {};
  ctx.people.forEach((r) => (byProtocol[drawText_(r[RCOL.protocol])] = r));
  const memberTeam = {};
  teams.forEach((team) => {
    const number = Number(team.number);
    if (!(number > 0) || !Array.isArray(team.members) || team.members.length === 0) {
      throw drawConflict_('Equipe sem número ou sem integrantes.');
    }
    team.members.forEach((id) => {
      const row = byProtocol[drawText_(id)];
      if (!row || drawStatus_(row[RCOL.status]) !== 'credenciado') {
        throw drawConflict_(drawText_(id) + ' não está credenciado.');
      }
      const current = drawText_(row[RCOL.team]);
      if (current && oldNames.indexOf(current) === -1) {
        throw drawConflict_(drawText_(row[RCOL.name]) + ' já está na equipe "' + current + '".');
      }
      if (memberTeam[drawText_(id)]) throw drawConflict_(drawText_(id) + ' aparece em duas equipes.');
      memberTeam[drawText_(id)] = 'Equipe ' + number;
    });
  });
  return memberTeam;
}

// aba Equipes: as linhas do sorteio anterior ficam livres e as equipes novas entram nas primeiras linhas livres, com
// status "pendente" (só o "Publicar no site" confirma). Linha nova ganha as fórmulas de integrantes e insígnia
function drawWriteTeamRows_(ctx, oldNames, names) {
  const rows = ctx.teamRows.map((r) => [r[TCOL.name], r[TCOL.status]]);
  rows.forEach((r) => {
    if (oldNames.indexOf(drawText_(r[0])) > -1) {
      r[0] = '';
      r[1] = '';
    }
  });
  const fresh = [];
  names.forEach((name) => {
    let index = rows.findIndex((r) => !drawText_(r[0]));
    if (index === -1) {
      index = rows.length;
      rows.push(['', '']);
      fresh.push(index + 2);
    }
    rows[index] = [name, 'pendente'];
  });
  ctx.teams.getRange(2, TCOL.name + 1, rows.length, 1).setValues(rows.map((r) => [r[0]]));
  drawRestoreBadges_(ctx, rows.length, () => true);
  ctx.teams.getRange(2, TCOL.status + 1, rows.length, 1).setValues(rows.map((r) => [r[1]]));
  // linhas além das que o configurarPlanilha preparou (passou de TEAM_ROWS equipes)
  fresh.forEach((row) => {
    const formulas = teamFormulas_(row);
    Object.keys(formulas).forEach((col) =>
      setScriptFormula_(ctx.teams.getRange(row, Number(col) + 1), formulas[col]),
    );
  });
  if (fresh.length) ctx.teams.setRowHeights(fresh[0], fresh.length, BADGE_ROW_HEIGHT);
}

// insígnia = miniatura. Com Pokémon sorteado ela mostra a arte dele; a insígnia do Drive (coluna ID da insígnia), se a
// organização colar uma, ganha. Só enfeite da aba: se falhar, o sorteio segue
function drawBadgeFormula_(row, pokemonId) {
  const id = colLetter_(TCOL.badgeId) + row;
  const drive = '"https://lh3.googleusercontent.com/d/"&' + id + '&"=w' + BADGE_THUMB_WIDTH + '"';
  const art = '"' + DRAW_ARTWORK_URL + pokemonId + '.png"';
  return '=IF(' + id + '<>"",IMAGE(' + drive + '),IMAGE(' + art + '))';
}

function drawPokemonBadges_(ctx, plan) {
  try {
    if (!ctx.teamRows.length) return;
    const range = ctx.teams.getRange(2, TCOL.badge + 1, ctx.teamRows.length, 1);
    const formulas = range.getFormulas();
    ctx.teamRows.forEach((r, i) => {
      const step = plan.find((p) => p.from === drawText_(r[TCOL.name]));
      if (step)
        formulas[i] = [localizeFormula_(drawBadgeFormula_(i + 2, step.pokemonId), formulaSeparator_())];
    });
    range.setFormulas(formulas);
  } catch (err) {
    console.error(err);
  }
}

// volta a insígnia padrão (Drive) nas linhas da aba Equipes escolhidas por `pick(índice)`
function drawRestoreBadges_(ctx, count, pick) {
  try {
    if (count < 1) return;
    const range = ctx.teams.getRange(2, TCOL.badge + 1, count, 1);
    const formulas = range.getFormulas();
    for (let i = 0; i < count; i++) {
      if (pick(i)) formulas[i] = [localizeFormula_(teamFormulas_(i + 2)[TCOL.badge], formulaSeparator_())];
    }
    range.setFormulas(formulas);
  } catch (err) {
    console.error(err);
  }
}

// dá nome (Pokémon) a uma ou várias equipes. Confere tudo antes: ou grava todas, ou nenhuma
function drawNames_(ctx, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw drawConflict_('Nenhuma equipe para nomear.');
  const teams = drawTeams_(ctx);
  const usedPokemon = teams.map((t) => t.pokemonId).filter((id) => id !== null);
  const usedNames = teams.map((t) => t.name);
  const seen = [];
  const plan = items.map((item) => {
    const number = Number(item.number);
    const pokemonId = Number(item.pokemonId);
    const name = drawText_(item.name).slice(0, 40);
    if (!(number > 0) || !(pokemonId > 0) || !name) {
      throw drawConflict_('Faltam o número da equipe, o Pokémon ou o nome.');
    }
    const team = teams.find((t) => t.number === number);
    if (!team) throw drawConflict_('A Equipe ' + number + ' não está salva.');
    if (team.pokemonId !== null || seen.indexOf(number) > -1) {
      throw drawConflict_('A ' + team.name + ' já foi sorteada.');
    }
    if (usedPokemon.indexOf(pokemonId) > -1) {
      throw drawConflict_('Esse Pokémon já foi sorteado para outra equipe.');
    }
    if (usedNames.indexOf(name) > -1) throw drawConflict_('Já existe uma equipe com esse nome.');
    seen.push(number);
    usedPokemon.push(pokemonId);
    usedNames.push(name);
    return { from: team.name, to: name, number: number, pokemonId: pokemonId };
  });

  const rename = {};
  plan.forEach((p) => (rename[p.from] = p.to));
  const renamed = (value) => {
    const name = drawText_(value);
    return Object.prototype.hasOwnProperty.call(rename, name) ? rename[name] : value;
  };
  if (ctx.teamRows.length) {
    ctx.teams
      .getRange(2, TCOL.name + 1, ctx.teamRows.length, 1)
      .setValues(ctx.teamRows.map((r) => [renamed(r[TCOL.name])]));
  }
  if (ctx.people.length) {
    ctx.registrations
      .getRange(2, RCOL.team + 1, ctx.people.length, 1)
      .setValues(ctx.people.map((r) => [renamed(r[RCOL.team])]));
  }
  const drawCells = ctx.drawRows.map((r) => {
    const step = plan.find((p) => p.number === Number(r[0]));
    return step ? [step.to, step.pokemonId] : [r[1], r[2]];
  });
  ctx.draw.getRange(2, 2, drawCells.length, 2).setValues(drawCells);
  drawPokemonBadges_(ctx, plan);
  CacheService.getScriptCache().remove(TEAMS_CACHE_KEY);
  return { ok: true, named: plan.length };
}

// "Publicar no site": todas as equipes do sorteio com nome viram "confirmado" e aparecem em /equipes
function drawPublish_(ctx) {
  const teams = drawTeams_(ctx);
  if (teams.length === 0) throw drawConflict_('Ainda não há equipes salvas.');
  if (teams.some((t) => t.pokemonId === null)) {
    throw drawConflict_('Ainda há equipe sem nome: sorteie todos os nomes antes de publicar.');
  }
  const names = teams.map((t) => t.name);
  const status = ctx.teamRows.map((r) =>
    names.indexOf(drawText_(r[TCOL.name])) > -1 ? ['confirmado'] : [r[TCOL.status]],
  );
  ctx.teams.getRange(2, TCOL.status + 1, status.length, 1).setValues(status);
  CacheService.getScriptCache().remove(TEAMS_CACHE_KEY);
  return { ok: true, published: teams.length };
}

// Pokémon de cada equipe (pelo nome), para a lista pública mostrar a imagem dele
function drawPokemonByTeam_(book) {
  const sheet = book.getSheetByName(DRAW_SHEET);
  const map = {};
  if (!sheet) return map;
  readRows_(sheet, DRAW_HEADERS.length).forEach((r) => {
    const id = Number(r[2]);
    if (id > 0) map[nameKey_(r[1])] = id;
  });
  return map;
}
