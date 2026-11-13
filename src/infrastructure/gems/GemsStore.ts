import type { ColorData, GemsDeviceStore, GemsMode } from '@application/gems/GemsPorts';
import {
  cleanQuestion,
  cleanQueueState,
  isGemColor,
  type GemColor,
  type GemQuestion,
} from '@domain/gems/GemQueue';

// o que cada aparelho guarda no navegador (sobrevive a fechar a aba, o navegador ou reiniciar): a cor do NPC e os
// dados de cada cor. Sem prazo: o que estiver pendente é enviado quando a conexão voltar, nem que seja horas depois
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const COLOR_KEY = 'hackarun:gemas:cor';
const dataKey = (color: GemColor) => `hackarun:gemas:${color}`;

export class GemsStore implements GemsDeviceStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  mode(): GemsMode | null {
    const value = this.read(COLOR_KEY);
    return isGemColor(value) || value === 'entrega' ? value : null;
  }

  setMode(mode: GemsMode | null): void {
    if (mode) this.write(COLOR_KEY, mode);
    else this.remove(COLOR_KEY);
  }

  data(color: GemColor): ColorData | null {
    const raw = this.read(dataKey(color));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<Record<keyof ColorData, unknown>>;
      const state = cleanQueueState(parsed.state);
      if (!state) return null;
      const questions = Array.isArray(parsed.questions)
        ? parsed.questions.map(cleanQuestion).filter((q): q is GemQuestion => q !== null)
        : [];
      const current = typeof parsed.current === 'number' ? parsed.current : null;
      return { questions, state, current, pending: parsed.pending === true };
    } catch {
      return null;
    }
  }

  saveData(color: GemColor, data: ColorData): boolean {
    return this.write(dataKey(color), JSON.stringify(data));
  }

  // aba anônima ou armazenamento bloqueado: a tela funciona, mas avisa que nada fica guardado
  get available(): boolean {
    return this.storage !== null;
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): boolean {
    try {
      this.storage?.setItem(key, value);
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // nada a fazer
    }
  }
}

export function browserStorage(): KeyValueStorage | null {
  try {
    const storage = window.localStorage;
    const probe = 'hackarun:gemas:teste';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
