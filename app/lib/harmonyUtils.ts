// src/harmonyUtils.ts
import * as Tonal from 'tonal';
import { DEFAULT_OCTAVE } from './constants';
import { ChordInfo } from './types';

/**
 * Parses a Roman numeral with optional inversion notation.
 * @param roman - Roman numeral string (e.g., "V", "V7", "ii6", "IV64", "V/3").
 * @returns Object with base Roman numeral and desired bass interval, or null if invalid.
 */
function parseRomanNumeral(roman: string): {
  baseRoman: string;
  bassInterval: string | null;
} | null {
  // Match figured bass (6, 64, 7, 65, 43, 42, 2) or slash notation (/3, /5, /b3, /#5 etc.)
  const figuredBassMatch = roman.match(
    /^(.*?)(?:(64|65|43|42|6|7|2))(?![a-zA-Z#b])$/,
  ); // Ensure figure is at the end
  const slashMatch = roman.match(/^(.*?)\/([#b]?\d+)$/);

  let baseRoman: string;
  let bassInterval: string | null = null;

  if (figuredBassMatch) {
    baseRoman = figuredBassMatch[1];
    const figure = figuredBassMatch[2];
    switch (figure) {
      case '6':
        bassInterval = '3';
        break; // 1st inversion triad or 7th chord
      case '64':
        bassInterval = '5';
        break; // 2nd inversion triad
      case '7':
        bassInterval = '1';
        break; // Root position 7th (often implied, but can be explicit)
      case '65':
        bassInterval = '3';
        break; // 1st inversion 7th
      case '43':
        bassInterval = '5';
        break; // 2nd inversion 7th
      case '42':
      case '2':
        bassInterval = '7';
        break; // 3rd inversion 7th
      default:
        bassInterval = '1'; // Should not happen with regex, but default to root
    }
    // Add 'M' or 'm' prefix if needed for interval quality based on chord type?
    // Tonal.transpose usually handles this ok if the base chord symbol is correct.
  } else if (slashMatch) {
    baseRoman = slashMatch[1];
    bassInterval = slashMatch[2]; // e.g., "3", "5", "b3", "#5"
    // Need to translate this number/accidental to a Tonal interval string
    // For simplicity now, assume 1, 3, 5, 7 correspond to P1, M/m3, P5, M/m7
    // Tonal might interpret "3" correctly based on context, let's try
    if (bassInterval === '3')
      bassInterval = '3'; // Keep simple for now
    else if (bassInterval === '5') bassInterval = '5';
    else if (bassInterval === '7') bassInterval = '7';
    // Add more complex slash parsing if needed (e.g., /b3 -> m3?)
    else bassInterval = '1'; // Fallback for unrecognized slash
  } else {
    baseRoman = roman;
    bassInterval = '1'; // Root position default
  }

  if (!baseRoman) {
    console.warn(`Could not parse base Roman numeral from "${roman}"`);
    return null;
  }

  return { baseRoman, bassInterval };
}

/**
 * Gets the MIDI notes, note names (e.g., "C4"), and required bass note
 * pitch class based on a chord's Roman numeral in a given key.
 * Handles inversions indicated by figured bass or slash notation.
 *
 * @param fullRomanWithInversion - Roman numeral symbol (e.g., "V7", "ii6", "IV64", "V/3").
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Object with:
 * - `notes`: array of MIDI notes for the chord in root position (sorted).
 * - `noteNames`: array of note names with octaves (e.g., ["C4", "E4", "G4"]) for the chord in root position (sorted).
 * - `requiredBassPc`: pitch class (0-11) of the required bass note for the inversion, or null if root position/error.
 * Returns null if a fundamental error occurs.
 */
export function getChordInfoFromRoman(
  fullRomanWithInversion: string,
  keyName: string,
): {
  notes: number[];
  noteNames: string[];
  requiredBassPc: number | null;
} | null {
  try {
    const parsed = parseRomanNumeral(fullRomanWithInversion);
    if (!parsed) return null;
    const { baseRoman, bassInterval } = parsed;

    // Attempt to parse major key first, then minor
    let keyDetailsObj: // Changed name to avoid conflict
      | ReturnType<typeof Tonal.Key.majorKey>
      | ReturnType<typeof Tonal.Key.minorKey> = Tonal.Key.majorKey(keyName);
    if (!keyDetailsObj || keyDetailsObj.type !== 'major') {
      keyDetailsObj = Tonal.Key.minorKey(keyName);
    }

    if (!keyDetailsObj || !keyDetailsObj.tonic) {
      console.warn(
        `Could not get valid key details for key "${keyName}". Roman: "${fullRomanWithInversion}"`,
      );
      return null;
    }

    const finalChordSymbol = _constructChordSymbol(
      baseRoman,
      keyDetailsObj,
      keyName, // Pass keyName for Tonal.Key.minorKey inside helper
      fullRomanWithInversion, // For logging
    );

    if (!finalChordSymbol) {
      return null; // Error already logged in _constructChordSymbol
    }

    return _getMidiNotesAndBassPc(
      finalChordSymbol,
      bassInterval,
      keyDetailsObj.type as 'major' | 'minor', // Pass keyType for octave guessing
      fullRomanWithInversion, // For logging
    );
  } catch (error) {
    console.error(
      `Unexpected error getting chord info for Roman "${fullRomanWithInversion}" in key "${keyName}":`,
      error,
    );
    return null;
  }
}


/**
 * Constructs the Tonal-compatible chord symbol from a base Roman numeral and key information.
 * @param baseRoman The base Roman numeral (e.g., "V", "ii", "IV").
 * @param keyDetails Tonal key details object.
 * @param keyName The name of the key (e.g., "C", "Gm").
 * @param fullRomanWithInversion Full original Roman numeral for logging.
 * @returns The Tonal-compatible chord symbol string (e.g., "G7", "Dm7", "Fmaj7") or null if an error occurs.
 */
function _constructChordSymbol(
  baseRoman: string,
  keyDetails:
    | ReturnType<typeof Tonal.Key.majorKey>
    | ReturnType<typeof Tonal.Key.minorKey>,
  keyName: string, // Added for Tonal.Key.minorKey().natural.chords etc.
  fullRomanWithInversion: string, // For logging
): string | null {
  const keyType = keyDetails.type as 'major' | 'minor';
  const romanMap: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
  const baseRomanMatch = baseRoman.match(/([ivx]+)/i);
  if (!baseRomanMatch) {
    console.warn(`Could not parse base Roman letters from "${baseRoman}" in full Roman "${fullRomanWithInversion}".`);
    return null;
  }
  const baseRomanUpper = baseRomanMatch[1].toUpperCase();
  const scaleDegreeIndex = romanMap[baseRomanUpper];

  if (scaleDegreeIndex === undefined) {
    console.warn(`Could not map base Roman letters "${baseRomanUpper}" to scale degree index.`);
    return null;
  }

  let finalChordSymbol: string;

  const diatonicChords = keyType === 'major'
    ? keyDetails.chords
    : (Tonal.Key.minorKey(keyName) || keyDetails)?.natural?.chords; // Ensure minorKey result is checked

  const diatonicHarmonicChords = keyType === 'minor'
    ? (Tonal.Key.minorKey(keyName) || keyDetails)?.harmonic?.chords
    : [];

  if (!diatonicChords || scaleDegreeIndex >= diatonicChords.length) {
    console.warn(`Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}".`);
    return null;
  }

  finalChordSymbol = diatonicChords[scaleDegreeIndex]; // Initial diatonic chord

  // Adjust Quality for Minor Key (Harmonic/Melodic) & Explicit Markings
  const qualityMatch = baseRoman.match(/(dim|o|\+|aug|M|m|maj|min)$/i);
  const requestedQualitySymbol = qualityMatch ? qualityMatch[1].toLowerCase() : null;
  const requestedSeventh = baseRoman.includes('7');
  const requestedHalfDim = baseRoman.includes('ø') || baseRoman.includes('hd');
  const requestedDim = baseRoman.includes('°') || baseRoman.includes('dim') || baseRoman.includes('o');

  if (keyType === 'minor') {
    if (scaleDegreeIndex === 4 /* V */ && diatonicHarmonicChords && diatonicHarmonicChords.length > scaleDegreeIndex) {
      finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually V major
    } else if (scaleDegreeIndex === 6 /* VII */ && diatonicHarmonicChords && diatonicHarmonicChords.length > scaleDegreeIndex) {
      finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually vii diminished
    }
  }

  let currentChordInfo = Tonal.Chord.get(finalChordSymbol);
  if (requestedQualitySymbol && currentChordInfo.tonic) {
    let qualityToApply = '';
    if (['maj', 'M'].includes(requestedQualitySymbol)) qualityToApply = 'M';
    else if (['min', 'm'].includes(requestedQualitySymbol)) qualityToApply = 'm';
    else if (['dim', 'o'].includes(requestedQualitySymbol)) qualityToApply = 'dim';
    else if (['aug', '+'].includes(requestedQualitySymbol)) qualityToApply = 'aug';

    if (qualityToApply) {
      const potentialNewSymbol = currentChordInfo.tonic + qualityToApply;
      const checkChord = Tonal.Chord.get(potentialNewSymbol);
      if (!checkChord.empty) {
        finalChordSymbol = checkChord.symbol;
        currentChordInfo = checkChord;
      }
    }
  }

  if (requestedSeventh) {
    currentChordInfo = Tonal.Chord.get(finalChordSymbol); // Re-get in case quality changed
    if (!currentChordInfo.tonic) { // Should not happen if previous steps are correct
        console.warn(`Cannot add 7th, chord tonic is missing for ${finalChordSymbol}`);
        return finalChordSymbol; // Return triad as is
    }
    let seventhSymbol = '';

    if (requestedHalfDim) {
      seventhSymbol = currentChordInfo.tonic + 'm7b5';
    } else if (requestedDim) {
      seventhSymbol = currentChordInfo.tonic + 'dim7';
    } else {
      if (keyType === 'major') {
        if (scaleDegreeIndex === 0 || scaleDegreeIndex === 3) seventhSymbol = currentChordInfo.tonic + 'maj7';
        else if (scaleDegreeIndex === 1 || scaleDegreeIndex === 2 || scaleDegreeIndex === 5) seventhSymbol = currentChordInfo.tonic + 'm7';
        else if (scaleDegreeIndex === 4) seventhSymbol = currentChordInfo.tonic + '7';
        else if (scaleDegreeIndex === 6) seventhSymbol = currentChordInfo.tonic + 'm7b5';
      } else { // Minor key context
        const minorKeyDetails = Tonal.Key.minorKey(keyName); // Get full minor key details
        if (scaleDegreeIndex === 4) seventhSymbol = currentChordInfo.tonic + '7';
        else if (scaleDegreeIndex === 6) seventhSymbol = currentChordInfo.tonic + 'dim7';
        else if (scaleDegreeIndex === 1) seventhSymbol = currentChordInfo.tonic + 'm7b5';
        else if (scaleDegreeIndex === 0) seventhSymbol = currentChordInfo.tonic + 'm7';
        else if (scaleDegreeIndex === 2 && minorKeyDetails?.natural.chords[2]?.endsWith('maj7')) seventhSymbol = currentChordInfo.tonic + 'maj7';
        else if (scaleDegreeIndex === 3) seventhSymbol = currentChordInfo.tonic + 'm7';
        else if (scaleDegreeIndex === 5 && minorKeyDetails?.natural.chords[5]?.endsWith('maj7')) seventhSymbol = currentChordInfo.tonic + 'maj7';
        else {
          if (currentChordInfo.type === 'major') seventhSymbol = currentChordInfo.tonic + 'maj7';
          else if (currentChordInfo.type === 'minor') seventhSymbol = currentChordInfo.tonic + 'm7';
          else seventhSymbol = finalChordSymbol + '7';
        }
      }
    }

    const chordInfoWithSeventh = Tonal.Chord.get(seventhSymbol);
    if (!chordInfoWithSeventh.empty) {
      finalChordSymbol = seventhSymbol;
    } else {
      const fallbackSymbol = finalChordSymbol + '7';
      const fallbackInfo = Tonal.Chord.get(fallbackSymbol);
      if (!fallbackInfo.empty) {
        finalChordSymbol = fallbackSymbol;
      } else {
        console.warn(`Input "${fullRomanWithInversion}" requested 7th, but common 7th types failed for base "${finalChordSymbol}". Using base triad.`);
      }
    }
  }
  return finalChordSymbol;
}

/**
 * Calculates MIDI notes, note names, and the required bass pitch class for a given chord symbol and inversion.
 * @param finalChordSymbol The Tonal-compatible chord symbol (e.g., "G7", "Dm7").
 * @param bassInterval The Tonal-compatible interval string for the bass note (e.g., "1P", "3M", "5P").
 * @param keyType The type of the key ('major' or 'minor') for octave guessing.
 * @param fullRomanWithInversion Full original Roman numeral for logging.
 * @returns Object with notes, noteNames, and requiredBassPc, or null if an error occurs.
 */
function _getMidiNotesAndBassPc(
  finalChordSymbol: string,
  bassInterval: string | null,
  keyType: 'major' | 'minor',
  fullRomanWithInversion: string, // For logging
): { notes: number[]; noteNames: string[]; requiredBassPc: number | null } | null {
  const finalChord = Tonal.Chord.get(finalChordSymbol);
  if (!finalChord || finalChord.empty || !finalChord.notes || finalChord.notes.length === 0 || !finalChord.tonic) {
    console.warn(`Could not get valid chord info for final symbol "${finalChordSymbol}" (derived from "${fullRomanWithInversion}").`);
    return null;
  }

  const rootNoteDetails = Tonal.Note.get(finalChord.tonic);
  let rootOctaveGuess = 3;
  if (['F', 'G', 'A', 'B'].includes(rootNoteDetails.letter)) rootOctaveGuess = 2;
  if (keyType === 'minor' && ['A', 'B'].includes(rootNoteDetails.letter)) rootOctaveGuess = 2;
  if (keyType === 'major' && ['D', 'E'].includes(rootNoteDetails.letter)) rootOctaveGuess = 3;

  let rootMidi = Tonal.Note.midi(finalChord.tonic + rootOctaveGuess);
  if (rootMidi !== null && rootMidi < 40) {
    const higherMidi = Tonal.Note.midi(finalChord.tonic + (rootOctaveGuess + 1));
    if (higherMidi) rootMidi = higherMidi;
  }

  if (rootMidi === null) {
    console.warn(`Could not determine root MIDI for chord "${finalChordSymbol}".`);
    return null;
  }
  const rootNoteName = Tonal.Note.fromMidi(rootMidi);
  if (!rootNoteName) {
    console.warn(`Could not get note name from root MIDI ${rootMidi}.`);
    return null;
  }

  const chordNotesMidi: number[] = [];
  const noteNames: string[] = [];
  finalChord.intervals.forEach((interval) => {
    try {
      const transposedNoteName = Tonal.transpose(rootNoteName, interval);
      if (transposedNoteName) {
        const midi = Tonal.Note.midi(transposedNoteName);
        if (midi !== null) {
          chordNotesMidi.push(midi);
          noteNames.push(transposedNoteName);
        }
      }
    } catch (transposeError) {
      console.error(`Error transposing ${rootNoteName} by ${interval}:`, transposeError);
    }
  });

  const sortedIndices = chordNotesMidi.map((_, index) => index).sort((a, b) => chordNotesMidi[a] - chordNotesMidi[b]);
  const sortedMidiNotes = sortedIndices.map((i) => chordNotesMidi[i]);
  const sortedNoteNames = sortedIndices.map((i) => noteNames[i]);

  let requiredBassPc: number | null = null;
  if (bassInterval && bassInterval !== '1P' && bassInterval !== '1') { // Also check for simple '1' from parseRomanNumeral
    try {
      const bassNoteName = Tonal.transpose(rootNoteName, bassInterval);
      if (bassNoteName) {
        // const bassMidi = Tonal.Note.midi(bassNoteName); // MIDI not strictly needed here
        // if (bassMidi !== null) {
        requiredBassPc = Tonal.Note.chroma(bassNoteName);
        // } else {
        //   console.warn(`Could not get MIDI for calculated bass note ${bassNoteName} (root: ${rootNoteName}, interval: ${bassInterval}).`);
        // }
      } else {
        console.warn(`Could not transpose root ${rootNoteName} by interval ${bassInterval}.`);
      }
    } catch (e) {
      console.error(`Error transposing for bass note: Root=${rootNoteName}, Interval=${bassInterval}`, e);
    }
  }

  // Sanity check: ensure the required bass PC is actually in the chord notes
  // Convert chord's chroma set to numbers for comparison if requiredBassPc is number
  const chordChromaNumbers = finalChord.chroma.split('').map(pc => parseInt(pc, 10));

  if (
    requiredBassPc !== null &&
    !finalChord.chroma.includes(requiredBassPc.toString()) && // Original check (string comparison)
    !chordChromaNumbers.includes(requiredBassPc) // Added check (number comparison if chroma is number)
  ) {
    // Check if the PC is enharmonically equivalent to one in the chord.
    // This is a more complex check and might be overkill if Tonal's chroma is reliable.
    // For now, we stick to direct match.
    console.warn(
      `Calculated bass PC ${requiredBassPc} for inversion "${bassInterval}" is not directly in the base chord chromas for "${finalChordSymbol}" (${finalChord.chroma}). Resetting requiredBassPc to null.`,
    );
    requiredBassPc = null;
  }


  return { notes: sortedMidiNotes, noteNames: sortedNoteNames, requiredBassPc };
}


/** Creates an extended pool of MIDI notes for a chord across multiple octaves. (Unchanged) */
export function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
  const pool: Set<number> = new Set();
  if (!baseChordNotes || baseChordNotes.length === 0) return [];

  [-2, -1, 0, 1, 2, 3, 4].forEach((octaveOffset) => {
    baseChordNotes.forEach((midi) => {
      if (midi !== null) {
        const note = midi + octaveOffset * 12;
        if (note >= 21 && note <= 108) {
          // Filter within reasonable piano range
          pool.add(note);
        }
      }
    });
  });
  return Array.from(pool).sort((a, b) => a - b);
}

/** Converts a MIDI number to its note name (e.g., 60 -> "C4"). (Unchanged) */
export function midiToNoteName(midi: number | null): string | null {
  if (midi === null || !Number.isInteger(midi) || midi < 0 || midi > 127)
    return null;
  try {
    return Tonal.Note.fromMidi(midi);
  } catch {
    console.warn(`Could not convert MIDI ${midi} to note name.`);
    return null;
  }
}
