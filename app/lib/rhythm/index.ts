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
    5: [[[4]], [[-4]], [[8, 8]], [[16, 16, 16, 16]]], // Standard
    6: [
      [[4]],
      [[8, 8]],
      [[-8, 8]],
      [[8, 16, 16]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // + Rests
    7: [
      [[8, 8]],
      [[-8, 16, 16]],
      [[16, 16, 16, 16]],
      [[8, 16, 16]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // More subdivision
    8: [
      [[8, 8]],
      [[-8, 8]],
      [[16, 16, 16, 16]],
      [[8, 16, 16]],
      [[-4]],
      [[16, 16, 8]],
      [[16, 8, 16]],
    ], // Syncopation and rests
    9: [
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

/**
 * Derives the primary beat-group segmentation for a given time signature and
 * classifies the beat type (simple vs compound) used later for rhythmic cell selection.
 *
 * Grouping rules:
 *  - Compound meters with an 8 denominator and numerator 6,9,12 are grouped into equal
 *    dotted-quarter units (arrays of 3 underlying eighth units).
 *  - Asymmetrical / additive meters (5/4, 7/4, 5/8, 7/8) are mapped to common conducting
 *    patterns (e.g. 5/4 -> 3+2, 7/8 -> 2+2+3). These are treated as simple beat groups.
 *  - All other supported simple meters produce one group per notated beat (quarter in x/4,
 *    half in 2/2) by setting groupSize = 1 (each base unit = 1/denominator fraction).
 *
 * The returned `groups` array lists how many base units belong to each higher-level beat group.
 * For example:
 *  - 4/4 -> baseUnit = 1/4, groups = [1,1,1,1]
 *  - 6/8 -> baseUnit = 1/8, groups = [3,3]
 *  - 7/8 -> baseUnit = 1/8, groups = [2,2,3]
 *  - 5/4 -> baseUnit = 1/4, groups = [3,2]
 *
 * @param numerator The top number of the time signature.
 * @param denominator The bottom number of the time signature.
 * @returns An object containing:
 *  - groups: number[] of group lengths in base units
 *  - baseUnit: Fraction representing the underlying smallest written unit (1/denominator)
 *  - beatType: 'simple' | 'compound' classification used for rhythmic cell selection.
 */
function getGroupingPlan(numerator: number, denominator: number): GroupingPlan {
  const baseUnit = new Fraction(1, denominator); // Base unit is 1/denominator (e.g. quarter note in 4/4, eighth in 6/8)
  const beatType =
    [6, 9, 12].includes(numerator) && denominator === 8 ? 'compound' : 'simple'; // Determine compound or simple meter

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

/**
 * Validates and parses a time signature string (e.g. '4/4', '6/8').
 *
 * Rules enforced:
 *  - Must contain exactly one '/'.
 *  - Numerator & denominator must be positive integers.
 *  - Denominator must be in the supported set (1,2,4,8,16,32) used elsewhere for
 *    rhythmic value generation.
 *  - Only a curated list of numerators per denominator is accepted to limit
 *    generation to commonly used simple / compound / additive meters supported
 *    by the current rhythm engine (e.g. 5/4, 7/8 are allowed; 13/8 is rejected).
 *
 * On failure an InvalidInputError is thrown describing the issue.
 * On success returns the numeric numerator & denominator.
 *
 * @param meter Time signature string (e.g. '3/4').
 * @returns Parsed { num, den } object.
 * @throws InvalidInputError if malformed or unsupported.
 */
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
  // Validate inputs
  if (!Array.isArray(items) || !Array.isArray(weights)) {
    throw new TypeError('weightedPick expects arrays for items and weights');
  }
  if (items.length === 0 || weights.length === 0) {
    throw new RangeError('weightedPick requires non-empty items and weights');
  }
  if (items.length !== weights.length) {
    throw new RangeError(
      `weightedPick items/weights length mismatch: ${items.length} vs ${weights.length}`,
    );
  }
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w)) {
      throw new TypeError(
        `weightedPick weight at index ${i} is not a finite number`,
      );
    }
    if (w < 0) {
      throw new RangeError(`weightedPick weight at index ${i} is negative`);
    }
  }
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    throw new RangeError('weightedPick requires at least one positive weight');
  }
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1]; // fallback
}

/**
 * Generates a musically natural rhythmic pattern that exactly fills one bar
 * of the provided time signature. The rhythm is constructed by selecting
 * pre-defined "cells" (idiomatic micro‑patterns) per beat group, rather than
 * choosing isolated note values, to improve accent clarity and stylistic feel.
 *
 * Features / Rules:
 *  - Supports simple, compound, and selected additive meters (e.g. 5/4, 7/8).
 *  - Complexity (1–10) maps to an internal tier (1–5) affecting subdivision,
 *    syncopation, and rest usage.
 *  - Strong beats are biased toward note onsets; rests on primary downbeats
 *    are strongly discouraged at lower complexities.
 *  - Rests are encoded as negative denominators (e.g. -8 = eighth rest).
 *  - Ensures the sum of fractional durations equals the meter (validated).
 *
 * Low-complexity behavior (simple meters only):
 *  - This special logic path applies for complexity levels 1 through 4.
 *  - Complexity 1: Uses only whole, half, and quarter notes, favoring longer durations. No rests.
 *  - Complexity 2: Uses the same note set as level 1 but favors quarters. No rests.
 *  - Complexity 3: Introduces eighth notes. No rests.
 *  - Complexity 4: Increases the frequency of eighth notes. No rests.
 *  - For levels 1-4, it prevents syncopation by ensuring off-beat notes do not cross beat boundaries.
 *
 * High-complexity behavior (or any compound meter):
 *  - For complexity 5+, or for any compound meter, rhythm is generated by assembling pre-defined rhythmic "cells".
 *  - This allows for more complex and syncopated patterns, including rests.
 *
 * Representation:
 *  Each element in the returned array is a denominator (power-of-two) or its
 *  negative for rests. Example for 4/4: [4, 8, 8, -4] => quarter, two eighths,
 *  quarter rest.
 *
 * Supported meters:
 *  A curated set validated by {@link validateMeter}: common x/4, 2/2, compound x/8
 *  (6/8, 9/8, 12/8) and additive 5/4, 7/4, 5/8, 7/8.
 *
 * Errors:
 *  - InvalidInputError: if complexity is not an integer in [1,10] or meter is unsupported.
 *  - GenerationError: if an internal sum mismatch occurs, or if a rare unfillable
 *    remainder is encountered in low‑complexity measure‑level generation.
 *
 * @param meter Time signature string (e.g. "4/4", "6/8", "7/8"). Must pass
 *              validateMeter().
 * @param complexity Integer 1–10 controlling density & syncopation.
 * @returns RhythmicEvent[] array of (possibly signed) denominators summing to one measure.
 *
 * @example
 *  generateRhythm('4/4', 3); // -> [4, 8, 8, 4]
 *  generateRhythm('6/8', 5); // -> [8,16,16,8,16,16] (one possible result)
 *  // Negative values indicate rests:
 *  generateRhythm('3/4', 4); // -> [4, -8, 8, 4]
 */
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

  // -----------------------------------------------------------------------
  // Low complexity (1-3) simple-meter strategy:
  // User requirement: complexity 1 => only whole, half, quarter (favor longer);
  // complexity 2 => same set but favor quarters; complexity 3 => introduce a
  // small amount of eighth notes. We generate at measure level here instead of
  // beat-group cells to allow half & whole notes that span multiple beats.
  // Additional for complexity 3: disallow off-beat durations that cross the
  // next beat boundary (prevents syncopation that would require ties).
  // -----------------------------------------------------------------------
  if (beatType === 'simple' && complexity <= 4) {
    const target = new Fraction(num, den); // total measure length
    const events: RhythmicEvent[] = [];
    let position = new Fraction(0); // accumulated duration

    // Determine allowed denominators by complexity
    const allowed: number[] = (() => {
      if (complexity === 1) return [1, 2, 4];
      if (complexity === 2) return [1, 2, 4];
      if (complexity === 3) return [1, 2, 4, 8];
      return [1, 2, 4, 8]; // complexity === 4 introduces more 8ths
    })();

    // Weight mapping per complexity
    const baseWeights: Record<number, number> = {};
    for (const d of allowed) baseWeights[d] = 1; // init
    if (complexity === 1) {
      baseWeights[1] = 1; // whole (if fits & at start)
      baseWeights[2] = 6; // half
      baseWeights[4] = 2; // quarter
    } else if (complexity === 2) {
      baseWeights[1] = 1; // rare whole
      baseWeights[2] = 20; // some halves
      baseWeights[4] = 100; // mostly quarters
    } else if (complexity === 3) {
      baseWeights[1] = 1;
      baseWeights[2] = 5;
      baseWeights[4] = 150;
      baseWeights[8] = 40;
    } else if (complexity === 4) {
      baseWeights[1] = 1;
      baseWeights[2] = 3;
      baseWeights[4] = 150;
      baseWeights[8] = 100;
    }

    const fitsWholeNote = (
      d: number,
      pos: Fraction,
      remaining: Fraction,
    ): boolean => {
      const dur = new Fraction(1, d);
      // Whole note (d=1) only allowed at start and only if equals full measure
      if (d === 1) return pos.equals(0) && dur.equals(remaining);
      // Otherwise ensure it fits entirely inside remaining
      return dur.compare(remaining) <= 0;
    };

    while (position.compare(target) < 0) {
      const remaining = target.sub(position);
      // Compute current position relative to beat boundaries (baseUnit = 1/den)
      const posUnits = position.mul(den); // measured in base units of 1/den
      const isOnBeatBoundary = Number(posUnits.d) === 1; // integer number of base units
      // Distance (in base units) to the next beat boundary
      const nextBoundaryUnits = isOnBeatBoundary
        ? new Fraction(1)
        : new Fraction(Math.ceil(posUnits.valueOf())).sub(posUnits);

      // Collect viable denominators
      let viable = allowed.filter((d) => {
        if (!fitsWholeNote(d, position, remaining)) return false;
        if (complexity <= 4 && !isOnBeatBoundary) {
          // Event length in base units (1/den units)
          const eventUnits = new Fraction(den, d);
          // Off-beat events must end before or exactly at next boundary
          if (eventUnits.compare(nextBoundaryUnits) > 0) return false;
        }
        return true;
      });
      if (!viable.length) {
        // Fallback: force smallest allowed that fits (shouldn't usually happen)
        const smallest = allowed[allowed.length - 1];
        viable = [smallest];
      }
      // Adjust weights contextually: Avoid repeating many wholes/halves; ensure finish
      const weighted = viable.map((d) => {
        let w = baseWeights[d] ?? 1;
        const dur = new Fraction(1, d);
        // If remaining equals dur force it with huge weight
        if (dur.equals(remaining)) w *= 50;
        // Discourage using half/whole right before a small leftover (to avoid awkward final tiny note) by anticipating remainder
        const remainderAfter = remaining.sub(dur);
        if (
          remainderAfter.compare(0) > 0 &&
          remainderAfter.valueOf() < 1 / 8 &&
          d <= 2
        ) {
          w *= 0.2;
        }
        // Reduce repetition of same denominator more than 3 times in a row
        const len = events.length;
        if (
          len >= 3 &&
          events[len - 1] === d &&
          events[len - 2] === d &&
          events[len - 3] === d
        ) {
          w *= 0.15;
        }
        return { d, w };
      });
      const total = weighted.reduce((s, x) => s + x.w, 0);
      let roll = Math.random() * total;
      let chosen = weighted[0].d;
      for (const entry of weighted) {
        roll -= entry.w;
        if (roll <= 0) {
          chosen = entry.d;
          break;
        }
      }
      events.push(chosen);
      position = position.add(new Fraction(1, chosen));
    }

    // Final safety check
    const sum = events.reduce(
      (acc, d) => acc.add(new Fraction(1, d)),
      new Fraction(0),
    );
    if (!sum.equals(target)) {
      throw new GenerationError(
        `Low-complexity rhythm mismatch: expected ${target.toFraction(true)} got ${sum.toFraction(true)}`,
      );
    }
    return events; // (No rests for low complexities per requirement.)
  }

  const complexityLevel = Math.ceil(complexity);
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

    // Weight selection: prefer simpler subdivision at mid complexities and avoid rests on strong beats
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

      // Subdivision-aware weighting to curb excessive 16ths at moderate complexity
      const flat = cell.flat();
      let count16 = 0;
      let count8 = 0;
      let hasRest = false;

      // Tally the number of 16th and 8th notes and check for rests.
      // A negative value indicates a rest.
      for (const v of flat) {
        const d = Math.abs(v);
        if (v < 0) hasRest = true;
        if (d === 16) count16++;
        else if (d === 8) count8++;
      }

      // Prefer simpler patterns around complexity ~5; scale penalty/boost by complexity
      if (beatType === 'simple') {
        if (complexity <= 5) {
          // Penalize each 16th moderately
          weight *= Math.pow(0.7, count16);
          // Boost clean eighths [8,8]
          if (count8 === 2 && count16 === 0) weight *= 1.6;
          // Heavy 16ths (four 16ths) extra penalty
          if (count16 >= 4) weight *= 0.7;
        } else if (complexity <= 7) {
          // Mild preference for fewer 16ths
          weight *= Math.pow(0.85, count16);
        } else {
          // Higher complexity: slight encouragement of more subdivision
          weight *= 1 + Math.min(0.3, count16 * 0.05);
        }
      } else if (beatType === 'compound') {
        // In compound meters, keep some 16ths but still temper at mid complexity
        if (complexity <= 5) {
          weight *= Math.pow(0.8, count16);
          if (count8 === 3 && count16 === 0) weight *= 1.4; // [8,8,8]
        } else if (complexity <= 7) {
          weight *= Math.pow(0.9, count16);
        } else {
          weight *= 1 + Math.min(0.25, count16 * 0.04);
        }
      }

      // Slightly de-emphasize rest-heavy cells at moderate complexity overall
      if (complexity <= 5 && hasRest) weight *= 0.7;

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
