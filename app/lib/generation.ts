// src/generation.ts
// Description:
// Consolidated logic for generating chord progressions and music.
// Supports generating SATB chorales or Melody + Accompaniment style music.
// Outputs MusicXML for Grand Staff with shared stems within each staff.

// --- Library Imports ---
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces'; // Optional: For type hints

// --- Configuration Constants ---

/** Defines the standard order of voices from highest to lowest for SATB. */
type VoiceNameSATB = 'soprano' | 'alto' | 'tenor' | 'bass';
const VOICE_ORDER_SATB: ReadonlyArray<VoiceNameSATB> = [
  'soprano',
  'alto',
  'tenor',
  'bass',
];

/** Standard MIDI note ranges for SATB voices. Also used for Melody/Accompaniment ranges. */
const VOICE_RANGES: Readonly<
  Record<VoiceNameSATB | 'melody' | 'accompaniment', [number, number]>
> = {
  soprano: [60, 81], // C4 to A5
  alto: [55, 74], // G3 to D5
  // Ranges for Melody + Accompaniment Style
  melody: [60, 84], // C4 to C6 - Slightly wider range for melody
  accompaniment: [36, 72], // C2 to C5 - Typical keyboard accompaniment range
  tenor: [48, 69], // C3 to A4
/** Maximum interval allowed between adjacent upper voices (SATB). */
const VOICE_SPACING_LIMIT_SATB = {

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

// --- Tonal & MusicXML Helper Functions ---

/**
 * Gets the MIDI notes of a chord based on its Roman numeral in a given key.
 * @param roman - Roman numeral symbol (e.g., "V7", "ii", "IV").
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Array of MIDI note numbers for the chord, or empty if error.
 */
function getChordNotesFromRoman(roman: string, keyName: string): number[] {
  try {
    const keyDetails =
      Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
    if (!keyDetails || !keyDetails.chords || !keyDetails.chordScales) {
      console.warn(
        `Could not get valid key details for key "${keyName}". Roman: "${roman}"`,
      );
      return [];
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type;

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

    const diatonicChords = keyDetails.chords;
    if (scaleDegreeIndex >= diatonicChords.length) {
      console.warn(
        `Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}".`,
      );
      return [];
    }

    let chordSymbol = diatonicChords[scaleDegreeIndex];

    if (roman.includes('7') && !chordSymbol.includes('7')) {
      const seventhChordSymbol = chordSymbol + '7';
      const chordInfo = Tonal.Chord.get(seventhChordSymbol);
      if (!chordInfo.empty) {
        chordSymbol = seventhChordSymbol;
      } else {
        console.warn(
          `Input "${roman}" requested 7th, but "${seventhChordSymbol}" invalid. Using "${chordSymbol}".`,
        );
      }
    }
    // TODO: Add more detailed parsing for dim, aug, other extensions if needed

    const chord = Tonal.Chord.get(chordSymbol);
    if (!chord || chord.empty || !chord.notes || chord.notes.length === 0) {
      console.warn(
        `Could not get notes for chord symbol "${chordSymbol}" (from "${roman}" in "${keyName}").`,
      );
      return [];
    }

    if (!chord.tonic) {
      console.warn(`Chord symbol "${chordSymbol}" has no valid tonic.`);
      return [];
    }
    const rootNoteDetails = Tonal.Note.get(chord.tonic);
    const rootOctaveGuess =
      rootNoteDetails.letter === 'A' || rootNoteDetails.letter === 'B' ? 3 : 4;
    const rootMidiGuess = Tonal.Note.midi(
      rootNoteDetails.letter + rootNoteDetails.acc + rootOctaveGuess,
    );

    if (rootMidiGuess === null) {
      console.warn(`Could not determine root MIDI for chord "${chordSymbol}".`);
      return [];
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidiGuess);
    if (!rootNoteName) {
      console.warn(`Could not get note name from root MIDI ${rootMidiGuess}.`);
      return [];
    }

    return chord.intervals
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
      .filter((midi): midi is number => midi !== null); // Type guard ensures number[] return
  } catch (error) {
    console.error(
      `Error getting chord notes for Roman "${roman}" in key "${keyName}":`,
      error,
    );
    return [];
  }
}

/**
 * Creates an extended pool of MIDI notes for a chord across multiple octaves.
 * @param baseChordNotes - Array of MIDI notes for the chord in one octave.
 * @returns Array of MIDI notes spanning relevant octaves.
 */
function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
  const pool: Set<number> = new Set();
  if (!baseChordNotes || baseChordNotes.length === 0) return [];

  [-2, -1, 0, 1, 2].forEach((octaveOffset) => {
    baseChordNotes.forEach((midi) => {
      if (midi !== null) {
        const note = midi + octaveOffset * 12;
        // Filter within reasonable piano range (A0 to C8)
        if (note >= 21 && note <= 108) {
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
function midiToNoteName(midi: number | null): string | null {
  if (midi === null || midi < 0 || midi > 127) return null;
  try {
    return Tonal.Note.fromMidi(midi);
  } catch {
    return null;
  }
}

/**
 * Converts a MIDI number to a MusicXML Pitch object.
 * @param midi - MIDI note number.
 * @returns MusicXMLPitch object or null if invalid.
 */
function midiToMusicXMLPitch(midi: number): MusicXMLPitch | null {
  const noteName = midiToNoteName(midi);
  if (!noteName) return null;

  try {
    const noteDetails = Tonal.Note.get(noteName);
    if (
      !noteDetails.pc ||
      noteDetails.oct === undefined ||
      noteDetails.oct === null ||
      !noteDetails.letter
    ) {
      console.warn(
        `Could not get complete Tonal details for note: ${noteName} (MIDI: ${midi})`,
      );
      return null;
    }

    const step = noteDetails.letter;
    const alterMap: Record<string, number> = {
      '##': 2,
      '#': 1,
      '': 0,
      b: -1,
      bb: -2,
    };
    const alterNum = alterMap[noteDetails.acc] ?? 0;
    const octave = noteDetails.oct;

    const musicXmlAlter = alterNum === 0 ? undefined : alterNum;

    return { step, alter: musicXmlAlter, octave };
  } catch (error) {
    console.error(
      `Error getting MusicXML details for note "${noteName}" (MIDI: ${midi}):`,
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
    default:
      console.warn(
        `Unsupported beat value ${beatValue}, defaulting to 'quarter'.`,
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
  if (!allowedNotes || allowedNotes.length === 0) {
    // If no notes allowed, maybe return previous? Or null? Returning null is safer.
    return null; // Changed from returning previousNoteMidi
  }
  if (allowedNotes.length === 1) {
    return allowedNotes[0];
  }

  let bestNote: number = allowedNotes[0];
  let minScore: number = Infinity;

  allowedNotes.forEach((note) => {
    // Primary score: closeness to target
    let score = Math.abs(note - targetMidi);

    // Modify score based on previous note and smoothness preference
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);
      const smoothnessWeight = smoothnessPref / 10.0; // Normalize 0-1

      // Penalize leaps based on smoothness preference
      if (interval === 0) {
        // Penalize staying same slightly less if smoothness is high
        score *= 0.1 * (1.1 - smoothnessWeight);
      } else if (interval <= 2) {
        // Stepwise motion bonus, higher bonus if smoothness high
        score *= 0.5 * (1.1 - smoothnessWeight);
      } else if (interval <= avoidLeapThreshold) {
        // Moderate leaps penalty (increases w/ smoothness)
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.5);
      } else {
        // Larger leaps penalty (increases more w/ smoothness)
        score *= 1.5 + (interval / 12.0) * smoothnessWeight;
      }
    }

    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });

  // Optional: Re-evaluate if the chosen best note creates a large leap, prefer stepwise if close
  if (
    previousNoteMidi !== null &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    const stepNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi!) <= 2,
    );
    if (stepNotes.length > 0) {
      // Find the best step note based on closeness to target
      let bestStepNote = stepNotes[0];
      let minStepTargetScore = Math.abs(bestStepNote - targetMidi);
      stepNotes.forEach((stepNote) => {
        let stepTargetScore = Math.abs(stepNote - targetMidi);
        if (stepTargetScore < minStepTargetScore) {
          minStepTargetScore = stepTargetScore;
          bestStepNote = stepNote;
        }
      });

      // If the best stepwise note isn't drastically worse than the leaping note (target-wise), prefer it.
      const LEAP_PREFERENCE_FACTOR = 1.5 + smoothnessPref / 10.0; // Higher smoothness makes leaps less preferable
      if (minStepTargetScore < minScore * LEAP_PREFERENCE_FACTOR) {
        // console.log(`  Overriding leap (${midiToNoteName(bestNote)}) with step (${midiToNoteName(bestStepNote)}) due to smoothness.`); // Debug
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
  const [minRange, maxRange] = VOICE_RANGES.bass;
  const allowedBassNotes = chordNotesPool.filter(
    (n) => n >= minRange && n <= maxRange,
  );

  if (allowedBassNotes.length === 0) {
    console.warn('No valid bass notes found in range.');
    // Try extending range slightly? Or return null. Returning null is safer.
    return null;
  }

  // Prioritize root note if available in range
  const rootNotePc = chordRootMidi % 12;
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);

  // Target slightly below previous note or root - 1 octave if no previous
  const targetMidi =
    previousBassMidi !== null ? previousBassMidi - 1 : chordRootMidi - 12;

  if (rootOptions.length > 0) {
    return findClosestNote(
      targetMidi,
      rootOptions,
      previousBassMidi,
      smoothness,
    );
  } else {
    // If root not available, choose the best available note
    console.log(
      `Root note (${Tonal.Note.pitchClass(Tonal.Note.fromMidi(chordRootMidi) ?? '')}) not available in bass range. Choosing best alternative.`,
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
  const [minRange, maxRange] = VOICE_RANGES.soprano;
  const allowedSopranoNotes = fullChordNotePool.filter(
    (n) => n >= minRange && n <= maxRange,
  );

  if (allowedSopranoNotes.length === 0) {
    console.warn('No valid soprano notes found in range.');
    return null;
  }

  // Target slightly above previous note, or middle of range if no previous
  const targetMidi =
    previousSopranoMidi !== null
      ? previousSopranoMidi + 1
      : (minRange + maxRange) / 2;

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
  if (sopranoNoteMidi === null || bassNoteMidi === null) {
    console.warn('Cannot assign inner voices without valid soprano and bass.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  const [altoMin, altoMax] = VOICE_RANGES.alto;
  const [tenorMin, tenorMax] = VOICE_RANGES.tenor;

  // --- Assign Alto First ---
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= altoMin &&
      n <= altoMax &&
      n < sopranoNoteMidi && // Must be below Soprano
      n > bassNoteMidi && // Must be above Bass
      sopranoNoteMidi - n <= VOICE_SPACING_LIMIT.soprano_alto, // Check spacing with Soprano
  );

  let altoNoteMidi: number | null = null;
  // Target near previous, or midway between S/B
  const altoTargetMidi =
    previousAltoMidi !== null
      ? previousAltoMidi
      : (sopranoNoteMidi + bassNoteMidi) / 2;

  // Prioritize the target pitch class if available
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

  // If target PC didn't work or wasn't available, find the best overall option
  if (altoNoteMidi === null) {
    if (allowedAltoNotes.length === 0) {
      console.warn(
        'No valid notes for Alto in range/spacing. Cannot assign Alto.',
      );
      // Could try relaxing constraints slightly or return null
      // Returning null for now
    } else {
      altoNoteMidi = findClosestNote(
        altoTargetMidi,
        allowedAltoNotes,
        previousAltoMidi,
        smoothness,
      );
    }
  }

  // If still no Alto note found, we can't proceed reliably for Tenor
  if (altoNoteMidi === null) {
    console.error(
      'Failed to find any suitable note for Alto after all checks.',
    );
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  // --- Assign Tenor Second ---
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= tenorMin &&
      n <= tenorMax &&
      n < altoNoteMidi! && // Must be below assigned Alto
      n > bassNoteMidi && // Must be above Bass
      altoNoteMidi! - n <= VOICE_SPACING_LIMIT.alto_tenor && // Check spacing with Alto
      n - bassNoteMidi <= VOICE_SPACING_LIMIT.tenor_bass, // Check spacing with Bass
  );

  let tenorNoteMidi: number | null = null;
  const tenorTargetMidi =
    previousTenorMidi !== null
      ? previousTenorMidi
      : (altoNoteMidi + bassNoteMidi) / 2;

  // Prioritize the target pitch class
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

  // If target PC didn't work or wasn't available, find best overall
  if (tenorNoteMidi === null) {
    if (allowedTenorNotes.length === 0) {
      console.warn(
        'No valid notes for Tenor below Alto / within spacing. Cannot assign Tenor.',
      );
      // Return the valid Alto, but null Tenor
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

  // Final check if Tenor assignment failed
  if (tenorNoteMidi === null) {
    console.error(
      'Failed to find any suitable note for Tenor after all checks.',
    );
    return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi }; // Return valid Alto
  }

  // Sanity check: Tenor should not be >= Alto (should be prevented by filter, but check anyway)
  if (tenorNoteMidi >= altoNoteMidi) {
    console.warn(
      `INTERNAL ERROR: Tenor (${midiToNoteName(tenorNoteMidi)}) >= Alto (${midiToNoteName(altoNoteMidi)}). Attempting fallback.`,
    );
    // Try forcing selection from notes strictly below Alto again
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
      if (tenorNoteMidi === null) tenorNoteMidi = lowerTenorOptions[0]; // Just pick one if findClosest fails
    } else {
      // No options left, this indicates a significant problem earlier
      console.error(
        'Fallback correction for Tenor failed - no notes below Alto available.',
      );
      tenorNoteMidi = null; // Set tenor to null as it's invalid
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
  beatIndex: number, // 0-based beat index
): void {
  if (
    voice1Prev === null ||
    voice1Curr === null ||
    voice2Prev === null ||
    voice2Curr === null
  )
    return;

  // Only check if both voices moved
  const voice1Moved = voice1Prev !== voice1Curr;
  const voice2Moved = voice2Prev !== voice2Curr;
  if (!voice1Moved || !voice2Moved) return;

  // Get note names for interval calculation
  const note1PrevName = midiToNoteName(voice1Prev);
  const note1CurrName = midiToNoteName(voice1Curr);
  const note2PrevName = midiToNoteName(voice2Prev);
  const note2CurrName = midiToNoteName(voice2Curr);
  if (!note1PrevName || !note1CurrName || !note2PrevName || !note2CurrName)
    return; // Skip if conversion failed

  try {
    const intervalPrev = Tonal.Interval.distance(note2PrevName, note1PrevName); // Use distance for directed interval
    const intervalCurr = Tonal.Interval.distance(note2CurrName, note1CurrName);

    // Simplify to check basic interval type (octave, fifth)
    const simplePrev = Tonal.Interval.simplify(intervalPrev);
    const simpleCurr = Tonal.Interval.simplify(intervalCurr);

    // Check for Perfect 5ths (P5)
    if (
      (simplePrev === 'P5' || simplePrev === 'P-5') &&
      (simpleCurr === 'P5' || simpleCurr === 'P-5')
    ) {
      console.warn(
        `PARALLEL 5th (${part1Name}/${part2Name}) at M${measureIndex + 1}:B${beatIndex + 1}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    }
    // Check for Perfect Octaves/Unisons (P1, P8)
    else if (
      (simplePrev === 'P1' || simplePrev === 'P8' || simplePrev === 'P-8') &&
      (simpleCurr === 'P1' || simpleCurr === 'P8' || simpleCurr === 'P-8')
    ) {
      console.warn(
        `PARALLEL Octave/Unison (${part1Name}/${part2Name}) at M${measureIndex + 1}:B${beatIndex + 1}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    }
  } catch (error) {
    // Tonal might throw errors on unusual intervals or edge cases
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
  beatIndex: number, // 0-based beat index within measure
): void {
  const { soprano, alto, tenor, bass } = currentNotes;
  const prev = previousNotes;
  const loc = `M${measureIndex + 1}:B${beatIndex + 1}`;

  // Basic checks require all notes to be present
  if (soprano === null || alto === null || tenor === null || bass === null) {
    // console.log(`Skipping full rule check at ${loc} due to missing notes.`); // Optional debug
    return;
  }

  // Voice Crossing
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

  // Voice Spacing (Absolute difference in MIDI)
  if (Math.abs(soprano - alto) > VOICE_SPACING_LIMIT.soprano_alto)
    console.warn(`Spacing > P8 between Soprano/Alto at ${loc}`);
  if (Math.abs(alto - tenor) > VOICE_SPACING_LIMIT.alto_tenor)
    console.warn(`Spacing > P8 between Alto/Tenor at ${loc}`);
  if (Math.abs(tenor - bass) > VOICE_SPACING_LIMIT.tenor_bass)
    console.warn(`Spacing > P12 between Tenor/Bass at ${loc}`);

  // Parallel Motion Checks (Requires previous notes)
  if (
    prev &&
    prev.soprano !== null &&
    prev.alto !== null &&
    prev.tenor !== null &&
    prev.bass !== null
  ) {
    // Check all pairs
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
  if (numMeasures <= 0) return [];

  let currentKey = key;
  const keyDetails =
    Tonal.Key.majorKey(currentKey) || Tonal.Key.minorKey(currentKey);
  if (!keyDetails) {
    console.error(`Invalid key "${key}". Defaulting to "C".`);
    currentKey = 'C';
    return generateChordProgression(
      currentKey,
      numMeasures,
      harmonicComplexity,
    ); // Recurse with default
  }

  const isMajor = keyDetails.type === 'major';
  const tonicRoman = isMajor ? 'I' : 'i';
  const dominantRoman = 'V';
  const dominant7Roman = 'V7'; // Always major V7 for standard cadences
  const subdominantRoman = isMajor ? 'IV' : 'iv';
  const supertonicRoman = isMajor ? 'ii' : 'ii°'; // ii in major, ii° in minor
  const mediantRoman = isMajor ? 'iii' : 'III'; // iii in major, III in minor
  const submediantRoman = isMajor ? 'vi' : 'VI'; // vi in major, VI in minor
  const leadingToneRoman = 'vii°'; // Fully diminished in both major and minor typically

  // Define chord pools based on complexity
  const primaryChords = [tonicRoman, subdominantRoman, dominantRoman];
  const secondaryChords = [submediantRoman, supertonicRoman];
  const complexChords = [mediantRoman, leadingToneRoman]; // III/iii can be complex

  let allowedChords = [...primaryChords];
  if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
  if (harmonicComplexity >= 7) allowedChords.push(...complexChords);

  // Add V7 based on complexity
  if (harmonicComplexity >= 5) {
    if (allowedChords.includes(dominantRoman)) {
      // Replace V with V7 if V exists
      allowedChords = allowedChords.map((c) =>
        c === dominantRoman ? dominant7Roman : c,
      );
    } else if (!allowedChords.includes(dominant7Roman)) {
      // Add V7 if V wasn't included initially
      allowedChords.push(dominant7Roman);
    }
  }

  // Ensure unique chords
  allowedChords = Array.from(new Set(allowedChords));
  if (allowedChords.length === 0) {
    console.error('No allowed chords generated. Defaulting to tonic.');
    allowedChords = [tonicRoman];
  }

  let progression: string[] = [tonicRoman]; // Start on tonic
  let prevChord = tonicRoman;
  const MAX_ATTEMPTS = 5; // Prevent infinite loops if choices are limited

  for (let i = 1; i < numMeasures - 1; i++) {
    // Generate intermediate chords
    let nextChord: string | undefined = undefined;
    let attempts = 0;

    do {
      let candidates = [...allowedChords];

      // Basic Tonal Motion Rules (can be expanded)
      if ([subdominantRoman, supertonicRoman].includes(prevChord)) {
        // Pre-dominant -> Dominant tendency
        const dominantCandidates = candidates.filter((c) =>
          [dominantRoman, dominant7Roman, leadingToneRoman].includes(c),
        );
        if (dominantCandidates.length > 0) candidates = dominantCandidates;
      } else if (
        [dominantRoman, dominant7Roman, leadingToneRoman].includes(prevChord)
      ) {
        // Dominant -> Tonic tendency
        const tonicResolutionCandidates = candidates.filter((c) =>
          [tonicRoman, submediantRoman].includes(c),
        ); // Allow deceptive cadence vi/VI
        if (tonicResolutionCandidates.length > 0)
          candidates = tonicResolutionCandidates;
      } else if (prevChord === submediantRoman) {
        // Submediant often moves to pre-dominant or dominant
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
      // Add more rules (e.g., avoid iii-IV, root movements) if desired

      if (candidates.length === 0) candidates = allowedChords; // Fallback if rules are too strict

      // Select random candidate, avoid repeating previous chord if possible
      const potentialNext =
        candidates[Math.floor(Math.random() * candidates.length)];
      if (potentialNext !== prevChord || allowedChords.length === 1) {
        nextChord = potentialNext;
      }
      attempts++;
    } while (nextChord === undefined && attempts < MAX_ATTEMPTS);

    // If still no chord found (e.g., only one allowed chord), use it or fallback
    if (nextChord === undefined) {
      nextChord =
        allowedChords.find((c) => c !== prevChord) ?? allowedChords[0]; // Try not to repeat, else just pick first
      console.warn(
        `Could not find distinct next chord from ${prevChord}, using ${nextChord}`,
      );
    }

    progression.push(nextChord);
    prevChord = nextChord;
  }

  // --- Cadence ---
  if (numMeasures > 1) {
    // Standard Authentic Cadence: V(7)-I or V(7)-i
    const preCadenceChord = allowedChords.includes(dominant7Roman)
      ? dominant7Roman
      : allowedChords.includes(dominantRoman)
        ? dominantRoman
        : tonicRoman; // Prefer V7, then V, else I/i
    if (numMeasures === 2) {
      progression[1] = tonicRoman; // Simple I-I or i-i for 2 measures if V not available
    } else {
      progression[numMeasures - 2] = preCadenceChord; // Penultimate chord
      progression[numMeasures - 1] = tonicRoman; // Final chord is tonic
    }
  } else if (numMeasures === 1) {
    progression[0] = tonicRoman; // Single measure is just tonic
  }

  console.log(
    `Generated Progression (${currentKey}, complexity ${harmonicComplexity}):`,
    progression.join(' - '),
  );
  return progression;
}

/**
 * Generates the four-part voice data as a MusicXML string using xmlbuilder2,
 * formatted for a single Grand Staff (Treble + Bass clefs) with shared stems
 * for simultaneous notes on each staff.
 * @param chordProgression - Array of Roman numeral chord symbols.
 * @param keySignature - The key signature (e.g., "C", "Gm").
 * @param meter - The time signature (e.g., "4/4").
 * @param numMeasures - The number of measures to generate (should match chordProgression length).
 * @param generationSettings - Generation parameters.
 * @returns {string} A MusicXML string representing the generated piece on a grand staff.
 * @throws {Error} If the key or meter is invalid or fundamental errors occur.
 */
export function generateVoices(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): string {
  const { melodicSmoothness, dissonanceStrictness } = generationSettings;

  // --- Key, Meter Validation ---
  const keyDetails =
    Tonal.Key.majorKey(keySignature) || Tonal.Key.minorKey(keySignature);
  if (!keyDetails) throw new Error('Invalid key signature: ' + keySignature);
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
    throw new Error('Unsupported beat value: ' + beatValue);
  if (meterBeats <= 0) throw new Error('Meter beats must be positive.');

  // --- MusicXML Document Setup ---
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });

  root
    .ele('work')
    .ele('work-title')
    .txt('Generated Chorale (Grand Staff, Shared Stems)')
    .up()
    .up();
  const identification = root.ele('identification');
  identification
    .ele('encoding')
    .ele('software')
    .txt('AI Music Generator (Consolidated)')
    .up()
    .ele('encoding-date')
    .txt(new Date().toISOString().split('T')[0])
    .up() // Use current date
    .up();
  identification.up();

  // --- Part List (Single Part for Grand Staff) ---
  const partList = root.ele('part-list');
  partList
    .ele('score-part', { id: 'P1' })
    .ele('part-name')
    .txt('Choral')
    .up() // Or Piano, Keyboard etc.
    .ele('score-instrument', { id: 'P1-I1' })
    .ele('instrument-name')
    .txt('Keyboard')
    .up()
    .up() // Optional instrument association
    .up();
  partList.up();

  // --- Part Element ---
  const partBuilder = root.ele('part', { id: 'P1' });

  // --- Voicing State & XML Parameters ---
  let previousMeasureLastNotes: PreviousNotes = {
    soprano: null,
    alto: null,
    tenor: null,
    bass: null,
  };
  const divisions = 4; // Standard divisions per quarter note
  const beatDurationTicks = divisions * (4 / beatValue); // Duration of one beat in XML divisions
  const musicXmlBeatType = getMusicXMLDurationType(beatValue); // e.g., "quarter"
  const leadingToneMidiPc =
    Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE) !== null
      ? (Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE)! +
          (Tonal.Interval.semitones('M7') ?? 11)) %
        12
      : -1; // Calculate leading tone PC once

  // --- Generate Measures ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const roman = chordProgression[measureIndex];
    console.log(`--- Measure ${measureIndex + 1}: Chord ${roman} ---`); // Log progress
    const baseChordNotes = getChordNotesFromRoman(roman, keySignature);

    const measureBuilder = partBuilder.ele('measure', {
      number: `${measureIndex + 1}`,
    });

    // --- Add Attributes in First Measure ---
    if (measureIndex === 0) {
      const attributes = measureBuilder.ele('attributes');
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
      attributes.ele('staves').txt('2').up(); // Define two staves
      // Clef for Staff 1 (Treble)
      attributes
        .ele('clef', { number: '1' })
        .ele('sign')
        .txt('G')
        .up()
        .ele('line')
        .txt('2')
        .up()
        .up();
      // Clef for Staff 2 (Bass)
      attributes
        .ele('clef', { number: '2' })
        .ele('sign')
        .txt('F')
        .up()
        .ele('line')
        .txt('4')
        .up()
        .up();
      attributes.up(); // Close attributes
    }

    // --- Handle Chord Errors (Add Rests) ---
    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}" in ${keySignature}. Adding rests.`,
      );
      for (let beat = 0; beat < meterBeats; beat++) {
        // Staff 1 Rest (Voice 1)
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${beatDurationTicks}`)
          .up()
          .ele('voice')
          .txt('1')
          .up()
          .ele('staff')
          .txt('1')
          .up()
          .up();
        // Staff 2 Rest (Voice 2)
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${beatDurationTicks}`)
          .up()
          .ele('voice')
          .txt('2')
          .up()
          .ele('staff')
          .txt('2')
          .up()
          .up();
      }
      previousMeasureLastNotes = {
        soprano: null,
        alto: null,
        tenor: null,
        bass: null,
      };
      measureBuilder.up();
      continue;
    }

    // --- Calculate Voicing ---
    const chordRootMidi = baseChordNotes[0];
    const chordPcs = baseChordNotes.map((n) => n % 12);
    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);

    // Assign outer voices first
    const sopranoNoteMidi = assignSopranoNote(
      fullChordNotePool,
      previousMeasureLastNotes.soprano,
      melodicSmoothness,
    );
    const bassNoteMidi = assignBassNote(
      chordRootMidi,
      fullChordNotePool,
      previousMeasureLastNotes.bass,
      melodicSmoothness,
    );

    // Determine needed pitch classes and doubling for inner voices
    let currentVoicingPcs = new Set<number>();
    if (bassNoteMidi !== null) currentVoicingPcs.add(bassNoteMidi % 12);
    if (sopranoNoteMidi !== null) currentVoicingPcs.add(sopranoNoteMidi % 12);
    let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
    let pcsToDouble: number[] = [];
    const voicesToFill = 2; // Alto and Tenor

    if (neededPcs.length < voicesToFill) {
      const numDoublingsNeeded = voicesToFill - neededPcs.length;
      const canDoubleRoot = chordRootMidi % 12 !== leadingToneMidiPc;
      // Prioritize doubling root
      if (
        canDoubleRoot &&
        pcsToDouble.length < numDoublingsNeeded &&
        !neededPcs.includes(chordRootMidi % 12)
      ) {
        pcsToDouble.push(chordRootMidi % 12);
      }
      // Then fifth (if not leading tone)
      const fifthMidi = Tonal.Note.midi(
        Tonal.Note.transpose(Tonal.Note.fromMidi(chordRootMidi) ?? '', 'P5'),
      );
      const fifthPc = fifthMidi !== null ? fifthMidi % 12 : -1;
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        fifthPc !== -1 &&
        chordPcs.includes(fifthPc) &&
        fifthPc !== leadingToneMidiPc &&
        !neededPcs.includes(fifthPc) &&
        !pcsToDouble.includes(fifthPc)
      ) {
        pcsToDouble.push(fifthPc);
      }
      // Then third (if not leading tone)
      const thirdPc = chordPcs.find(
        (pc) => pc !== chordRootMidi % 12 && pc !== fifthPc,
      );
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        thirdPc !== undefined &&
        thirdPc !== leadingToneMidiPc &&
        !neededPcs.includes(thirdPc) &&
        !pcsToDouble.includes(thirdPc)
      ) {
        pcsToDouble.push(thirdPc);
      }
      // Fallback doubling (usually root again)
      while (pcsToDouble.length < numDoublingsNeeded) {
        if (canDoubleRoot) pcsToDouble.push(chordRootMidi % 12);
        else if (
          fifthPc !== -1 &&
          chordPcs.includes(fifthPc) &&
          fifthPc !== leadingToneMidiPc
        )
          pcsToDouble.push(fifthPc); // Allow multiple 5th doublings if root is LT
        else {
          // Emergency: double anything available that isn't LT
          const fallbackPc =
            chordPcs.find((pc) => pc !== leadingToneMidiPc) ??
            chordRootMidi % 12;
          pcsToDouble.push(fallbackPc);
        }
        if (pcsToDouble.length > 10) break; // Safety break
      }
    }

    let targetInnerPcs = [...neededPcs, ...pcsToDouble].slice(0, voicesToFill);
    while (targetInnerPcs.length < voicesToFill) {
      // Ensure exactly two targets
      const fallbackPc =
        chordPcs.find((pc) => pc !== leadingToneMidiPc) ?? chordRootMidi % 12;
      targetInnerPcs.push(fallbackPc);
    }
    // Simple assignment: let assignInnerVoices handle placement based on previous notes and range
    const tenorTargetPc = targetInnerPcs[0];
    const altoTargetPc = targetInnerPcs[1];

    // Assign inner voices
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
    console.log(
      `   Voicing MIDI: S=${sopranoNoteMidi} A=${altoNoteMidi} T=${tenorNoteMidi} B=${bassNoteMidi}`,
    );

    // Check Voice Leading Rules
    if (dissonanceStrictness > 3) {
      checkVoiceLeadingRules(
        currentMeasureVoicing,
        previousMeasureLastNotes,
        measureIndex,
        0,
      ); // Check at start of measure
    }

    // --- Add Notes/Rests to Measure using Shared Stem Logic ---
    for (let beat = 0; beat < meterBeats; beat++) {
      const sopMidi = currentMeasureVoicing.soprano;
      const altMidi = currentMeasureVoicing.alto;
      const tenMidi = currentMeasureVoicing.tenor;
      const basMidi = currentMeasureVoicing.bass;

      let staff1HasNote = false; // Track if the first note of the chord is added
      let staff2HasNote = false;

      // --- Staff 1: Soprano (Primary) & Alto (Chord) ---
      const staff1Voice = '1';
      const staff1Staff = '1';
      let staff1Stem = sopMidi !== null && sopMidi >= 71 ? 'down' : 'up'; // Default up, down if S is high
      if (sopMidi === null && altMidi !== null) {
        staff1Stem = altMidi >= 71 ? 'down' : 'up';
      } // Stem based on A if S absent

      // Add Soprano Note (if exists)
      if (sopMidi !== null) {
        const pitch = midiToMusicXMLPitch(sopMidi);
        if (pitch) {
          const note = measureBuilder.ele('note');
          const pitchEl = note.ele('pitch');
          pitchEl.ele('step').txt(pitch.step).up();
          if (pitch.alter !== undefined)
            pitchEl.ele('alter').txt(`${pitch.alter}`).up();
          pitchEl.ele('octave').txt(`${pitch.octave}`).up();
          pitchEl.up(); // pitch

          note.ele('duration').txt(`${beatDurationTicks}`).up(); // Duration on first note
          note.ele('voice').txt(staff1Voice).up();
          note.ele('type').txt(musicXmlBeatType).up(); // Type on first note
          note.ele('stem').txt(staff1Stem).up();
          note.ele('staff').txt(staff1Staff).up();
          note.up(); // note
          staff1HasNote = true;
        }
      }

      // Add Alto Note (if exists)
      if (altMidi !== null) {
        const pitch = midiToMusicXMLPitch(altMidi);
        if (pitch) {
          const note = measureBuilder.ele('note');
          if (!staff1HasNote) {
            // If S was null, A gets duration/type
            note.ele('duration').txt(`${beatDurationTicks}`).up();
            note.ele('type').txt(musicXmlBeatType).up();
            staff1HasNote = true;
          } else {
            // Otherwise, it's part of the chord
            note.ele('chord').up();
          }
          const pitchEl = note.ele('pitch');
          pitchEl.ele('step').txt(pitch.step).up();
          if (pitch.alter !== undefined)
            pitchEl.ele('alter').txt(`${pitch.alter}`).up();
          pitchEl.ele('octave').txt(`${pitch.octave}`).up();
          pitchEl.up(); // pitch

          note.ele('voice').txt(staff1Voice).up(); // Same voice
          note.ele('stem').txt(staff1Stem).up(); // Same stem
          note.ele('staff').txt(staff1Staff).up();
          note.up(); // note
        }
      }

      // Add Rest to Staff 1 if no notes were added
      if (!staff1HasNote) {
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${beatDurationTicks}`)
          .up()
          .ele('voice')
          .txt(staff1Voice)
          .up()
          .ele('type')
          .txt(musicXmlBeatType)
          .up()
          .ele('staff')
          .txt(staff1Staff)
          .up()
          .up();
      }

      // --- Staff 2: Tenor (Primary) & Bass (Chord) ---
      const staff2Voice = '2';
      const staff2Staff = '2';
      let staff2Stem = tenMidi !== null && tenMidi <= 55 ? 'up' : 'down'; // Default down, up if T is low
      if (tenMidi === null && basMidi !== null) {
        staff2Stem = basMidi <= 55 ? 'up' : 'down';
      } // Stem based on B if T absent

      // Add Tenor Note (if exists)
      if (tenMidi !== null) {
        const pitch = midiToMusicXMLPitch(tenMidi);
        if (pitch) {
          const note = measureBuilder.ele('note');
          const pitchEl = note.ele('pitch');
          pitchEl.ele('step').txt(pitch.step).up();
          if (pitch.alter !== undefined)
            pitchEl.ele('alter').txt(`${pitch.alter}`).up();
          pitchEl.ele('octave').txt(`${pitch.octave}`).up();
          pitchEl.up(); // pitch

          note.ele('duration').txt(`${beatDurationTicks}`).up();
          note.ele('voice').txt(staff2Voice).up();
          note.ele('type').txt(musicXmlBeatType).up();
          note.ele('stem').txt(staff2Stem).up();
          note.ele('staff').txt(staff2Staff).up();
          note.up(); // note
          staff2HasNote = true;
        }
      }

      // Add Bass Note (if exists)
      if (basMidi !== null) {
        const pitch = midiToMusicXMLPitch(basMidi);
        if (pitch) {
          const note = measureBuilder.ele('note');
          if (!staff2HasNote) {
            // If T was null, B gets duration/type
            note.ele('duration').txt(`${beatDurationTicks}`).up();
            note.ele('type').txt(musicXmlBeatType).up();
            staff2HasNote = true;
          } else {
            // Otherwise, it's part of the chord
            note.ele('chord').up();
          }
          const pitchEl = note.ele('pitch');
          pitchEl.ele('step').txt(pitch.step).up();
          if (pitch.alter !== undefined)
            pitchEl.ele('alter').txt(`${pitch.alter}`).up();
          pitchEl.ele('octave').txt(`${pitch.octave}`).up();
          pitchEl.up(); // pitch

          note.ele('voice').txt(staff2Voice).up(); // Same voice
          note.ele('stem').txt(staff2Stem).up(); // Same stem
          note.ele('staff').txt(staff2Staff).up();
          note.up(); // note
        }
      }

      // Add Rest to Staff 2 if no notes were added
      if (!staff2HasNote) {
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${beatDurationTicks}`)
          .up()
          .ele('voice')
          .txt(staff2Voice)
          .up()
          .ele('type')
          .txt(musicXmlBeatType)
          .up()
          .ele('staff')
          .txt(staff2Staff)
          .up()
          .up();
      }
    } // End for each beat

    // Update previous notes for next measure's checks
    previousMeasureLastNotes = { ...currentMeasureVoicing };
    measureBuilder.up(); // Close measure
  } // End for each measure

  partBuilder.up(); // Close part
  console.log('Generation complete. Returning Grand Staff MusicXML string.');
  const xmlString = root.end({ prettyPrint: true });
  return xmlString;
}

// --- Optional: Example Usage (for testing in Node.js) ---

/*
// Save the above code as generation.ts
// Make sure you have installed dependencies: npm install tonal xmlbuilder2
// You might also need types: npm install --save-dev @types/node
// Compile: tsc generation.ts
// Run: node generation.js (or adjust based on your tsconfig/build setup)

import * as fs from 'fs'; // Node.js file system module

try {
    const key = "A"; // Test A Major
    const measures = 10;
    const complexity = 7; // Allow V7 and some secondary chords
    const smoothness = 5; // Moderate smoothness preference
    const strictness = 5; // Check rules, log warnings
    const meter = "4/4";

    console.log(`Generating ${measures}m of ${key} ${meter}, complexity ${complexity}, grand staff shared stems...`);

    const progression = generateChordProgression(key, measures, complexity);
    const settings: GenerationSettings = { melodicSmoothness: smoothness, dissonanceStrictness: strictness };

    const xmlOutput = generateVoices(progression, key, meter, measures, settings);

    // Output to console (optional)
    // console.log("\n--- Generated MusicXML ---");
    // console.log(xmlOutput);

    // Save to file
    const filename = 'generated_chorale_complete.musicxml';
    fs.writeFileSync(filename, xmlOutput);
    console.log(`MusicXML saved to ${filename}`);

} catch (error) {
    console.error("\n--- ERROR DURING GENERATION ---");
    if (error instanceof Error) {
        console.error(error.message);
        if(error.stack) console.error(error.stack);
    } else {
        console.error(error);
    }
}
*/
