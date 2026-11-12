import { BoltBuilder } from '@presentation/motion/animators/hero/lightning/BoltBuilder';
import { BoltPainter } from '@presentation/motion/animators/hero/lightning/BoltPainter';
import { chance, rand, type Bolt, type Vec } from '@presentation/motion/animators/hero/lightning/types';

// raios em volta da roda, com o mesmo traço dos raios do logo na página inicial: poucos estalos com a roda parada,
// descargas seguidas durante o giro e uma rajada no ponteiro quando ela para. Um canvas 2D por cima da roda
export type LightningMode = 'calm' | 'storm';

const MAX_DPR = 2;
const MAX_BOLTS = 36;
const TAU = Math.PI * 2;
// intervalo entre descargas (ms) em cada modo
const GAP: Record<LightningMode, [number, number]> = { calm: [700, 1700], storm: [60, 150] };

export class WheelLightning {
  private readonly painter: BoltPainter | null;
  private readonly builder = new BoltBuilder();
  private readonly resizer: ResizeObserver;
  private bolts: Bolt[] = [];
  private mode: LightningMode = 'calm';
  private nextAt = 0;
  private raf = 0;
  private size = 0;
  private scale = 1;

  // rimRatio: raio da roda em fração da metade do canvas (o canvas é maior que a roda, para o raio ter para onde ir)
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rimRatio: number,
  ) {
    const ctx = canvas.getContext('2d');
    this.painter = ctx ? new BoltPainter(ctx, false) : null;
    this.resizer = new ResizeObserver(() => this.measure());
    this.resizer.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.measure();
    this.wake();
  }

  setMode(mode: LightningMode): void {
    this.mode = mode;
    this.nextAt = 0;
    this.wake();
  }

  // rajada no ponteiro (topo da roda): descargas para fora e arcos descendo pela borda
  burst(): void {
    const now = performance.now();
    const top = -Math.PI / 2;
    for (let i = 0; i < 7; i++) this.add(this.strike(top + rand(-0.5, 0.5), now, rand(0.3, 0.55)));
    for (let i = 0; i < 5; i++) this.add(this.arc(top + rand(-0.9, 0.9), now));
    this.wake();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    if (!document.hidden) this.wake();
  };

  private measure(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const side = Math.round(this.canvas.clientWidth * dpr);
    if (side === 0 || side === this.size) return;
    this.size = side;
    this.canvas.width = side;
    this.canvas.height = side;
    // espessura acompanha o tamanho da roda (referência: 600 px de canvas)
    this.scale = Math.max(0.8, side / 600);
  }

  private wake(): void {
    if (this.raf === 0 && this.painter) this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (!this.painter || document.hidden || this.size === 0) return;
    if (now >= this.nextAt) {
      const [min, max] = GAP[this.mode];
      this.nextAt = now + rand(min, max);
      this.spawn(now);
    }
    this.bolts = this.bolts.filter((bolt) => now - bolt.born < bolt.life);
    this.painter.clear(this.size, this.size);
    for (const bolt of this.bolts) {
      const age = (now - bolt.born) / bolt.life;
      const flicker = 0.75 + Math.random() * 0.25;
      this.painter.paint(bolt, bolt.intensity * (1 - age) * flicker, this.scale, age > 0.45);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private spawn(now: number): void {
    const angle = rand(0, TAU);
    if (this.mode === 'storm') {
      this.add(chance(0.55) ? this.strike(angle, now, rand(0.18, 0.42)) : this.arc(angle, now));
    } else {
      this.add(this.arc(angle, now, true));
    }
  }

  private add(bolt: Bolt): void {
    this.bolts.push(bolt);
    if (this.bolts.length > MAX_BOLTS) this.bolts.shift();
  }

  private onRim(angle: number, stretch = 1): Vec {
    const half = this.size / 2;
    const radius = half * this.rimRatio * stretch;
    return { x: half + Math.cos(angle) * radius, y: half + Math.sin(angle) * radius };
  }

  // descarga que sai da borda da roda para fora, com galhos. reach: alcance em fração do raio
  private strike(angle: number, now: number, reach: number): Bolt {
    const from = this.onRim(angle);
    const to = this.onRim(angle + rand(-0.25, 0.25), 1 + reach);
    const options = {
      roughness: 0.3,
      forks: Math.round(rand(1, 4)),
      minSegment: 3 * this.scale,
      width: 1.2,
    };
    return {
      kind: 'strike',
      tint: chance(0.25) ? 'violet' : 'blue',
      strokes: this.builder.build(from, to, options),
      restrike: chance(0.45) ? this.builder.build(from, to, options) : null,
      origin: from,
      born: now,
      life: rand(300, 520),
      intensity: rand(0.9, 1),
    };
  }

  // arco que corre pela borda da roda (tiny = estalo curto e fraco)
  private arc(angle: number, now: number, tiny = false): Bolt {
    const span = (chance(0.5) ? 1 : -1) * (tiny ? rand(0.12, 0.3) : rand(0.3, 0.75));
    const from = this.onRim(angle);
    const to = this.onRim(angle + span);
    const middle = angle + span / 2;
    const push = Math.hypot(to.x - from.x, to.y - from.y) * rand(0.12, tiny ? 0.25 : 0.35);
    const bulge = { x: Math.cos(middle) * push, y: Math.sin(middle) * push };
    const options = {
      roughness: tiny ? 0.35 : 0.24,
      forks: tiny ? 0 : Math.round(rand(0, 2)),
      minSegment: 2.5 * this.scale,
      width: tiny ? 0.6 : 0.85,
    };
    return {
      kind: tiny ? 'crackle' : 'arc',
      tint: chance(0.2) ? 'violet' : 'blue',
      strokes: this.builder.arc(from, to, bulge, options),
      restrike: null,
      origin: null,
      born: now,
      life: tiny ? rand(140, 260) : rand(260, 460),
      intensity: tiny ? rand(0.55, 0.9) : rand(0.8, 1),
    };
  }
}
