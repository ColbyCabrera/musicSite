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
    let finalChordSymbol = '';
    try {
      const diatonicChords =
        keyType === 'major'
          ? Tonal.Key.majorKey(keyName)?.chords // Use Tonal's list for major
          : Tonal.Key.minorKey(keyName)?.natural.chords; // Start with natural minor

      const diatonicHarmonicChords =
        keyType === 'minor' ? Tonal.Key.minorKey(keyName)?.harmonic.chords : [];
      // const diatonicMelodicChords = Tonal.Key.minorKey(keyName)?.melodic.chords; // Melodic less common for basic RN analysis

      if (!diatonicChords || scaleDegreeIndex >= diatonicChords.length) {
        console.warn(
          `Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}".`,
        );
        return null;
      }

      finalChordSymbol = diatonicChords[scaleDegreeIndex]; // Initial diatonic chord

      // --- Adjust Quality for Minor Key (Harmonic/Melodic) & Explicit Markings ---
      const qualityMatch = baseRoman.match(/(dim|o|\+|aug|M|m|maj|min)$/i);
      const requestedQualitySymbol = qualityMatch
        ? qualityMatch[1].toLowerCase()
        : null;
      const requestedSeventh = baseRoman.includes('7');
      const requestedHalfDim =
        baseRoman.includes('ø') || baseRoman.includes('hd'); // Check for half-dim symbol
      const requestedDim =
        baseRoman.includes('°') ||
        baseRoman.includes('dim') ||
        baseRoman.includes('o');

      // Minor key adjustments (prioritize harmonic minor for V and vii)
      if (keyType === 'minor') {
        if (
          scaleDegreeIndex === 4 /* V */ &&
          diatonicHarmonicChords &&
          diatonicHarmonicChords.length > scaleDegreeIndex
        ) {
          finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually V major
        } else if (
          scaleDegreeIndex === 6 /* VII */ &&
          diatonicHarmonicChords &&
          diatonicHarmonicChords.length > scaleDegreeIndex
        ) {
          finalChordSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually vii diminished
        }
        // Note: ii chord in minor is often m7b5 (half-diminished), handled later if 7th is added
      }

      // Apply explicit quality override if provided
      let currentChordInfo = Tonal.Chord.get(finalChordSymbol);
      if (requestedQualitySymbol && currentChordInfo.tonic) {
        let qualityToApply = '';
        if (['maj', 'M'].includes(requestedQualitySymbol)) qualityToApply = 'M';
        else if (['min', 'm'].includes(requestedQualitySymbol))
          qualityToApply = 'm';
        else if (['dim', 'o'].includes(requestedQualitySymbol))
          qualityToApply = 'dim'; // Triad
        else if (['aug', '+'].includes(requestedQualitySymbol))
          qualityToApply = 'aug';

        if (qualityToApply) {
          // Construct the new symbol ensuring tonic remains correct
          const potentialNewSymbol = currentChordInfo.tonic + qualityToApply;
          const checkChord = Tonal.Chord.get(potentialNewSymbol);
          if (!checkChord.empty) {
            finalChordSymbol = checkChord.symbol;
            currentChordInfo = checkChord; // Update current chord info
          }
        }
      }

      // Add 7th if requested
      if (requestedSeventh) {
        currentChordInfo = Tonal.Chord.get(finalChordSymbol); // Re-get in case quality changed
        let seventhSymbol = '';

        // Determine 7th type based on context and common practice
        if (requestedHalfDim) {
          seventhSymbol = currentChordInfo.tonic + 'm7b5'; // Explicit half-dim
        } else if (requestedDim) {
          seventhSymbol = currentChordInfo.tonic + 'dim7'; // Explicit fully-dim
        } else {
          // Infer 7th type based on quality and scale degree
          if (keyType === 'major') {
            if (
              scaleDegreeIndex === 0 /* I */ ||
              scaleDegreeIndex === 3 /* IV */
            )
              seventhSymbol = currentChordInfo.tonic + 'maj7'; // Imaj7, IVmaj7
            else if (
              scaleDegreeIndex === 1 /* ii */ ||
              scaleDegreeIndex === 2 /* iii */ ||
              scaleDegreeIndex === 5 /* vi */
            )
              seventhSymbol = currentChordInfo.tonic + 'm7'; // iim7, iiim7, vim7
            else if (scaleDegreeIndex === 4 /* V */)
              seventhSymbol = currentChordInfo.tonic + '7'; // V7 (dominant)
            else if (scaleDegreeIndex === 6 /* vii */)
              seventhSymbol = currentChordInfo.tonic + 'm7b5'; // viiø7 (half-dim)
          } else {
            // Minor key context
            if (scaleDegreeIndex === 4 /* V */)
              seventhSymbol = currentChordInfo.tonic + '7'; // V7 (dominant, from harmonic minor)
            else if (scaleDegreeIndex === 6 /* vii */)
              seventhSymbol = currentChordInfo.tonic + 'dim7'; // vii°7 (fully-dim, from harmonic minor)
            else if (scaleDegreeIndex === 1 /* ii */)
              seventhSymbol = currentChordInfo.tonic + 'm7b5'; // iiø7 (half-dim, common)
            else if (scaleDegreeIndex === 0 /* i */)
              seventhSymbol = currentChordInfo.tonic + 'm7'; // im7
            else if (
              scaleDegreeIndex === 2 /* III */ &&
              Tonal.Key.minorKey(keyName)?.natural.chords[2].endsWith('maj7')
            )
              seventhSymbol = currentChordInfo.tonic + 'maj7'; // IIImaj7 (if from natural minor/melodic) - less common RN default but possible
            else if (scaleDegreeIndex === 3 /* iv */)
              seventhSymbol = currentChordInfo.tonic + 'm7'; // ivm7
            else if (
              scaleDegreeIndex === 5 /* VI */ &&
              Tonal.Key.minorKey(keyName)?.natural.chords[5].endsWith('maj7')
            )
              seventhSymbol = currentChordInfo.tonic + 'maj7'; // VImaj7 (if from natural minor/melodic) - less common RN default but possible
            else {
              // Default guess if specific cases don't match
              if (currentChordInfo.type === 'major')
                seventhSymbol = currentChordInfo.tonic + 'maj7';
              else if (currentChordInfo.type === 'minor')
                seventhSymbol = currentChordInfo.tonic + 'm7';
              else seventhSymbol = finalChordSymbol + '7'; // Fallback dominant 7th
            }
          }
        }

        // Validate and apply the 7th symbol
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
              `Input "${fullRomanWithInversion}" requested 7th, but common 7th types failed for base "${finalChordSymbol}". Using base triad.`,
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

      // --- Get Root Position MIDI Notes and Note Names ---
      const rootNoteDetails = Tonal.Note.get(finalChord.tonic);
      // Smarter octave guess based on typical key ranges and root note
      let rootOctaveGuess = 3; // Default C3-B3 range start
      if (['F', 'G', 'A', 'B'].includes(rootNoteDetails.letter)) {
        rootOctaveGuess = 2; // Start lower for F, G, A, B roots (F2-B2)
      }
      if (keyType === 'minor' && ['A', 'B'].includes(rootNoteDetails.letter)) {
        rootOctaveGuess = 2; // Ensure Am, Bdim start low enough (A2, B2)
      }
      if (keyType === 'major' && ['D', 'E'].includes(rootNoteDetails.letter)) {
        rootOctaveGuess = 3; // D major/E minor roots often start around D3/E3
      }

      let rootMidi = Tonal.Note.midi(finalChord.tonic + rootOctaveGuess);
      // Adjust octave up if rootMidi is very low (e.g., below E2/MIDI 40)
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

      // Calculate MIDI notes and Note Names simultaneously
      const chordNotesMidi: number[] = [];
      const noteNames: string[] = [];

      finalChord.intervals.forEach((interval) => {
        try {
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (transposedNoteName) {
            const midi = Tonal.Note.midi(transposedNoteName);
            if (midi !== null) {
              chordNotesMidi.push(midi);
              noteNames.push(transposedNoteName); // Add the calculated note name
            }
          }
        } catch (transposeError) {
          console.error(
            `Error transposing ${rootNoteName} by ${interval}:`,
            transposeError,
          );
          // Skip this note if transposition fails
        }
      });

      // Ensure notes are sorted (MIDI and names should correspond)
      const sortedIndices = chordNotesMidi
        .map((_, index) => index)
        .sort((a, b) => chordNotesMidi[a] - chordNotesMidi[b]);

      const sortedMidiNotes = sortedIndices.map((i) => chordNotesMidi[i]);
      const sortedNoteNames = sortedIndices.map((i) => noteNames[i]);

      // --- Determine Required Bass Pitch Class ---
      let requiredBassPc: number | null = null;
      if (bassInterval && bassInterval !== '1P') {
        // Tonal uses P for perfect unison
        // Transpose the ROOT of the chord by the bassInterval to find the bass note
        try {
          // Use the determined root note name (with octave) for accurate transposition context
          const bassNoteName = Tonal.transpose(
            rootNoteName, // Use the root note with octave (e.g., "C4")
            bassInterval,
          );
          if (bassNoteName) {
            const bassMidi = Tonal.Note.midi(bassNoteName);
            if (bassMidi !== null) {
              requiredBassPc = Tonal.Note.chroma(bassNoteName); // Use chroma directly
            } else {
              console.warn(
                `Could not get MIDI for calculated bass note ${bassNoteName} (root: ${rootNoteName}, interval: ${bassInterval}).`,
              );
            }
          } else {
            console.warn(
              `Could not transpose root ${rootNoteName} by interval ${bassInterval}.`,
            );
          }
        } catch (e) {
          console.error(
            `Error transposing for bass note: Root=${rootNoteName}, Interval=${bassInterval}`,
            e,
          );
        }
      }

      // Sanity check: ensure the required bass PC is actually in the chord notes
      if (
        requiredBassPc !== null &&
        !finalChord.chroma.includes(requiredBassPc.toString()) // Check against chord's chroma
      ) {
        console.warn(
          `Calculated bass PC ${requiredBassPc} for inversion "${bassInterval}" is not in the base chord chromas for "${finalChordSymbol}" (${finalChord.chroma}). Resetting requiredBassPc to null.`,
        );
        requiredBassPc = null; // Revert if calculated bass note isn't part of the chord's pitch classes
      }

      return {
        notes: sortedMidiNotes,
        noteNames: sortedNoteNames,
        requiredBassPc,
      };
    } catch (innerError) {
      console.error(
        `Error processing chord data for Roman "${fullRomanWithInversion}" in key "${keyName}" (Final Symbol: ${finalChordSymbol}):`,
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
