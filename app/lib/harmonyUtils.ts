// src/harmonyUtils.ts
import * as Tonal from 'tonal';
import { DEFAULT_OCTAVE } from './constants';
import { ChordInfo } from './types';
import { MusicTheoryError, InvalidInputError } from './errors';

const ROMAN_MAP: Record<string, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6,
};

// Default 7th types based on scale degree for major keys
const MAJOR_KEY_DEFAULT_SEVENTHS: Record<number, string> = {
  [ROMAN_MAP.I]: 'maj7',   // Imaj7
  [ROMAN_MAP.II]: 'm7',    // iim7
  [ROMAN_MAP.III]: 'm7',   // iiim7
  [ROMAN_MAP.IV]: 'maj7',  // IVmaj7
  [ROMAN_MAP.V]: '7',      // V7
  [ROMAN_MAP.VI]: 'm7',    // vim7
  [ROMAN_MAP.VII]: 'm7b5', // vii°7 (half-diminished)
};

// Default 7th types based on scale degree for minor keys
// These often draw from natural minor for general chords, and harmonic minor for V and vii
const MINOR_KEY_DEFAULT_SEVENTHS: Record<number, string> = {
  [ROMAN_MAP.I]: 'm7',     // im7
  [ROMAN_MAP.II]: 'm7b5',  // ii°7 (half-diminished, from natural minor's ii°)
  [ROMAN_MAP.III]: 'maj7', // IIImaj7 (from natural minor)
  [ROMAN_MAP.IV]: 'm7',    // ivm7
  [ROMAN_MAP.V]: '7',      // V7 (from harmonic minor)
  [ROMAN_MAP.VI]: 'maj7',  // VImaj7 (from natural minor)
  [ROMAN_MAP.VII]: 'dim7', // vii°7 (fully-diminished, from harmonic minor)
};


/**
 * Parses a Roman numeral string to separate the base numeral from inversion/alteration.
 * Handles figured bass (e.g., "ii6", "IV64") and slash notation (e.g., "V/3", "V7/5").
 * The TODO about 'M' or 'm' prefixes for bassInterval was evaluated: Tonal.transpose
 * generally infers interval quality correctly based on the chord's root and the interval
 * number (e.g., "3" will be major or minor based on context). Explicitly adding 'M'/'m'
 * here is usually unnecessary and could conflict with Tonal.js's internal logic.
 * The primary role of bassInterval is to identify the *scale degree* of the bass note
 * relative to the chord root, not necessarily its precise quality independently.
 *
 * @param romanWithInversion - The full Roman numeral string.
 * @returns Object with base Roman numeral and bass interval string, or null if invalid.
 */
function parseRomanNumeral(romanWithInversion: string): {
  baseRoman: string;
  bassInterval: string | null; // e.g., "1", "3", "5", "7", "b3", "#5"
} | null {
  // Regex for figured bass (e.g., 6, 64, 7, 65, 43, 42, 2)
  // Ensures figure is at the end and not part of a chord name like 'Cmaj7'
  const figuredBassMatch = romanWithInversion.match(
    /^(.*?)(?:(64|65|43|42|6|7|2))(?![a-zA-Z#b])$/,
  );
  // Regex for slash notation (e.g., /3, /5, /b3, /#5)
  const slashMatch = romanWithInversion.match(/^(.*?)\/([#b]?\d+)$/);

  let baseRoman: string;
  let bassInterval: string | null = '1'; // Default to root position (1st degree of the chord)

  if (figuredBassMatch) {
    baseRoman = figuredBassMatch[1];
    const figure = figuredBassMatch[2];
    switch (figure) {
      case '6':
        bassInterval = '3';
        break; // 1st inversion (triad or 7th)
      case '64':
        bassInterval = '5';
        break; // 2nd inversion (triad)
      // case '7': bassInterval = '1'; break; // Root position 7th (already default)
      case '65':
        bassInterval = '3';
        break; // 1st inversion 7th chord
      case '43':
        bassInterval = '5';
        break; // 2nd inversion 7th chord
      case '42':
      case '2':
        bassInterval = '7';
        break; // 3rd inversion 7th chord
      default:
        // Includes '7' which implies root position if no other figures
        bassInterval = '1';
    }
  } else if (slashMatch) {
    baseRoman = slashMatch[1];
    bassInterval = slashMatch[2]; // e.g., "3", "5", "b3", "#5"
    // Tonal.transpose can usually handle "3", "b3", "5", "#5", "7" directly.
    // No complex translation needed here for Tonal.js.
  } else {
    baseRoman = romanWithInversion;
    // bassInterval remains '1' (root position)
  }

  if (!baseRoman) {
    // This case should ideally be rare if regex are comprehensive.
    // If it occurs, it's likely an unparsable Roman numeral format.
    throw new MusicTheoryError(
      `parseRomanNumeral: Could not parse base Roman numeral from "${romanWithInversion}". Check format.`,
    );
  }

  return { baseRoman, bassInterval };
}

/**
 * Retrieves key details (tonic, type, chords) using Tonal.js.
 * @param keyName - Key signature (e.g., "C", "Gm", "F#maj", "Dbmin").
 * @returns Tonal key object or null if key is invalid.
 */
function getKeyDetails(
  keyName: string,
): ReturnType<typeof Tonal.Key.majorKey> | ReturnType<typeof Tonal.Key.minorKey> | null {
  let keyDetails = Tonal.Key.majorKey(keyName);
  if (!keyDetails || !keyDetails.tonic) {
    keyDetails = Tonal.Key.minorKey(keyName);
  }

  if (!keyDetails || !keyDetails.tonic) {
    // This indicates the keyName provided was not recognized by Tonal.js
    throw new InvalidInputError(`getKeyDetails: Could not get valid key details for key "${keyName}". Key not recognized.`);
  }
  return keyDetails;
}

/**
 * Determines the initial diatonic chord symbol based on the key and Roman numeral degree.
 * @param baseRomanUpper - Uppercase Roman numeral (e.g., "I", "II", "V").
 * @param scaleDegreeIndex - Index of the Roman numeral (0-6).
 * @param keyDetails - Tonal key object.
 * @param keyName - Original key name for logging.
 * @returns Initial diatonic chord symbol (e.g., "CM", "dm", "G") or null.
 */
function getInitialDiatonicChordSymbol(
  baseRomanUpper: string,
  scaleDegreeIndex: number,
  keyDetails: NonNullable<ReturnType<typeof getKeyDetails>>, // Ensure keyDetails is not null
  keyName: string,
): string | null {
  const keyType = keyDetails.type;
  let diatonicChords: readonly string[] | undefined;
  let diatonicHarmonicChords: readonly string[] | undefined;

  if (keyType === 'major') {
    diatonicChords = keyDetails.chords;
  } else {
    // For minor keys, start with natural minor, then consider harmonic for V and vii.
    diatonicChords = keyDetails.natural.chords;
    diatonicHarmonicChords = keyDetails.harmonic.chords;
  }

  if (!diatonicChords || scaleDegreeIndex >= diatonicChords.length) {
    throw new MusicTheoryError(
      `getInitialDiatonicChordSymbol: Scale degree index ${scaleDegreeIndex} (${baseRomanUpper}) is out of bounds for key "${keyName}". Valid range is 0-${(diatonicChords?.length ?? 0) -1}.`,
    );
  }

  let initialSymbol = diatonicChords[scaleDegreeIndex];

  // In minor keys, V and vii are typically derived from the harmonic minor scale.
  if (keyType === 'minor') {
    if (
      scaleDegreeIndex === ROMAN_MAP.V && // V degree
      diatonicHarmonicChords &&
      diatonicHarmonicChords.length > scaleDegreeIndex
    ) {
      initialSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually V major
    } else if (
      scaleDegreeIndex === ROMAN_MAP.VII && // VII degree
      diatonicHarmonicChords &&
      diatonicHarmonicChords.length > scaleDegreeIndex
    ) {
      initialSymbol = diatonicHarmonicChords[scaleDegreeIndex]; // Usually vii diminished
    }
  }
  return initialSymbol;
}

/**
 * Applies explicit quality (dim, aug, M, m), 7th (7, ø, °), and other modifications
 * to a base chord symbol.
 * @param currentChordSymbol - The current chord symbol (e.g., "dm", "G").
 * @param baseRomanInput - The base Roman numeral from parsing (e.g., "ii", "V7", "vii°").
 * @param keyDetails - Tonal key object.
 * @param scaleDegreeIndex - Index of the Roman numeral (0-6).
 * @returns The modified chord symbol (e.g., "dm7", "G7", "b°7") or the original if no valid modifications.
 */
function applyChordModifications(
  currentChordSymbol: string,
  baseRomanInput: string,
  keyDetails: NonNullable<ReturnType<typeof getKeyDetails>>,
  scaleDegreeIndex: number,
): string {
  let finalChordSymbol = currentChordSymbol;
  const keyType = keyDetails.type;
  const currentChordDetails = Tonal.Chord.get(currentChordSymbol);
  if (currentChordDetails.empty || !currentChordDetails.tonic) {
    // This implies the initial diatonic symbol was somehow invalid, which is a theory/logic error.
    throw new MusicTheoryError(
      `applyChordModifications: Invalid initial diatonic chord symbol "${currentChordSymbol}" for Roman "${baseRomanInput}". Cannot apply further modifications.`,
    );
  }
  const tonic = currentChordDetails.tonic; // Tonic is guaranteed here by the check above

  // --- 1. Explicit Quality Modifiers (triads: dim, o, +, aug, M, m) ---
  // These usually override the diatonic quality.
  const qualityMatch = baseRomanInput.match(/(dim|o|\+|aug|M|m|maj|min)$/i);
  const requestedQualitySymbol = qualityMatch ? qualityMatch[1].toLowerCase() : null;

  if (requestedQualitySymbol) {
    let qualityToApply = '';
    if (['maj', 'M'].includes(requestedQualitySymbol)) qualityToApply = 'M'; // Major triad
    else if (['min', 'm'].includes(requestedQualitySymbol)) qualityToApply = 'm'; // Minor triad
    else if (['dim', 'o'].includes(requestedQualitySymbol)) qualityToApply = 'dim'; // Diminished triad
    else if (['aug', '+'].includes(requestedQualitySymbol)) qualityToApply = 'aug'; // Augmented triad

    if (qualityToApply) {
      const potentialNewSymbol = tonic + qualityToApply;
      const checkChord = Tonal.Chord.get(potentialNewSymbol);
      if (!checkChord.empty) {
        finalChordSymbol = checkChord.symbol;
      } else {
        // This means the requested quality (e.g. "dim", "aug") is incompatible with the tonic.
        // This could be a user error in Roman numeral (e.g., "Cdim" in G major's "IVdim") or a logic gap.
        console.warn( 
          `[WARN] applyChordModifications: Could not apply explicit quality "${qualityToApply}" to tonic "${tonic}" for Roman "${baseRomanInput}". Using diatonic quality.`,
        );
      }
    }
  }

  // --- 2. Adding 7ths (if requested) ---
  const requestedSeventh = baseRomanInput.includes('7');
  const requestedHalfDim =
    baseRomanInput.includes('ø') || baseRomanInput.includes('hd');
  const requestedFullDim =
    baseRomanInput.includes('°') ||
    (baseRomanInput.toLowerCase().includes('dim') && requestedSeventh); // "dim7" or "°7"

  if (requestedSeventh) {
    const currentTriadSymbol = finalChordSymbol; // Symbol after quality modification
    const triadDetails = Tonal.Chord.get(currentTriadSymbol); // currentTriadSymbol is after quality modification
    if (triadDetails.empty || !triadDetails.tonic) {
      // This implies the quality modification step resulted in an invalid chord.
      throw new MusicTheoryError(
        `applyChordModifications: Cannot add 7th because the modified triad symbol "${currentTriadSymbol}" (from Roman "${baseRomanInput}") is invalid.`,
      );
    }

    let seventhChordType = '';

    if (requestedHalfDim) {
      seventhChordType = 'm7b5'; // Half-diminished 7th (e.g., Cø7 -> Cm7b5)
    } else if (requestedFullDim) {
      seventhChordType = 'dim7'; // Fully-diminished 7th (e.g., C°7 -> Cdim7)
    } else {
      // Infer 7th type using the configuration maps
      if (keyType === 'major') {
        seventhChordType = MAJOR_KEY_DEFAULT_SEVENTHS[scaleDegreeIndex];
      } else { // minor key
        // Special handling for III and VI in minor if derived from natural minor and results in maj7
        // The MINOR_KEY_DEFAULT_SEVENTHS map already accounts for common V7 and vii°7 from harmonic.
        // For III and VI, Tonal.js's `keyDetails.natural.chords` would give the precise diatonic chord.
        // If the diatonic triad on III or VI is major (e.g. Eb in C minor, Ab in C minor),
        // then the 7th chord is often maj7.
        if (scaleDegreeIndex === ROMAN_MAP.III || scaleDegreeIndex === ROMAN_MAP.VI) {
            const naturalMinorChordSymbol = keyDetails.natural.chords[scaleDegreeIndex];
            if (naturalMinorChordSymbol && Tonal.Chord.get(naturalMinorChordSymbol).type === 'major seventh') {
                seventhChordType = 'maj7';
            } else if (naturalMinorChordSymbol && Tonal.Chord.get(naturalMinorChordSymbol).type === 'major') {
                 // If the natural minor triad is major, but not already maj7 (e.g. just "Eb"), common practice is maj7.
                seventhChordType = 'maj7';
            } else {
                 // Otherwise, use the general minor key default (e.g. for minor triads becoming m7)
                seventhChordType = MINOR_KEY_DEFAULT_SEVENTHS[scaleDegreeIndex];
            }
        } else {
            seventhChordType = MINOR_KEY_DEFAULT_SEVENTHS[scaleDegreeIndex];
        }
      }

      // Fallback if no specific type determined from maps (should be very rare with comprehensive maps)
      if (!seventhChordType) {
        // This fallback logic can be simplified as the maps should cover all degrees.
        // If the triad is major, default to dominant 7th. If minor/dim, default to minor 7th.
        if (triadDetails.type === "major") seventhChordType = "7";
        else if (triadDetails.type === "minor") seventhChordType = "m7";
        else if (triadDetails.type === "diminished") seventhChordType = "m7b5"; // Or dim7 if context suggests
        else seventhChordType = "7"; // Default fallback
        console.warn(
            `[WARN] applyChordModifications: Could not determine specific 7th type for "${baseRomanInput}" on triad "${finalChordSymbol}" (key: ${keyDetails.tonic} ${keyType}, degree: ${scaleDegreeIndex}). Defaulting to inferred "${seventhChordType}".`,
          );
      }
    }

    // Construct and validate the 7th chord symbol
    if (seventhChordType) { // Ensure seventhChordType was actually determined
      const potentialSeventhSymbol = triadDetails.tonic + seventhChordType; // Use triadDetails.tonic
      const seventhChordInfo = Tonal.Chord.get(potentialSeventhSymbol);

      if (!seventhChordInfo.empty) {
        finalChordSymbol = seventhChordInfo.symbol;
      } else {
        // This means the determined seventhChordType (e.g., "maj7", "m7b5") isn't valid for the tonic.
        // This is more of a logic error in determining seventhChordType.
        console.warn( 
          `[WARN] applyChordModifications: Constructed invalid 7th chord symbol "${potentialSeventhSymbol}" for Roman "${baseRomanInput}". Attempting generic '7'.`,
        );
        // Try a generic dominant 7th as a last resort if adding a specific 7th failed
        const genericSeventhSymbol = triadDetails.tonic + '7';
        const genericSeventhInfo = Tonal.Chord.get(genericSeventhSymbol);
        if (!genericSeventhInfo.empty) {
          finalChordSymbol = genericSeventhInfo.symbol;
           console.warn(
            `[WARN] applyChordModifications: Using generic dominant 7th "${finalChordSymbol}" as fallback for Roman "${baseRomanInput}".`
           );
        } else {
          // If even generic '7' fails, it's very problematic. Stick to the triad.
           console.warn(
            `[WARN] applyChordModifications: Could not form any valid 7th chord for Roman "${baseRomanInput}" on base "${triadDetails.symbol}". Using triad symbol.`
           );
           // finalChordSymbol remains the triad symbol
        }
      }
    }
  }
  return finalChordSymbol;
}

/**
 * Calculates MIDI notes, note names, and the required bass pitch class for a given chord symbol.
 * @param finalChordSymbol - The fully resolved chord symbol (e.g., "Dm7", "G7", "Bbm7b5").
 * @param bassInterval - Interval for the bass note (e.g., "1", "3", "b5", "7").
 * @param keyType - 'major' or 'minor'.
 * @param keyTonic - The tonic of the key (e.g., "C", "G", "F#"). Used for octave hint.
 * @returns Object with notes, noteNames, and requiredBassPc, or null on failure.
 */
function getChordNotesAndBass(
  finalChordSymbol: string,
  bassInterval: string | null,
  keyType: 'major' | 'minor',
  keyTonic: string,
): {
  notes: number[];
  noteNames: string[];
  requiredBassPc: number | null;
} | null {
  const finalChord = Tonal.Chord.get(finalChordSymbol);
  if (finalChord.empty || !finalChord.notes || finalChord.notes.length === 0 || !finalChord.tonic) {
    // This means that after all modifications, the resulting chord symbol is invalid.
    throw new MusicTheoryError(
      `getChordNotesAndBass: The fully modified chord symbol "${finalChordSymbol}" is invalid or has no notes.`,
    );
  }

  // Determine a sensible root octave for the chord voicing.
  const chordTonicNote = Tonal.Note.get(finalChord.tonic);
  let rootOctaveGuess = 3; // Default: C3-B3 range for chord root
  if (['F', 'G', 'A', 'B'].includes(chordTonicNote.letter)) {
    rootOctaveGuess = 2; // F2-B2 for these roots to keep them lower
  }
  // Minor key tonics like A, B often sound better starting lower.
  if (keyType === 'minor' && (keyTonic === 'A' || keyTonic === 'Am' || keyTonic === 'B' || keyTonic === 'Bm')) {
      if (finalChord.tonic.startsWith('A') || finalChord.tonic.startsWith('B')) {
        rootOctaveGuess = 2;
      }
  }
  // For keys like D, E, ensure chords don't start too high if root is D, E.
  if ((keyTonic === 'D' || keyTonic === 'Dm' || keyTonic === 'E' || keyTonic === 'Em') &&
      (finalChord.tonic.startsWith('D') || finalChord.tonic.startsWith('E'))) {
        // Keep default of 3, but this logic can be expanded.
  }


  let rootMidi = Tonal.Note.midi(finalChord.tonic + rootOctaveGuess);
  if (rootMidi !== null && rootMidi < 36) { // MIDI 36 is C2
    const higherMidi = Tonal.Note.midi(finalChord.tonic + (rootOctaveGuess + 1));
    if (higherMidi) rootMidi = higherMidi;
  }
   if (rootMidi !== null && rootMidi > 72) { // MIDI 72 is C5
    const lowerMidi = Tonal.Note.midi(finalChord.tonic + (rootOctaveGuess -1));
    if (lowerMidi && lowerMidi >=36) rootMidi = lowerMidi; // don't go too low
  }


  if (rootMidi === null) {
    // This implies Tonal.Note.midi failed for a note like "C" + octave. Highly unlikely with valid tonic.
    throw new MusicTheoryError(
      `getChordNotesAndBass: Could not determine root MIDI for chord "${finalChordSymbol}" with tonic "${finalChord.tonic}" and octave guess ${rootOctaveGuess}.`,
    );
  }
  const rootNoteNameWithOctave = Tonal.Note.fromMidi(rootMidi);
  if (!rootNoteNameWithOctave) { // Should also be highly unlikely if rootMidi is valid
    throw new MusicTheoryError(
      `getChordNotesAndBass: Could not get note name from root MIDI ${rootMidi} for chord "${finalChordSymbol}".`,
    );
  }

  const chordNotesMidi: number[] = [];
  const noteNames: string[] = [];

  finalChord.intervals.forEach((interval) => {
    try {
      const transposedNoteName = Tonal.transpose(rootNoteNameWithOctave, interval);
      const midi = Tonal.Note.midi(transposedNoteName);
      if (midi !== null) {
        chordNotesMidi.push(midi);
        noteNames.push(transposedNoteName);
      } else {
         // This warning is kept as it indicates a potential issue with a specific interval transposition
         // but doesn't necessarily invalidate the entire chord.
         console.warn(`[WARN] getChordNotesAndBass: Could not get MIDI for transposed note "${transposedNoteName}" (root: "${rootNoteNameWithOctave}", interval: "${interval}") for chord ${finalChordSymbol}`);
      }
    } catch (transposeError: unknown) {
      // This error might occur if Tonal.transpose fails with an unusual interval string.
      throw new MusicTheoryError(
        `getChordNotesAndBass: Error transposing root "${rootNoteNameWithOctave}" by interval "${interval}" for chord "${finalChordSymbol}": ${(transposeError as Error).message}`,
      );
    }
  });

  if (chordNotesMidi.length === 0) {
    // This means all interval transpositions failed or the chord had no intervals.
    throw new MusicTheoryError(
      `getChordNotesAndBass: No valid MIDI notes could be generated for chord symbol "${finalChordSymbol}" from its intervals.`,
    );
  }

  // Sort notes by MIDI pitch
  const sortedIndices = Array.from(chordNotesMidi.keys()).sort(
    (a, b) => chordNotesMidi[a] - chordNotesMidi[b],
  );
  const sortedMidiNotes = sortedIndices.map((i) => chordNotesMidi[i]);
  const sortedNoteNames = sortedIndices.map((i) => noteNames[i]);

  // Determine required bass pitch class for inversions
  let requiredBassPc: number | null = null;
  if (bassInterval && bassInterval !== '1' && bassInterval !== '1P' && bassInterval !== 'P1') {
    try {
      // Transpose the CHORD's TONIC (without octave initially, Tonal.transpose handles it)
      // by the bassInterval to find the correct bass note.
      // Using rootNoteNameWithOctave as the base for transposition ensures the bass note
      // is in a sensible octave relative to the chord.
      const bassNoteName = Tonal.transpose(rootNoteNameWithOctave, bassInterval);
      const bassNoteDetails = Tonal.Note.get(bassNoteName);

      if (bassNoteDetails && typeof bassNoteDetails.chroma === 'number') {
        requiredBassPc = bassNoteDetails.chroma;

        // Sanity check: ensure the required bass PC is actually part of the chord's chroma.
        // Tonal.Chord.get(finalChordSymbol).chroma returns string array, convert requiredBassPc.
        if (!finalChord.chroma.includes(requiredBassPc.toString())) {
          // This warning is important as it indicates a potential music theory violation or an unusual inversion.
          // The function will still return the requiredBassPc, but the caller should be aware.
          console.warn(
            `[WARN] getChordNotesAndBass: Calculated bass PC ${requiredBassPc} ("${bassNoteName}") for inversion interval "${bassInterval}" on chord "${finalChordSymbol}" (chroma: ${finalChord.chroma}) is not one of the chord's primary pitch classes. This might indicate an unusual inversion (e.g., V/b3 where b3 is not in V) or a parsing issue. The bass note might be a non-chord tone.`,
          );
        }
      } else {
        // This means Tonal.transpose might have returned a note Tonal.Note.get can't process, or bassInterval was problematic.
        console.warn( 
          `[WARN] getChordNotesAndBass: Could not determine chroma for calculated bass note "${bassNoteName}" (chord: "${finalChordSymbol}", root: "${rootNoteNameWithOctave}", bass interval: "${bassInterval}").`,
        );
      }
    } catch (e: unknown) { 
      // This error can occur if Tonal.transpose fails with the bassInterval.
      console.error( // Log as error as it's an unexpected failure in a core utility.
        `getChordNotesAndBass: Error transposing for bass note. Chord: "${finalChordSymbol}", Root: "${rootNoteNameWithOctave}", Bass Interval: "${bassInterval}". Error: ${(e as Error).message}`,
      );
      // requiredBassPc remains null, implying root position or failure to determine inversion.
    }
  }

  return {
    notes: sortedMidiNotes,
    noteNames: sortedNoteNames,
    requiredBassPc,
  };
}

/**
 * Main exported function. Gets MIDI notes, note names, and required bass note
 * pitch class based on a chord's Roman numeral in a given key.
 * Handles inversions indicated by figured bass or slash notation.
 *
 * @param fullRomanWithInversion - Roman numeral symbol (e.g., "V7", "ii6", "IV64", "V/3").
 * @param keyNameInput - Key signature (e.g., "C", "Gm", "F#maj").
 * @returns Object with notes, noteNames, requiredBassPc, or null on failure.
 */
export function getChordInfoFromRoman(
  fullRomanWithInversion: string,
  keyNameInput: string,
): {
  notes: number[];
  noteNames: string[];
  requiredBassPc: number | null;
} | null {
  // No try-catch here; helper functions are expected to throw specific errors if they fail critically.
  // The main error to catch here would be if a helper returned null unexpectedly when it should have thrown.

  // 1. Parse Roman Numeral (handles inversions)
  // parseRomanNumeral will throw MusicTheoryError if parsing fails.
  const parsedRoman = parseRomanNumeral(fullRomanWithInversion);
  // If parseRomanNumeral were to return null (legacy or future change), handle it:
  // if (!parsedRoman) {
  //   throw new MusicTheoryError(`Failed to parse Roman numeral "${fullRomanWithInversion}".`);
  // }
  const { baseRoman, bassInterval } = parsedRoman;

  // 2. Get Key Details
  // getKeyDetails will throw InvalidInputError if key is not recognized.
  const keyDetails = getKeyDetails(keyNameInput);
  // if (!keyDetails) { // Should be handled by getKeyDetails throwing an error
  //    throw new InvalidInputError(`Failed to get key details for "${keyNameInput}" with Roman "${fullRomanWithInversion}".`);
  // }
  const keyType = keyDetails.type as 'major' | 'minor'; // Safe if getKeyDetails throws on null
  const keyTonic = keyDetails.tonic; // Safe

  // 3. Determine Scale Degree Index
  const baseRomanMatch = baseRoman.match(/([ivxlcIVXLC]+)/i);
  if (!baseRomanMatch) {
    throw new MusicTheoryError(
      `getChordInfoFromRoman: Could not extract Roman letters from base "${baseRoman}" (full: "${fullRomanWithInversion}"). Invalid Roman numeral structure.`,
    );
  }
  const baseRomanUpper = baseRomanMatch[1].toUpperCase();
  const scaleDegreeIndex = ROMAN_MAP[baseRomanUpper];

  if (scaleDegreeIndex === undefined) {
    throw new MusicTheoryError(
      `getChordInfoFromRoman: Could not map base Roman numeral "${baseRomanUpper}" to a scale degree index. Full input: "${fullRomanWithInversion}".`,
    );
  }

  // 4. Get Initial Diatonic Chord Symbol
  // getInitialDiatonicChordSymbol will throw MusicTheoryError if index is out of bounds.
  let currentChordSymbol = getInitialDiatonicChordSymbol(
    baseRomanUpper,
    scaleDegreeIndex,
    keyDetails, // keyDetails is non-nullable here due to earlier check/throw
    keyNameInput,
  );
  // if (!currentChordSymbol) { // Should be handled by getInitialDiatonicChordSymbol throwing
  //   throw new MusicTheoryError(`Failed to get initial diatonic chord for "${baseRomanUpper}" in key "${keyNameInput}".`);
  // }

  // 5. Apply Explicit Chord Modifications (Quality, 7ths)
  // applyChordModifications can throw MusicTheoryError if initial symbol is bad.
  // It logs warnings for non-critical modification issues but proceeds.
  currentChordSymbol = applyChordModifications(
    currentChordSymbol, // currentChordSymbol is non-nullable here
    baseRoman,
    keyDetails,
    scaleDegreeIndex,
  );

  // 6. Get Chord Notes and Bass Note Information
  // getChordNotesAndBass will throw MusicTheoryError if the final symbol is invalid or notes can't be generated.
  const chordNotesAndBass = getChordNotesAndBass(
    currentChordSymbol,
    bassInterval,
    keyType,
    keyTonic,
  );
  // if (!chordNotesAndBass) { // Should be handled by getChordNotesAndBass throwing
  //   throw new MusicTheoryError(`Failed to get notes and bass for symbol "${currentChordSymbol}" (Roman: "${fullRomanWithInversion}", Key: "${keyNameInput}").`);
  // }

  return chordNotesAndBass;
  // No top-level try-catch here means errors from helpers will propagate.
  // If a very generic catch is desired at this level, it could be added,
  // but it's often better to let specific errors propagate to the caller.
}

/** Creates an extended pool of MIDI notes for a chord across multiple octaves. */
export function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
  const pool: Set<number> = new Set();
  if (!baseChordNotes || baseChordNotes.length === 0) return [];

  [-2, -1, 0, 1, 2, 3, 4].forEach((octaveOffset) => {
    baseChordNotes.forEach((midi) => {
      if (midi !== null) { // Should always be non-null if baseChordNotes is number[]
        const note = midi + octaveOffset * 12;
        if (note >= 21 && note <= 108) { // MIDI A0 to C8 (standard piano range)
          pool.add(note);
        }
      }
    });
  });
  return Array.from(pool).sort((a, b) => a - b);
}

/** Converts a MIDI number to its note name (e.g., 60 -> "C4"). */
export function midiToNoteName(midi: number | null): string | null {
  if (midi === null || !Number.isInteger(midi) || midi < 0 || midi > 127) {
    // This is a utility function; throwing might be too aggressive if called in contexts
    // where a null return is handled. For now, keep as console.warn and return null.
    // If strictness is needed, an InvalidInputError could be thrown.
    // console.warn(`[WARN] midiToNoteName: Invalid MIDI number: ${midi}.`);
    return null;
  }
  try {
    return Tonal.Note.fromMidi(midi);
  } catch (e: unknown) { 
    // This error is rare if the input number is within 0-127.
    // It might occur if Tonal.js has an internal issue or a very unexpected MIDI value bypasses checks.
    console.warn(`[WARN] midiToNoteName: Error converting MIDI ${midi} to note name: ${(e as Error).message}`);
    return null; // Return null to indicate failure, allowing caller to handle.
  }
}
