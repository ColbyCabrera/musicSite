// Unified rhythm utilities combining simple factor pattern and note-value generation.
import Fraction from 'fraction.js';
import { InvalidInputError, GenerationError } from '../errors';
import { TimingInfo } from '../types';

// Returns fractional beat factors for a measure based on complexity (lightweight pattern)
export function generateBeatFactorPattern(
  timing: TimingInfo,
  complexity = 3,
): number[] {
  const { meterBeats, beatDurationTicks, measureDurationTicks } = timing;
  const pattern: number[] = [];
  let acc = 0;
  const subdivisionChance = Math.max(0.05, Math.min(0.95, complexity / 10));
  const beatPatterns: [number, number[]][] = [
    [1 - subdivisionChance, [1]],
    [subdivisionChance, [0.5, 0.5]],
  ];
  for (let b = 0; b < meterBeats && acc < measureDurationTicks; b++) {
    const remaining = measureDurationTicks - acc;
    const maxThisBeat = Math.min(beatDurationTicks, remaining);
    const applicable = beatPatterns.filter(
      (p) =>
        p[1].reduce((s, f) => s + f, 0) * beatDurationTicks <=
        maxThisBeat + 0.01,
    );
    let chosen = applicable.length
      ? applicable[applicable.length - 1][1]
      : [maxThisBeat / beatDurationTicks];
    if (applicable.length) {
      const total = applicable.reduce((s, p) => s + p[0], 0);
      let roll = Math.random() * total;
      for (const p of applicable) {
        roll -= p[0];
        if (roll <= 0) {
          chosen = p[1];
          break;
        }
      }
    }
    pattern.push(...chosen);
    acc += chosen.reduce((s, f) => s + f * beatDurationTicks, 0);
  }
  return pattern;
}

// Existing note-value generation retained (wrapper around original rhythm.ts complexity approach)
type NoteValuesMap = Record<number, Fraction>;

export function generateNoteValueSequence(
  meter: string,
  complexity: number,
): number[] {
  if (complexity < 1 || complexity > 10 || !Number.isInteger(complexity)) {
    throw new InvalidInputError(
      `Complexity must be integer 1-10. Got ${complexity}`,
    );
  }
  const parts = meter.split('/');
  if (parts.length !== 2)
    throw new InvalidInputError(`Invalid meter '${meter}'.`);
  const num = parseInt(parts[0], 10);
  const den = parseInt(parts[1], 10);
  const validDen = [1, 2, 4, 8, 16, 32];
  if (!num || !validDen.includes(den))
    throw new InvalidInputError(`Unsupported meter '${meter}'.`);
  const noteValues: NoteValuesMap = {
    1: new Fraction(1),
    2: new Fraction(1, 2),
    4: new Fraction(1, 4),
    8: new Fraction(1, 8),
    16: new Fraction(1, 16),
    32: new Fraction(1, 32),
  };
  const target = new Fraction(num, den);
  const weights: Record<number, number> = {
    1: 0,
    2: 0,
    4: 0,
    8: 0,
    16: 0,
    32: 0,
  };
  if (complexity <= 2) {
    weights[4] = 10;
    weights[2] = 5;
    weights[8] = 1;
  } else if (complexity <= 4) {
    weights[4] = 10;
    weights[8] = 8;
    weights[2] = 3;
    weights[16] = 1;
  } else if (complexity <= 6) {
    weights[4] = 8;
    weights[8] = 10;
    weights[16] = 5;
    weights[2] = 2;
    weights[32] = 0.5;
  } else if (complexity <= 8) {
    weights[8] = 10;
    weights[16] = 12;
    weights[4] = 4;
    weights[32] = 2;
    weights[2] = 1;
  } else {
    weights[16] = 12;
    weights[8] = 8;
    weights[32] = 8;
    weights[4] = 2;
  }
  const seq: number[] = [];
  let remaining = target.clone();
  const notes = Object.keys(noteValues).map(Number);
  const pick = (possible: number[]): number => {
    let total = possible.reduce((s, n) => s + (weights[n] || 0), 0);
    if (total <= 0) total = possible.length;
    let roll = Math.random() * total;
    for (const n of possible) {
      const w = weights[n] || total / possible.length;
      roll -= w;
      if (roll <= 0) return n;
    }
    return possible[possible.length - 1];
  };
  while (remaining.compare(0) > 0) {
    const possible = notes.filter((n) => noteValues[n].compare(remaining) <= 0);
    if (!possible.length) break;
    const chosen = pick(possible);
    seq.push(chosen);
    remaining = remaining.sub(noteValues[chosen]);
  }
  const sum = seq.reduce((s, n) => s.add(noteValues[n]), new Fraction(0));
  if (sum.compare(target) !== 0) {
    // Non-fatal mismatch warning suppressed
  }
  return seq;
}

// Adapter to convert beat factor pattern to tick durations for current timing.
export function factorsToDurations(
  factors: number[],
  timing: TimingInfo,
): number[] {
  return factors.map((f) => Math.round(f * timing.beatDurationTicks));
}
