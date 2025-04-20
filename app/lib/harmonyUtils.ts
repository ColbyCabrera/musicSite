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
 * Gets the MIDI notes and note names (with octaves) of a chord and the required bass note
 * based on its Roman numeral in a given key. Handles inversions indicated by
 * figured bass or slash notation (via parseRomanNumeral).
 *
 * @param fullRomanWithInversion - Roman numeral symbol (e.g., "V7", "ii6", "IV64", "V/3").
 * The parsing logic for inversion figures ('6', '64', '/3', etc.) should be handled
 * by the external `parseRomanNumeral` function, which should return the Tonal-compatible
 * `bassInterval`.
 * @param keyName - Key signature name (e.g., "C", "Gm", "Eb", "F#m"). Tonal.js handles most common formats.
 * @returns An object containing `midiNotes`, `noteNames`, and `requiredBassPc`,
 * or null if a fundamental error occurs (invalid input, cannot determine chord).
 */
export function getChordInfoFromRoman(
  fullRomanWithInversion: string,
  keyName: string,
): ChordInfo | null {
  try {
    // 1. Parse the Roman numeral string (delegated to external function)
    const parsed = parseRomanNumeral(fullRomanWithInversion);
    if (!parsed) {
      console.warn(
        `Could not parse Roman numeral: "${fullRomanWithInversion}"`,
      );
      return null;
    }
    const { baseRoman, bassInterval } = parsed; // bassInterval is like "3M", "5P", null

    // 2. Determine Key Details using Tonal.js
    let keyDetails = null;
    // Tonal.Key.majorKey and Tonal.Key.minorKey return null if keyName is invalid
    const potentialMajorKey = Tonal.Key.majorKey(keyName);
    const potentialMinorKey = Tonal.Key.minorKey(keyName);

    // Prioritize explicit key type if present (e.g., "Gm" -> minor)
    if (keyName.endsWith('m') && potentialMinorKey) {
      keyDetails = potentialMinorKey;
    } else if (!keyName.endsWith('m') && potentialMajorKey) {
      keyDetails = potentialMajorKey;
    } else {
      // Fallback if no 'm' suffix: try major first, then minor
      keyDetails = potentialMajorKey ?? potentialMinorKey;
    }

    if (!keyDetails || !keyDetails.tonic) {
      console.warn(
        `Could not get valid key details for key "${keyName}". Roman: "${fullRomanWithInversion}"`,
      );
      return null;
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type; // 'major' or 'minor'

    // 3. Use Tonal.js's RomanNumeral functionality (more robust)
    let chordData: ReturnType<typeof Tonal.RomanNumeral.get> | null = null;
    try {
      // Tonal.RomanNumeral.get now accepts only one argument
      chordData = Tonal.RomanNumeral.get(baseRoman);
    } catch (rnError) {
      console.warn(
        `Tonal.RomanNumeral.get failed for "${baseRoman}" in key "${keyName}":`,
        rnError,
      );
      // Optionally, try without key context as a fallback?
      try {
        chordData = Tonal.RomanNumeral.get(baseRoman); // Might work for simple cases like V7 -> G7
      } catch {
        chordData = null; // Ignore secondary error
      }
      if (!chordData || chordData.empty) {
        console.warn(
          `Could not interpret Roman numeral "${baseRoman}" even without key context.`,
        );
        return null;
      }
      console.warn(
        `Interpreted "${baseRoman}" without full key context as ${chordData.name}. Results might be less accurate.`,
      );
    }

    if (!chordData || chordData.empty || !chordData.name) {
      console.warn(
        `Could not resolve Roman numeral "${baseRoman}" to a valid chord in key "${keyName}". Tonal returned empty/invalid data.`,
        chordData,
      );
      return null;
    }

    // 4. Get the final chord details using Tonal.Chord
    const finalChord = Tonal.Chord.get(chordData.name); // Use the name derived by RomanNumeral.get

    if (
      !finalChord ||
      finalChord.empty ||
      !finalChord.notes || // Tonal guarantees notes array, but check length
      finalChord.notes.length === 0 ||
      !finalChord.tonic
    ) {
      console.warn(
        `Could not get valid chord info from Tonal.Chord.get for symbol "${chordData.name}" (derived from "${fullRomanWithInversion}" in "${keyName}").`,
      );
      return null;
    }

    // 5. Determine Root MIDI and Note Name with Octave
    const rootNoteDetails = Tonal.Note.get(finalChord.tonic);
    if (!rootNoteDetails || !rootNoteDetails.letter) {
      console.warn(`Could not get details for root note: ${finalChord.tonic}`);
      return null;
    }

    // Smarter octave guess based on typical key ranges
    let rootOctaveGuess = 3; // Default C3-B3 range start
    if (['F', 'G', 'A', 'B'].includes(rootNoteDetails.letter)) {
      rootOctaveGuess = 2; // Start lower F2-B2
    } else if (
      keyType === 'minor' &&
      ['A', 'B'].includes(rootNoteDetails.letter)
    ) {
      rootOctaveGuess = 2; // Ensure Am, Bdim start low enough
    }

    let rootMidi = Tonal.Note.midi(finalChord.tonic + rootOctaveGuess);

    // Adjust octave if rootMidi is too low (e.g., below E2/MIDI 40)
    if (rootMidi !== null && rootMidi < 40) {
      const higherMidi = Tonal.Note.midi(
        finalChord.tonic + (rootOctaveGuess + 1),
      );
      if (higherMidi) rootMidi = higherMidi;
    }
    if (rootMidi === null) {
      console.warn(
        `Could not determine root MIDI for chord "${finalChord.symbol}".`,
      );
      return null;
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidi); // e.g., "C3", "G#2"
    if (!rootNoteName) {
      console.warn(`Could not get note name from root MIDI ${rootMidi}.`);
      return null;
    }

    // 6. Calculate MIDI notes and Note Names with Octaves for the chord
    const processedNotes = finalChord.intervals
      .map((interval) => {
        try {
          // Transpose the root *with octave* to get the correct note name *with octave*
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (!transposedNoteName) return { midi: null, name: null };
          const midi = Tonal.Note.midi(transposedNoteName);
          // Return midi as null if it couldn't be determined, even if name exists
          return { midi: midi ?? null, name: transposedNoteName };
        } catch (transposeError) {
          console.error(
            `Error transposing ${rootNoteName} by ${interval}:`,
            transposeError,
          );
          return { midi: null, name: null };
        }
      })
      // Filter out any entries where MIDI or name failed, and provide type safety
      .filter(
        (n): n is { midi: number; name: string } =>
          n.midi !== null && n.name !== null,
      )
      // Sort based on MIDI value to ensure ascending order
      .sort((a, b) => a.midi - b.midi);

    // Separate the results
    const chordMidiNotes: number[] = processedNotes.map((n) => n.midi);
    const chordNoteNames: string[] = processedNotes.map((n) => n.name);

    if (chordMidiNotes.length === 0) {
      console.warn(
        `Failed to calculate any valid MIDI notes for chord ${finalChord.symbol} from root ${rootNoteName}`,
      );
      return null;
    }

    // 7. Determine Required Bass Pitch Class based on Inversion
    let requiredBassPc: number | null = null;
    // Check bassInterval from the initial parsing (e.g., "3M", "5P")
    // We ignore "1P" or null/undefined as that's root position.
    if (bassInterval && bassInterval !== '1P' && bassInterval !== '1') {
      try {
        // Transpose the CHORD ROOT (without octave initially, just the pitch class)
        // Tonal transpose handles pitch classes correctly
        const bassNoteNamePcOnly = Tonal.transpose(
          finalChord.tonic,
          bassInterval,
        );

        if (bassNoteNamePcOnly) {
          // Get the pitch class (chroma) of the resulting bass note
          const bassChroma = Tonal.Note.chroma(bassNoteNamePcOnly);
          if (bassChroma !== undefined) {
            requiredBassPc = bassChroma;

            // Sanity check: ensure the required bass PC corresponds to one of the chord tones' PCs
            const chordTonePcs = finalChord.notes.map((n) =>
              Tonal.Note.chroma(n),
            );
            if (!chordTonePcs.includes(requiredBassPc)) {
              console.warn(
                `Calculated bass pitch class ${requiredBassPc} (for inversion interval "${bassInterval}") is not one of the chord tone pitch classes [${chordTonePcs.join(',')}] for chord "${finalChord.symbol}". This might indicate an unusual inversion request or parsing error. Resetting bass to root.`,
              );
              requiredBassPc = null; // Revert to root position if invalid inversion calculated
            }
          } else {
            console.warn(
              `Could not get chroma for calculated bass note pitch class ${bassNoteNamePcOnly} (root: ${finalChord.tonic}, interval: ${bassInterval}).`,
            );
          }
        } else {
          console.warn(
            `Could not transpose root PC ${finalChord.tonic} by interval ${bassInterval} to find bass note PC.`,
          );
        }
      } catch (e) {
        console.error(
          `Error transposing for bass note PC: Root=${finalChord.tonic}, Interval=${bassInterval}`,
          e,
        );
      }
    }

    // 8. Return the combined information
    return {
      midiNotes: chordMidiNotes,
      noteNames: chordNoteNames,
      requiredBassPc: requiredBassPc,
    };
  } catch (error) {
    // Catch unexpected errors during the whole process
    console.error(
      `Unexpected error in getChordInfoFromRoman for Roman "${fullRomanWithInversion}" in key "${keyName}":`,
      error,
    );
    return null;
  }
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

