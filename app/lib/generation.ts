// src/generation.ts
// Description: Consolidated core logic for generating chord progressions
//              and four-part voice leading, outputting MusicXML.

// --- Library Imports ---
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces'; // Optional: For type hints

// --- Configuration Constants (Previously in config.ts) ---

/** Defines the standard order of voices from highest to lowest. */
type VoiceName = 'soprano' | 'alto' | 'tenor' | 'bass';
const VOICE_ORDER: ReadonlyArray<VoiceName> = [
  'soprano',
  'alto',
  'tenor',
  'bass',
];

/** Standard MIDI note ranges for SATB voices. */
const VOICE_RANGES: Readonly<Record<VoiceName, [number, number]>> = {
  soprano: [60, 81], // C4 to A5
  alto: [55, 74], // G3 to D5
  tenor: [48, 69], // C3 to A4
  bass: [40, 62], // E2 to D4
};

/** Maximum interval allowed between adjacent upper voices (in semitones). */
const VOICE_SPACING_LIMIT = {
  soprano_alto: 12, // Perfect Octave
  alto_tenor: 12, // Perfect Octave
  tenor_bass: 19, // Perfect Twelfth (Octave + Perfect Fifth) - adjust if needed
};

/** Default octave used when converting pitch classes to notes without explicit octave. */
const DEFAULT_OCTAVE: number = 4;

// --- Type Definitions ---

/** Structure for MusicXML pitch representation */
interface MusicXMLPitch {
  step: string; // C, D, E, F, G, A, B
  alter?: number; // -2, -1, 0, 1, 2 (0 is natural, often omitted)
  octave: number; // Standard octave number
}

/** Structure to hold MIDI notes of the previous beat/measure end */
interface PreviousNotes {
  soprano: number | null;
  alto: number | null;
  tenor: number | null;
  bass: number | null;
}

/** Settings controlling the generation process */
export interface GenerationSettings {
  melodicSmoothness: number; // Typically 0-10
  dissonanceStrictness: number; // Typically 0-10 (controls rule checking)
}

// --- Tonal & MusicXML Helper Functions (Previously in tonal-helpers.ts) ---

/**
 * Gets the MIDI notes of a chord based on its Roman numeral in a given key.
 * @param roman - Roman numeral symbol (e.g., "V7", "ii", "IV").
 * @param key - Key signature (e.g., "C", "Gm").
 * @returns Array of MIDI note numbers for the chord, or empty if error.
 */
function getChordNotesFromRoman(roman: string, keyName: string): number[] {
  try {
    // Tonal needs the key type (major/minor) implicitly via Tonal.Key functions.
    const keyDetails =
      Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
    if (!keyDetails || !keyDetails.chords || !keyDetails.chordScales) {
      // Check for essential details
      console.warn(
        `Could not get valid key details or chords for key "${keyName}". Roman: "${roman}"`,
      );
      return [];
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type; // 'major' or 'minor'

    // Map Roman numerals (I-VII) to array indices (0-6).
    const romanMap = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
    const baseRomanMatch = roman.match(/([iv]+)/i); // Extract I, II, V etc. (case-insensitive)
    if (!baseRomanMatch) {
      console.warn(
        `Could not parse base Roman numeral from "${roman}" in key "${keyName}".`,
      );
      return [];
    }
    const baseRomanUpper = baseRomanMatch[1].toUpperCase(); // e.g., "V" from "V7" or "v"
    const scaleDegreeIndex = romanMap[baseRomanUpper as keyof typeof romanMap];

    if (scaleDegreeIndex === undefined) {
      console.warn(
        `Could not map Roman numeral "${baseRomanUpper}" (from "${roman}") to a scale degree index.`,
      );
      return [];
    }

    // Get the diatonic chords directly from Tonal.Key for the specified key.
    // Example: C major -> ["CM", "Dm", "Em", "FM", "GM", "Am", "B°"]
    const diatonicChords = keyDetails.chords;
    if (scaleDegreeIndex >= diatonicChords.length) {
      console.warn(
        `Scale degree index ${scaleDegreeIndex} is out of bounds for diatonic chords in key "${keyName}". Chords: ${diatonicChords}`,
      );
      return [];
    }

    let chordSymbol = diatonicChords[scaleDegreeIndex]; // Base diatonic chord symbol (e.g., "GM", "Dm")

    // If the input Roman numeral includes a '7' (e.g., "V7"), attempt to use the 7th chord.
    if (roman.includes('7') && !chordSymbol.includes('7')) {
      const seventhChordSymbol = chordSymbol + '7';
      // Check if Tonal recognizes this constructed 7th chord symbol.
      const chordInfo = Tonal.Chord.get(seventhChordSymbol);
      if (!chordInfo.empty) {
        chordSymbol = seventhChordSymbol; // Use the valid 7th chord symbol.
      } else {
        // Warn if the requested 7th is invalid, but proceed with the diatonic triad/chord.
        console.warn(
          `Input "${roman}" requested a 7th, but "${seventhChordSymbol}" is not a valid Tonal chord symbol in key "${keyName}". Using diatonic chord "${chordSymbol}".`,
        );
      }
    }
    // TODO: Could add similar logic for other chord extensions/qualities (e.g., dim, aug) if needed.

    // Get the detailed chord object from Tonal using the final determined symbol.
    const chord = Tonal.Chord.get(chordSymbol);
    if (!chord || chord.empty || !chord.notes || chord.notes.length === 0) {
      console.warn(
        `Could not get valid notes for chord symbol "${chordSymbol}" (derived from Roman "${roman}" in key "${keyName}").`,
      );
      return [];
    }

    // Determine a suitable root MIDI note, aiming for octave 3 or 4.
    if (!chord.tonic) {
      console.warn(
        `Chord symbol "${chordSymbol}" does not have a valid tonic.`,
      );
      return [];
    }
    const rootNote = Tonal.Note.get(chord.tonic); // { letter, acc, oct } - oct might be undefined
    // Estimate MIDI: If root is A or B, start octave 3; otherwise, start octave 4.
    const rootOctaveGuess =
      rootNote.letter === 'A' || rootNote.letter === 'B' ? 3 : 4;
    const rootMidiGuess = Tonal.Note.midi(
      rootNote.letter + rootNote.acc + rootOctaveGuess,
    );

    if (rootMidiGuess === null) {
      console.warn(
        `Could not determine a root MIDI value for chord "${chordSymbol}".`,
      );
      return [];
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidiGuess); // Get the note name for transposition
    if (!rootNoteName) {
      console.warn(
        `Could not get note name from root MIDI ${rootMidiGuess} for chord "${chordSymbol}".`,
      );
      return [];
    }

    // Calculate all chord note MIDIs by transposing the root note by the chord's intervals.
    return chord.intervals
      .map((interval) => {
        try {
          // Transpose the determined root note name (e.g., "G4") by the interval (e.g., "3M").
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (!transposedNoteName) {
            console.warn(
              `Tonal.transpose returned null for ${rootNoteName} + ${interval}`,
            );
            return null;
          }
          // Convert the resulting note name (e.g., "B4") back to MIDI.
          return Tonal.Note.midi(transposedNoteName);
        } catch (transposeError) {
          console.error(
            `Error during Tonal.transpose(${rootNoteName}, ${interval}):`,
            transposeError,
          );
          return null;
        }
      })
      .filter((midi) => midi !== null); // Remove any nulls resulting from errors.
  } catch (error) {
    console.error(
      `Unexpected error getting chord notes for Roman "${roman}" in key "${keyName}":`,
      error,
    );
    return []; // Return empty array on any unexpected error.
  }
}

/**
 * Creates an extended pool of MIDI notes for a chord across multiple octaves.
 * @param baseChordNotes - Array of MIDI notes for the chord in one octave.
 * @returns Array of MIDI notes spanning relevant octaves.
 */
function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
  const pool: number[] = [];
  if (!baseChordNotes || baseChordNotes.length === 0) return pool;

  [-2, -1, 0, 1, 2].forEach((octaveOffset) => {
    baseChordNotes.forEach((midi) => {
      if (midi !== null) {
        // Check if midi is valid
        pool.push(midi + octaveOffset * 12);
      }
    });
  });
  // Ensure the pool is sorted and unique, filtering out unreasonable notes
  return Array.from(new Set(pool))
    .sort((a, b) => a - b)
    .filter((n) => n >= 21 && n <= 108); // A0 to C8
}

/**
 * Converts a MIDI number to its note name (e.g., 60 -> "C4").
 * @param midi - MIDI note number.
 * @returns Note name string or null if invalid.
 */
function midiToNoteName(midi: number | null): string | null {
  if (midi === null || midi < 0 || midi > 127) return null; // Basic validation
  try {
    return Tonal.Note.fromMidi(midi);
  } catch {
    return null; // Tonal might throw for invalid MIDI
  }
}

/**
 * Converts a MIDI number to a MusicXML Pitch object.
 * @param midi - MIDI note number.
 * @returns MusicXMLPitch object or null if invalid.
 */
function midiToMusicXMLPitch(midi: number): MusicXMLPitch | null {
  const noteName = midiToNoteName(midi); // Use validated conversion
  if (!noteName) return null;

  try {
    const noteDetails = Tonal.Note.get(noteName); // Gets {pc, acc, oct, chroma, midi, freq, letter}
    // Check for essential properties
    if (
      !noteDetails.pc ||
      noteDetails.oct === undefined ||
      noteDetails.oct === null ||
      !noteDetails.letter
    ) {
      console.warn(
        `Could not get complete details for note: ${noteName} (MIDI: ${midi})`,
      );
      return null;
    }

    const step = noteDetails.letter; // Should be C, D, E, F, G, A, B
    const alter =
      noteDetails.acc === '#'
        ? 1
        : noteDetails.acc === '##'
          ? 2
          : noteDetails.acc === 'b'
            ? -1
            : noteDetails.acc === 'bb'
              ? -2
              : 0; // Convert accidental symbol to number
    const octave = noteDetails.oct;

    // MusicXML 'alter': 0=natural, 1=sharp, -1=flat, 2=double sharp, -2=double flat
    // Omit alter attribute if 0 (natural) or NaN
    const musicXmlAlter = alter === 0 || isNaN(alter) ? undefined : alter;

    return { step, alter: musicXmlAlter, octave };
  } catch (error) {
    console.error(
      `Error getting details for note "${noteName}" (MIDI: ${midi}):`,
      error,
    );
    return null;
  }
}

/**
 * Determines the MusicXML duration type string based on the beat value of the time signature.
 * @param beatValue - The denominator of the time signature (e.g., 4 for quarter note beat).
 * @returns MusicXML duration type string (e.g., "quarter", "eighth").
 */
function getMusicXMLDurationType(beatValue: number): string {
  switch (beatValue) {
    case 1:
      return 'whole';
    case 2:
      return 'half';
    case 4:
      return 'quarter';
    case 8:
      return 'eighth';
    case 16:
      return '16th';
    // Add cases for 32nd, 64th if needed
    default:
      console.warn(
        `Unsupported beat value ${beatValue} for duration type, defaulting to 'quarter'.`,
      );
      return 'quarter';
  }
}

// --- Internal Voice Leading Helper Functions ---

/**
 * Selects the "best" MIDI note from allowed notes based on target, previous note, and smoothness.
 * @returns {number | null} The chosen MIDI note, or null if no suitable note.
 */
function findClosestNote(
  targetMidi: number,
  allowedNotes: number[],
  previousNoteMidi: number | null,
  smoothnessPref: number, // 0-10
  avoidLeapThreshold: number = Tonal.Interval.semitones('P5') ?? 7, // Default to Perfect 5th
): number | null {
  // ... [Implementation unchanged from previous version] ...
  if (!allowedNotes || allowedNotes.length === 0) {
    return previousNoteMidi ?? null;
  }
  if (allowedNotes.length === 1) {
    return allowedNotes[0];
  }
  let bestNote: number = allowedNotes[0];
  let minScore: number = Infinity;
  allowedNotes.forEach((note) => {
    let score = Math.abs(note - targetMidi);
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);
      const smoothnessWeight = smoothnessPref / 10.0;
      if (interval === 0) {
        score *= 0.1 * (1.1 - smoothnessWeight);
      } else if (interval <= 2) {
        score *= 0.5 * (1.1 - smoothnessWeight);
      } else if (interval <= avoidLeapThreshold) {
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.5);
      } else {
        score *= 1.5 + (interval / 12.0) * smoothnessWeight;
      }
    }
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });
  if (
    previousNoteMidi !== null &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    const stepNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi!) <= 2,
    );
    if (stepNotes.length > 0) {
      let bestStepNote = stepNotes[0];
      let minStepTargetScore = Math.abs(bestStepNote - targetMidi);
      stepNotes.forEach((stepNote) => {
        let stepTargetScore = Math.abs(stepNote - targetMidi);
        if (stepTargetScore < minStepTargetScore) {
          minStepTargetScore = stepTargetScore;
          bestStepNote = stepNote;
        }
      });
      const LEAP_PREFERENCE_FACTOR = 2.0;
      if (minStepTargetScore < minScore * LEAP_PREFERENCE_FACTOR) {
        bestNote = bestStepNote;
      }
    }
  }
  return bestNote;
}

/** Assigns a MIDI note for the Bass voice. */
function assignBassNote(
  chordRootMidi: number,
  chordNotesPool: number[],
  previousBassMidi: number | null,
  smoothness: number,
): number | null {
  // ... [Implementation unchanged from previous version] ...
  const [minRange, maxRange] = VOICE_RANGES.bass;
  let allowedBassNotes = chordNotesPool.filter(
    (n) => n >= minRange && n <= maxRange,
  );
  if (allowedBassNotes.length === 0) {
    console.warn(
      'No valid bass notes found in range. Cannot assign bass note.',
    );
    return null;
  }
  const rootNotePc = chordRootMidi % 12;
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);
  const targetMidi = previousBassMidi ?? chordRootMidi - 12;
  if (rootOptions.length > 0) {
    return findClosestNote(
      targetMidi,
      rootOptions,
      previousBassMidi,
      smoothness,
    );
  } else {
    console.log(
      `Root note (${Tonal.Note.pitchClass(Tonal.Note.fromMidi(chordRootMidi))}) not available in bass range. Choosing best alternative.`,
    );
    return findClosestNote(
      targetMidi,
      allowedBassNotes,
      previousBassMidi,
      smoothness,
    );
  }
}

/** Assigns a MIDI note for the Soprano voice. */
function assignSopranoNote(
  fullChordNotePool: number[],
  previousSopranoMidi: number | null,
  smoothness: number,
): number | null {
  // ... [Implementation unchanged from previous version] ...
  const [minRange, maxRange] = VOICE_RANGES.soprano;
  let allowedSopranoNotes = fullChordNotePool.filter(
    (n) => n >= minRange && n <= maxRange,
  );
  if (allowedSopranoNotes.length === 0) {
    console.warn(
      'No valid soprano notes found in range. Cannot assign soprano note.',
    );
    return null;
  }
  const targetMidi = previousSopranoMidi
    ? previousSopranoMidi + Math.floor(Math.random() * 3) + 1
    : minRange + 7;
  return findClosestNote(
    targetMidi,
    allowedSopranoNotes,
    previousSopranoMidi,
    smoothness,
  );
}

/** Assigns MIDI notes for the Alto and Tenor voices. */
function assignInnerVoices(
  tenorTargetNotePc: number,
  altoTargetNotePc: number,
  fullChordNotePool: number[],
  previousTenorMidi: number | null,
  previousAltoMidi: number | null,
  sopranoNoteMidi: number | null,
  bassNoteMidi: number | null,
  smoothness: number,
): { tenorNoteMidi: number | null; altoNoteMidi: number | null } {
  // ... [Implementation unchanged from previous version] ...
  if (sopranoNoteMidi === null || bassNoteMidi === null) {
    console.warn('Cannot assign inner voices without valid soprano and bass.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }
  const [altoMin, altoMax] = VOICE_RANGES.alto;
  const [tenorMin, tenorMax] = VOICE_RANGES.tenor;
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= altoMin &&
      n <= altoMax &&
      n < sopranoNoteMidi &&
      n > bassNoteMidi &&
      sopranoNoteMidi - n <= VOICE_SPACING_LIMIT.soprano_alto,
  );
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= tenorMin &&
      n <= tenorMax &&
      n < sopranoNoteMidi &&
      n > bassNoteMidi &&
      n - bassNoteMidi <= VOICE_SPACING_LIMIT.tenor_bass,
  );
  let altoNoteMidi: number | null = null;
  let altoTargetMidi = previousAltoMidi
    ? previousAltoMidi + (Math.random() > 0.5 ? 1 : -1)
    : (sopranoNoteMidi + bassNoteMidi) / 2;
  const altoTargetPcOptions = allowedAltoNotes.filter(
    (n) => n % 12 === altoTargetNotePc,
  );
  if (altoTargetPcOptions.length > 0) {
    altoNoteMidi = findClosestNote(
      altoTargetMidi,
      altoTargetPcOptions,
      previousAltoMidi,
      smoothness,
    );
  }
  if (altoNoteMidi === null) {
    if (allowedAltoNotes.length === 0) {
      console.warn(
        'No valid notes for Alto in range/spacing. Cannot assign Alto.',
      );
      return { tenorNoteMidi: null, altoNoteMidi: null };
    } else {
      altoNoteMidi = findClosestNote(
        altoTargetMidi,
        allowedAltoNotes,
        previousAltoMidi,
        smoothness,
      );
    }
  }
  if (altoNoteMidi === null) {
    console.error('Failed to find any suitable note for Alto.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }
  allowedTenorNotes = allowedTenorNotes.filter(
    (n) =>
      n < altoNoteMidi! && altoNoteMidi! - n <= VOICE_SPACING_LIMIT.alto_tenor,
  );
  let tenorNoteMidi: number | null = null;
  let tenorTargetMidi = previousTenorMidi
    ? previousTenorMidi + (Math.random() > 0.5 ? 1 : -1)
    : (altoNoteMidi + bassNoteMidi) / 2;
  const tenorTargetPcOptions = allowedTenorNotes.filter(
    (n) => n % 12 === tenorTargetNotePc,
  );
  if (tenorTargetPcOptions.length > 0) {
    tenorNoteMidi = findClosestNote(
      tenorTargetMidi,
      tenorTargetPcOptions,
      previousTenorMidi,
      smoothness,
    );
  }
  if (tenorNoteMidi === null) {
    if (allowedTenorNotes.length === 0) {
      console.warn(
        'No valid notes for Tenor below Alto / within spacing. Cannot assign Tenor.',
      );
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
    } else {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        allowedTenorNotes,
        previousTenorMidi,
        smoothness,
      );
    }
  }
  if (tenorNoteMidi === null) {
    console.error('Failed to find any suitable note for Tenor.');
    return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
  }
  if (tenorNoteMidi >= altoNoteMidi) {
    console.warn(
      `INTERNAL ERROR: Tenor (${midiToNoteName(tenorNoteMidi)}) >= Alto (${midiToNoteName(altoNoteMidi)}). Attempting fallback correction.`,
    );
    const lowerTenorOptions = allowedTenorNotes.filter(
      (n) => n < altoNoteMidi!,
    );
    if (lowerTenorOptions.length > 0) {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        lowerTenorOptions,
        previousTenorMidi,
        smoothness,
      );
      if (tenorNoteMidi === null) tenorNoteMidi = lowerTenorOptions[0];
    } else {
      tenorNoteMidi = Math.max(tenorMin, bassNoteMidi + 1, altoNoteMidi - 1);
      console.warn(
        `Forcing Tenor to fallback MIDI ${tenorNoteMidi} (${midiToNoteName(tenorNoteMidi)}).`,
      );
    }
    if (tenorNoteMidi === null) {
      console.error('Fallback correction for Tenor failed.');
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
    }
  }
  return { tenorNoteMidi, altoNoteMidi };
}

/** Checks for parallel 5ths and octaves between two voices. */
function checkParallels(
  voice1Prev: number | null,
  voice1Curr: number | null,
  voice2Prev: number | null,
  voice2Curr: number | null,
  part1Name: string,
  part2Name: string,
  measureIndex: number,
  beatIndex: number, // 0-based beat index within measure
): void {
  // ... [Implementation unchanged from previous version] ...
  if (
    voice1Prev === null ||
    voice2Prev === null ||
    voice1Curr === null ||
    voice2Curr === null
  )
    return;
  const voice1Moved = voice1Prev !== voice1Curr;
  const voice2Moved = voice2Prev !== voice2Curr;
  if (!voice1Moved || !voice2Moved) return;
  const note1PrevName = midiToNoteName(voice1Prev);
  const note1CurrName = midiToNoteName(voice1Curr);
  const note2PrevName = midiToNoteName(voice2Prev);
  const note2CurrName = midiToNoteName(voice2Curr);
  if (!note1PrevName || !note1CurrName || !note2PrevName || !note2CurrName)
    return;
  try {
    const intervalPrev = Tonal.Interval.distance(note2PrevName, note1PrevName);
    const intervalCurr = Tonal.Interval.distance(note2CurrName, note1CurrName);
    const simplePrev = Tonal.Interval.simplify(intervalPrev);
    const simpleCurr = Tonal.Interval.simplify(intervalCurr);
    const numPrev = Tonal.Interval.num(simplePrev);
    const numCurr = Tonal.Interval.num(simpleCurr);
    const loc = `M${measureIndex + 1}:B${beatIndex + 1}`;
    if (
      numPrev === 5 &&
      numCurr === 5 &&
      simplePrev === 'P5' &&
      simpleCurr === 'P5'
    ) {
      console.warn(
        `PARALLEL 5th (${part1Name}/${part2Name}) at ${loc}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    } else if (
      (numPrev === 8 || numPrev === 1) &&
      (numCurr === 8 || numCurr === 1) &&
      simplePrev?.startsWith('P') &&
      simpleCurr?.startsWith('P')
    ) {
      console.warn(
        `PARALLEL Octave/Unison (${part1Name}/${part2Name}) at ${loc}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    }
  } catch (error) {
    console.error(
      `Error checking parallels at M${measureIndex + 1}:B${beatIndex + 1} between ${part1Name}/${part2Name}:`,
      error,
    );
  }
}

/** Performs voice leading checks (crossing, spacing, parallels). */
function checkVoiceLeadingRules(
  currentNotes: PreviousNotes,
  previousNotes: PreviousNotes,
  measureIndex: number,
  beatIndex: number,
): void {
  // ... [Implementation unchanged from previous version] ...
  const { soprano, alto, tenor, bass } = currentNotes;
  const prev = previousNotes;
  const loc = `M${measureIndex + 1}:B${beatIndex + 1}`;
  if (soprano === null || alto === null || tenor === null || bass === null) {
    return;
  }
  if (alto > soprano)
    console.warn(
      `Voice Crossing: Alto (${midiToNoteName(alto)}) > Soprano (${midiToNoteName(soprano)}) at ${loc}`,
    );
  if (tenor > alto)
    console.warn(
      `Voice Crossing: Tenor (${midiToNoteName(tenor)}) > Alto (${midiToNoteName(alto)}) at ${loc}`,
    );
  if (bass > tenor)
    console.warn(
      `Voice Crossing: Bass (${midiToNoteName(bass)}) > Tenor (${midiToNoteName(tenor)}) at ${loc}`,
    );
  if (Math.abs(soprano - alto) > VOICE_SPACING_LIMIT.soprano_alto)
    console.warn(`Spacing > P8 between Soprano/Alto at ${loc}`);
  if (Math.abs(alto - tenor) > VOICE_SPACING_LIMIT.alto_tenor)
    console.warn(`Spacing > P8 between Alto/Tenor at ${loc}`);
  if (Math.abs(tenor - bass) > VOICE_SPACING_LIMIT.tenor_bass)
    console.warn(`Spacing > P12 between Tenor/Bass at ${loc}`);
  if (
    prev &&
    prev.soprano !== null &&
    prev.alto !== null &&
    prev.tenor !== null &&
    prev.bass !== null
  ) {
    checkParallels(
      prev.soprano,
      soprano,
      prev.alto,
      alto,
      'Soprano',
      'Alto',
      measureIndex,
      beatIndex,
    );
    checkParallels(
      prev.soprano,
      soprano,
      prev.tenor,
      tenor,
      'Soprano',
      'Tenor',
      measureIndex,
      beatIndex,
    );
    checkParallels(
      prev.soprano,
      soprano,
      prev.bass,
      bass,
      'Soprano',
      'Bass',
      measureIndex,
      beatIndex,
    );
    checkParallels(
      prev.alto,
      alto,
      prev.tenor,
      tenor,
      'Alto',
      'Tenor',
      measureIndex,
      beatIndex,
    );
    checkParallels(
      prev.alto,
      alto,
      prev.bass,
      bass,
      'Alto',
      'Bass',
      measureIndex,
      beatIndex,
    );
    checkParallels(
      prev.tenor,
      tenor,
      prev.bass,
      bass,
      'Tenor',
      'Bass',
      measureIndex,
      beatIndex,
    );
  }
}

// --- Exported Generation Functions ---

/**
 * Generates a simple chord progression based on tonal harmony tendencies.
 * @param key - The key signature (e.g., "C", "Gm").
 * @param numMeasures - The desired number of measures (and chords).
 * @param harmonicComplexity - A value (0-10) influencing chord choices.
 * @returns An array of Roman numeral chord symbols.
 */
export function generateChordProgression(
  key: string,
  numMeasures: number,
  harmonicComplexity: number, // 0-10
): string[] {
  // ... [Implementation unchanged from previous version] ...
  if (numMeasures <= 0) return [];
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) {
    console.error(
      `Invalid key provided: "${key}". Using "C" major as fallback.`,
    );
    key = 'C';
    return generateChordProgression(key, numMeasures, harmonicComplexity);
  }
  const isMajor = keyDetails.type === 'major';
  const tonicRoman = isMajor ? 'I' : 'i';
  const dominantRoman = 'V';
  const dominant7Roman = 'V7';
  const subdominantRoman = isMajor ? 'IV' : 'iv';
  const supertonicRoman = isMajor ? 'ii' : 'ii°';
  const mediantRoman = isMajor ? 'iii' : 'III';
  const submediantRoman = isMajor ? 'vi' : 'VI';
  const leadingToneRoman = 'vii°';
  const primaryChords = [tonicRoman, subdominantRoman, dominantRoman];
  const secondaryChords = [submediantRoman, supertonicRoman];
  const complexChords = [mediantRoman, leadingToneRoman];
  let allowedChords = [...primaryChords];
  if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
  if (harmonicComplexity >= 7) allowedChords.push(...complexChords);
  if (harmonicComplexity >= 5) {
    if (allowedChords.includes(dominantRoman)) {
      allowedChords = allowedChords.map((c) =>
        c === dominantRoman ? dominant7Roman : c,
      );
    } else if (!allowedChords.includes(dominant7Roman)) {
      allowedChords.push(dominant7Roman);
    }
  }
  const uniqueChords = new Set<string>(allowedChords);
  allowedChords = [];
  uniqueChords.forEach((chord) => {
    allowedChords.push(chord);
  });
  let progression: string[] = [tonicRoman];
  let prevChord = tonicRoman;
  const MAX_ATTEMPTS = 5;
  for (let i = 1; i < numMeasures - 1; i++) {
    let nextChord: string | undefined = undefined;
    let attempts = 0;
    do {
      let candidates = [...allowedChords];
      if ([subdominantRoman, supertonicRoman].includes(prevChord)) {
        const dominantCandidates = candidates.filter((c) =>
          [dominantRoman, dominant7Roman, leadingToneRoman].includes(c),
        );
        if (dominantCandidates.length > 0) candidates = dominantCandidates;
      } else if ([dominantRoman, dominant7Roman].includes(prevChord)) {
        const tonicResolutionCandidates = candidates.filter((c) =>
          [tonicRoman, submediantRoman].includes(c),
        );
        if (tonicResolutionCandidates.length > 0)
          candidates = tonicResolutionCandidates;
      } else if (prevChord === submediantRoman) {
        const submediantNextCandidates = candidates.filter((c) =>
          [
            supertonicRoman,
            subdominantRoman,
            dominantRoman,
            dominant7Roman,
          ].includes(c),
        );
        if (submediantNextCandidates.length > 0)
          candidates = submediantNextCandidates;
      }
      if (candidates.length === 0) candidates = allowedChords;
      nextChord = candidates[Math.floor(Math.random() * candidates.length)];
      attempts++;
    } while (
      nextChord === prevChord &&
      allowedChords.length > 1 &&
      attempts < MAX_ATTEMPTS
    );
    if (nextChord === undefined) {
      nextChord = allowedChords[0] ?? tonicRoman;
      console.warn(
        `Could not find distinct next chord from ${prevChord}, using ${nextChord}`,
      );
    }
    progression.push(nextChord);
    prevChord = nextChord;
  }
  if (numMeasures > 1) {
    const preCadenceChord = allowedChords.includes(dominant7Roman)
      ? dominant7Roman
      : allowedChords.includes(dominantRoman)
        ? dominantRoman
        : tonicRoman;
    if (numMeasures === 2) {
      progression[1] = tonicRoman;
    } else {
      progression[numMeasures - 2] = preCadenceChord;
      progression[numMeasures - 1] = tonicRoman;
    }
  } else if (numMeasures === 1) {
    progression[0] = tonicRoman;
  }
  console.log(
    `Generated Progression (${key}, complexity ${harmonicComplexity}):`,
    progression.join(' - '),
  );
  return progression;
}

/**
 * Main function to generate the four-part voice data as a MusicXML string using xmlbuilder2.
 * @param chordProgression - Array of Roman numeral chord symbols.
 * @param keySignature - The key signature (e.g., "C", "Gm").
 * @param meter - The time signature (e.g., "4/4").
 * @param numMeasures - The number of measures to generate (should match chordProgression length).
 * @param generationSettings - Generation parameters.
 * @returns {string} A MusicXML string representing the generated piece.
 * @throws {Error} If the key or meter is invalid or fundamental errors occur.
 */
export function generateVoices(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): string {
  // ... [Implementation unchanged from previous version using xmlbuilder2] ...
  const { melodicSmoothness, dissonanceStrictness } = generationSettings;

  const keyDetails =
    Tonal.Key.majorKey(keySignature) || Tonal.Key.minorKey(keySignature);
  if (!keyDetails)
    throw new Error('Invalid key signature provided: ' + keySignature);
  const keyTonic = keyDetails.tonic;
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';
  const keyFifths = keyDetails.alteration ?? 0;

  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error(
      "Invalid meter format. Use 'beats/beatValue' (e.g., '4/4').",
    );
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);
  if (![1, 2, 4, 8, 16].includes(beatValue))
    throw new Error(
      'Unsupported beat value (denominator) in meter: ' + beatValue,
    );
  if (meterBeats <= 0) throw new Error('Meter must have at least one beat.');

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });
  root.ele('work').ele('work-title').txt('Generated Chorale').up().up();
  const identification = root.ele('identification');
  identification
    .ele('encoding')
    .ele('software')
    .txt('AI Music Generator (Consolidated)')
    .up()
    .ele('encoding-date')
    .txt(new Date().toISOString().split('T')[0])
    .up()
    .up();
  identification.up();
  const partList = root.ele('part-list');
  partList
    .ele('score-part', { id: 'P1' })
    .ele('part-name')
    .txt('Soprano')
    .up()
    .up();
  partList
    .ele('score-part', { id: 'P2' })
    .ele('part-name')
    .txt('Alto')
    .up()
    .up();
  partList
    .ele('score-part', { id: 'P3' })
    .ele('part-name')
    .txt('Tenor')
    .up()
    .up();
  partList
    .ele('score-part', { id: 'P4' })
    .ele('part-name')
    .txt('Bass')
    .up()
    .up();
  partList.up();

  const partBuilders: Record<VoiceName, XMLBuilder> = {
    soprano: root.ele('part', { id: 'P1' }),
    alto: root.ele('part', { id: 'P2' }),
    tenor: root.ele('part', { id: 'P3' }),
    bass: root.ele('part', { id: 'P4' }),
  };

  let previousMeasureLastNotes: PreviousNotes = {
    soprano: null,
    alto: null,
    tenor: null,
    bass: null,
  };
  const divisions = 4;
  const beatDurationTicks = divisions * (4 / beatValue);
  const musicXmlBeatType = getMusicXMLDurationType(beatValue);
  const leadingToneMidiPc =
    Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE) !== null
      ? (Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE)! +
          (Tonal.Interval.semitones('M7') ?? 11)) %
        12
      : -1;

  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    console.log(`--- Generating Measure ${measureIndex + 1} ---`);
    const roman = chordProgression[measureIndex];
    const baseChordNotes = getChordNotesFromRoman(roman, keySignature);

    const currentMeasureBuilders: Record<VoiceName, XMLBuilder> = {
      soprano: partBuilders.soprano.ele('measure', {
        number: `${measureIndex + 1}`,
      }),
      alto: partBuilders.alto.ele('measure', { number: `${measureIndex + 1}` }),
      tenor: partBuilders.tenor.ele('measure', {
        number: `${measureIndex + 1}`,
      }),
      bass: partBuilders.bass.ele('measure', { number: `${measureIndex + 1}` }),
    };

    if (measureIndex === 0) {
      VOICE_ORDER.forEach((voiceName) => {
        const attributes = currentMeasureBuilders[voiceName].ele('attributes');
        attributes.ele('divisions').txt(`${divisions}`).up();
        attributes
          .ele('key')
          .ele('fifths')
          .txt(`${keyFifths}`)
          .up()
          .ele('mode')
          .txt(keyMode)
          .up()
          .up();
        attributes
          .ele('time')
          .ele('beats')
          .txt(`${meterBeats}`)
          .up()
          .ele('beat-type')
          .txt(`${beatValue}`)
          .up()
          .up();
        const clef = attributes.ele('clef');
        switch (voiceName) {
          case 'soprano':
            clef.ele('sign').txt('G').up().ele('line').txt('2').up();
            break;
          case 'alto':
            clef.ele('sign').txt('G').up().ele('line').txt('2').up();
            break;
          case 'tenor':
            clef
              .ele('sign')
              .txt('G')
              .up()
              .ele('line')
              .txt('2')
              .up()
              .ele('clef-octave-change')
              .txt('-1')
              .up();
            break;
          case 'bass':
            clef.ele('sign').txt('F').up().ele('line').txt('4').up();
            break;
        }
        clef.up();
        attributes.up();
      });
    }

    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}" in ${keySignature}. Adding rests.`,
      );
      VOICE_ORDER.forEach((voiceName) => {
        for (let beat = 0; beat < meterBeats; beat++) {
          const noteElement = currentMeasureBuilders[voiceName].ele('note');
          noteElement.ele('rest').up();
          noteElement.ele('duration').txt(`${beatDurationTicks}`).up();
          noteElement.ele('type').txt(musicXmlBeatType).up();
          noteElement.ele('voice').txt('1').up();
          noteElement.up();
        }
      });
      previousMeasureLastNotes = {
        soprano: null,
        alto: null,
        tenor: null,
        bass: null,
      };
      Object.values(currentMeasureBuilders).forEach((mb) => mb.up());
      continue;
    }

    const chordRootMidi = baseChordNotes[0];
    const chordRootPc = chordRootMidi % 12;
    const chordPcs = baseChordNotes.map((n) => n % 12);
    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);
    const bassNoteMidi = assignBassNote(
      chordRootMidi,
      fullChordNotePool,
      previousMeasureLastNotes.bass,
      melodicSmoothness,
    );
    const sopranoNoteMidi = assignSopranoNote(
      fullChordNotePool,
      previousMeasureLastNotes.soprano,
      melodicSmoothness,
    );
    let currentVoicingPcs = new Set<number>();
    if (bassNoteMidi !== null) currentVoicingPcs.add(bassNoteMidi % 12);
    if (sopranoNoteMidi !== null) currentVoicingPcs.add(sopranoNoteMidi % 12);
    let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
    let pcsToDouble: number[] = [];
    const voicesToFill = 2;
    if (neededPcs.length < voicesToFill) {
      const numDoublingsNeeded = voicesToFill - neededPcs.length;
      const canDoubleRoot = chordRootPc !== leadingToneMidiPc;
      if (
        canDoubleRoot &&
        !currentVoicingPcs.has(chordRootPc) &&
        !neededPcs.includes(chordRootPc)
      )
        pcsToDouble.push(chordRootPc);
      const fifthMidi = Tonal.Note.midi(
        Tonal.Note.transpose(Tonal.Note.fromMidi(chordRootMidi), 'P5'),
      );
      const fifthPc = fifthMidi !== null ? fifthMidi % 12 : -1;
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        fifthPc !== -1 &&
        chordPcs.includes(fifthPc) &&
        fifthPc !== leadingToneMidiPc &&
        !currentVoicingPcs.has(fifthPc) &&
        !neededPcs.includes(fifthPc) &&
        !pcsToDouble.includes(fifthPc)
      )
        pcsToDouble.push(fifthPc);
      const thirdPc = chordPcs.find(
        (pc) => pc !== chordRootPc && pc !== fifthPc,
      );
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        thirdPc !== undefined &&
        thirdPc !== leadingToneMidiPc &&
        !currentVoicingPcs.has(thirdPc) &&
        !neededPcs.includes(thirdPc) &&
        !pcsToDouble.includes(thirdPc)
      )
        pcsToDouble.push(thirdPc);
      while (pcsToDouble.length < numDoublingsNeeded) {
        if (canDoubleRoot && !pcsToDouble.includes(chordRootPc))
          pcsToDouble.push(chordRootPc);
        else if (
          fifthPc !== -1 &&
          chordPcs.includes(fifthPc) &&
          !pcsToDouble.includes(fifthPc)
        )
          pcsToDouble.push(fifthPc);
        else if (thirdPc !== undefined && !pcsToDouble.includes(thirdPc))
          pcsToDouble.push(thirdPc);
        else if (canDoubleRoot) pcsToDouble.push(chordRootPc);
        else {
          const fallbackPc =
            chordPcs.find((pc) => pc !== leadingToneMidiPc) ?? chordRootPc;
          pcsToDouble.push(fallbackPc);
        }
        if (pcsToDouble.length > voicesToFill * 2) break;
      }
    }
    let targetInnerPcs = [...neededPcs, ...pcsToDouble].slice(0, voicesToFill);
    while (targetInnerPcs.length < voicesToFill) {
      const fallbackPc =
        chordPcs.find((pc) => pc !== leadingToneMidiPc) ?? chordRootPc;
      targetInnerPcs.push(fallbackPc);
    }
    const tenorTargetPc = targetInnerPcs[0];
    const altoTargetPc = targetInnerPcs[1];
    const { tenorNoteMidi, altoNoteMidi } = assignInnerVoices(
      tenorTargetPc,
      altoTargetPc,
      fullChordNotePool,
      previousMeasureLastNotes.tenor,
      previousMeasureLastNotes.alto,
      sopranoNoteMidi,
      bassNoteMidi,
      melodicSmoothness,
    );
    const currentMeasureVoicing: PreviousNotes = {
      soprano: sopranoNoteMidi,
      alto: altoNoteMidi,
      tenor: tenorNoteMidi,
      bass: bassNoteMidi,
    };
    console.log(` M${measureIndex + 1} Voicing (MIDI):`, currentMeasureVoicing);

    if (dissonanceStrictness > 3) {
      checkVoiceLeadingRules(
        currentMeasureVoicing,
        previousMeasureLastNotes,
        measureIndex,
        0,
      );
    }

    for (let beat = 0; beat < meterBeats; beat++) {
      VOICE_ORDER.forEach((voiceName) => {
        const midi = currentMeasureVoicing[voiceName];
        const noteElement = currentMeasureBuilders[voiceName].ele('note');
        if (midi !== null) {
          const pitch = midiToMusicXMLPitch(midi);
          if (pitch) {
            const pitchElement = noteElement.ele('pitch');
            pitchElement.ele('step').txt(pitch.step).up();
            if (pitch.alter !== undefined && pitch.alter !== 0) {
              pitchElement.ele('alter').txt(`${pitch.alter}`).up();
            }
            pitchElement.ele('octave').txt(`${pitch.octave}`).up();
            pitchElement.up();
            noteElement.ele('duration').txt(`${beatDurationTicks}`).up();
            noteElement.ele('type').txt(musicXmlBeatType).up();
            noteElement.ele('voice').txt('1').up();
            // Add accidental logic here if needed
          } else {
            console.warn(
              `Could not convert MIDI ${midi} to MusicXML pitch for ${voiceName}. Adding rest.`,
            );
            noteElement.ele('rest').up();
            noteElement.ele('duration').txt(`${beatDurationTicks}`).up();
            noteElement.ele('voice').txt('1').up();
          }
        } else {
          noteElement.ele('rest').up();
          noteElement.ele('duration').txt(`${beatDurationTicks}`).up();
          noteElement.ele('voice').txt('1').up();
        }
        noteElement.up();
      });
    }
    previousMeasureLastNotes = { ...currentMeasureVoicing };
    Object.values(currentMeasureBuilders).forEach((mb) => mb.up());
  }
  Object.values(partBuilders).forEach((pb) => pb.up());
  console.log('Generation complete. Returning MusicXML string.');
  const xmlString = root.end({ prettyPrint: true });
  return xmlString;
}

// --- Optional: Example Usage (for testing in Node.js) ---
/*
import * as fs from 'fs';

try {
    const key = "Fm"; // Test minor key
    const measures = 12;
    const complexity = 7;
    const smoothness = 6;
    const strictness = 4;
    const meter = "4/4";

    console.log(`Generating ${measures} measures in ${key} ${meter}, complexity ${complexity}...`);

    const progression = generateChordProgression(key, measures, complexity);
    const settings: GenerationSettings = { melodicSmoothness: smoothness, dissonanceStrictness: strictness };

    const xmlOutput = generateVoices(progression, key, meter, measures, settings);

    console.log("\n--- Generated MusicXML ---");
    // console.log(xmlOutput); // Uncomment to log XML to console

    fs.writeFileSync('generated_chorale_consolidated.musicxml', xmlOutput);
    console.log("Saved to generated_chorale_consolidated.musicxml");

} catch (error) {
    console.error("\n--- ERROR DURING GENERATION ---");
    if (error instanceof Error) {
        console.error(error.message);
        console.error(error.stack);
    } else {
        console.error(error);
    }
}
*/
