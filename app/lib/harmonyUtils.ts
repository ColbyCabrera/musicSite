// src/harmonyUtils.ts
import * as Tonal from 'tonal';
import { DEFAULT_OCTAVE } from './constants';

/**
 * Gets the MIDI notes of a chord based on its Roman numeral in a given key.
 * (Error handling and logging improved)
 * @param roman - Roman numeral symbol (e.g., "V7", "ii", "IV").
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Array of MIDI note numbers for the chord, or empty if error.
 */
export function getChordNotesFromRoman(roman: string, keyName: string): number[] {
     try {
    // Attempt to parse major key first, then minor
    let keyDetails: ReturnType<typeof Tonal.Key.majorKey> | ReturnType<typeof Tonal.Key.minorKey> = Tonal.Key.majorKey(keyName);
    if (!keyDetails || keyDetails.type !== 'major') {
      keyDetails = Tonal.Key.minorKey(keyName);
    }

    if (!keyDetails || !keyDetails.tonic) {
      console.warn(
        `Could not get valid key details for key "${keyName}". Roman: "${roman}"`,
      );
      return [];
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type as 'major' | 'minor'; // 'major' or 'minor'

    // Map Roman numerals (case-insensitive) to scale degrees (0-indexed)
    const romanMap: Record<string, number> = {
      I: 0,
      II: 1,
      III: 2,
      IV: 3,
      V: 4,
      VI: 5,
      VII: 6,
    };
    const baseRomanMatch = roman.match(/([iv]+)/i);
    if (!baseRomanMatch) {
      console.warn(
        `Could not parse base Roman numeral from "${roman}" in key "${keyName}".`,
      );
      return [];
    }
    const baseRomanUpper = baseRomanMatch[1].toUpperCase();
    const scaleDegreeIndex = romanMap[baseRomanUpper];

    if (scaleDegreeIndex === undefined) {
      console.warn(
        `Could not map Roman numeral "${baseRomanUpper}" to scale degree index.`,
      );
      return [];
    }

    const diatonicChords = keyDetails.type === 'major'
      ? keyDetails.chords
      : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']; // Common harmonic minor chords
    if (scaleDegreeIndex >= diatonicChords.length) {
      console.warn(
        `Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}". Diatonic chords: ${diatonicChords.join(', ')}`,
      );
      return [];
    }

    let chordSymbol = diatonicChords[scaleDegreeIndex];

    // --- Handle Chord Quality and Extensions (Improved) ---
    const qualityMatch = roman.match(/(dim|o|\+|aug)$/i);
    const requestedQuality = qualityMatch
      ? qualityMatch[1].toLowerCase().replace('o', 'dim').replace('+', 'aug')
      : null;
    const requestedSeventh = roman.includes('7');
    const baseChord = Tonal.Chord.get(chordSymbol);
    let finalChordSymbol = chordSymbol;

    // Adjust default diatonic qualities based on common practice
    if (keyType === 'minor' && scaleDegreeIndex === 4 /* V */ && !baseChord.aliases.includes('major')) {
        finalChordSymbol = Tonal.Chord.get(baseChord.tonic + 'M').symbol || finalChordSymbol; // V in minor usually major
    }
    if (keyType === 'major' && scaleDegreeIndex === 6 /* vii */ && !baseChord.aliases.includes('diminished')) {
        finalChordSymbol = Tonal.Chord.get(baseChord.tonic + 'dim').symbol || finalChordSymbol; // vii in major usually diminished
    }
     if (keyType === 'minor' && scaleDegreeIndex === 1 /* ii */ && !baseChord.aliases.includes('diminished')) {
        finalChordSymbol = Tonal.Chord.get(baseChord.tonic + 'dim').symbol || finalChordSymbol; // ii in minor usually diminished
    }
     if (keyType === 'minor' && scaleDegreeIndex === 6 /* VII */ && !baseChord.aliases.includes('major')) {
        // Natural minor VII, sometimes used. Let's default to harmonic minor's vii° unless VII is specified.
        // If roman was 'VII', assume major for now. If 'vii', let dim adjustment handle it.
        // This part might need refinement based on desired harmonic minor usage.
        // For now, if base diatonic was minor, let it be unless explicit quality requested.
    }


    // Apply explicit quality if requested
    if (requestedQuality) {
      const qualitySymbol = Tonal.Chord.get(
        baseChord.tonic + requestedQuality,
      ).symbol;
      if (qualitySymbol) {
        finalChordSymbol = qualitySymbol;
      } else {
        console.warn(
          `Requested quality "${requestedQuality}" invalid for root ${baseChord.tonic}. Using "${finalChordSymbol}".`,
        );
      }
    }

    // Add 7th if requested
    if (requestedSeventh) {
        let seventhChordSymbol = finalChordSymbol + '7';
        // Handle V7 in minor -> Major chord + m7 interval = Dominant 7th
        if (keyType === 'minor' && scaleDegreeIndex === 4 && finalChordSymbol.endsWith('M')) { // Check if it became major
            const root = Tonal.Chord.get(finalChordSymbol).tonic;
            if (root) {
              const dom7Symbol = Tonal.Chord.get(root + '7').symbol; // Request dominant 7th directly
              if (dom7Symbol) seventhChordSymbol = dom7Symbol;
            }
        } else if (keyType === 'major' && scaleDegreeIndex === 6 && finalChordSymbol.endsWith('dim')) {
            // Handle vii°7 in major
             const root = Tonal.Chord.get(finalChordSymbol).tonic;
             if (root) {
                 const dim7Symbol = Tonal.Chord.get(root + 'dim7').symbol;
                 if (dim7Symbol) seventhChordSymbol = dim7Symbol;
             }
        } else if (keyType === 'minor' && scaleDegreeIndex === 6 && finalChordSymbol.endsWith('dim') ) {
             // Handle vii°7 in minor
             const root = Tonal.Chord.get(finalChordSymbol).tonic;
             if (root) {
                 const dim7Symbol = Tonal.Chord.get(root + 'dim7').symbol;
                 if (dim7Symbol) seventhChordSymbol = dim7Symbol;
             }
        }
        // TODO: Add specific handling for half-diminished (ø7) on ii in minor if needed

        const chordInfo = Tonal.Chord.get(seventhChordSymbol);
        if (!chordInfo.empty) {
            finalChordSymbol = seventhChordSymbol;
        } else {
            // Fallback if adding '7' creates invalid chord (e.g., "C+7" isn't standard)
             console.warn(
               `Input "${roman}" requested 7th, but "${seventhChordSymbol}" invalid or ambiguous. Using "${finalChordSymbol}". Consider specifying full type (e.g., Vmaj7, Vmin7, V7).`,
             );
             // Could try adding dominant 7th specifically as a last resort if base was major/aug
             const base = Tonal.Chord.get(finalChordSymbol);
             if (base.tonic && (base.type === 'major' || base.type === 'augmented')) {
                 const dom7 = Tonal.Chord.get(base.tonic + '7').symbol;
                 if (dom7) {
                     finalChordSymbol = dom7;
                     console.warn(`Interpreted requested 7th as dominant 7th: "${dom7}".`);
                 }
             }
        }
    }
    // TODO: Add more detailed parsing for dim7, half-dim7 (ø7), aug7, etc. if needed

    const chord = Tonal.Chord.get(finalChordSymbol);
    if (!chord || chord.empty || !chord.notes || chord.notes.length === 0 || !chord.tonic) {
      console.warn(
        `Could not get notes for final chord symbol "${finalChordSymbol}" (derived from "${roman}" in "${keyName}").`, chord
      );
      return [];
    }

    // Use Tonal.Chord.notes which provides pitch classes, then map to MIDI
    const rootNoteDetails = Tonal.Note.get(chord.tonic);
    const rootOctaveGuess = ['C', 'D', 'E', 'F', 'G'].includes(rootNoteDetails.letter) ? 3 : 2;
    let rootMidi = Tonal.Note.midi(chord.tonic + rootOctaveGuess);

    if (rootMidi !== null && rootMidi < 35) {
      rootMidi = Tonal.Note.midi(chord.tonic + (rootOctaveGuess + 1));
    }
    if (rootMidi === null) {
      console.warn(`Could not determine root MIDI for chord "${finalChordSymbol}".`);
      return [];
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidi);
    if (!rootNoteName) {
      console.warn(`Could not get note name from root MIDI ${rootMidi}.`);
      return [];
    }

    return chord.intervals
      .map((interval) => {
        try {
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (!transposedNoteName) return null;
          return Tonal.Note.midi(transposedNoteName);
        } catch (transposeError) {
          console.error(`Error transposing ${rootNoteName} by ${interval}:`, transposeError);
          return null;
        }
      })
      .filter((midi): midi is number => midi !== null);
  } catch (error) {
    console.error(`Unexpected error getting chord notes for Roman "${roman}" in key "${keyName}":`, error);
    return [];
  }
}

/**
 * Creates an extended pool of MIDI notes for a chord across multiple octaves.
 * @param baseChordNotes - Array of MIDI notes for the chord in one octave.
 * @returns Array of MIDI notes spanning relevant octaves.
 */
export function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
    const pool: Set<number> = new Set();
    if (!baseChordNotes || baseChordNotes.length === 0) return [];

    [-2, -1, 0, 1, 2, 3, 4].forEach((octaveOffset) => {
        baseChordNotes.forEach((midi) => {
            if (midi !== null) {
                const note = midi + octaveOffset * 12;
                if (note >= 21 && note <= 108) { // Filter within reasonable piano range
                    pool.add(note);
                }
            }
        });
    });
    return Array.from(pool).sort((a, b) => a - b);
}

/**
 * Converts a MIDI number to its note name (e.g., 60 -> "C4").
 * @param midi - MIDI note number.
 * @returns Note name string or null if invalid.
 */
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