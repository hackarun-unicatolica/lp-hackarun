// barra de carregamento da /gemas: a % anda com o tempo sem passar de 95% e só chega a 100% quando a planilha responde
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimatedPercent, LoadingMeter } from '@presentation/views/gems/LoadingMeter';

describe('porcentagem estimada', () => {
  it('começa em 0, sempre cresce e nunca chega a 100 sozinha', () => {
    expect(estimatedPercent(0)).toBe(0);
    let last = 0;
    for (let ms = 100; ms <= 120_000; ms += 100) {
      const value = estimatedPercent(ms);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    expect(last).toBe(95);
    expect(estimatedPercent(3_000)).toBeGreaterThan(50);
  });
});

describe('barra na tela', () => {
  let clock = 0;
  const elements = () => {
    document.body.innerHTML = '<div data-box hidden><p data-label></p><span data-fill></span></div>';
    const q = (s: string) => document.querySelector(s) as HTMLElement;
    return { box: q('[data-box]'), fill: q('[data-fill]'), label: q('[data-label]') };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('mostra a % enquanto carrega, vai a 100% no fim e some', () => {
    const el = elements();
    const meter = new LoadingMeter(el, () => clock);
    meter.start();
    expect(el.box.hidden).toBe(false);
    clock = 3_000;
    vi.advanceTimersByTime(100);
    expect(el.label.textContent).toMatch(/Carregando as questões… \d+%/);
    expect(Number(el.box.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
    meter.finish();
    expect(el.fill.style.width).toBe('100%');
    expect(el.label.textContent).toBe('Carregando as questões… 100%');
    vi.advanceTimersByTime(500);
    expect(el.box.hidden).toBe(true);
  });

  it('chamar start de novo não reinicia a contagem; cancelar esconde na hora', () => {
    const el = elements();
    const meter = new LoadingMeter(el, () => clock);
    meter.start();
    clock = 2_000;
    meter.start();
    vi.advanceTimersByTime(100);
    expect(Number(el.box.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    meter.cancel();
    expect(el.box.hidden).toBe(true);
    expect(meter.running).toBe(false);
  });

  it('terminar sem ter começado não faz nada (questões já guardadas no aparelho)', () => {
    const el = elements();
    new LoadingMeter(el, () => clock).finish();
    expect(el.box.hidden).toBe(true);
  });
});
