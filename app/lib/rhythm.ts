import Fraction from 'fraction.js';
import { InvalidInputError, GenerationError } from './errors';

type NoteValuesMap = Record<number, Fraction>;

/**
 * Generates an array of rhythmic values for a single measure, based on the specified
 * time signature (meter) and a complexity level. The output array contains numbers
 * representing standard note durations (e.g., 4 for a quarter note, 8 for an eighth note).
 * The sum of these durations (when interpreted according to the meter) should fill one measure.
 *
 * The function uses a weighted random selection process, where complexity influences
 * the probability of choosing shorter (more complex) or longer (simpler) note values.
 *
 * @param {string} meter - The time signature as a string (e.g., '4/4', '3/4', '6/8').
 *                         The numerator indicates beats per measure, and the denominator
 *                         indicates the note value that represents one beat.
 * @param {number} complexity - An integer from 1 (simplest rhythms) to 10 (most complex rhythms).
 *                              This influences the distribution of note durations generated.
 * @returns {number[]} An array of numbers, where each number is a rhythmic value
 *                     (1=whole, 2=half, 4=quarter, 8=eighth, 16=sixteenth, 32=thirty-second).
 *                     The total duration represented by these values will correspond to one measure
 *                     in the given meter.
 * @throws {InvalidInputError} If the meter string is malformed, uses unsupported denominators,
 *                             or if the complexity value is outside the valid range (1-10).
 * @throws {GenerationError} If an internal error occurs during rhythm selection,
 *                           preventing a valid rhythm from being generated.
 */
export function generateRhythm(meter: string, complexity: number): number[] {
  // --- Input Validation ---
  if (complexity < 1 || complexity > 10 || !Number.isInteger(complexity)) {
    throw new InvalidInputError(`Complexity must be an integer between 1 and 10. Received: ${complexity}`);
  }

  const meterParts = meter.split('/');
  if (meterParts.length !== 2) {
    throw new InvalidInputError(`Invalid meter string format: '${meter}'. Expected 'N/D' (e.g., '4/4').`);
  }

  const numerator = parseInt(meterParts[0], 10);
  const denominator = parseInt(meterParts[1], 10);

  const validDenominators = [1, 2, 4, 8, 16, 32];
  if (
    isNaN(numerator) ||
    isNaN(denominator) ||
    numerator <= 0 ||
    !validDenominators.includes(denominator) // Denominator must be positive and one of the valid ones
  ) {
    throw new InvalidInputError(
      `Invalid meter numerator or denominator in '${meter}'. Numerator must be positive, denominator must be one of ${validDenominators.join(', ')}. Received: N=${numerator}, D=${denominator}`,
    );
  }

  // --- Configuration ---

  // Define base note durations and their fractional values relative to a whole note
  const noteValues: NoteValuesMap = {
    1: new Fraction(1, 1), // Whole Note
    2: new Fraction(1, 2), // Half Note
    4: new Fraction(1, 4), // Quarter Note
    8: new Fraction(1, 8), // Eighth Note
    16: new Fraction(1, 16), // Sixteenth Note
    32: new Fraction(1, 32), // Thirty-Second Note
  };
  const noteTypes = Object.keys(noteValues).map(Number); // [1, 2, 4, 8, 16, 32]

  // Calculate the total duration of the measure
  const targetDuration = new Fraction(numerator, denominator);

  // --- Complexity Mapping (Weights) ---
  const weights: Record<number, number> = {
    1: 0,
    2: 0,
    4: 0,
    8: 0,
    16: 0,
    32: 0,
  };

  if (complexity <= 2) {
    // Very Simple
    weights[4] = 10;
    weights[2] = 5;
    weights[8] = 1;
  } else if (complexity <= 4) {
    // Simple
    weights[4] = 10;
    weights[8] = 8;
    weights[2] = 3;
    weights[16] = 1;
  } else if (complexity <= 6) {
    // Moderate
    weights[4] = 8;
    weights[8] = 10;
    weights[16] = 5;
    weights[2] = 2;
    weights[32] = 0.5;
  } else if (complexity <= 8) {
    // Complex
    weights[8] = 10;
    weights[16] = 12;
    weights[4] = 4;
    weights[32] = 2;
    weights[2] = 1;
  } else {
    // Very Complex
    weights[16] = 12;
    weights[8] = 8;
    weights[32] = 8;
    weights[4] = 2;
  }

  // --- Rhythm Generation ---
  const rhythm: number[] = [];
  let remainingDuration = targetDuration.clone(); // Use clone to avoid modifying targetDuration

  // Helper for weighted random choice
  const weightedRandomChoice = (
    choices: Record<number, Fraction>,
    currentWeights: Record<number, number>,
  ): number | null => {
    const population: number[] = [];
    const weightValues: number[] = [];

    // Populate population and weights only with valid choices
    for (const note of Object.keys(choices).map(Number)) {
      population.push(note);
      weightValues.push(currentWeights[note] ?? 0); // Use provided weight or 0 if missing
    }

    if (population.length === 0) {
      return null; // No choices available
    }

    let totalWeight = weightValues.reduce((sum, w) => sum + w, 0);

    // If all preferred weights are zero, give all possible notes an equal chance
    if (totalWeight <= 0) {
      weightValues.fill(1); // Assign weight 1 to all possible
      totalWeight = weightValues.length;
      if (totalWeight === 0) return null; // Still no choices
    }

    let randomWeight = Math.random() * totalWeight;

    for (let i = 0; i < population.length; i++) {
      if (randomWeight < weightValues[i]) {
        return population[i];
      }
      randomWeight -= weightValues[i];
    }

    // Fallback (should not happen with correct logic, but safeguards)
    return population[population.length - 1];
  };

  // Loop until the measure is filled
  while (remainingDuration.compare(0) > 0) {
    // while remainingDuration > 0
    // Find notes small enough to fit
    const possibleNotes: NoteValuesMap = {};
    for (const note of noteTypes) {
      if (noteValues[note].compare(remainingDuration) <= 0) {
        // noteValue <= remaining
        possibleNotes[note] = noteValues[note];
      }
    }

    if (Object.keys(possibleNotes).length === 0) {
      // This implies that remainingDuration is smaller than the smallest available noteValue (e.g., 32nd note).
      // This can happen if the targetDuration is not perfectly divisible by standard note values.
      // Instead of breaking, we should try to fill with the smallest possible unit or log a more specific error.
      // For now, the console.warn is acceptable as the final check will report discrepancy.
      // If this were a critical error, a GenerationError could be thrown.
      console.warn(
        `[WARN] generateRhythm: No standard note value fits remaining duration ${remainingDuration.toFraction()} for meter ${meter}. Measure might be incomplete or slightly off.`,
      );
      break;
    }

    // Choose a note based on weighted probability
    const chosenNote = weightedRandomChoice(possibleNotes, weights);

    if (chosenNote === null) {
      // This would mean weightedRandomChoice failed despite possibleNotes having entries,
      // which indicates an internal logic error in weightedRandomChoice or its inputs.
      throw new GenerationError(
        `generateRhythm: Could not select a note for remaining duration ${remainingDuration.toFraction()} (meter ${meter}), though options were available. This indicates an internal generation error.`,
      );
    }

    const chosenValue = noteValues[chosenNote]; // chosenNote is number here

    // Add the chosen note to the rhythm
    rhythm.push(chosenNote);

    // Decrease the remaining duration
    remainingDuration = remainingDuration.sub(chosenValue);
  }

  // --- Final Check (Optional) ---
  const currentSum = rhythm.reduce(
    (sum, note) => sum.add(noteValues[note]),
    new Fraction(0),
  );
  if (currentSum.compare(targetDuration) !== 0) {
    console.warn(
      `[WARN] Final rhythm duration ${currentSum.toFraction()} does not match target ${targetDuration.toFraction()}. Rhythm: [${rhythm.join(', ')}]`,
    );
  }

  return rhythm;
}
