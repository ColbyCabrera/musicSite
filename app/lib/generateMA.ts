import { getChordInfoFromRoman } from './theory/harmony';
import { Interval, Key, Note, Scale } from 'tonal';
import { weightedRandomChoice } from './utils';
import { isInRange as utilIsInRange, putInRange as utilPutInRange, InvalidRangeError } from './generationUtils';
import { generateRhythm } from './rhythm';
import { GenerationError, InvalidInputError, MusicTheoryError } from './errors';

// AI generation removed: no external API usage retained.

// returns object with melody and accompaniment
export default async function generateMA(
  progression: string[],
  key: string,
  meter: string,
  rangeConstraints: {
    melody: { min: string; max: string };
    accompaniment: { min: string; max: string };
  },
): Promise<{ melody: Melody; accompaniment: Melody }> {
  // Defensive argument validation to surface common misuse (passing key as first arg)
  if (!Array.isArray(progression) || typeof key !== 'string' || typeof meter !== 'string') {
    throw new InvalidInputError(
      'generateMA usage: generateMA(progression: string[], key: string, meter: string, rangeConstraints). ' +
      'Received invalid argument types. Ensure you pass the chord progression array first.'
    );
  }
  if (!rangeConstraints || !rangeConstraints.melody || !rangeConstraints.accompaniment) {
    throw new InvalidInputError(
      'generateMA: Missing rangeConstraints { melody: {min,max}, accompaniment: {min,max} }.'
    );
  }
  const melody = generateMelody(
    progression,
    key,
    meter,
    rangeConstraints.melody.min,
    rangeConstraints.melody.max,
  );

  // With AI removed, accompaniment is currently empty.
  const accompaniment: Melody = [];

  return {
    melody,
    accompaniment,
  };
}

type Melody = { note: string; rhythm: number }[];

function generateMelody(
  progression: string[],
  keySignature: string, // Renamed for clarity
  meter: string,
  minRange: string,
  maxRange: string,
): Melody {
  // Added return type
  const keyDetails = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
  if (!keyDetails || !keyDetails.tonic) {
    throw new InvalidInputError(
      `Invalid key signature for melody generation: ${keySignature}`,
    );
  }

  const melody: Melody = [];
  // Ensure startingNote is valid, provide a fallback octave if needed
  const tonic = keyDetails.scale[0];
  const startingNoteOctave =
    Note.get(tonic + '4').oct === undefined ? 4 : Note.get(tonic + '4').oct;
  const startingNote = tonic + (startingNoteOctave ?? 4);

  progression.forEach((chordSymbol, i) => {
    let chordInfo: {
      notes: number[];
      noteNames: string[];
      requiredBassPc: number | null;
    } | null;
    try {
      chordInfo = getChordInfoFromRoman(chordSymbol, keySignature);
    } catch (e) {
      // If a specific chord symbol fails, log and skip trying to use its notes,
      // but continue generating rhythm and diatonic melody for that segment.
      console.warn(
        `generateMelody: Error processing Roman numeral "${chordSymbol}" for chord-based notes. Error: ${(e as Error).message}. Will use diatonic notes.`,
      );
      chordInfo = null; // Allow generation to proceed with diatonic context
    }

    let rhythm;
    try {
      rhythm = generateRhythm(meter, 3); // Using moderate complexity for melody rhythm
    } catch (e) {
      console.error(
        `generateMelody: Failed to generate rhythm for meter "${meter}". Error: ${(e as Error).message}`,
      );
      throw new GenerationError(
        `Failed to generate rhythm for meter "${meter}": ${(e as Error).message}`,
      );
    }

    if (i === 0) {
      const firstRhythm = rhythm.shift();
      if (!firstRhythm) {
        throw new GenerationError(
          'Failed to get first rhythm value for starting note.',
        );
      }
      melody.push({ note: startingNote, rhythm: firstRhythm });
    }

    rhythm.forEach((noteLength) => {
      const lastMelodyNote = melody[melody.length - 1]?.note;
      if (!lastMelodyNote) {
        // Should not happen after first note is added
        throw new GenerationError(
          'Cannot determine last melody note for diatonic context.',
        );
      }
      const lastNoteDetails = Note.get(lastMelodyNote);
      if (lastNoteDetails.empty) {
        throw new MusicTheoryError(
          `Invalid last note in melody: ${lastMelodyNote}`,
        );
      }

      const diatonicNotes: (string | null)[] = [];
      for (let step = -3; step <= 3; step++) {
        // Reduced range for more focused choices
        diatonicNotes.push(
          transposeDiatonicallyBySteps(
            lastNoteDetails.name,
            step,
            `${keyDetails.tonic} ${keyDetails.type}`,
          ),
        );
      }
      const validDiatonicNotes = diatonicNotes.filter(
        (n) => n !== null,
      ) as string[];

      const minMidi = Note.midi(minRange);
      const maxMidi = Note.midi(maxRange);

      const choices: { item: string[]; weight: number }[] = [
        {
          item: validDiatonicNotes.map((noteName) =>
            convertNoteWithRange(noteName, minMidi, maxMidi),
          ),
          weight: 1, // Base weight for diatonic movement
        },
      ];

      if (chordInfo && chordInfo.noteNames) {
        choices.push({
          item: chordInfo.noteNames.map((noteNameFromChord) => {
            const noteDetails = Note.get(noteNameFromChord);
            const lastOctave = lastNoteDetails.oct ?? 4; // Fallback octave
            const currentNoteName = noteDetails.letter + lastOctave;
            // const noteMidi = Note.midi(currentNoteName); // No longer needed here

            // if (noteMidi === null || minMidi === null || maxMidi === null) return currentNoteName; // Fallback // Handled by convertNoteWithRange
            return convertNoteWithRange(currentNoteName, minMidi, maxMidi);
          }),
          weight: 2, // Higher weight for chord tones
        });
      }

      const possibleNotes = weightedRandomChoice(
        choices.filter((c) => c.item.length > 0),
      );

      // console.log(possibleNotes); // Debugging

      // Handle the case where possibleNotes might be null or empty
      let nextMelodyNote: string;
      if (possibleNotes && possibleNotes.length > 0) {
        nextMelodyNote = getNextNote(melody, keySignature, possibleNotes);
      } else {
        // Fallback strategy if no possible notes were determined (e.g., all weights were zero, or items were empty)
        // Revert to the last note or a simple step from it, or tonic.
        console.warn(
          `generateMelody: No possible notes from weighted choice for chord ${chordSymbol}. Using fallback.`,
        );
        const fallbackLastNote =
          melody[melody.length - 1]?.note ?? keyDetails.scale[0] + '4';
        // Attempt a simple step up or down, or just use the fallbackLastNote
        nextMelodyNote =
          getStepUp(fallbackLastNote, keySignature) || fallbackLastNote;
        // Ensure the fallback is also within range
        const noteMidi = Note.midi(nextMelodyNote);
        const minMidiFallback = Note.midi(minRange);
        const maxMidiFallback = Note.midi(maxRange);

        // Ensure the fallback is also within range by calling convertNoteWithRange
        nextMelodyNote = convertNoteWithRange(
          nextMelodyNote,
          minMidiFallback,
          maxMidiFallback,
        );
      }

      melody.push({
        note: nextMelodyNote,
        rhythm: noteLength,
      });
    });
  });

  // console.log('melody', melody); // Debugging
  if (melody.length === 0) {
    // This might happen if the progression is empty and the initial note wasn't added.
    throw new GenerationError('Failed to generate any notes for the melody.');
  }
  return melody;
}

function getNextNote(
  currentMelody: Melody,
  keySignature: string, // Renamed for clarity
  possibleNotes: string[], // Assumed to be non-empty and validated by caller
): string {
  // Added return type
  if (possibleNotes.length === 0) {
    // Fallback, though caller should ideally handle empty possibleNotes.
    console.warn(
      'getNextNote called with no possible notes. Returning last melody note or tonic.',
    );
    return (
      currentMelody[currentMelody.length - 1]?.note ??
      (Key.majorKey(keySignature)?.tonic ?? 'C') + '4'
    );
  }

  const lastNoteName = currentMelody[currentMelody.length - 1].note;
  const lastNoteDetails = Note.get(lastNoteName);
  if (lastNoteDetails.empty) {
    throw new MusicTheoryError(
      `Invalid last note in getNextNote: ${lastNoteName}`,
    );
  }

  const noteBeforeLastName = currentMelody[currentMelody.length - 2]?.note;

  if (noteBeforeLastName) {
    const noteBeforeLastDetails = Note.get(noteBeforeLastName);
    if (noteBeforeLastDetails.empty) {
      throw new MusicTheoryError(
        `Invalid note before last in getNextNote: ${noteBeforeLastName}`,
      );
    }
    if (isLeap(lastNoteDetails.name, noteBeforeLastDetails.name)) {
      const direction = getIntervalDirection(
        noteBeforeLastDetails.name,
        lastNoteDetails.name,
      );
      // Attempt to step in the opposite direction of the leap
      const nextNote =
        direction === 'asc'
          ? getStepDown(lastNoteDetails.name, keySignature)
          : getStepUp(lastNoteDetails.name, keySignature);
      // If the counter-step is valid and in possibleNotes, prefer it. Otherwise, random choice.
      if (nextNote && possibleNotes.includes(nextNote)) return nextNote;
    }
  }

  // Default to random choice from the provided valid & ranged possible notes
  const randomIndex = Math.floor(Math.random() * possibleNotes.length);
  return possibleNotes[randomIndex];
}

function getIntervalDirection(
  firstNoteName: string, // Renamed for clarity
  secondNoteName: string, // Renamed for clarity
): 'asc' | 'desc' | 'same' {
  // Added 'same' for completeness
  const firstMidi = Note.midi(firstNoteName);
  const secondMidi = Note.midi(secondNoteName);

  if (firstMidi === null || secondMidi === null) {
    throw new MusicTheoryError(
      `Invalid note names for getIntervalDirection: ${firstNoteName}, ${secondNoteName}`,
    );
  }

  if (secondMidi > firstMidi) return 'asc';
  if (secondMidi < firstMidi) return 'desc';
  return 'same';
}

function isLeap(firstNoteName: string, secondNoteName: string): boolean {
  // Renamed parameters
  const interval = Interval.distance(firstNoteName, secondNoteName); // Tonal.Interval can handle note names
  const semitones = Interval.semitones(interval);
  if (semitones === undefined) {
    // Should not happen with valid note names
    throw new MusicTheoryError(
      `Could not determine semitones for interval between ${firstNoteName} and ${secondNoteName}`,
    );
  }
  // A leap is typically more than a major second (2 semitones)
  return Math.abs(semitones) > 2;
}

function getStepUp(noteName: string, keySignature: string): string | null {
  // Renamed parameters, added null return
  const currNoteDetails = Note.get(noteName);
  if (currNoteDetails.empty) {
    throw new MusicTheoryError(`Invalid note for getStepUp: ${noteName}`);
  }

  const keyObj = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
  if (!keyObj || !keyObj.tonic) {
    throw new InvalidInputError(`Invalid key for getStepUp: ${keySignature}`);
  }
  const scale = keyObj.scale;
  const currentPcIndex = scale.indexOf(currNoteDetails.pc);
  if (currentPcIndex === -1) {
    console.warn(
      `getStepUp: Note ${noteName} (PC: ${currNoteDetails.pc}) not in scale ${keySignature}. Transposing chromatically.`,
    );
    return Note.transpose(noteName, 'm2'); // Fallback to chromatic step if PC not in scale
  }

  const nextPcIndex = (currentPcIndex + 1) % scale.length;
  const nextPc = scale[nextPcIndex];

  // Determine octave: if nextPc is lower than currentPc (e.g. B to C), increment octave.
  let octave = currNoteDetails.oct ?? 4; // Fallback octave
  if (Note.chroma(nextPc)! < Note.chroma(currNoteDetails.pc)!) {
    octave++;
  }
  return nextPc + octave;
}

function getStepDown(noteName: string, keySignature: string): string | null {
  // Renamed, added null return
  const currNoteDetails = Note.get(noteName);
  if (currNoteDetails.empty) {
    throw new MusicTheoryError(`Invalid note for getStepDown: ${noteName}`);
  }

  const keyObj = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
  if (!keyObj || !keyObj.tonic) {
    throw new InvalidInputError(`Invalid key for getStepDown: ${keySignature}`);
  }
  const scale = keyObj.scale;
  const currentPcIndex = scale.indexOf(currNoteDetails.pc);

  if (currentPcIndex === -1) {
    console.warn(
      `getStepDown: Note ${noteName} (PC: ${currNoteDetails.pc}) not in scale ${keySignature}. Transposing chromatically.`,
    );
    return Note.transpose(noteName, '-m2'); // Fallback to chromatic step
  }

  const prevPcIndex = (currentPcIndex - 1 + scale.length) % scale.length;
  const prevPc = scale[prevPcIndex];

  let octave = currNoteDetails.oct ?? 4;
  if (Note.chroma(prevPc)! > Note.chroma(currNoteDetails.pc)!) {
    octave--;
  }
  return prevPc + octave;
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
  // Validate interval quantity (integer)
  if (!Number.isInteger(intervalQuantity)) {
    // console.warn // console.error is too strong for a utility function, let caller decide.
    throw new InvalidInputError(
      `Invalid interval quantity: ${intervalQuantity} (must be an integer)`,
    );
  }

  // Validate and parse the input note
  const startNoteDetails = Note.get(noteName);
  if (
    startNoteDetails.empty ||
    !startNoteDetails.pc ||
    startNoteDetails.oct === undefined
  ) {
    throw new MusicTheoryError(
      `Invalid input note for transposition: ${noteName}`,
    );
  }

  // Get the notes of the specified scale
  const scaleDetails = Scale.get(scaleName);
  if (scaleDetails.empty || scaleDetails.notes.length === 0) {
    throw new MusicTheoryError(
      `Invalid or empty scale for transposition: ${scaleName}`,
    );
  }
  const scaleNotes = scaleDetails.notes;
  const scaleSize = scaleNotes.length;

  // Find the index of the starting note's pitch class in the scale
  const pcIndex = scaleNotes.indexOf(startNoteDetails.pc);
  if (pcIndex === -1) {
    // This might be a common case if a chromatic note is passed with a diatonic scale.
    // Depending on desired behavior, could throw, or try to find closest diatonic.
    // For now, let's consider it an issue if exact PC not found.
    console.warn(
      `transposeDiatonicallyBySteps: Pitch class ${startNoteDetails.pc} (from note ${noteName}) not found in scale ${scaleName}. Returning null.`,
    );
    return null;
  }

  // Calculate the target index in the scale notes array
  const targetPcIndex =
    (pcIndex + (intervalQuantity % scaleSize) + scaleSize) % scaleSize;
  const targetPc = scaleNotes[targetPcIndex];

  // Calculate the change in octaves
  const octaveChange = Math.floor((pcIndex + intervalQuantity) / scaleSize);
  const targetOctave = startNoteDetails.oct + octaveChange;

  const resultNoteName = targetPc + targetOctave;
  const resultNoteDetails = Note.get(resultNoteName);

  // Validate the result note
  if (resultNoteDetails.empty) {
    // This should be rare if logic is correct, but good to check.
    console.warn(
      `transposeDiatonicallyBySteps: Constructed an invalid note "${resultNoteName}".`,
    );
    return null;
  }

  return resultNoteName;
}

/**
 * Checks if a given note falls within the specified musical range.
 *
 * @param noteName The note to check (e.g., "C4", "F#5").
 * @param minRangeNote The minimum note of the range (e.g., "C4").
 * @param maxRangeNote The maximum note of the range (e.g., "G5").
 * @returns True if the note is within the range (inclusive), false otherwise or if inputs are invalid.
 */
// Local isInRange and putInRange functions are now removed.
// Their functionalities are replaced by utilIsInRange and utilPutInRange from generationUtils.

/**
 * Converts a note to be within a specified MIDI range.
 * @param noteName The name of the note (e.g., "C4").
 * @param minMidi The minimum MIDI value of the range.
 * @param maxMidi The maximum MIDI value of the range.
 * @returns The converted note name or the original if conversion fails or is not needed.
 */
function convertNoteWithRange(
  noteName: string,
  minMidi: number | null,
  maxMidi: number | null,
): string {
  try {
    const noteMidi = Note.midi(noteName);
    if (noteMidi === null || minMidi === null || maxMidi === null) {
      return noteName; // Not enough info to convert or range is not defined
    }
    return Note.fromMidi(utilPutInRange(noteMidi, minMidi, maxMidi));
  } catch (e) {
    if (e instanceof InvalidRangeError) {
      // Log a warning if the range was invalid, but return the original note
      // to allow melody generation to proceed.
      console.warn(
        `[convertNoteWithRange] Invalid range for note ${noteName}: ${e.message}. Original note will be used.`,
      );
      return noteName;
    }
    // For other errors, re-throw to be handled by higher-level error handlers.
    throw e;
  }
}
