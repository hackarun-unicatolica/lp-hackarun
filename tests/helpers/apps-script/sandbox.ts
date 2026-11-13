import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FakeCache, FakeLock, signedSha256 } from './fakes';
import { FakeBook, FakeSheet, recorder, type Cell } from './sheetFakes';
import { FakeDrive } from './driveFakes';

const SCRIPT_DIR = new URL('../../../apps-script/', import.meta.url);
// cada arquivo roda como script separado no mesmo contexto, igual ao editor do Apps Script
export const SCRIPT_FILES = [
  'Code.gs',
  'Validation.gs',
  'Limits.gs',
  'Images.gs',
  'Sheets.gs',
  'Registry.gs',
  'Setup.gs',
  'Summary.gs',
  'Mentors.gs',
  'Draw.gs',
  'Feedback.gs',
  'Gems.gs',
] as const;

export interface ScriptResponse {
  ok: boolean;
  error?: string;
  protocol?: string;
  open?: boolean;
  capacity?: number | null;
  taken?: number;
  teams?: Record<string, unknown>[];
}

interface TextOutput {
  getContent(): string;
}

type Handler = (event: unknown) => TextOutput;
export type Row = Record<string, Cell>;

// roda os .gs de verdade dentro de um vm do Node, com relógio e serviços do Google falsos
export class AppsScriptSandbox {
  readonly cache = new FakeCache();
  readonly lock = new FakeLock();
  readonly drive = new FakeDrive();
  readonly book = new FakeBook();
  readonly properties: Record<string, string> = {};
  readonly errors: unknown[][] = [];
  readonly logs: unknown[][] = [];
  // cada SpreadsheetApp.flush(): true = ainda com o lock na mão
  readonly flushes: boolean[] = [];
  now = Date.parse('2026-10-20T12:00:00-03:00');
  private readonly context: vm.Context;

  constructor() {
    this.context = vm.createContext(this.globals());
    for (const file of SCRIPT_FILES) {
      vm.runInContext(readFileSync(new URL(file, SCRIPT_DIR), 'utf8'), this.context, { filename: file });
    }
  }

  post(body: unknown): ScriptResponse {
    return this.postRaw(JSON.stringify(body));
  }

  postRaw(contents: string): ScriptResponse {
    return this.call('doPost', { postData: { contents } });
  }

  get(action: string): ScriptResponse {
    return this.call('doGet', { parameter: { action } });
  }

  // const do topo do script não vira propriedade do global: só dá pra ler avaliando
  evaluate<T>(expression: string): T {
    return vm.runInContext(expression, this.context) as T;
  }

  tab(name: string): FakeSheet {
    const sheet = this.book.getSheetByName(name);
    if (!sheet) throw new Error(`A aba ${name} ainda não foi criada`);
    return sheet;
  }

  get registrations(): FakeSheet {
    return this.tab('Inscritos');
  }

  get teams(): FakeSheet {
    return this.tab('Equipes');
  }

  get summary(): FakeSheet {
    return this.tab('Resumo');
  }

  // coluna (base 1) pelo título
  column(sheet: FakeSheet, title: string): number {
    const col = (sheet.rows[0] ?? []).map(String).indexOf(title) + 1;
    if (col === 0) throw new Error(`A aba ${sheet.name} não tem a coluna ${title}`);
    return col;
  }

  // linha de dados (base 0) lida pelo título da coluna
  row(sheet: FakeSheet, index: number): Row {
    const headers = (sheet.rows[0] ?? []).map(String);
    const values = sheet.data[index] ?? [];
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  }

  // muda uma célula como a organização faria (sem disparar o onEdit)
  edit(sheet: FakeSheet, index: number, title: string, value: Cell): void {
    sheet.write(index + 2, this.column(sheet, title), value);
  }

  // o gatilho simples, como se a pessoa tivesse editado a coluna `title`
  onEdit(sheet: FakeSheet, title: string): void {
    const col = this.column(sheet, title);
    const range = { getSheet: () => sheet, getColumn: () => col, getLastColumn: () => col };
    this.evaluate<(e: unknown) => void>('onEdit')({ range });
  }

  // planilha já configurada (layout atual), com linhas montadas pelo nome da coluna
  seed(registrations: Row[], teams: Row[] = []): { registrations: FakeSheet; teams: FakeSheet } {
    const fill = (name: string, headersExpr: string, rows: Row[]) => {
      const headers = this.evaluate<string[]>(headersExpr);
      const sheet = this.book.add(new FakeSheet(name));
      sheet.appendRow([...headers]);
      rows.forEach((row) => sheet.appendRow(headers.map((h) => row[h] ?? '')));
      return sheet;
    };
    this.properties['PLANILHA_VERSAO'] = this.evaluate<string>('SETUP_VERSION');
    return {
      registrations: fill('Inscritos', 'REGISTRATION_HEADERS', registrations),
      teams: fill('Equipes', 'TEAM_HEADERS', teams),
    };
  }

  private call(name: 'doPost' | 'doGet', event: unknown): ScriptResponse {
    const handler = this.context[name] as Handler;
    return JSON.parse(handler(event).getContent()) as ScriptResponse;
  }

  private globals(): Record<string, unknown> {
    const readClock = () => this.now;
    class ScriptDate extends Date {
      constructor(value?: string | number | Date) {
        super(value ?? readClock());
      }

      static override now(): number {
        return readClock();
      }
    }
    const textOutput = (text: string) => {
      const output = { getContent: () => text, setMimeType: () => output };
      return output;
    };
    // regra montada: o que foi pedido + getRanges e a fórmula, que o Setup.gs usa pra achar as regras dele
    const rule = (spec: Record<string, unknown[]>) => ({
      spec,
      getRanges: () => spec['setRanges']?.[0] ?? [],
      getBooleanCondition: () => ({ getCriteriaValues: () => spec['whenFormulaSatisfied'] ?? [] }),
    });
    return {
      Date: ScriptDate,
      console: {
        error: (...args: unknown[]) => this.errors.push(args),
        warn: () => {},
        log: (...args: unknown[]) => this.logs.push(args),
      },
      ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: textOutput },
      CacheService: { getScriptCache: () => this.cache },
      LockService: { getScriptLock: () => this.lock },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (key: string) => this.properties[key] ?? null,
          getProperties: () => ({ ...this.properties }),
          setProperty: (key: string, value: string) => {
            this.properties[key] = value;
          },
        }),
      },
      DriveApp: this.drive.api(),
      SpreadsheetApp: {
        BandingTheme: { BLUE: 'BLUE' },
        ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' },
        newDataValidation: () => recorder(),
        newConditionalFormatRule: () => recorder(rule),
        getActiveSpreadsheet: () => this.book,
        flush: () => {
          this.flushes.push(this.lock.held);
        },
      },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        Charset: { UTF_8: 'UTF_8' },
        computeDigest: (_algorithm: string, text: string) => signedSha256(text),
        getUuid: () => randomUUID(),
      },
    };
  }
}

export * from './bodies';
export * from './mentorBodies';
