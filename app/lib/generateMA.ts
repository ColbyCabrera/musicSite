import { getChordInfoFromRoman } from './harmonyUtils';
import { Interval, Key, Note, Scale } from 'tonal';
import { weightedRandomChoice } from './utils';
import { generateRhythm } from './rhythm';

// returns object with melody and accompaniment
export default function generateMA(
  progression: string[],
  key: string,
  meter: string,
  minRange: string, // e.g., 'C4'
  maxRange: string, // e.g., 'G5'
): Melody {
  const minMidi = Note.midi(minRange);
  const maxMidi = Note.midi(maxRange);

  if (minMidi === null) {
    throw new Error(`Invalid minimum range note: ${minRange}`);
  }
  if (maxMidi === null) {
    throw new Error(`Invalid maximum range note: ${maxRange}`);
  }
  if (minMidi > maxMidi) {
    throw new Error(
      `Minimum range (${minRange}) cannot be higher than maximum range (${maxRange})`,
    );
  }

  const melody = generateMelody(progression, key, meter, minRange, maxRange);
  return melody; // Return structure
}

type Melody = { note: string; rhythm: number }[];

// ADD MIN AND MAX RANGE FOR MELODY AND ACCOMPANIMENT
function generateMelody(
  progression: string[],
  key: string,
  meter: string,
  minRange: string, // e.g., 'C4'
  maxRange: string,
) {
  const keyObj = Key.majorKey(key);
  const melody: Melody = [];
  const startingNote = Key.majorKey(key).scale[0] + 4; // eg. C4

  progression.forEach((chord, i) => {
    const chordInfo = getChordInfoFromRoman(chord, key);
    const rhythm = generateRhythm(meter, 1);
    if (i === 0) melody.push({ note: startingNote, rhythm: rhythm.shift()!! }); // Assert that rhythm is not empty

    rhythm.forEach((noteLength, j) => {
      const lastNote = Note.get(melody[melody.length - 1].note);
      let diatonicNotes = [];

      for (let i = -7; i <= 7; i++) {
        diatonicNotes.push(
          transposeDiatonicallyBySteps(
            lastNote.name,
            i,
            `${keyObj.tonic} ${keyObj.type}`,
          ),
        );
      }

      const possibleNotes = weightedRandomChoice([
        {
          item: chordInfo?.noteNames.map(
            (noteName) =>
              putInRange(
                Note.get(noteName).letter + lastNote.oct,
                minRange,
                maxRange,
              ), // Proper note name, ex. C4, D4, etc.
          ),
          weight: 2,
        },
        {
          item: diatonicNotes.map((noteName) =>
            putInRange(noteName ?? keyObj.scale[0] + 4, minRange, maxRange),
          ),
          weight: 1,
        },
      ]) as string[];

      console.log(possibleNotes);

      melody.push({
        note: getNextNote(melody, key, possibleNotes),
        rhythm: noteLength,
      });
    });
  });

  console.log('melody', melody);
  return melody;
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
    return getIntervalDirection(noteBeforeLast.name, lastNote.name) === 'asc'
      ? getStepDown(lastNote.name, key)
      : getStepUp(lastNote.name, key);
  } else {
    const randomIndex = Math.floor(Math.random() * possibleNotes.length);

    return possibleNotes[randomIndex];
  }
}

function getIntervalDirection(
  firstNote: string,
  secondNote: string,
): 'asc' | 'desc' {
  const interval = Interval.distance(firstNote, secondNote);
  const intervalDistance = Interval.num(interval);

  return intervalDistance > 0 ? 'asc' : 'desc';
}

function isLeap(firstNote: string, secondNote: string) {
  const interval = Interval.distance(firstNote, secondNote);
  const intervalDistance = Interval.num(interval);

  return intervalDistance > 2 || intervalDistance < -2; // Greater than a major second is considered a leap
}

function getStepUp(note: string, key: string) {
  const currNote = Note.get(note);
  const scale = Key.majorKey(key).scale;
  const currentIndex = scale.indexOf(currNote.letter);

  // Get the next note in the scale, wrapping around if necessary.
  const nextIndex = (currentIndex + 1) % scale.length;
  const stepUpLetter = scale[nextIndex];

  // Calculate the interval between the current note and the target note in the scale.
  const interval = Note.distance(currNote.letter, stepUpLetter);

  // Transpose the note upward by the determined interval.
  return Note.transpose(currNote.name, interval);
}

function getStepDown(note: string, key: string) {
  const currNote = Note.get(note);
  const scale = Key.majorKey(key).scale;
  const stepDownLetter = scale.slice(scale.indexOf(currNote.letter) - 1)[0];
  const interval = Note.distance(stepDownLetter, currNote.letter);

  return Note.transpose(currNote.name, `-${interval}`);
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

/**
 * Checks if a given note falls within the specified musical range.
 *
 * @param noteName The note to check (e.g., "C4", "F#5").
 * @param minRangeNote The minimum note of the range (e.g., "C4").
 * @param maxRangeNote The maximum note of the range (e.g., "G5").
 * @returns True if the note is within the range (inclusive), false otherwise or if inputs are invalid.
 */
function isInRange(
  noteName: string,
  minRangeNote: string,
  maxRangeNote: string,
): boolean {
  const noteMidi = Note.midi(noteName);
  const minMidi = Note.midi(minRangeNote);
  const maxMidi = Note.midi(maxRangeNote);

  // Check for invalid inputs
  if (noteMidi === null || minMidi === null || maxMidi === null) {
    console.warn(
      `Invalid input for isInRange: note=${noteName}, min=${minRangeNote}, max=${maxRangeNote}`,
    );
    return false;
  }
  // Ensure min is not greater than max (though ideally validated earlier)
  if (minMidi > maxMidi) {
    console.warn(
      `Min range ${minRangeNote} is higher than max range ${maxRangeNote} in isInRange.`,
    );
    return false; // Or handle as appropriate
  }

  return noteMidi >= minMidi && noteMidi <= maxMidi;
}

/**
 * Transposes a note by octaves to fit within a specified musical range.
 * If the note cannot fit even after transposition, it clamps to the nearest boundary (min or max).
 *
 * @param noteName The note to potentially adjust (e.g., "C3", "G6").
 * @param minRangeNote The minimum note of the target range (e.g., "C4").
 * @param maxRangeNote The maximum note of the target range (e.g., "G5").
 * @returns The adjusted note name within the range, or the original note if inputs are invalid.
 */
function putInRange(
  noteName: string,
  minRangeNote: string,
  maxRangeNote: string,
): string {
  const originalMidi = Note.midi(noteName);
  const minMidi = Note.midi(minRangeNote);
  const maxMidi = Note.midi(maxRangeNote);

  // --- Input Validation ---
  if (originalMidi === null || minMidi === null || maxMidi === null) {
    console.warn(
      `Invalid input for putInRange: note=${noteName}, min=${minRangeNote}, max=${maxRangeNote}. Returning original.`,
    );
    return noteName; // Return original note if any input is invalid
  }
  if (minMidi > maxMidi) {
    console.warn(
      `Min range ${minRangeNote} > max range ${maxRangeNote} in putInRange. Returning original note.`,
    );
    return noteName; // Cannot reasonably place in an invalid range
  }

  // --- Check if already in range ---
  if (originalMidi >= minMidi && originalMidi <= maxMidi) {
    return noteName; // Already in range
  }

  // --- Transpose if out of range ---
  let currentNote = noteName;
  let currentMidi = originalMidi;

  if (currentMidi < minMidi) {
    // Note is too low, transpose up by octaves
    while (currentMidi < minMidi) {
      const nextNote = Note.transpose(currentNote, '8P'); // 8P = Perfect Octave up
      const nextMidi = Note.midi(nextNote);
      if (nextMidi === null) {
        // Should not happen with valid input/transpose
        console.error(`Error transposing ${currentNote} up by octave.`);
        return minRangeNote; // Fallback to min range note
      }
      // Check if transposing up *overshot* the max range
      if (nextMidi > maxMidi) {
        // It overshot. Decide whether min or max boundary is closer *musically* (MIDI difference)
        // This case means the note's pitch class might not fit well.
        // Clamp to the closest boundary.
        return minMidi - currentMidi <= nextMidi - maxMidi
          ? minRangeNote
          : maxRangeNote;
        // Alternative: Could return the last valid note *before* overshooting, which is currentNote.
        // return currentNote; // This might be less musically jarring than clamping sometimes. Choose one behavior.
        // Let's stick to clamping for now as requested.
      }
      currentNote = nextNote;
      currentMidi = nextMidi;
      // If it lands exactly in range, we'll exit the loop or the next check will pass.
    }
    // After loop, currentMidi >= minMidi. It might be > maxMidi if the initial overshoot check wasn't triggered (e.g., landed exactly on maxMidi+1).
    // Re-check final position.
    return currentMidi <= maxMidi ? currentNote : maxRangeNote; // Clamp to max if final position is too high
  } else {
    // currentMidi > maxMidi
    // Note is too high, transpose down by octaves
    while (currentMidi > maxMidi) {
      const nextNote = Note.transpose(currentNote, '-8P'); // -8P = Perfect Octave down
      const nextMidi = Note.midi(nextNote);
      if (nextMidi === null) {
        console.error(`Error transposing ${currentNote} down by octave.`);
        return maxRangeNote; // Fallback to max range note
      }
      // Check if transposing down *undershot* the min range
      if (nextMidi < minMidi) {
        // It undershot. Clamp to the closest boundary.
        return currentMidi - maxMidi <= minMidi - nextMidi
          ? maxRangeNote
          : minRangeNote;
        // Alternative: return currentNote; // Return last valid note before undershooting.
      }
      currentNote = nextNote;
      currentMidi = nextMidi;
    }
    // After loop, currentMidi <= maxMidi. Re-check final position.
    return currentMidi >= minMidi ? currentNote : minRangeNote; // Clamp to min if final position is too low
  }
}
