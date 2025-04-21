import Fraction from 'fraction.js';
import { getChordInfoFromRoman } from './harmonyUtils';
import { Interval, Key, Note } from 'tonal';
import { get } from 'http';

// returns object with melody and accompaniment
export default function generateMA(
  progression: string[],
  key: string,
  meter: string,
) {
  generateMelody(progression, key, meter);
}

type Melody = { note: string; rhythm: number }[];

// TODO: Make it so that melody is follows counterpoint rules
function generateMelody(progression: string[], key: string, meter: string) {
  const melody: Melody = [];
  const startingNote = Key.majorKey(key).scale[0] + 4; // eg. C4

  progression.forEach((chord, i) => {
    const chordInfo = getChordInfoFromRoman(chord, key);
    const rhythm = generateRhythm(meter, 1);
    if (i === 0)
      melody.push({ note: startingNote, rhythm: rhythm.shift() ?? 0 });

    rhythm.forEach((noteLength, j) => {
      const possibleNotes = weightedRandomChoice([
        { item: chordInfo?.noteNames, weight: 2 },
        { item: Key.majorKey('C').scale, weight: 1 },
      ]) as string[];

      melody.push({
        note: getNextNote(melody, key, possibleNotes),
        rhythm: noteLength,
      });
    });
  });

  console.log('melody', melody);
}

function getNextNote(
  currentMelody: Melody,
  key: string,
  possibleNotes: string[],
) {
  const lastNote = Note.get(currentMelody[currentMelody.length - 1].note);
  const noteBeforeLast = Note.get(
    currentMelody[currentMelody.length - 2]?.note,
  );
  if (isLeap(lastNote.name, noteBeforeLast.name)) {
    return getStepDown(lastNote.name, key);
  } else {
    const randomIndex = Math.floor(Math.random() * possibleNotes.length);

    return possibleNotes[randomIndex];
  }
}

function isLeap(firstNote: string, secondNote: string) {
  const interval = Interval.distance(firstNote, secondNote);
  const intervalDistance = Interval.num(interval);

  return intervalDistance > 2; // Greater than a major second is considered a leap
}

function getStepDown(note: string, key: string) {
  const lastNote = Note.get(note);
  const scale = Key.majorKey(key).scale;
  const stepDownLetter = scale.slice(scale.indexOf(lastNote.letter) - 1)[0];
  const interval = Note.distance(stepDownLetter, lastNote.letter);

  return Note.transpose(lastNote.name, `-${interval}`);
}

/**
 * Transposes a note by a given number of diatonic steps within a specified scale.
 * Assumes the input note's pitch class exists within the scale.
 * Defaults to the C Major scale.
 *
 * @param {string} noteName - The starting note in scientific pitch notation (e.g., "C4", "B3").
 * @param {number} intervalQuantity - The number of diatonic steps to move.
 * Positive for up, negative for down, 0 for no change.
 * e.g., +1 (up a step), -1 (down a step), +2 (up a third), +7 (up an octave).
 * @param {string} [scaleName='C major'] - The name of the scale to use (e.g., "C major", "G harmonic minor").
 * @returns {string|null} The resulting note name (e.g., "D4", "A3", "B4"),
 * or null if the input note or scale is invalid or the note's pitch class isn't in the scale.
 */
function transposeDiatonicallyBySteps(
  noteName: string,
  intervalQuantity: number,
  scaleName = 'C major',
) {
  // Validate interval quantity
  if (
    typeof intervalQuantity !== 'number' ||
    !Number.isInteger(intervalQuantity)
  ) {
    console.error(
      'Invalid interval quantity:',
      intervalQuantity,
      '(must be an integer)',
    );
    return null;
  }

  // Validate and parse the input note
  const startNote = Note.get(noteName);
  if (!startNote || !startNote.pc || startNote.oct === undefined) {
    console.error('Invalid input note:', noteName);
    return null;
  }

  // Get the notes of the specified scale
  const scale = Scale.get(scaleName);
  if (!scale || !scale.notes || scale.notes.length === 0) {
    console.error('Invalid scale name or empty scale:', scaleName);
    return null;
  }
  const scaleNotes = scale.notes; // e.g., ['C', 'D', 'E', 'F', 'G', 'A', 'B'] for C major
  const scaleSize = scaleNotes.length;

  // Find the index of the starting note's pitch class in the scale
  const pcIndex = scaleNotes.indexOf(startNote.pc);
  if (pcIndex === -1) {
    console.error(
      `Pitch class ${startNote.pc} not found in scale ${scaleName}`,
    );
    return null; // Pitch class not diatonic to the scale
  }

  // Calculate the target index in the scale notes array
  // Handles positive/negative intervalQuantity and wrapping around the scale
  const targetPcIndex =
    (pcIndex + (intervalQuantity % scaleSize) + scaleSize) % scaleSize;

  // Get the target pitch class
  const targetPc = scaleNotes[targetPcIndex];

  // Calculate the change in octaves based on how many times we wrapped around the scale
  const octaveChange = Math.floor((pcIndex + intervalQuantity) / scaleSize);

  // Calculate the target octave
  const targetOctave = startNote.oct + octaveChange;

  // Construct the final note name
  const resultNote = targetPc + targetOctave;

  // Validate the result note (optional, but good practice)
  if (!Note.get(resultNote).name) {
    console.error('Failed to construct valid result note:', resultNote);
    return null;
  }

  return resultNote;
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

interface WeightedChoice<T> {
  item: T;
  weight: number;
}

/**
 * Performs a weighted random choice from a list of items.
 * Each item has an associated weight. Items with higher weights are more likely to be chosen.
 *
 * @template T The type of the items to choose from.
 * @param {WeightedChoice<T>[]} choices - An array of objects, each containing an 'item' and its 'weight'.
 * @returns {T | null} The chosen item, or null if the input array is empty or contains no valid choices.
 */
const weightedRandomChoice = <T>(choices: WeightedChoice<T>[]): T | null => {
  if (!choices || choices.length === 0) {
    return null; // No choices provided
  }

  const population: T[] = [];
  const weightValues: number[] = [];

  // Populate population and weights, filtering out items with non-positive weights initially
  for (const choice of choices) {
    // Ensure weight is a valid, non-negative number
    const weight =
      typeof choice.weight === 'number' && choice.weight > 0
        ? choice.weight
        : 0;
    population.push(choice.item);
    weightValues.push(weight);
  }

  if (population.length === 0) {
    // This could happen if the original choices array only had items with <= 0 weight
    // Or if the choices array was empty (handled at the start)
    return null;
  }

  let totalWeight = weightValues.reduce((sum, w) => sum + w, 0);

  // If all provided weights were zero or negative, give all original items an equal chance
  if (totalWeight <= 0) {
    // Reset weights to 1 for all *original* valid items if all weights were non-positive
    const numValidOriginalChoices = choices.length; // Use original length here
    if (numValidOriginalChoices === 0) return null; // Still no choices

    // Re-populate based on original choices, giving each weight 1
    population.length = 0; // Clear arrays
    weightValues.length = 0;
    for (const choice of choices) {
      population.push(choice.item);
      weightValues.push(1); // Assign weight 1 to all
    }
    totalWeight = population.length; // Total weight is now the number of items
    if (totalWeight === 0) return null; // Should not happen if choices had length > 0
  }

  let randomWeight = Math.random() * totalWeight;

  for (let i = 0; i < population.length; i++) {
    // Check if the random number falls within the range of the current item's weight
    if (randomWeight < weightValues[i]) {
      return population[i]; // Return the chosen item (which is an array in your case)
    }
    // Subtract the current item's weight to move to the next range
    randomWeight -= weightValues[i];
  }

  // Fallback: This should theoretically not be reached if totalWeight > 0
  // It might be reached if there are floating point precision issues or edge cases.
  // Returning the last item is a reasonable fallback.
  return population.length > 0 ? population[population.length - 1] : null;
};
