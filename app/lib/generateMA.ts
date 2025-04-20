import Fraction from 'fraction.js';

// returns object with melody and accompaniment
export default function generateMA(
  progression: string[],
  key: string,
  meter: string,
) {
  generateMelody(progression, key, meter);
}

function generateMelody(progression: string[], key: string, meter: string) {
  const rhythm = generateRhythm(meter, 1);
  const numofNotesInBar = rhythm.length;

  
}

type NoteValuesMap = Record<number, Fraction>;

/**
 * Generates an array of note durations for one measure based on meter and complexity.
 *
 * @param meter - The time signature as a string (e.g., '4/4', '3/4', '6/8').
 * @param complexity - An integer from 1 (simplest) to 10 (most complex).
 * @returns An array of numbers representing note durations (1: whole, 2: half,
 * 4: quarter, 8: eighth, 16: sixteenth, 32: thirty-second) that
 * sum up to the duration of one measure according to the meter.
 * @throws {Error} If the meter string is invalid or complexity is out of range.
 */
function generateRhythm(meter: string, complexity: number): number[] {
  // --- Input Validation ---
  if (complexity < 1 || complexity > 10) {
    throw new Error('Complexity must be between 1 and 10.');
  }

  const meterParts = meter.split('/');
  if (meterParts.length !== 2) {
    throw new Error(`Invalid meter string format: '${meter}'. Expected 'N/D'.`);
  }

  const numerator = parseInt(meterParts[0], 10);
  const denominator = parseInt(meterParts[1], 10);

  const validDenominators = [1, 2, 4, 8, 16, 32];
  if (
    isNaN(numerator) ||
    isNaN(denominator) ||
    numerator <= 0 ||
    denominator <= 0 ||
    !validDenominators.includes(denominator)
  ) {
    throw new Error(
      `Invalid meter numerator or denominator in '${meter}'. Denominator must be one of ${validDenominators.join(', ')}.`,
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
      // Should not happen if 32nd notes are available and logic is correct
      console.warn(
        `Warning: No standard note value fits remaining duration ${remainingDuration.toFraction()}. Measure might be incomplete.`,
      );
      break;
    }

    // Choose a note based on weighted probability
    const chosenNote = weightedRandomChoice(possibleNotes, weights);

    if (chosenNote === null) {
      console.warn(
        `Warning: Could not select a note for remaining duration ${remainingDuration.toFraction()}. Measure might be incomplete.`,
      );
      break; // Defensive break
    }

    const chosenValue = noteValues[chosenNote];

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
      `Warning: Final rhythm duration ${currentSum.toFraction()} does not match target ${targetDuration.toFraction()}. Rhythm: [${rhythm.join(', ')}]`,
    );
  }

  return rhythm;
}
