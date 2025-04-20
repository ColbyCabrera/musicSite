// src/harmonyUtils.ts
import * as Tonal from 'tonal';
import { DEFAULT_OCTAVE } from './constants';

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
 * Gets the MIDI notes of a chord and the required bass note based on its Roman numeral in a given key.
 * Handles inversions indicated by figured bass or slash notation.
 * @param fullRomanWithInversion - Roman numeral symbol (e.g., "V7", "ii6", "IV64", "V/3").
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Object with `notes` (array of MIDI notes for the chord in root position)
 * and `requiredBassPc` (pitch class of the required bass note, or null if root position/error),
 * or null if a fundamental error occurs.
 */
export function getChordInfoFromRoman(
  fullRomanWithInversion: string,
  keyName: string,
): { notes: number[]; requiredBassPc: number | null } | null {
  try {
    const parsed = parseRomanNumeral(fullRomanWithInversion);
    if (!parsed) return null;
    const { baseRoman, bassInterval } = parsed;

    // Attempt to parse major key first, then minor
    let keyDetails:
      | ReturnType<typeof Tonal.Key.majorKey>
      | ReturnType<typeof Tonal.Key.minorKey> = Tonal.Key.majorKey(keyName);
    if (!keyDetails || keyDetails.type !== 'major') {
      keyDetails = Tonal.Key.minorKey(keyName);
    }

    if (!keyDetails || !keyDetails.tonic) {
      console.warn(
        `Could not get valid key details for key "${keyName}". Roman: "${fullRomanWithInversion}"`,
      );
      return null;
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type as 'major' | 'minor';

    const romanMap: Record<string, number> = {
      I: 0,
      II: 1,
      III: 2,
      IV: 3,
      V: 4,
      VI: 5,
      VII: 6,
    };
    const baseRomanMatch = baseRoman.match(/([ivx]+)/i); // Allow V, X etc.
    if (!baseRomanMatch) {
      console.warn(
        `Could not parse base Roman letters from "${baseRoman}" in full Roman "${fullRomanWithInversion}".`,
      );
      return null;
    }
    const baseRomanUpper = baseRomanMatch[1].toUpperCase();
    const scaleDegreeIndex = romanMap[baseRomanUpper];

    if (scaleDegreeIndex === undefined) {
      console.warn(
        `Could not map base Roman letters "${baseRomanUpper}" to scale degree index.`,
      );
      return null;
    }

    // --- Get Diatonic Chord Symbol ---
    // Use Tonal.RomanNumeral.get which is more robust
    let chordData;
    try {
      // Tonal expects roman numerals relative to C major/minor, then transpose.
      // Or, we can try to use the key context directly if Tonal supports it well enough.
      // Let's stick to the previous logic of finding the diatonic chord and modifying quality.
      const diatonicChords =
        keyDetails.type === 'major'
          ? Tonal.Key.majorKey(keyName)?.chords // Use Tonal's list
          : Tonal.Key.minorKey(keyName)?.natural.chords; // Start with natural minor

      const diatonicHarmonicChords =
        Tonal.Key.minorKey(keyName)?.harmonic.chords;
      const diatonicMelodicChords = Tonal.Key.minorKey(keyName)?.melodic.chords;

      if (!diatonicChords || scaleDegreeIndex >= diatonicChords.length) {
        console.warn(
          `Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}".`,
        );
        return null;
      }

      let chordSymbol = diatonicChords[scaleDegreeIndex];

      // --- Adjust Quality for Minor Key (Harmonic/Melodic) & Extensions ---
      // This section needs careful refinement based on how baseRoman was constructed
      const qualityMatch = baseRoman.match(/(dim|o|\+|aug|M|m|maj|min)$/i); // More specific quality match
      const requestedQualitySymbol = qualityMatch
        ? qualityMatch[1].toLowerCase()
        : null;
      const requestedSeventh = baseRoman.includes('7'); // Check baseRoman for 7th
      const baseChord = Tonal.Chord.get(chordSymbol);
      let finalChordSymbol = chordSymbol;

      // Minor key adjustments (prioritize harmonic minor for V and vii)
      if (keyType === 'minor') {
        if (scaleDegreeIndex === 4 /* V */ && diatonicHarmonicChords) {
          finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually V major
        } else if (scaleDegreeIndex === 6 /* VII */ && diatonicHarmonicChords) {
          finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually vii diminished
        }
        // Allow ii° from natural minor unless overridden
        // Allow III from natural minor unless overridden
        // Allow iv from natural minor unless overridden
        // Allow VI from natural minor unless overridden
      }

      // Apply explicit quality if requested (e.g., "iv" vs "iV")
      // This logic needs refinement - Tonal's RomanNumeral.get might be better
      const currentChordInfo = Tonal.Chord.get(finalChordSymbol);
      if (requestedQualitySymbol && currentChordInfo.tonic) {
        let qualityToApply = '';
        if (['maj', 'M'].includes(requestedQualitySymbol)) qualityToApply = 'M';
        else if (['min', 'm'].includes(requestedQualitySymbol))
          qualityToApply = 'm';
        else if (['dim', 'o'].includes(requestedQualitySymbol))
          qualityToApply = 'dim';
        else if (['aug', '+'].includes(requestedQualitySymbol))
          qualityToApply = 'aug';

        if (qualityToApply) {
          const newSymbol = Tonal.Chord.get(
            currentChordInfo.tonic + qualityToApply,
          ).symbol;
          if (newSymbol) finalChordSymbol = newSymbol;
        }
      }

      // Add 7th if requested
      if (requestedSeventh) {
        const current = Tonal.Chord.get(finalChordSymbol);
        let seventhSymbol = '';
        // Try common 7th types based on base quality
        if (current.type === 'major') seventhSymbol = current.tonic + 'maj7';
        else if (current.type === 'minor') seventhSymbol = current.tonic + 'm7';
        else if (current.type === 'diminished')
          seventhSymbol = current.tonic + 'dim7'; // Or m7b5? Need context
        else seventhSymbol = finalChordSymbol + '7'; // Default dominant 7th guess

        // Specific common cases
        if (keyType === 'minor' && scaleDegreeIndex === 4 /* V */)
          seventhSymbol = current.tonic + '7'; // Dominant 7th
        if (keyType === 'major' && scaleDegreeIndex === 6 /* vii */)
          seventhSymbol = current.tonic + 'm7b5'; // Half-diminished 7th
        if (keyType === 'minor' && scaleDegreeIndex === 1 /* ii */)
          seventhSymbol = current.tonic + 'm7b5'; // Half-diminished 7th
        if (keyType === 'minor' && scaleDegreeIndex === 6 /* vii */)
          seventhSymbol = current.tonic + 'dim7'; // Fully diminished 7th (harmonic minor)

        const chordInfo = Tonal.Chord.get(seventhSymbol);
        if (!chordInfo.empty) {
          finalChordSymbol = seventhSymbol;
        } else {
          // Fallback: just append 7 if specific type failed
          const fallbackSymbol = finalChordSymbol + '7';
          const fallbackInfo = Tonal.Chord.get(fallbackSymbol);
          if (!fallbackInfo.empty) {
            finalChordSymbol = fallbackSymbol;
          } else {
            console.warn(
              `Input "${fullRomanWithInversion}" requested 7th, but common 7th types failed for base "${finalChordSymbol}". Using base chord.`,
            );
          }
        }
      }

      // --- Final Chord Processing ---
      const finalChord = Tonal.Chord.get(finalChordSymbol);
      if (
        !finalChord ||
        finalChord.empty ||
        !finalChord.notes ||
        finalChord.notes.length === 0 ||
        !finalChord.tonic
      ) {
        console.warn(
          `Could not get valid chord info for final symbol "${finalChordSymbol}" (derived from "${fullRomanWithInversion}" in "${keyName}").`,
        );
        return null;
      }

      // --- Get Root Position MIDI Notes ---
      const rootNoteDetails = Tonal.Note.get(finalChord.tonic);
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
      // Adjust octave if rootMidi is too low for typical voicings (e.g., below E2)
      if (rootMidi !== null && rootMidi < 40) {
        const higherMidi = Tonal.Note.midi(
          finalChord.tonic + (rootOctaveGuess + 1),
        );
        if (higherMidi) rootMidi = higherMidi;
      }
      if (rootMidi === null) {
        console.warn(
          `Could not determine root MIDI for chord "${finalChordSymbol}".`,
        );
        return null;
      }
      const rootNoteName = Tonal.Note.fromMidi(rootMidi);
      if (!rootNoteName) {
        console.warn(`Could not get note name from root MIDI ${rootMidi}.`);
        return null;
      }

      const chordNotesMidi = finalChord.intervals
        .map((interval) => {
          try {
            const transposedNoteName = Tonal.transpose(rootNoteName, interval);
            if (!transposedNoteName) return null;
            return Tonal.Note.midi(transposedNoteName);
          } catch (transposeError) {
            console.error(
              `Error transposing ${rootNoteName} by ${interval}:`,
              transposeError,
            );
            return null;
          }
        })
        .filter((midi): midi is number => midi !== null)
        .sort((a, b) => a - b); // Ensure sorted

      // --- Determine Required Bass Pitch Class ---
      let requiredBassPc: number | null = null;
      if (bassInterval && bassInterval !== '1') {
        // Try to transpose the ROOT of the chord by the bassInterval
        try {
          const bassNoteName = Tonal.transpose(
            finalChord.tonic + rootOctaveGuess,
            bassInterval,
          );
          if (bassNoteName) {
            const bassMidi = Tonal.Note.midi(bassNoteName);
            if (bassMidi !== null) {
              requiredBassPc = bassMidi % 12;
            } else {
              console.warn(
                `Could not get MIDI for calculated bass note ${bassNoteName} (root: ${finalChord.tonic}, interval: ${bassInterval}).`,
              );
            }
          } else {
            console.warn(
              `Could not transpose root ${finalChord.tonic} by interval ${bassInterval}.`,
            );
          }
        } catch (e) {
          console.error(
            `Error transposing for bass note: Root=${finalChord.tonic}, Interval=${bassInterval}`,
            e,
          );
        }
      }

      // Sanity check: ensure the required bass PC is actually in the chord notes
      if (
        requiredBassPc !== null &&
        !finalChord.notes
          .map((n) => Tonal.Note.chroma(n))
          .includes(requiredBassPc)
      ) {
        console.warn(
          `Calculated bass PC ${requiredBassPc} for inversion "${bassInterval}" is not in the base chord tones for "${finalChordSymbol}". Resetting to root.`,
        );
        requiredBassPc = null; // Revert to root position if calculated bass note isn't part of the chord
      }

      return { notes: chordNotesMidi, requiredBassPc };
    } catch (innerError) {
      console.error(
        `Error processing chord data for Roman "${fullRomanWithInversion}":`,
        innerError,
      );
      return null;
    }
  } catch (error) {
    console.error(
      `Unexpected error getting chord info for Roman "${fullRomanWithInversion}" in key "${keyName}":`,
      error,
    );
    return null;
  }
}

// --- Keep existing helpers ---

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

// DEPRECATED - Use getChordInfoFromRoman instead
/**
 * Gets the MIDI notes of a chord based on its Roman numeral in a given key.
 * (Error handling and logging improved)
 * @param roman - Roman numeral symbol (e.g., "V7", "ii", "IV"). Does NOT handle inversions well.
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Array of MIDI note numbers for the chord, or empty if error.
 * @deprecated Prefer getChordInfoFromRoman which handles inversions.
 */
export function getChordNotesFromRoman(
  roman: string,
  keyName: string,
): number[] {
  console.warn(
    'Usage of getChordNotesFromRoman is deprecated. Use getChordInfoFromRoman instead.',
  );
  const info = getChordInfoFromRoman(roman, keyName);
  return info ? info.notes : [];
}
