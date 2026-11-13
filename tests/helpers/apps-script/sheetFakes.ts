// dublês da planilha (SpreadsheetApp): abas, intervalos, fórmulas e o que a formatação pediu.
// Formatação (cor, largura, alinhamento...) só fica registrada em `calls`: o teste confere o pedido, não o visual

import { FakeBanding, FakeFilter } from './layoutFakes';
import { protection, type FakeProtection } from './recorders';

export type Cell = string | number | Date;
export { recorder, type FakeProtection } from './recorders';
export { FakeBanding, FakeFilter } from './layoutFakes';

export interface StyleCall {
  method: string;
  a1: string;
  args: unknown[];
}

const letter = (col: number) => String.fromCharCode(64 + col);

export class FakeRange {
  constructor(
    readonly sheet: FakeSheet,
    readonly row: number,
    readonly col: number,
    readonly numRows = 1,
    readonly numCols = 1,
  ) {
    // o que não está aqui (setFontColor, setWrap...) só é registrado e devolve o próprio intervalo
    return new Proxy(this, {
      get: (target, prop: string, receiver) => {
        if (prop in target) return Reflect.get(target, prop, receiver) as unknown;
        if (!prop.startsWith('set')) return undefined;
        return (...args: unknown[]) => {
          target.sheet.calls.push({ method: prop, a1: target.getA1Notation(), args });
          return receiver as unknown;
        };
      },
    });
  }

  getRow = () => this.row;
  getColumn = () => this.col;
  getNumRows = () => this.numRows;
  getNumColumns = () => this.numCols;
  getLastColumn = () => this.col + this.numCols - 1;
  getSheet = () => this.sheet;
  getA1Notation = () =>
    `${letter(this.col)}${this.row}` +
    (this.numRows > 1 || this.numCols > 1
      ? `:${letter(this.getLastColumn())}${this.row + this.numRows - 1}`
      : '');

  getValues(): Cell[][] {
    return Array.from({ length: this.numRows }, (_, r) => {
      const source = this.sheet.rows[this.row - 1 + r] ?? [];
      return Array.from({ length: this.numCols }, (_, c) => source[this.col - 1 + c] ?? '');
    });
  }

  setValues(values: Cell[][]): this {
    values.forEach((line, r) =>
      line.forEach((value, c) => this.sheet.write(this.row + r, this.col + c, value)),
    );
    return this;
  }

  getFormulas(): string[][] {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) => this.sheet.formulaAt(this.row + r, this.col + c) ?? ''),
    );
  }

  setFormulas(formulas: string[][]): this {
    formulas.forEach((line, r) =>
      line.forEach((formula, c) => {
        const key = `${this.row + r},${this.col + c}`;
        if (formula) this.sheet.formulas.set(key, formula);
        else this.sheet.formulas.delete(key);
        this.sheet.write(this.row + r, this.col + c, '');
      }),
    );
    return this;
  }

  setValue(value: Cell): this {
    return this.setValues([[value]]);
  }

  setFormula(formula: string): this {
    this.sheet.formulas.set(`${this.row},${this.col}`, formula);
    this.sheet.write(this.row, this.col, '');
    return this;
  }

  setDataValidation(rule: unknown): this {
    this.sheet.validations.push({ a1: this.getA1Notation(), rule });
    return this;
  }

  clearDataValidations(): this {
    const a1 = this.getA1Notation();
    this.sheet.calls.push({ method: 'clearDataValidations', a1, args: [] });
    this.sheet.validations.splice(0, Infinity, ...this.sheet.validations.filter((v) => v.a1 !== a1));
    return this;
  }

  clearFormat(): this {
    this.sheet.calls.push({ method: 'clearFormat', a1: this.getA1Notation(), args: [] });
    return this;
  }

  createFilter(): FakeFilter {
    if (this.sheet.filter) throw new Error('You can only have one filter per sheet');
    this.sheet.filter = new FakeFilter(this.sheet, this);
    return this.sheet.filter;
  }

  applyRowBanding(...args: unknown[]): FakeBanding {
    const banding = new FakeBanding(this, args);
    this.sheet.bandings.push(banding);
    return banding;
  }

  protect(): FakeProtection {
    const p = protection('RANGE', this.getA1Notation(), this);
    this.sheet.protections.push(p);
    return p;
  }
}

export class FakeSheet {
  readonly rows: Cell[][] = [];
  readonly formulas = new Map<string, string>();
  readonly calls: StyleCall[] = [];
  readonly validations: { a1: string; rule: unknown }[] = [];
  readonly bandings: FakeBanding[] = [];
  readonly protections: FakeProtection[] = [];
  readonly rowHeights = new Map<number, number>();
  readonly columnWidths = new Map<number, number>();
  conditionalRules: unknown[] = [];
  filter: FakeFilter | null = null;
  frozen = { rows: 0, columns: 0 };
  tabColor = '';

  constructor(public name: string) {}

  getName = () => this.name;
  setName = (name: string) => ((this.name = name), this);
  getMaxRows = () => 1000;
  getMaxColumns = () => 26;
  insertColumnAfter = () => this;
  readonly hiddenColumns = new Set<number>();
  hideColumns = (col: number) => (this.hiddenColumns.add(col), this);
  getFilter = () => this.filter;
  getBandings = () => this.bandings;
  getProtections = (type: string) => this.protections.filter((p) => p.type === type);
  getConditionalFormatRules = () => this.conditionalRules;
  setConditionalFormatRules = (rules: unknown[]) => ((this.conditionalRules = rules), this);
  setFrozenRows = (n: number) => ((this.frozen.rows = n), this);
  setFrozenColumns = (n: number) => ((this.frozen.columns = n), this);
  setTabColor = (color: string) => ((this.tabColor = color), this);
  setColumnWidth = (col: number, width: number) => (this.columnWidths.set(col, width), this);
  setRowHeight = (row: number, height: number) => (this.rowHeights.set(row, height), this);
  setRowHeights = (start: number, count: number, height: number) => {
    for (let r = start; r < start + count; r++) this.rowHeights.set(r, height);
    return this;
  };

  protect(): FakeProtection {
    const p = protection('SHEET', this.name);
    this.protections.push(p);
    return p;
  }

  // última linha com algum valor ou fórmula (como a planilha de verdade)
  getLastRow(): number {
    for (let r = this.rows.length; r > 0; r--) {
      const filled = (this.rows[r - 1] ?? []).some((v) => v !== '' && v != null);
      if (filled || [...this.formulas.keys()].some((k) => k.startsWith(`${r},`))) return r;
    }
    return 0;
  }

  getLastColumn(): number {
    return Math.max(0, ...this.rows.map((row) => row.length));
  }

  appendRow(values: Cell[]): this {
    const row = this.getLastRow() + 1;
    values.forEach((value, c) => this.write(row, c + 1, value));
    return this;
  }

  getRange(rowOrA1: number | string, col = 1, numRows = 1, numCols = 1): FakeRange {
    if (typeof rowOrA1 === 'number') return new FakeRange(this, rowOrA1, col, numRows, numCols);
    const [start, end = start] = rowOrA1.split(':') as [string, string?];
    const parse = (ref: string) => [ref.charCodeAt(0) - 64, Number(ref.slice(1))] as const;
    const [c1, r1] = parse(start);
    const [c2, r2] = parse(end as string);
    return new FakeRange(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
  }

  deleteRow(row: number): this {
    this.rows.splice(row - 1, 1);
    return this;
  }

  deleteColumn(col: number): this {
    this.rows.forEach((line) => line.splice(col - 1, 1));
    return this;
  }

  clear(): this {
    this.rows.length = 0;
    this.formulas.clear();
    return this;
  }

  write(row: number, col: number, value: Cell): void {
    const line = (this.rows[row - 1] ??= []);
    for (let c = line.length; c < col - 1; c++) line[c] = '';
    line[col - 1] = value;
    for (let r = 0; r < row - 1; r++) this.rows[r] ??= [];
  }

  formulaAt(row: number, col: number): string | undefined {
    return this.formulas.get(`${row},${col}`);
  }

  // linhas de dados (sem o título)
  get data(): Cell[][] {
    return this.rows.slice(1);
  }
}

export class FakeBook {
  readonly sheets: FakeSheet[] = [];
  // idioma da planilha: define o separador de argumento das fórmulas (pt_BR usa ";")
  locale = 'en_US';
  name = 'HackaRun 2026 · Inscrições';

  getName = () => this.name;
  getSpreadsheetLocale = () => this.locale;

  getSheets = () => [...this.sheets];
  getSheetByName = (name: string) => this.sheets.find((s) => s.name === name) ?? null;

  insertSheet(name: string, index = this.sheets.length): FakeSheet {
    const sheet = new FakeSheet(name);
    this.sheets.splice(index, 0, sheet);
    return sheet;
  }

  add(sheet: FakeSheet): FakeSheet {
    this.sheets.push(sheet);
    return sheet;
  }
}
