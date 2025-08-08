// Unified rhythm utilities combining simple factor pattern and note-value generation.
import Fraction from 'fraction.js';
import { InvalidInputError, GenerationError } from '../errors';
import { TimingInfo } from '../types';

// Returns fractional beat factors for a measure based on complexity (lightweight pattern)
export function generateBeatFactorPattern(
  timing: TimingInfo,
  complexity = 3,
): number[] {
  // Clamp complexity to the valid range of 1-10 to ensure meaningful subdivisionChance values.
  const clampedComplexity = Math.max(1, Math.min(10, complexity));
  const { meterBeats, beatDurationTicks, measureDurationTicks } = timing;
  const pattern: number[] = [];
  let acc = 0;
  const subdivisionChance = Math.max(
    0.05,
    Math.min(0.95, clampedComplexity / 10),
  );
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
  // It’s the goal sum the generated note values must add up to
  const target = new Fraction(num, den);
  const weights: Record<number, number> = {
    1: 0,
    2: 0,
    4: 0,
    8: 0,
    16: 0,
    32: 0,
  };
  if (complexity === 1) {
    weights[1] = 1;
    weights[2] = 8;
    weights[4] = 10;
  } else if (complexity === 2) {
    weights[1] = 1;
    weights[2] = 5;
    weights[4] = 10;
  } else if (complexity === 3) {
    weights[2] = 5;
    weights[4] = 10;
    weights[8] = 1;
  } else if (complexity === 4) {
    weights[1] = 1;
    weights[2] = 5;
    weights[4] = 10;
    weights[8] = 8;
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
    // Create a list of items with their weights, filtering out those with no defined or zero weight.
    const weightedItems = possible
      .map((n) => ({ note: n, weight: weights[n] ?? 0 }))
      .filter((item) => item.weight > 0);

    // If no items have a positive weight, fall back to random unweighted selection from all possible notes.
    if (weightedItems.length === 0) {
      return possible[Math.floor(Math.random() * possible.length)];
    }

    const totalWeight = weightedItems.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    let roll = Math.random() * totalWeight;

    for (const item of weightedItems) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.note;
      }
    }

    // Fallback for rare floating point inaccuracies, return the last item with weight.
    return weightedItems[weightedItems.length - 1].note;
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

// ---------------------------------------------------------------------------
// Improved rhythm generation (avoids common notation errors)
// ---------------------------------------------------------------------------
// This function generates a sequence of note value denominators (e.g. [4,8,8])
// whose fractional sum equals the notated meter. It attempts to:
//  - Respect beat / beat-group boundaries by filling beat-groups with common rhythmic cells.
//  - Use simpler, more direct rhythms at low complexity and more syncopated/varied
//    patterns at higher complexity.
//  - Intelligently place rests to create more natural phrasing.
//  - Support a wide range of simple, compound, and asymmetrical meters.
// References (principles distilled from):
//  https://musictheory.pugetsound.edu/mt21c/CommonRhythmicNotationErrors.html

const ALLOWED_DENOMS = [1, 2, 4, 8, 16, 32] as const;
type AllowedDenom = (typeof ALLOWED_DENOMS)[number];

// Represents a musical event; negative number for rest denominator, positive for note.
type RhythmicEvent = number;

interface GroupingPlan {
  // Each number is expressed in base units of 1/denominator (e.g. for 4/4 with den=4, a quarter = 1, for 6/8 with den=8, an eighth =1).
  groups: number[];
  baseUnit: Fraction; // 1 / meterDenominator
  beatType: 'simple' | 'compound';
}

// --- Rhythmic Cell Library ---
// A library of common, natural-sounding rhythmic patterns for different beat types.
// Each cell is an array of denominators that fills a single beat.
// E.g., for a simple beat (quarter note), a cell could be [4] or [8, 8].
const RHYTHMIC_CELLS: Record<
  'simple' | 'compound',
  Record<number, RhythmicEvent[][][]>
> = {
  simple: {
    // For beats like quarter notes (in 4/4, 3/4, etc.)
    1: [[[4]], [[8, 8]], [[8, 16, 16]], [[16, 16, 8]], [[16, 8, 16]]], // Standard
    2: [
      [[4]],
      [[8, 8]],
      [[-8, 8]],
      [[8, 16, 16]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // + Rests
    3: [
      [[8, 8]],
      [[-8, 16, 16]],
      [[16, 16, 16, 16]],
      [[8, 16, 16]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // More subdivision
    4: [
      [[8, 8]],
      [[-8, 8]],
      [[16, 16, 16, 16]],
      [[8, 16, 16]],
      [[-4]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // Syncopation and rests
    5: [
      [[16, 16, 16, 16]],
      [[8, 16, 16]],
      [[16, 16, 8]],
      [[-8, 16, 16]],
      [[16, 8, 16]],
    ], // Higher complexity
  },
  compound: {
    // For beats like dotted quarters (in 6/8, 9/8, etc.)
    1: [[[8, 8, 8]], [[4, 8]]], // Basic compound beat (can't use dotted notes)
    2: [[[8, 8, 8]], [[4, 8]], [[-8, 8, 8]]],
    3: [
      [[8, 8, 8]],
      [[8, 16, 16, 16, 16]],
      [[16, 16, 16, 16, 8]],
      [[4, 8]],
      [[-4, 8]],
    ],
    4: [
      [[16, 16, 16, 16, 16, 16]],
      [[8, 16, 16, 16, 16]],
      [[16, 16, 8, 16, 16]],
      [[-8, 8, 8]],
    ],
    5: [
      [[16, 16, 16, 16, 16, 16]],
      [[8, 16, 16, 16, 16]],
      [[16, 16, 16, 16, 8]],
      [[16, 16, 8, 16, 16]],
    ],
  },
};

function getGroupingPlan(numerator: number, denominator: number): GroupingPlan {
  const baseUnit = new Fraction(1, denominator);
  const beatType =
    [6, 9, 12].includes(numerator) && denominator === 8 ? 'compound' : 'simple';

  // Irregular / compound heuristics
  if (denominator === 8) {
    if (numerator === 6) return { groups: [3, 3], baseUnit, beatType };
    if (numerator === 9) return { groups: [3, 3, 3], baseUnit, beatType };
    if (numerator === 12) return { groups: [3, 3, 3, 3], baseUnit, beatType };
    if (numerator === 5)
      return { groups: [3, 2], baseUnit, beatType: 'simple' };
    if (numerator === 7)
      return { groups: [2, 2, 3], baseUnit, beatType: 'simple' };
    if (numerator === 3) return { groups: [3], baseUnit, beatType: 'simple' };
  }
  if (denominator === 4) {
    if (numerator === 5)
      return { groups: [3, 2], baseUnit, beatType: 'simple' };
    if (numerator === 7)
      return { groups: [3, 2, 2], baseUnit, beatType: 'simple' };
  }
  // Simple meters: each beat is its own group.
  // For 2/2, each beat is a half note (group size 1, base unit 1/2).
  // For x/4, each beat is a quarter note (group size 1, base unit 1/4).
  const groupSize = 1;
  return {
    groups: Array.from({ length: numerator / groupSize }, () => groupSize),
    baseUnit,
    beatType,
  };
}

function validateMeter(meter: string): { num: number; den: number } {
  const parts = meter.split('/');
  if (parts.length !== 2)
    throw new InvalidInputError(`Invalid meter '${meter}'.`);
  const num = parseInt(parts[0], 10);
  const den = parseInt(parts[1], 10);
  if (
    !Number.isInteger(num) ||
    !Number.isInteger(den) ||
    num <= 0 ||
    den <= 0
  ) {
    throw new InvalidInputError(`Invalid meter numbers in '${meter}'.`);
  }
  if (!ALLOWED_DENOMS.includes(den as AllowedDenom)) {
    throw new InvalidInputError(`Unsupported denominator in '${meter}'.`);
  }
  const allowedSimple = den === 4 && [2, 3, 4, 5, 7].includes(num);
  const allowedHalf = den === 2 && [2].includes(num);
  const allowedEighth = den === 8 && [3, 5, 6, 7, 9, 12].includes(num);
  if (!(allowedSimple || allowedHalf || allowedEighth)) {
    throw new InvalidInputError(`Unsupported or uncommon meter '${meter}'.`);
  }
  return { num, den };
}

// Pick one element by weight
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1]; // fallback
}

export function generateRhythm(
  meter: string,
  complexity: number,
): RhythmicEvent[] {
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 10) {
    throw new InvalidInputError(
      `Complexity must be integer 1-10. Got ${complexity}`,
    );
  }
  const { num, den } = validateMeter(meter);
  const { groups, baseUnit, beatType } = getGroupingPlan(num, den);
  const result: RhythmicEvent[] = [];

  const complexityLevel = Math.ceil(complexity / 2);
  const cellSet = RHYTHMIC_CELLS[beatType][complexityLevel];

  for (let i = 0; i < groups.length; i++) {
    const groupUnits = groups[i];
    const groupDuration = baseUnit.mul(groupUnits);

    // Find cells that match the current group's duration
    const validCells = cellSet.filter((cell) => {
      const cellDuration = cell
        .flat()
        .reduce(
          (sum, val) => sum.add(new Fraction(1, Math.abs(val))),
          new Fraction(0),
        );
      return cellDuration.equals(groupDuration);
    });

    if (validCells.length === 0) {
      // Fallback: if no pre-defined cells match (e.g., for irregular groups like in 5/4),
      // fill with the simplest possible rhythm.
      const baseDenom = baseUnit.d;
      for (let j = 0; j < groupUnits; j++) {
        result.push(Number(baseDenom));
      }
      continue;
    }

    // Weight selection: give strong preference to non-rest-starting cells on downbeats
    const weights = validCells.map((cell) => {
      let weight = 1.0;
      // On beat 1 (i=0) and other strong beats (e.g. beat 3 in 4/4), heavily prefer cells that start with a note.
      const isStrongBeat = i === 0 || (num === 4 && i === 2);
      if (isStrongBeat && cell[0][0] < 0) {
        weight = 0.1; // Drastically reduce the chance of starting a strong beat with a rest.
      }
      // At low complexity, further penalize rests on any downbeat.
      if (complexity <= 4 && cell[0][0] < 0) {
        weight *= 0.5;
      }
      return weight;
    });

    const chosenCell = weightedPick(validCells, weights);
    result.push(...chosenCell.flat());
  }

  // Final validation
  const sum = result.reduce(
    (acc, d) => acc.add(new Fraction(1, Math.abs(d))),
    new Fraction(0),
  );
  const target = new Fraction(num, den);
  if (!sum.equals(target)) {
    throw new GenerationError(
      `Internal rhythm generation mismatch: expected ${target.toFraction(
        true,
      )} got ${sum.toFraction(true)}.`,
    );
  }
  return result;
}
