// barra de carregamento das questões em %: a planilha responde de uma vez (não dá para medir o download), então a
// porcentagem é uma estimativa pelo tempo, que anda rápido no começo e desacelera perto de 95%. Quando a resposta
// chega, vai para 100% e some. Serve só para mostrar que a tela não travou

const CEILING = 95;
// em ~3 s chega perto de 60%; a planilha costuma responder entre 2 e 6 s
const PACE_MS = 3_000;
const TICK_MS = 100;
const HIDE_AFTER_MS = 400;

export function estimatedPercent(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(CEILING, Math.round(CEILING * (1 - Math.exp(-elapsedMs / PACE_MS))));
}

export interface MeterElements {
  box: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
}

export class LoadingMeter {
  private startedAt = 0;
  private timer: number | null = null;
  private hideTimer: number | null = null;

  constructor(
    private readonly el: MeterElements,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.startedAt = this.now();
    this.el.box.hidden = false;
    this.paint(0);
    this.timer = window.setInterval(() => this.paint(estimatedPercent(this.now() - this.startedAt)), TICK_MS);
  }

  // terminou (deu certo ou não): 100% e some logo depois
  finish(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
    this.paint(100);
    this.hideTimer = window.setTimeout(() => {
      this.el.box.hidden = true;
      this.hideTimer = null;
    }, HIDE_AFTER_MS);
  }

  // trocou de cor no meio do carregamento: some na hora
  cancel(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.timer = null;
    this.hideTimer = null;
    this.el.box.hidden = true;
  }

  private paint(percent: number): void {
    this.el.fill.style.width = `${percent}%`;
    this.el.box.setAttribute('aria-valuenow', String(percent));
    this.el.label.textContent = `Carregando as questões… ${percent}%`;
  }
}
