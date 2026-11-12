import { describe, expect, it } from 'vitest';
import {
  FULL_TURN,
  landingRotation,
  sliceArc,
  sliceCenter,
  slicePath,
  sliceUnderPointer,
} from '@presentation/views/roulette/wheel';

const SLICES = 5;

describe('geometria da roda', () => {
  it('a primeira fatia fica centrada no topo e as outras seguem no sentido horário', () => {
    expect(sliceCenter(0, SLICES)).toBe(0);
    expect(sliceCenter(1, SLICES)).toBe(72);
    expect(sliceCenter(4, SLICES)).toBe(288);
    expect(sliceUnderPointer(0, SLICES)).toBe(0);
  });

  it('girar a roda no sentido horário traz a fatia anterior para o ponteiro', () => {
    expect(sliceUnderPointer(72, SLICES)).toBe(4);
    expect(sliceUnderPointer(-72, SLICES)).toBe(1);
    expect(sliceUnderPointer(FULL_TURN * 3, SLICES)).toBe(0);
  });

  it('a roda sempre para na fatia sorteada, em qualquer ponto de parada e de onde quer que venha', () => {
    for (let index = 0; index < SLICES; index++) {
      for (const offset of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        for (const current of [0, 37.5, 1800, 5321.7, 98765.4]) {
          const rotation = landingRotation(current, index, SLICES, offset);
          expect(sliceUnderPointer(rotation, SLICES)).toBe(index);
        }
      }
    }
  });

  it('um ponto de parada fora de 0 a 1 não tira a roda da fatia', () => {
    for (const offset of [-3, 2, Number.POSITIVE_INFINITY]) {
      expect(sliceUnderPointer(landingRotation(0, 2, SLICES, offset), SLICES)).toBe(2);
    }
  });

  it('nunca volta: dá pelo menos cinco voltas e menos de seis a cada giro', () => {
    let rotation = 0;
    for (let spin = 0; spin < 20; spin++) {
      const next = landingRotation(rotation, spin % SLICES, SLICES, (spin * 0.37) % 1);
      expect(next - rotation).toBeGreaterThanOrEqual(5 * FULL_TURN);
      expect(next - rotation).toBeLessThan(6 * FULL_TURN);
      rotation = next;
    }
  });

  it('para longe da borda da fatia, para não parecer que caiu na vizinha', () => {
    const width = FULL_TURN / SLICES;
    for (const offset of [0, 1]) {
      const rotation = landingRotation(0, 0, SLICES, offset);
      const fromCenter = Math.abs((((rotation % FULL_TURN) + 180) % FULL_TURN) - 180);
      expect(fromCenter).toBeLessThan(width / 2 - 10);
    }
  });

  it('desenha a fatia do centro até a borda e o arco só na borda', () => {
    expect(slicePath(0, 4, 100)).toBe('M0 0L-70.711 -70.711A100 100 0 0 1 70.711 -70.711Z');
    expect(sliceArc(1, 4, 100)).toBe('M70.711 -70.711A100 100 0 0 1 70.711 70.711');
  });
});
