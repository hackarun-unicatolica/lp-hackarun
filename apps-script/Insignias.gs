// insígnias dos NPCs (hackarun.com.br/insignias), parte da organização: formata a aba "Questões" (uma cor por
// palestra) e cuida da aba "Insígnias completas", onde a entrega final registra as equipes que mostraram as 3 fichas.
// Marcou errado? "Desmarcar" apaga a linha: a aba fica só com quem completou de verdade.
// Marcar e desmarcar são idempotentes (repetir o mesmo pedido não muda nada): a tela reenvia sem prazo quando a
// internet volta, e nunca grava a mesma equipe duas vezes.
// Mudou o layout das abas? Suba INSIGNIAS_SETUP_VERSION: a próxima chamada refaz a formatação.

const INSIGNIAS_SETUP_VERSION = '2';
const INSIGNIAS_SETUP_PROPERTY = 'INSIGNIAS_VERSAO';
const INSIGNIAS_DONE_SHEET = 'Insígnias completas';
const INSIGNIAS_DONE = 'completou';
// versão 1 marcava "desmarcado" em vez de apagar; a formatação da versão 2 limpa essas linhas e a coluna extra
const INSIGNIAS_UNDONE = 'desmarcado';
const INSIGNIAS_OLD_COLUMN = 'Desmarcado em';
// hora mandada pela tela (a da marcação, não a do envio): vale se não estiver no futuro nem velha demais
const INSIGNIAS_CLOCK_SKEW_MS = 5 * 60 * 1000;
const INSIGNIAS_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
// [fundo, texto] da linha inteira de cada cor, com contraste AA
const INSIGNIAS_COLOR_STYLES = {
  azul: ['#DCEBFF', '#0B3A8A'],
  amarelo: ['#FFF4C2', '#5C4400'],
  vermelho: ['#FFE0E6', '#8A1530'],
};
// prettier-ignore
const INSIGNIAS_QUESTION_COLUMNS = [
  { title: 'Cor', width: 90, align: 'center' },
  { title: 'Nº', width: 50, align: 'center' },
  { title: 'Pergunta', width: 380, wrap: true },
  { title: 'A', width: 230, wrap: true },
  { title: 'B', width: 230, wrap: true },
  { title: 'C', width: 230, wrap: true },
  { title: 'D', width: 230, wrap: true },
  { title: 'Resposta', width: 90, align: 'center' },
];
// prettier-ignore
const INSIGNIAS_DONE_COLUMNS = [
  { title: 'Equipe', width: 220 },
  { title: 'Completou em', width: 160, format: 'dd/MM/yyyy HH:mm:ss', align: 'center' },
  { title: 'Situação', width: 130, align: 'center' },
];

// formata as duas abas uma vez por versão (a chamada seguinte só confere a propriedade)
function insigniasSetup_(book) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(INSIGNIAS_SETUP_PROPERTY) === INSIGNIAS_SETUP_VERSION) return;
  const questions = book.getSheetByName(GEMS_SHEET);
  if (questions) {
    styleTable_(questions, INSIGNIAS_QUESTION_COLUMNS, 2, '#FFC24A');
    questions.getRange(2, 1, questions.getMaxRows() - 1, 2).setFontWeight('bold');
    questions.getRange(2, 8, questions.getMaxRows() - 1, 1).setFontWeight('bold');
    questions.setConditionalFormatRules(
      Object.keys(INSIGNIAS_COLOR_STYLES).map((color) =>
        insigniasRule_(questions, '=LOWER(TRIM($A2))="' + color + '"', INSIGNIAS_COLOR_STYLES[color], 8),
      ),
    );
  }
  const done = ensureTab_(book, INSIGNIAS_DONE_SHEET, book.getSheets().length);
  insigniasCleanOld_(done);
  styleTable_(done, INSIGNIAS_DONE_COLUMNS, 1, '#2CF5B4');
  done.setConditionalFormatRules([
    insigniasRule_(
      done,
      '=$C2="' + INSIGNIAS_DONE + '"',
      ['#D9F5E8', '#0B5A38'],
      INSIGNIAS_DONE_COLUMNS.length,
    ),
  ]);
  props.setProperty(INSIGNIAS_SETUP_PROPERTY, INSIGNIAS_SETUP_VERSION);
}

// layout da versão 1: tira a coluna "Desmarcado em" e as linhas desmarcadas (de baixo para cima)
function insigniasCleanOld_(sheet) {
  if (
    sheet.getLastColumn() >= 4 &&
    String(sheet.getRange(1, 4, 1, 1).getValues()[0][0]).trim() === INSIGNIAS_OLD_COLUMN
  ) {
    sheet.deleteColumn(4);
  }
  insigniasRows_(sheet)
    .filter((r) => r.status === INSIGNIAS_UNDONE)
    .reverse()
    .forEach((r) => sheet.deleteRow(r.row));
}

function insigniasRule_(sheet, formula, colors, width) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(localizeFormula_(formula, formulaSeparator_()))
    .setBackground(colors[0])
    .setFontColor(colors[1])
    .setRanges([sheet.getRange(2, 1, sheet.getMaxRows() - 1, width)])
    .build();
}

// equipes confirmadas (aba Equipes), na ordem da planilha
function insigniasTeams_(book) {
  const sheet = book.getSheetByName(TEAMS_SHEET);
  if (!hasHeaders_(sheet, TEAM_HEADERS)) return [];
  return readRows_(sheet, TEAM_HEADERS.length)
    .filter((r) => isConfirmed_(r[TCOL.status]) && nameKey_(r[TCOL.name]))
    .map((r) => cellText_(r[TCOL.name]).trim());
}

// linhas da aba (com o número da linha na planilha), na ordem em que foram registradas
function insigniasRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet
    .getRange(2, 1, last - 1, INSIGNIAS_DONE_COLUMNS.length)
    .getValues()
    .map((r, i) => ({ row: i + 2, team: cellText_(r[0]).trim(), at: r[1], status: String(r[2]).trim() }));
}

function insigniasDone_(sheet) {
  return insigniasRows_(sheet)
    .filter((r) => r.status === INSIGNIAS_DONE && r.team)
    .map((r) => ({ team: r.team, at: r.at instanceof Date ? r.at.toISOString() : String(r.at) }));
}

// o que a tela da entrega mostra: todas as equipes e quem já completou, em ordem de chegada
function insigniasState_(book) {
  const done = book.getSheetByName(INSIGNIAS_DONE_SHEET);
  return { ok: true, teams: insigniasTeams_(book), done: done ? insigniasDone_(done) : [] };
}

// hora da marcação vinda da tela (ISO); fora da faixa aceitável, vale a hora do servidor
function insigniasWhen_(raw) {
  const now = Date.now();
  const at = new Date(String(raw || '')).getTime();
  const fine = at > 0 && at <= now + INSIGNIAS_CLOCK_SKEW_MS && now - at <= INSIGNIAS_MAX_AGE_MS;
  return new Date(fine ? at : now);
}

// gems-finish e gems-undo: a equipe precisa existir. Idempotente: marcar quem já está marcada ou desmarcar quem não
// está não muda nada e responde ok (reenvio depois de queda de conexão nunca duplica)
function insigniasChange_(book, action, rawTeam, rawAt) {
  const key = nameKey_(rawTeam);
  const team = insigniasTeams_(book).find((name) => nameKey_(name) === key);
  if (!key || !team)
    return { ok: false, error: 'unknown-team', message: 'Equipe não encontrada na aba Equipes.' };
  const sheet = book.getSheetByName(INSIGNIAS_DONE_SHEET);
  const active = insigniasRows_(sheet).filter((r) => r.status === INSIGNIAS_DONE && nameKey_(r.team) === key);
  if (action === 'gems-finish') {
    if (active.length === 0) sheet.appendRow([team, insigniasWhen_(rawAt), INSIGNIAS_DONE]);
  } else {
    active.reverse().forEach((r) => sheet.deleteRow(r.row));
  }
  SpreadsheetApp.flush();
  return insigniasState_(book);
}
