// geometria da roda: as fatias têm o mesmo tamanho e a primeira fica centrada no topo, onde está o ponteiro
export const FULL_TURN = 360;
// voltas inteiras antes de parar, para o giro ter suspense
const MIN_TURNS = 5;
// a roda não para sempre no meio da fatia: fica dentro dela, longe das bordas
const EDGE_MARGIN = 0.18;

export const sliceAngle = (sliceCount: number): number => FULL_TURN / sliceCount;

// centro da fatia, em graus no sentido horário a partir do topo
export const sliceCenter = (index: number, sliceCount: number): number => index * sliceAngle(sliceCount);

const positiveMod = (value: number, modulo: number): number => ((value % modulo) + modulo) % modulo;

// rotação final da roda para a fatia parar sob o ponteiro. Sempre maior que a atual (a roda nunca volta) e com
// pelo menos MIN_TURNS voltas. `offset` vai de 0 a 1 e decide em que ponto da fatia o ponteiro cai
export function landingRotation(current: number, index: number, sliceCount: number, offset: number): number {
  const width = sliceAngle(sliceCount);
  const usable = width * (1 - 2 * EDGE_MARGIN);
  const within = (Math.min(Math.max(offset, 0), 1) - 0.5) * usable;
  const target = positiveMod(-sliceCenter(index, sliceCount) + within, FULL_TURN);
  const base = current + MIN_TURNS * FULL_TURN;
  return base + positiveMod(target - base, FULL_TURN);
}

// qual fatia está sob o ponteiro numa rotação (usado nos testes para conferir o destino)
export function sliceUnderPointer(rotation: number, sliceCount: number): number {
  const width = sliceAngle(sliceCount);
  return Math.floor(positiveMod(-rotation + width / 2, FULL_TURN) / width) % sliceCount;
}

// fatia em SVG (viewBox centrado em 0,0): do centro até o raio, entre os dois ângulos
export function slicePath(index: number, sliceCount: number, radius: number): string {
  const width = sliceAngle(sliceCount);
  const center = sliceCenter(index, sliceCount);
  const [x1, y1] = point(center - width / 2, radius);
  const [x2, y2] = point(center + width / 2, radius);
  const largeArc = width > FULL_TURN / 2 ? 1 : 0;
  return `M0 0L${x1} ${y1}A${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}Z`;
}

// só o arco externo da fatia (a faixa colorida da borda)
export function sliceArc(index: number, sliceCount: number, radius: number): string {
  const width = sliceAngle(sliceCount);
  const center = sliceCenter(index, sliceCount);
  const [x1, y1] = point(center - width / 2, radius);
  const [x2, y2] = point(center + width / 2, radius);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${width > FULL_TURN / 2 ? 1 : 0} 1 ${x2} ${y2}`;
}

// ponto a `degrees` graus (sentido horário a partir do topo) e a `radius` do centro
export function point(degrees: number, radius: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  return [round(radius * Math.sin(radians)), round(-radius * Math.cos(radians))];
}
