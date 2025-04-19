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
  tenor: [48, 69], // C3 to A4
  bass: [40, 62], // E2 to D4
  // Ranges for Melody + Accompaniment Style
  melody: [60, 84], // C4 to C6 - Slightly wider range for melody
  accompaniment: [36, 72], // C2 to C5 - Typical keyboard accompaniment range
};

/** Maximum interval allowed between adjacent upper voices (SATB). */
const VOICE_SPACING_LIMIT_SATB = {
  soprano_alto: 12, // Perfect Octave
  alto_tenor: 12, // Perfect Octave
  tenor_bass: 19, // Perfect Twelfth (Octave + Perfect Fifth)
};

/** Maximum interval allowed between melody and highest accompaniment voice. */
const MELODY_ACCOMPANIMENT_SPACING_LIMIT = 24; // Two Octaves (adjustable)

/** Default octave used when converting pitch classes to notes without explicit octave. */
const DEFAULT_OCTAVE: number = 4;

// --- Type Definitions ---

/** Structure for MusicXML pitch representation */
interface MusicXMLPitch {
  step: string; // C, D, E, F, G, A, B
  alter?: number; // -2, -1, 0, 1, 2 (0 is natural, often omitted)
  octave: number; // Standard octave number
}

/** Structure to hold MIDI notes of the previous beat/measure end for SATB */
interface PreviousNotesSATB {
  soprano: number | null;
  alto: number | null;
  tenor: number | null;
  bass: number | null;
}

/** Structure to hold MIDI notes of the previous beat/measure end for Melody+Accompaniment */
interface PreviousNotesMelodyAccompaniment {
  melody: number | null;
  accompaniment: (number | null)[]; // Array for accompaniment notes
}

/** Settings controlling the generation process */
export interface GenerationSettings {
  melodicSmoothness: number; // Typically 0-10 (higher means smaller leaps preferred)
  dissonanceStrictness: number; // Typically 0-10 (higher means more SATB rules enforced)
  generationStyle: 'SATB' | 'MelodyAccompaniment'; // Choose the output style
  numAccompanimentVoices?: number; // Number of notes in accompaniment chord (default 3)
}

// --- Tonal & MusicXML Helper Functions ---

/**
 * Gets the MIDI notes of a chord based on its Roman numeral in a given key.
 * (Error handling and logging improved)
 * @param roman - Roman numeral symbol (e.g., "V7", "ii", "IV").
 * @param keyName - Key signature (e.g., "C", "Gm").
 * @returns Array of MIDI note numbers for the chord, or empty if error.
 */
function getChordNotesFromRoman(roman: string, keyName: string): number[] {
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
      : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    if (scaleDegreeIndex >= diatonicChords.length) {
      console.warn(
        `Scale degree index ${scaleDegreeIndex} out of bounds for key "${keyName}". Diatonic chords: ${diatonicChords.join(', ')}`,
      );
      return [];
    }

    let chordSymbol = diatonicChords[scaleDegreeIndex];

    // --- Handle Chord Quality and Extensions (Improved) ---
    // Check for explicit quality markers (dim, aug, +, o) - case insensitive
    const qualityMatch = roman.match(/(dim|o|\+|aug)$/i);
    const requestedQuality = qualityMatch
      ? qualityMatch[1].toLowerCase().replace('o', 'dim').replace('+', 'aug')
      : null;

    // Check for 7th
    const requestedSeventh = roman.includes('7');

    // Try to build the correct chord symbol
    const baseChord = Tonal.Chord.get(chordSymbol);
    let finalChordSymbol = chordSymbol;

    // Adjust quality if needed (e.g., V in minor needs to be major)
    if (
      keyType === 'minor' &&
      scaleDegreeIndex === 4 &&
      !baseChord.aliases.includes('major')
    ) {
      // Common practice: V chord in minor is major
      finalChordSymbol =
        Tonal.Chord.get(baseChord.tonic + 'M').symbol || finalChordSymbol;
    }
    // Adjust vii in major (often diminished)
    if (
      keyType === 'major' &&
      scaleDegreeIndex === 6 &&
      !baseChord.aliases.includes('diminished')
    ) {
      finalChordSymbol =
        Tonal.Chord.get(baseChord.tonic + 'dim').symbol || finalChordSymbol;
    }
    // Adjust ii in minor (often diminished)
    if (
      keyType === 'minor' &&
      scaleDegreeIndex === 1 &&
      !baseChord.aliases.includes('diminished')
    ) {
      finalChordSymbol =
        Tonal.Chord.get(baseChord.tonic + 'dim').symbol || finalChordSymbol;
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
      // Handle V7 in minor -> Major chord + m7 interval = Dominant 7th
      let seventhChordSymbol = finalChordSymbol + '7';
      if (keyType === 'minor' && scaleDegreeIndex === 4) {
        // Construct V7 directly (major triad + minor seventh)
        const root = Tonal.Chord.get(finalChordSymbol).tonic;
        if (root) {
          const dom7Symbol = Tonal.Chord.get(root + '7').symbol;
          if (dom7Symbol) seventhChordSymbol = dom7Symbol;
        }
      }

      const chordInfo = Tonal.Chord.get(seventhChordSymbol);
      if (!chordInfo.empty) {
        finalChordSymbol = seventhChordSymbol;
      } else {
        // Fallback if adding '7' creates invalid chord (e.g., "Cdim7" is valid, "C+7" isn't standard)
        // Try dominant 7th explicitly if base was major/aug
        const base = Tonal.Chord.get(finalChordSymbol);
        if (
          base.tonic &&
          (base.type === 'major' || base.type === 'augmented')
        ) {
          const dom7 = Tonal.Chord.get(base.tonic + '7').symbol;
          if (dom7) {
            finalChordSymbol = dom7;
            console.warn(
              `Input "${roman}" requested 7th on "${finalChordSymbol}", interpreting as dominant 7th: "${dom7}".`,
            );
          } else {
            console.warn(
              `Input "${roman}" requested 7th, but "${seventhChordSymbol}" invalid. Using "${finalChordSymbol}".`,
            );
          }
        } else {
          console.warn(
            `Input "${roman}" requested 7th, but "${seventhChordSymbol}" invalid. Using "${finalChordSymbol}".`,
          );
        }
      }
    }
    // TODO: Add more detailed parsing for dim7, half-dim7 (ø7), aug7, etc. if needed

    const chord = Tonal.Chord.get(finalChordSymbol);
    if (!chord || chord.empty || !chord.notes || chord.notes.length === 0) {
      console.warn(
        `Could not get notes for final chord symbol "${finalChordSymbol}" (derived from "${roman}" in "${keyName}").`,
      );
      return [];
    }

    if (!chord.tonic) {
      console.warn(
        `Final chord symbol "${finalChordSymbol}" has no valid tonic.`,
      );
      return [];
    }

    // Use Tonal.Chord.notes which provides pitch classes, then map to MIDI
    const rootNoteDetails = Tonal.Note.get(chord.tonic);
    // Guess root octave more centrally (closer to bass/tenor range start)
    const rootOctaveGuess = ['C', 'D', 'E', 'F', 'G'].includes(
      rootNoteDetails.letter,
    )
      ? 3
      : 2;
    let rootMidi = Tonal.Note.midi(chord.tonic + rootOctaveGuess);

    // If root MIDI is too low (e.g., Gm resulted in G2), try higher octave
    if (rootMidi !== null && rootMidi < 35) {
      rootMidi = Tonal.Note.midi(chord.tonic + (rootOctaveGuess + 1));
    }

    if (rootMidi === null) {
      console.warn(
        `Could not determine root MIDI for chord "${finalChordSymbol}".`,
      );
      return [];
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidi); // Get name like C3, G#4 etc.
    if (!rootNoteName) {
      console.warn(`Could not get note name from root MIDI ${rootMidi}.`);
      return [];
    }

    // Transpose intervals from the calculated root midi note name
    return chord.intervals
      .map((interval) => {
        try {
          // Use Tonal.transpose (works with note names)
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
      `Unexpected error getting chord notes for Roman "${roman}" in key "${keyName}":`,
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

  // Generate notes across a wider octave range relevant for piano/ensemble
  [-2, -1, 0, 1, 2, 3, 4].forEach((octaveOffset) => {
    // Extended range
    baseChordNotes.forEach((midi) => {
      if (midi !== null) {
        const note = midi + octaveOffset * 12;
        // Filter within reasonable piano range (A0 to C8 MIDI 21-108)
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
  if (midi === null || !Number.isInteger(midi) || midi < 0 || midi > 127)
    return null;
  try {
    return Tonal.Note.fromMidi(midi);
  } catch {
    console.warn(`Could not convert MIDI ${midi} to note name.`);
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
    // Tonal.Note.get provides components directly
    const noteDetails = Tonal.Note.get(noteName);
    if (
      !noteDetails ||
      noteDetails.empty || // Check if Tonal could parse it
      !noteDetails.letter || // Ensure letter (step) exists
      noteDetails.oct === undefined ||
      noteDetails.oct === null // Ensure octave exists
    ) {
      console.warn(
        `Could not get complete Tonal details for note: ${noteName} (MIDI: ${midi})`,
        noteDetails,
      );
      return null;
    }

    const step = noteDetails.letter;
    const octave = noteDetails.oct;
    let alterNum: number | undefined = undefined;

    // Map Tonal accidental string ('#', 'b', '##', 'bb') to MusicXML alter number
    switch (noteDetails.acc) {
      case '#':
        alterNum = 1;
        break;
      case 'b':
        alterNum = -1;
        break;
      case '##':
        alterNum = 2;
        break;
      case 'bb':
        alterNum = -2;
        break;
      default:
        alterNum = undefined; // Natural
    }

    return { step, alter: alterNum, octave };
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
    case 32:
      return '32nd'; // Added 32nd
    default:
      console.warn(
        `Unsupported beat value ${beatValue}, defaulting to 'quarter'.`,
      );
      return 'quarter';
  }
}

// --- Internal Voice Leading / Note Selection Helper Functions ---

/**
 * Selects the "best" MIDI note from allowed notes based on target, previous note, and smoothness.
 * Prioritizes stepwise motion if available and smoothness is high.
 * @param targetMidi - The ideal target MIDI note (e.g., based on range center).
 * @param allowedNotes - Array of valid MIDI notes (in range, in chord). MUST be sorted ascending.
 * @param previousNoteMidi - MIDI note of this voice in the previous chord/beat.
 * @param smoothnessPref - Preference for stepwise motion (0-10, higher means more preference).
 * @param avoidLeapThreshold - Interval size (semitones) considered a leap to be penalized. Defaults to Perfect 5th (7).
 * @returns {number | null} The chosen MIDI note, or null if no suitable note.
 */
function findClosestNote(
  targetMidi: number,
  allowedNotes: number[], // Assumed sorted ascending
  previousNoteMidi: number | null,
  smoothnessPref: number,
  avoidLeapThreshold: number = Tonal.Interval.semitones('P5') ?? 7,
): number | null {
  if (!allowedNotes || allowedNotes.length === 0) {
    return null;
  }
  if (allowedNotes.length === 1) {
    return allowedNotes[0];
  }

  let bestNote: number = allowedNotes[0];
  let minScore: number = Infinity;

  // --- Scoring Logic ---
  allowedNotes.forEach((note) => {
    // 1. Base Score: Closeness to the ideal target MIDI
    let score = Math.abs(note - targetMidi);

    // 2. Smoothness Adjustment (if previous note exists)
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);
      const smoothnessWeight = smoothnessPref / 10.0; // Normalize 0-1

      // Penalize leaps based on smoothness preference, reward steps
      if (interval === 0) {
        // Repeated note
        // Slight penalty for static motion, reduced by high smoothness preference
        score *= 0.8 + 0.2 * (1.0 - smoothnessWeight);
      } else if (interval <= 2) {
        // Stepwise motion (half or whole step)
        // Strong bonus for steps, increased by high smoothness preference
        score *= 0.4 * (1.0 - smoothnessWeight * 0.5); // Range 0.4 to 0.2
      } else if (interval <= avoidLeapThreshold) {
        // Small/Medium Leap (e.g., 3rd, 4th, 5th)
        // Moderate penalty, increases with smoothness preference
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.6); // Increases penalty up to 60% based on smoothness
      } else {
        // Large Leap ( > P5)
        // Strong penalty, increases significantly with smoothness preference
        score *= 1.5 + (interval / 12.0) * smoothnessWeight * 1.5; // Base penalty + scales with interval & smoothness
      }
    } else {
      // If no previous note, slightly penalize notes far from the target range center
      // This encourages starting voices in a typical part of their range
      score *= 1.0 + (Math.abs(note - targetMidi) / 24.0) * 0.1; // Small penalty based on distance
    }

    // --- Update Best Note ---
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
    // If scores are *very* close, prefer the one closer to the previous note (tie-breaker for smoothness)
    else if (previousNoteMidi !== null && Math.abs(score - minScore) < 0.1) {
      if (
        Math.abs(note - previousNoteMidi) <
        Math.abs(bestNote - previousNoteMidi)
      ) {
        minScore = score;
        bestNote = note;
      }
    }
  });

  // --- Post-selection Check: Override large leap if a good stepwise option exists? ---
  // This helps enforce smoothness more strongly when a leap was chosen primarily for target proximity.
  if (
    previousNoteMidi !== null &&
    smoothnessPref > 5 && // Only apply strong override if smoothness is important
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    // Find best stepwise option (interval <= 2) based purely on closeness to *target*
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

      // How much "worse" is the step note in terms of target proximity compared to the leap note?
      const targetClosenessFactor =
        minScore > 0
          ? minStepTargetScore / minScore
          : minStepTargetScore > 0
            ? 2.0
            : 1.0;

      // Override leap if the step is not significantly worse (e.g., less than 2x further from target)
      const LEAP_OVERRIDE_THRESHOLD = 1.5 + (10 - smoothnessPref) / 10.0; // Lower threshold (easier override) if smoothness is high (range 1.5 to 2.5)
      if (targetClosenessFactor < LEAP_OVERRIDE_THRESHOLD) {
        // console.log(`  Smoothness Override: Leap ${midiToNoteName(bestNote)} (score ${minScore.toFixed(2)}) replaced by Step ${midiToNoteName(bestStepNote)} (target score ${minStepTargetScore.toFixed(2)}, factor ${targetClosenessFactor.toFixed(2)})`); // Debug
        bestNote = bestStepNote;
      }
    }
  }

  return bestNote;
}

/** Assigns a MIDI note for the Bass voice (SATB context). */
function assignBassNoteSATB(
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
    console.warn('SATB: No valid bass notes found in range.');
    return null;
  }

  const rootNotePc = chordRootMidi % 12;
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);

  // Target slightly below previous note or root's typical octave if no previous
  const targetMidi =
    previousBassMidi !== null ? previousBassMidi - 1 : chordRootMidi; // Target root itself if no prev

  if (rootOptions.length > 0) {
    // Prefer root note if available
    return findClosestNote(
      targetMidi,
      rootOptions.sort((a, b) => a - b), // Ensure sorted
      previousBassMidi,
      smoothness,
      9, // Slightly larger leap threshold for bass
    );
  } else {
    // If root not available in range, choose the best available note (often the 3rd or 5th)
    const noteName = midiToNoteName(chordRootMidi);
    const pc = noteName ? Tonal.Note.pitchClass(noteName) : 'N/A';
    console.log(
      `SATB: Root note PC (${pc}) not available in bass range [${minRange}-${maxRange}]. Choosing best alternative from available: ${allowedBassNotes.map(midiToNoteName).join(', ')}`,
    );
    return findClosestNote(
      targetMidi,
      allowedBassNotes.sort((a, b) => a - b), // Ensure sorted
      previousBassMidi,
      smoothness,
      9, // Slightly larger leap threshold for bass
    );
  }
}

/** Assigns a MIDI note for the Soprano voice (SATB context) or Melody line. */
function assignSopranoOrMelodyNote(
  fullChordNotePool: number[],
  previousSopranoMidi: number | null,
  smoothness: number,
  style: 'SATB' | 'MelodyAccompaniment',
): number | null {
  const [minRange, maxRange] =
    style === 'SATB' ? VOICE_RANGES.soprano : VOICE_RANGES.melody;
  const allowedNotes = fullChordNotePool.filter(
    (n) => n >= minRange && n <= maxRange,
  );

  if (allowedNotes.length === 0) {
    console.warn(
      `${style}: No valid soprano/melody notes found in range [${minRange}-${maxRange}]. Pool: ${fullChordNotePool.map(midiToNoteName).join(', ')}`,
    );
    return null;
  }

  // Target slightly above previous note, or middle of range if no previous
  const targetMidi =
    previousSopranoMidi !== null
      ? previousSopranoMidi + 1 // Encourage upward step/leap
      : (minRange + maxRange) / 2; // Target middle of the range initially

  return findClosestNote(
    targetMidi,
    allowedNotes.sort((a, b) => a - b), // Ensure sorted
    previousSopranoMidi,
    smoothness,
    7, // Standard leap threshold
  );
}

/** Assigns MIDI notes for the Alto and Tenor voices (SATB context). */
function assignInnerVoicesSATB(
  // chord: Tonal.Chord.Chord, // Pass the chord object for more info?
  chordPcs: number[], // Pitch classes in the current chord
  fullChordNotePool: number[], // All available notes in multiple octaves
  previousTenorMidi: number | null,
  previousAltoMidi: number | null,
  sopranoNoteMidi: number | null,
  bassNoteMidi: number | null,
  smoothness: number,
  keyDetails: Tonal.Key.Key, // Pass key details for doubling rules
): { tenorNoteMidi: number | null; altoNoteMidi: number | null } {
  if (sopranoNoteMidi === null || bassNoteMidi === null) {
    console.warn(
      'SATB: Cannot assign inner voices without valid soprano and bass.',
    );
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  // Determine required pitch classes and potential doublings
  let currentVoicingPcs = new Set<number>();
  currentVoicingPcs.add(bassNoteMidi % 12);
  currentVoicingPcs.add(sopranoNoteMidi % 12);

  let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
  let pcsToDouble: number[] = [];
  const voicesToFill = 2; // Alto and Tenor

  // --- Doubling Logic (Standard SATB Practice) ---
  const chordRootMidi = Tonal.Note.midi(keyDetails.tonic + DEFAULT_OCTAVE); // Find root MIDI once
  const chordRootPc = chordRootMidi !== null ? chordRootMidi % 12 : -1;
  const leadingTonePc =
    Tonal.Note.midi(keyDetails.tonic + DEFAULT_OCTAVE) !== null
      ? (Tonal.Note.midi(keyDetails.tonic + DEFAULT_OCTAVE)! +
          (Tonal.Interval.semitones('M7') ?? 11)) %
        12
      : -1; // Calculate leading tone PC once

  if (neededPcs.length < voicesToFill) {
    const numDoublingsNeeded = voicesToFill - neededPcs.length;

    // 1. Prioritize doubling Root (unless it's the leading tone, less common)
    const canDoubleRoot = chordRootPc !== -1 && chordRootPc !== leadingTonePc;
    if (
      canDoubleRoot &&
      pcsToDouble.length < numDoublingsNeeded &&
      !neededPcs.includes(chordRootPc) && // Don't "double" if it was already needed
      !pcsToDouble.includes(chordRootPc) // Don't add it twice
    ) {
      pcsToDouble.push(chordRootPc);
    }

    // 2. Then Fifth (stable, good to double, unless it's the leading tone - rare case)
    const fifthInterval = 'P5'; // Assuming perfect fifth for doubling
    const fifthMidi = Tonal.Note.midi(
      Tonal.transpose(keyDetails.tonic + DEFAULT_OCTAVE, fifthInterval) ?? '',
    );
    const fifthPc = fifthMidi !== null ? fifthMidi % 12 : -1;
    const canDoubleFifth = fifthPc !== -1 && fifthPc !== leadingTonePc;
    if (
      canDoubleFifth &&
      pcsToDouble.length < numDoublingsNeeded &&
      chordPcs.includes(fifthPc) && // Ensure 5th is actually in the chord (covers triads, 7ths etc.)
      !neededPcs.includes(fifthPc) &&
      !pcsToDouble.includes(fifthPc)
    ) {
      pcsToDouble.push(fifthPc);
    }

    // 3. Then Third (less ideal to double, esp. if leading tone, but sometimes necessary)
    // Find the third PC (assuming it's the one not root or fifth in a triad context)
    const thirdPc = chordPcs.find((pc) => pc !== chordRootPc && pc !== fifthPc);
    const canDoubleThird = thirdPc !== undefined && thirdPc !== leadingTonePc;
    if (
      canDoubleThird &&
      pcsToDouble.length < numDoublingsNeeded &&
      !neededPcs.includes(thirdPc) &&
      !pcsToDouble.includes(thirdPc)
    ) {
      pcsToDouble.push(thirdPc);
    }

    // 4. Fallback Doubling (if still needed, usually Root again if possible)
    while (pcsToDouble.length < numDoublingsNeeded) {
      if (canDoubleRoot && !pcsToDouble.includes(chordRootPc))
        pcsToDouble.push(chordRootPc); // Add root if not already doubled excessively
      else if (canDoubleFifth && !pcsToDouble.includes(fifthPc))
        pcsToDouble.push(fifthPc); // Add fifth
      else if (canDoubleThird && !pcsToDouble.includes(thirdPc))
        pcsToDouble.push(thirdPc); // Add third
      else {
        // Emergency: double anything available that isn't LT
        const fallbackPc =
          chordPcs.find((pc) => pc !== leadingTonePc) ?? chordRootPc;
        if (fallbackPc !== -1) {
          pcsToDouble.push(fallbackPc);
          console.warn(`SATB: Emergency doubling of PC ${fallbackPc}`);
        } else {
          console.error('SATB: Cannot find any PC to double!');
          break; // Avoid infinite loop
        }
      }
      if (pcsToDouble.length > 5) break; // Safety break
    }
  }

  let targetInnerPcs = [...neededPcs, ...pcsToDouble];
  // Ensure we have exactly two target pitch classes for Alto and Tenor
  if (targetInnerPcs.length < 2) {
    console.warn(
      `SATB: Only ${targetInnerPcs.length} target PCs found for inner voices. Needed: ${neededPcs.join(',')}, Doubled: ${pcsToDouble.join(',')}. Adding fallback.`,
    );
    const fallbackPc =
      chordRootPc !== -1 && chordRootPc !== leadingTonePc
        ? chordRootPc
        : (chordPcs.find((pc) => pc !== leadingTonePc) ?? chordPcs[0]);
    if (fallbackPc !== undefined) targetInnerPcs.push(fallbackPc);
    if (targetInnerPcs.length < 2) targetInnerPcs.push(chordPcs[0]); // Absolute fallback
  }
  targetInnerPcs = targetInnerPcs.slice(0, 2); // Take the first two

  // Assign target PCs - Alto generally takes the higher, Tenor the lower of the two remaining
  // Note: This is a simplification; real composition is more complex.
  // We'll let findClosestNote handle the actual octave placement based on range and smoothness.
  const altoTargetPc = targetInnerPcs[0]; // Could add logic to assign intelligently
  const tenorTargetPc = targetInnerPcs[1];

  // --- Filter Notes by Range and Initial Spacing ---
  const [altoMin, altoMax] = VOICE_RANGES.alto;
  const [tenorMin, tenorMax] = VOICE_RANGES.tenor;

  // Alto candidates: within Alto range, below Soprano, above Bass, respects S-A spacing
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= altoMin &&
      n <= altoMax &&
      n < sopranoNoteMidi &&
      n > bassNoteMidi && // Must be above Bass
      sopranoNoteMidi - n <= VOICE_SPACING_LIMIT_SATB.soprano_alto,
  );

  // Tenor candidates: within Tenor range, below *potential* Alto, above Bass, respects T-B spacing
  // We find Tenor first relative to Bass, then check against chosen Alto later.
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= tenorMin &&
      n <= tenorMax &&
      // n < altoNoteMidi! && // Check later
      n > bassNoteMidi &&
      n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass, // Check spacing with Bass
    // altoNoteMidi! - n <= VOICE_SPACING_LIMIT.alto_tenor && // Check later
  );

  // --- Assign Voices (Iterative Refinement Might Be Needed) ---
  // Strategy: Assign one voice, then constrain and assign the other.
  // Let's try assigning Alto first, as it's constrained by Soprano.

  let altoNoteMidi: number | null = null;
  let tenorNoteMidi: number | null = null;

  // Target for Alto: near previous, or midway between S/B
  const altoTargetMidi =
    previousAltoMidi !== null
      ? previousAltoMidi
      : (sopranoNoteMidi + bassNoteMidi) / 2;
  // Target for Tenor: near previous, or midway between potential Alto and Bass
  const tenorTargetMidi =
    previousTenorMidi !== null
      ? previousTenorMidi
      : (altoTargetMidi + bassNoteMidi) / 2; // Use altoTarget as estimate

  // Filter Alto notes by target PC
  const altoTargetPcOptions = allowedAltoNotes.filter(
    (n) => n % 12 === altoTargetPc,
  );
  let altoOptionsToUse =
    altoTargetPcOptions.length > 0 ? altoTargetPcOptions : allowedAltoNotes;
  if (altoOptionsToUse.length === 0) {
    console.warn(
      `SATB: No valid notes for Alto (Target PC: ${altoTargetPc}) in range/spacing. Pool: ${allowedAltoNotes.map(midiToNoteName).join(', ')}`,
    );
    // Try relaxing S-A spacing slightly?
    altoOptionsToUse = fullChordNotePool.filter(
      (n) =>
        n >= altoMin && n <= altoMax && n < sopranoNoteMidi && n > bassNoteMidi,
    );
    if (altoOptionsToUse.length === 0) {
      console.error(
        'SATB: Still no Alto notes after relaxing spacing. Cannot assign Alto.',
      );
      return { tenorNoteMidi: null, altoNoteMidi: null }; // Critical failure
    } else {
      console.warn('SATB: Relaxed S-A spacing to find Alto note.');
    }
  }

  altoNoteMidi = findClosestNote(
    altoTargetMidi,
    altoOptionsToUse.sort((a, b) => a - b),
    previousAltoMidi,
    smoothness,
  );

  if (altoNoteMidi === null) {
    console.error(
      'SATB: Failed to select an Alto note even from available options.',
    );
    // Attempt recovery: just pick the middle note?
    altoNoteMidi =
      altoOptionsToUse.length > 0
        ? altoOptionsToUse[Math.floor(altoOptionsToUse.length / 2)]
        : null;
    if (altoNoteMidi === null)
      return { tenorNoteMidi: null, altoNoteMidi: null }; // Still failed
  }

  // Now Assign Tenor, constrained by the chosen Alto
  allowedTenorNotes = allowedTenorNotes.filter(
    (n) =>
      n < altoNoteMidi! && // Must be below assigned Alto
      altoNoteMidi! - n <= VOICE_SPACING_LIMIT_SATB.alto_tenor, // Check A-T spacing
  );

  // Filter Tenor notes by target PC
  const tenorTargetPcOptions = allowedTenorNotes.filter(
    (n) => n % 12 === tenorTargetPc,
  );
  let tenorOptionsToUse =
    tenorTargetPcOptions.length > 0 ? tenorTargetPcOptions : allowedTenorNotes;

  if (tenorOptionsToUse.length === 0) {
    console.warn(
      `SATB: No valid notes for Tenor (Target PC: ${tenorTargetPc}) below Alto ${midiToNoteName(altoNoteMidi)} / within spacing. Available T notes before Alto check: ${allowedTenorNotes.map(midiToNoteName).join(', ')}`,
    );
    // Try relaxing A-T spacing?
    tenorOptionsToUse = fullChordNotePool.filter(
      (n) =>
        n >= tenorMin &&
        n <= tenorMax &&
        n < altoNoteMidi! &&
        n > bassNoteMidi &&
        n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass,
    );
    if (tenorOptionsToUse.length === 0) {
      console.error(
        `SATB: Still no Tenor notes below Alto ${midiToNoteName(altoNoteMidi)} after relaxing spacing. Cannot assign Tenor.`,
      );
      // We have a valid Alto, return that at least
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
    } else {
      console.warn('SATB: Relaxed A-T spacing to find Tenor note.');
    }
  }

  tenorNoteMidi = findClosestNote(
    tenorTargetMidi,
    tenorOptionsToUse.sort((a, b) => a - b),
    previousTenorMidi,
    smoothness,
  );

  if (tenorNoteMidi === null) {
    console.error(
      'SATB: Failed to select a Tenor note even from available options.',
    );
    // Attempt recovery: just pick the highest valid tenor note?
    tenorNoteMidi =
      tenorOptionsToUse.length > 0
        ? tenorOptionsToUse[tenorOptionsToUse.length - 1]
        : null;
    if (tenorNoteMidi === null)
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi }; // Still failed
  }

  // --- Final Sanity Checks ---
  if (tenorNoteMidi >= altoNoteMidi) {
    console.error(
      `SATB INTERNAL ERROR: Tenor ${midiToNoteName(tenorNoteMidi)} >= Alto ${midiToNoteName(altoNoteMidi)}. Voicing failed.`,
    );
    // Invalidate Tenor if crossing occurred
    tenorNoteMidi = null;
  }

  return { tenorNoteMidi, altoNoteMidi };
}

/**
 * Generates accompaniment voicing (typically 3 notes) for Melody+Accompaniment style.
 * Aims for common keyboard voicings below the melody.
 * @param melodyNoteMidi - The MIDI note of the melody line.
 * @param chordRootMidi - The root MIDI note of the current chord (for grounding).
 * @param chordPcs - The pitch classes present in the current chord.
 * @param fullChordNotePool - All available MIDI notes for the chord across octaves.
 * @param previousAccompanimentNotes - Array of MIDI notes from the previous accompaniment chord.
 * @param smoothness - Smoothness preference (0-10).
 * @param numVoices - Number of notes desired in the accompaniment chord (e.g., 3).
 * @returns { (number | null)[] } An array of MIDI notes for the accompaniment, ordered lowest to highest.
 */
function generateAccompanimentVoicing(
  melodyNoteMidi: number | null,
  chordRootMidi: number,
  chordPcs: number[],
  fullChordNotePool: number[],
  previousAccompanimentNotes: (number | null)[],
  smoothness: number,
  numVoices: number = 3,
): (number | null)[] {
  if (melodyNoteMidi === null) {
    console.warn('Accompaniment: Cannot generate voicing without melody note.');
    return Array(numVoices).fill(null);
  }
  if (numVoices <= 0) return [];

  const [minRange, maxRange] = VOICE_RANGES.accompaniment;
  const chordRootPc = chordRootMidi % 12;

  // Filter pool: below melody, within accompaniment range
  let availableNotes = fullChordNotePool
    .filter(
      (n) =>
        n < melodyNoteMidi &&
        n >= minRange &&
        n <= maxRange &&
        melodyNoteMidi - n < MELODY_ACCOMPANIMENT_SPACING_LIMIT, // Optional: Limit distance from melody
    )
    .sort((a, b) => a - b); // Sort ascending

  if (availableNotes.length < numVoices) {
    console.warn(
      `Accompaniment: Not enough notes (${availableNotes.length}) in pool below melody ${midiToNoteName(melodyNoteMidi)} and within range [${minRange}-${maxRange}] to form ${numVoices}-note chord. Trying with available notes.`,
    );
    if (availableNotes.length === 0) {
      console.error('Accompaniment: No available notes found at all.');
      return Array(numVoices).fill(null);
    }
    // If not enough notes, we'll just use the ones we have
    numVoices = availableNotes.length;
  }

  let accompanimentNotes: (number | null)[] = [];
  let remainingPcs = new Set(chordPcs); // Track needed pitch classes

  // --- 1. Assign Lowest Note (Bass Function) ---
  let lowestNote: number | null = null;
  // Prefer root note in the lower part of the range
  const bassTargetMidi =
    previousAccompanimentNotes[0] !== null
      ? previousAccompanimentNotes[0] - 1
      : chordRootMidi - 12; // Aim below prev lowest or low root
  const rootOptionsLowest = availableNotes.filter(
    (n) => n % 12 === chordRootPc && n < minRange + 12,
  ); // Roots in lowest octave of range
  const allRootOptions = availableNotes.filter((n) => n % 12 === chordRootPc);

  let bassCandidates: number[] = [];
  if (rootOptionsLowest.length > 0) {
    bassCandidates = rootOptionsLowest;
  } else if (allRootOptions.length > 0) {
    bassCandidates = allRootOptions; // Use any root if none are very low
  } else {
    // No root available, use any note (findClosestNote will pick lowest)
    bassCandidates = availableNotes;
    console.warn(
      `Accompaniment: Chord root PC ${chordRootPc} not found in available notes: ${availableNotes.map(midiToNoteName).join(', ')}. Choosing lowest available.`,
    );
  }

  lowestNote = findClosestNote(
    bassTargetMidi,
    bassCandidates,
    previousAccompanimentNotes[0] ?? null,
    smoothness,
    9,
  ); // Bass leap threshold

  if (lowestNote !== null) {
    accompanimentNotes.push(lowestNote);
    remainingPcs.delete(lowestNote % 12);
    // Remove chosen note and any notes below it from further consideration for upper voices
    availableNotes = availableNotes.filter((n) => n > lowestNote!);
  } else {
    console.error('Accompaniment: Failed to assign lowest note.');
    return Array(numVoices).fill(null); // Critical failure
  }

  // --- 2. Assign Remaining Voices ---
  // Target the remaining pitch classes, prioritizing smoothness
  let currentAvailableNotes = availableNotes;
  for (let i = 1; i < numVoices; i++) {
    if (currentAvailableNotes.length === 0) {
      console.warn(
        `Accompaniment: Ran out of available notes after assigning ${accompanimentNotes.length} voice(s).`,
      );
      accompanimentNotes.push(null); // Add null if no more notes
      continue;
    }

    const previousNote =
      previousAccompanimentNotes[i] ??
      previousAccompanimentNotes[i - 1] ??
      lowestNote; // Use corresponding prev note, or one below, or lowest
    const targetMidi = previousNote !== null ? previousNote : lowestNote! + 7; // Target near previous, or ~P5 above lowest

    // Prioritize needed pitch classes if any remain
    const neededPcNotes = currentAvailableNotes.filter((n) =>
      remainingPcs.has(n % 12),
    );
    let candidates: number[];
    if (neededPcNotes.length > 0) {
      candidates = neededPcNotes;
    } else {
      // No specific PCs needed, or none available; choose best from remaining pool
      candidates = currentAvailableNotes;
    }

    const chosenNote = findClosestNote(
      targetMidi,
      candidates,
      previousNote,
      smoothness,
      7,
    );

    if (chosenNote !== null) {
      accompanimentNotes.push(chosenNote);
      remainingPcs.delete(chosenNote % 12);
      // Remove chosen note and potentially notes below it from pool for next voice up
      // Keep notes above chosen one available
      currentAvailableNotes = currentAvailableNotes.filter(
        (n) => n > chosenNote,
      );
    } else {
      console.warn(`Accompaniment: Failed to assign voice ${i + 1}.`);
      accompanimentNotes.push(null); // Add null if assignment fails
      // Keep currentAvailableNotes as is if selection failed
    }
  }

  // Ensure array has the correct length, padding with null if necessary
  while (accompanimentNotes.length < numVoices) {
    accompanimentNotes.push(null);
  }

  return accompanimentNotes.sort((a, b) => (a ?? -1) - (b ?? -1)); // Sort low to high, nulls first (shouldn't happen often)
}

/** Checks voice leading rules based on the generation style. */
function checkVoiceLeadingRules(
  currentNotes: PreviousNotesSATB | PreviousNotesMelodyAccompaniment,
  previousNotes: PreviousNotesSATB | PreviousNotesMelodyAccompaniment | null, // Allow null for first beat
  style: 'SATB' | 'MelodyAccompaniment',
  measureIndex: number,
  beatIndex: number, // 0-based beat index within measure
  strictness: number, // Dissonance strictness (0-10)
): void {
  if (strictness <= 1) return; // Skip checks if strictness is very low

  const loc = `M${measureIndex + 1}:B${beatIndex + 1}`;

  if (style === 'SATB') {
    const current = currentNotes as PreviousNotesSATB;
    const prev = previousNotes as PreviousNotesSATB | null;
    const { soprano, alto, tenor, bass } = current;

    // Basic checks require all notes
    if (soprano === null || alto === null || tenor === null || bass === null) {
      // console.log(`SATB Check Skipped at ${loc}: Missing notes.`);
      return;
    }

    // Voice Crossing (SATB)
    if (alto > soprano)
      console.warn(
        `SATB Crossing: Alto (${midiToNoteName(alto)}) > Soprano (${midiToNoteName(soprano)}) at ${loc}`,
      );
    if (tenor > alto)
      console.warn(
        `SATB Crossing: Tenor (${midiToNoteName(tenor)}) > Alto (${midiToNoteName(alto)}) at ${loc}`,
      );
    if (bass > tenor)
      console.warn(
        `SATB Crossing: Bass (${midiToNoteName(bass)}) > Tenor (${midiToNoteName(tenor)}) at ${loc}`,
      );

    // Voice Spacing (SATB) - only check if strictness is moderate
    if (strictness >= 4) {
      if (soprano - alto > VOICE_SPACING_LIMIT_SATB.soprano_alto)
        console.warn(`SATB Spacing > P8 between Soprano/Alto at ${loc}`);
      if (alto - tenor > VOICE_SPACING_LIMIT_SATB.alto_tenor)
        console.warn(`SATB Spacing > P8 between Alto/Tenor at ${loc}`);
    }
    // Bass-Tenor spacing is often larger, check if strictness is high
    if (strictness >= 6) {
      if (tenor - bass > VOICE_SPACING_LIMIT_SATB.tenor_bass)
        console.warn(`SATB Spacing > P12 between Tenor/Bass at ${loc}`);
    }

    // Parallel Motion Checks (SATB) - only if strictness is high
    if (
      strictness >= 7 &&
      prev &&
      prev.soprano !== null &&
      prev.alto !== null &&
      prev.tenor !== null &&
      prev.bass !== null
    ) {
      checkParallelsSATB(
        prev.soprano,
        soprano,
        prev.alto,
        alto,
        'Soprano',
        'Alto',
        measureIndex,
        beatIndex,
      );
      checkParallelsSATB(
        prev.soprano,
        soprano,
        prev.tenor,
        tenor,
        'Soprano',
        'Tenor',
        measureIndex,
        beatIndex,
      );
      checkParallelsSATB(
        prev.soprano,
        soprano,
        prev.bass,
        bass,
        'Soprano',
        'Bass',
        measureIndex,
        beatIndex,
      );
      checkParallelsSATB(
        prev.alto,
        alto,
        prev.tenor,
        tenor,
        'Alto',
        'Tenor',
        measureIndex,
        beatIndex,
      );
      checkParallelsSATB(
        prev.alto,
        alto,
        prev.bass,
        bass,
        'Alto',
        'Bass',
        measureIndex,
        beatIndex,
      );
      checkParallelsSATB(
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
  } else {
    // MelodyAccompaniment Style
    const current = currentNotes as PreviousNotesMelodyAccompaniment;
    // const prev = previousNotes as PreviousNotesMelodyAccompaniment | null; // Previous notes not used much here yet
    const { melody, accompaniment } = current;

    if (melody === null || accompaniment.some((n) => n === null)) {
      // console.log(`Melody/Acc Check Skipped at ${loc}: Missing notes.`);
      return;
    }
    const highestAccomp = accompaniment[accompaniment.length - 1]; // Highest note is last after sort

    if (highestAccomp === null) return; // Should be caught above, but safety check

    // Voice Crossing (Melody vs Accompaniment)
    if (highestAccomp >= melody) {
      console.warn(
        `Melody/Acc Crossing: Highest accompaniment (${midiToNoteName(highestAccomp)}) >= Melody (${midiToNoteName(melody)}) at ${loc}`,
      );
    }

    // Spacing between Melody and Accompaniment - check if strictness moderate
    if (strictness >= 5) {
      if (melody - highestAccomp > MELODY_ACCOMPANIMENT_SPACING_LIMIT) {
        console.warn(
          `Melody/Acc Spacing > ${MELODY_ACCOMPANIMENT_SPACING_LIMIT} semitones between Melody and Highest Accompaniment at ${loc}`,
        );
      }
    }

    // Parallel motion between melody and bass (lowest accompaniment) - maybe check if strictness high?
    const lowestAccomp = accompaniment[0];
    if (strictness >= 8 && lowestAccomp !== null && previousNotes) {
      const prev = previousNotes as PreviousNotesMelodyAccompaniment;
      if (prev.melody !== null && prev.accompaniment[0] !== null) {
        checkParallelsSATB(
          prev.melody,
          melody,
          prev.accompaniment[0],
          lowestAccomp,
          'Melody',
          'Bass (Accomp)',
          measureIndex,
          beatIndex,
        );
      }
    }

    // Other checks (e.g., parallel motion within accompaniment) are generally NOT applied in this style.
  }
}

/** Checks for parallel 5ths and octaves between two voices (Helper for SATB). */
function checkParallelsSATB(
  voice1Prev: number | null,
  voice1Curr: number | null,
  voice2Prev: number | null,
  voice2Curr: number | null,
  part1Name: string,
  part2Name: string,
  measureIndex: number,
  beatIndex: number,
): void {
  // Ensure all notes are valid MIDI numbers
  if (
    [voice1Prev, voice1Curr, voice2Prev, voice2Curr].some(
      (n) => n === null || !Number.isInteger(n),
    )
  )
    return;

  // Ensure both voices moved (or skip check if one is static)
  const voice1Moved = voice1Prev !== voice1Curr;
  const voice2Moved = voice2Prev !== voice2Curr;
  // Standard rule: only check if *both* voices move in similar motion (same direction)
  // However, checking all motion reveals more parallels, which might be desired depending on strictness.
  // Let's check if both moved, regardless of direction for simplicity here.
  if (!voice1Moved || !voice2Moved) return;

  // Get note names for Tonal interval calculation
  const note1PrevName = midiToNoteName(voice1Prev);
  const note1CurrName = midiToNoteName(voice1Curr);
  const note2PrevName = midiToNoteName(voice2Prev);
  const note2CurrName = midiToNoteName(voice2Curr);
  if (!note1PrevName || !note1CurrName || !note2PrevName || !note2CurrName)
    return; // Skip if conversion failed

  try {
    // Calculate the interval distance (semitones)
    const intervalPrevSemi = Math.abs(voice1Prev! - voice2Prev!);
    const intervalCurrSemi = Math.abs(voice1Curr! - voice2Curr!);

    // Check for Perfect 5ths (7 semitones) or Perfect Octaves/Unisons (0 or 12 semitones)
    const isPrevP5 = intervalPrevSemi % 12 === 7;
    const isCurrP5 = intervalCurrSemi % 12 === 7;
    const isPrevP8 = intervalPrevSemi % 12 === 0; // Catches unison and octaves
    const isCurrP8 = intervalCurrSemi % 12 === 0;

    if (isPrevP5 && isCurrP5) {
      console.warn(
        `PARALLEL 5th (${part1Name}/${part2Name}) at M${measureIndex + 1}:B${beatIndex + 1}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    } else if (isPrevP8 && isCurrP8 && intervalPrevSemi > 0) {
      // Check > 0 to ignore parallel unisons if desired (though technically P1s)
      console.warn(
        `PARALLEL Octave (${part1Name}/${part2Name}) at M${measureIndex + 1}:B${beatIndex + 1}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`,
      );
    }
    // Could add checks for hidden/direct octaves/fifths if needed (more complex)
  } catch (error) {
    // Tonal might throw errors on unusual intervals or edge cases if using Tonal.Interval.distance
    console.error(
      `Error checking parallels at M${measureIndex + 1}:B${beatIndex + 1} between ${part1Name}/${part2Name}:`,
      error,
    );
  }
}

// --- Exported Generation Functions ---

/**
 * Generates a simple chord progression based on tonal harmony tendencies.
 * (Logic remains largely the same, minor tweaks possible if needed)
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

  // Ensure complexity is within bounds
  harmonicComplexity = Math.max(0, Math.min(10, harmonicComplexity));

  let currentKey = key;
  let keyDetails: ReturnType<typeof Tonal.Key.majorKey> = Tonal.Key.majorKey(currentKey);
  if (!keyDetails || keyDetails.type !== 'major') {
    keyDetails = Tonal.Key.minorKey(currentKey) as unknown as ReturnType<typeof Tonal.Key.majorKey>;
  }

  if (!keyDetails) {
    console.error(`Invalid key "${key}". Defaulting to "C".`);
    currentKey = 'C';
    // Recurse with default, but prevent infinite loop
    return key === 'C'
      ? ['I']
      : generateChordProgression('C', numMeasures, harmonicComplexity);
  }

  const isMajor = keyDetails.type === 'major';
  // Define Roman numerals based on key type
  const tonicRoman = isMajor ? 'I' : 'i';
  const dominantRoman = 'V'; // V is typically Major in both modes for cadences
  const dominant7Roman = 'V7'; // Dominant 7th
  const subdominantRoman = isMajor ? 'IV' : 'iv';
  const supertonicRoman = isMajor ? 'ii' : 'ii°'; // ii in major, ii° in minor
  const mediantRoman = isMajor ? 'iii' : 'III+'; // iii in major, III+ (Augmented) in harmonic minor is common
  const submediantRoman = isMajor ? 'vi' : 'VI'; // vi in major, VI in minor
  const leadingToneRoman = 'vii°'; // Fully diminished vii° in major, sometimes vii°7 in minor

  // Define chord pools based on complexity (Tonic, Subdominant, Dominant function groups)
  const primaryChords = [tonicRoman, subdominantRoman, dominantRoman]; // T, S, D
  const secondaryChords = [submediantRoman, supertonicRoman]; // Tends towards T (vi/VI), tends towards D (ii/ii°)
  const complexChords = [mediantRoman, leadingToneRoman]; // Often substitutes for T (iii) or D (vii°)

  // Build allowed chords based on complexity
  let allowedChords = [...primaryChords];
  if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
  if (harmonicComplexity >= 6) allowedChords.push(...complexChords); // Increased threshold slightly

  // Add V7 based on complexity, replacing V if present
  if (harmonicComplexity >= 4) {
    // Lowered threshold for V7
    if (allowedChords.includes(dominantRoman)) {
      allowedChords = allowedChords.map((c) =>
        c === dominantRoman ? dominant7Roman : c,
      );
    } else if (!allowedChords.includes(dominant7Roman)) {
      allowedChords.push(dominant7Roman);
    }
  }
  // Optionally add vii°7 in minor if complexity is high
  if (
    !isMajor &&
    harmonicComplexity >= 8 &&
    allowedChords.includes(leadingToneRoman)
  ) {
    allowedChords = allowedChords.map((c) =>
      c === leadingToneRoman ? 'vii°7' : c,
    );
  }

  // Ensure unique chords and at least one chord exists
  allowedChords = Array.from(new Set(allowedChords));
  if (allowedChords.length === 0) {
    console.error('No allowed chords generated. Defaulting to tonic.');
    allowedChords = [tonicRoman];
  }

  let progression: string[] = [tonicRoman]; // Start on tonic
  let prevChord = tonicRoman;
  const MAX_ATTEMPTS_PER_CHORD = 10; // Prevent infinite loops

  // --- Generate Intermediate Chords ---
  for (let i = 1; i < numMeasures - 1; i++) {
    let nextChord: string | undefined = undefined;
    let attempts = 0;

    do {
      let candidates = [...allowedChords];

      // --- Apply Tonal Motion Rules (Simplified) ---
      // 1. Avoid Repeating Chords if possible
      if (candidates.length > 1) {
        candidates = candidates.filter((c) => c !== prevChord);
      }
      if (candidates.length === 0) candidates = [prevChord]; // Must repeat if only one option left

      // 2. Basic Functional Tendencies (Probabilistic would be better)
      const prevIsDominant = [
        dominantRoman,
        dominant7Roman,
        leadingToneRoman,
        'vii°7',
      ].includes(prevChord);
      const prevIsSubdominant = [subdominantRoman, supertonicRoman].includes(
        prevChord,
      );
      const prevIsTonicSubstitute = [submediantRoman].includes(prevChord); // vi/VI can act like Tonic

      let preferredTargets: string[] = [];
      if (prevIsDominant) {
        // Dominant -> Tonic (Strongest), maybe Submediant (Deceptive)
        preferredTargets = [tonicRoman, submediantRoman];
      } else if (prevIsSubdominant) {
        // Subdominant -> Dominant (Strong), maybe Tonic (Plagal-like), maybe Submediant
        preferredTargets = [
          dominantRoman,
          dominant7Roman,
          tonicRoman,
          submediantRoman,
        ];
      } else if (prevIsTonicSubstitute) {
        // e.g., vi
        // Submediant -> Subdominant/Supertonic (Common), maybe Dominant
        preferredTargets = [
          subdominantRoman,
          supertonicRoman,
          dominantRoman,
          dominant7Roman,
        ];
      } else {
        // Tonic or Mediant
        // Tonic -> Anywhere, but Subdominant/Supertonic common start of phrase
        // Mediant -> Often Subdominant or Submediant
        preferredTargets = [
          subdominantRoman,
          supertonicRoman,
          dominantRoman,
          dominant7Roman,
          submediantRoman,
          mediantRoman,
        ];
      }

      // Filter candidates by preferred targets, but don't eliminate all options
      const targetedCandidates = candidates.filter((c) =>
        preferredTargets.includes(c),
      );
      if (targetedCandidates.length > 0) {
        // Bias towards preferred targets but allow others sometimes based on complexity
        const useTargetProb = 0.6 + harmonicComplexity * 0.03; // Higher complexity -> slightly more likely to follow tendency? Or opposite? Let's try this.
        if (Math.random() < useTargetProb) {
          candidates = targetedCandidates;
        } else {
          // Allow non-targeted candidates occasionally
          const nonTargeted = candidates.filter(
            (c) => !preferredTargets.includes(c),
          );
          if (nonTargeted.length > 0 && Math.random() < 0.3) {
            // Small chance to pick non-target
            candidates = nonTargeted;
          }
          // Otherwise stick with original candidates (minus repeated chord)
        }
      }
      // Ensure candidates isn't empty after filtering
      if (candidates.length === 0)
        candidates = allowedChords.filter((c) => c !== prevChord);
      if (candidates.length === 0) candidates = [prevChord];

      // Select random candidate from the (potentially filtered) list
      nextChord = candidates[Math.floor(Math.random() * candidates.length)];
      attempts++;
    } while (attempts < MAX_ATTEMPTS_PER_CHORD && nextChord === undefined); // Loop should always find a chord

    // If somehow still undefined (shouldn't happen with fallback), force a choice
    if (nextChord === undefined) {
      console.warn(
        `Progression: Could not determine next chord after ${attempts} attempts from ${prevChord}. Choosing random allowed.`,
      );
      nextChord =
        allowedChords[Math.floor(Math.random() * allowedChords.length)];
    }

    progression.push(nextChord);
    prevChord = nextChord;
  }

  // --- Cadence ---
  if (numMeasures > 1) {
    // Prioritize Authentic Cadence (V(7)-I/i)
    const penultimateOptions = [dominant7Roman, dominantRoman].filter((c) =>
      allowedChords.includes(c),
    );
    let penultimateChord =
      penultimateOptions.length > 0 ? penultimateOptions[0] : null;

    // If no V/V7 allowed, try Subdominant (IV/iv) for Plagal or Imperfect Cadence (IV-I, IV-V)
    if (!penultimateChord) {
      const plagalOption = [subdominantRoman].find((c) =>
        allowedChords.includes(c),
      );
      if (plagalOption) {
        penultimateChord = plagalOption;
        console.log('Progression: Using Plagal tendency for cadence (IV-I).');
      }
    }

    // If still no suitable penultimate chord, use Tonic (results in weak cadence)
    if (!penultimateChord) {
      penultimateChord = tonicRoman;
      console.log(
        'Progression: No suitable V or IV for cadence. Using Tonic (weak).',
      );
    }

    // Set penultimate and final chords
    if (numMeasures === 2 && penultimateChord !== tonicRoman) {
      // For 2 measures, just use Cadence Chord -> Tonic
      progression[0] = penultimateChord;
      progression[1] = tonicRoman;
    } else if (numMeasures > 2) {
      progression[numMeasures - 2] = penultimateChord; // Penultimate chord
      progression[numMeasures - 1] = tonicRoman; // Final chord is tonic
    } else {
      // numMeasures is 1 or 2 with only tonic available
      progression[numMeasures - 1] = tonicRoman;
    }
  } else if (numMeasures === 1) {
    progression[0] = tonicRoman; // Single measure is just tonic
  }

  console.log(
    `Generated Progression (${currentKey}, complexity ${harmonicComplexity}):`,
    progression.join(' | '), // Use pipe for clarity
  );
  return progression;
}

/**
 * Generates the voice data as a MusicXML string using xmlbuilder2,
 * supporting either SATB or Melody+Accompaniment style.
 * Output is formatted for a single Grand Staff (Treble + Bass clefs).
 *
 * @param chordProgression - Array of Roman numeral chord symbols.
 * @param keySignature - The key signature (e.g., "C", "Gm").
 * @param meter - The time signature (e.g., "4/4").
 * @param numMeasures - The number of measures to generate (should match chordProgression length).
 * @param generationSettings - Generation parameters including style.
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
  // --- Destructure Settings ---
  const {
    melodicSmoothness,
    dissonanceStrictness, // Used for rule checking intensity
    generationStyle = 'MelodyAccompaniment', // Default to new style
    numAccompanimentVoices = 3, // Default for new style
  } = generationSettings;

  // --- Key, Meter Validation & Setup ---
  let keyDetails = Tonal.Key.majorKey(keySignature);
  if (!keyDetails || keyDetails.type !== 'major') {
    keyDetails = Tonal.Key.minorKey(keySignature) as unknown as ReturnType<typeof Tonal.Key.majorKey>;
  }
  if (!keyDetails) throw new Error('Invalid key signature: ' + keySignature);

  const keyTonic = keyDetails.tonic; // e.g., "C", "G"
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';
  // Tonal uses 'alteration' for sharps/flats relative to C major. MusicXML uses 'fifths'.
  // We need a mapping or direct calculation for fifths.
  // Tonal's keySignature function provides this!
  const keySigFifths =
    Tonal.Scale.steps(keyDetails.keySignature).length -
    Tonal.Scale.steps('C major').length;
  // Or simpler: Tonal.Key.props(keySignature).fifths - but props might not exist directly
  // Let's calculate fifths based on alteration count:
  let keyFifths = keyDetails.alteration; // Number of sharps (+) or flats (-)
  // Need to ensure this aligns with circle of fifths for MusicXML
  // Example: F major is -1 alteration (1 flat), key signature fifths = -1
  // Example: G major is 1 alteration (1 sharp), key signature fifths = 1
  // Example: Eb major is -3 alteration (3 flats), key signature fifths = -3
  // This seems correct.

  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error(
      "Invalid meter format. Use 'beats/beatValue' (e.g., '4/4').",
    );
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);
  if (![1, 2, 4, 8, 16, 32].includes(beatValue))
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
    .txt(`Generated Music (${generationStyle} Style)`)
    .up()
    .up();
  root
    .ele('identification')
    .ele('encoding')
    .ele('software')
    .txt('AI Music Generator (TS)')
    .up()
    .ele('encoding-date')
    .txt(new Date().toISOString().split('T')[0])
    .up()
    .up()
    .up();

  // Part List (Single Part for Grand Staff)
  root
    .ele('part-list')
    .ele('score-part', { id: 'P1' })
    .ele('part-name')
    .txt(generationStyle === 'SATB' ? 'Choral SATB' : 'Melody + Accompaniment')
    .up()
    // Could add part-abbreviation etc.
    .up() // score-part
    .up(); // part-list

  // Part Element (Contains Measures)
  const partBuilder = root.ele('part', { id: 'P1' });

  // --- Voicing State & XML Parameters ---
  let previousNotes: PreviousNotesSATB | PreviousNotesMelodyAccompaniment;
  if (generationStyle === 'SATB') {
    previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
  } else {
    previousNotes = {
      melody: null,
      accompaniment: Array(numAccompanimentVoices).fill(null),
    };
  }

  // MusicXML Time Calculation
  const divisions = 4; // Divisions per quarter note (adjust for finer rhythm?)
  const beatDurationTicks = divisions * (4 / beatValue); // Duration of one beat in XML divisions
  const musicXmlBeatType = getMusicXMLDurationType(beatValue); // e.g., "quarter"

  // --- Generate Measures ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const roman = chordProgression[measureIndex];
    console.log(`--- Measure ${measureIndex + 1} (${roman}) ---`); // Log progress
    const baseChordNotes = getChordNotesFromRoman(roman, keySignature);

    const measureBuilder = partBuilder.ele('measure', {
      number: `${measureIndex + 1}`,
    });

    // Add Attributes in First Measure
    if (measureIndex === 0) {
      const attributes = measureBuilder.ele('attributes');
      attributes.ele('divisions').txt(`${divisions}`).up();
      attributes
        .ele('key')
        .ele('fifths')
        .txt(`${keyFifths}`)
        .up() // Use calculated fifths
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
      attributes.ele('staves').txt('2').up(); // Define two staves for Grand Staff
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

    // Handle Chord Errors (Add Rests)
    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}" in ${keySignature}. Adding rests.`,
      );
      // Add rests for the duration of the measure on both staves
      const measureDurationTicks = meterBeats * beatDurationTicks;
      // Staff 1 Rest (Voice 1)
      measureBuilder
        .ele('note')
        .ele('rest')
        .att('measure', 'yes')
        .up() // measure="yes" is optional but clear
        .ele('duration')
        .txt(`${measureDurationTicks}`)
        .up()
        .ele('voice')
        .txt('1')
        .up() // Assign to voice 1
        .ele('staff')
        .txt('1')
        .up()
        .up();
      // Add backup for staff 2 alignment if needed (usually not for full measure rests)
      // measureBuilder.ele('backup').ele('duration').txt(`${measureDurationTicks}`).up().up();
      // Staff 2 Rest (Voice 2)
      measureBuilder
        .ele('note')
        .ele('rest')
        .att('measure', 'yes')
        .up()
        .ele('duration')
        .txt(`${measureDurationTicks}`)
        .up()
        .ele('voice')
        .txt('2')
        .up() // Assign to voice 2
        .ele('staff')
        .txt('2')
        .up()
        .up();

      // Reset previous notes state
      if (generationStyle === 'SATB') {
        previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
      } else {
        previousNotes = {
          melody: null,
          accompaniment: Array(numAccompanimentVoices).fill(null),
        };
      }
      measureBuilder.up(); // Close measure
      continue; // Move to next measure
    }

    // --- Calculate Voicing for the Measure ---
    const chordRootMidi = baseChordNotes[0]; // Assumes first note is root (Tonal usually orders this way)
    const chordPcs = baseChordNotes.map((n) => n % 12);
    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);

    let currentMeasureNotes:
      | PreviousNotesSATB
      | PreviousNotesMelodyAccompaniment;

    if (generationStyle === 'SATB') {
      const prevSATB = previousNotes as PreviousNotesSATB;
      const soprano = assignSopranoOrMelodyNote(
        fullChordNotePool,
        prevSATB.soprano,
        melodicSmoothness,
        'SATB',
      );
      const bass = assignBassNoteSATB(
        chordRootMidi,
        fullChordNotePool,
        prevSATB.bass,
        melodicSmoothness,
      );
      const { tenorNoteMidi: tenor, altoNoteMidi: alto } = assignInnerVoicesSATB(
        chordPcs,
        fullChordNotePool,
        prevSATB.tenor,
        prevSATB.alto,
        soprano,
        bass,
        melodicSmoothness,
        keyDetails,
      );
      currentMeasureNotes = { soprano, alto, tenor, bass };
      console.log(
        `   SATB Voicing: S=${midiToNoteName(soprano)} A=${midiToNoteName(alto)} T=${midiToNoteName(tenor)} B=${midiToNoteName(bass)}`,
      );
    } else {
      // Melody + Accompaniment Style
      const prevMA = previousNotes as PreviousNotesMelodyAccompaniment;
      const melody = assignSopranoOrMelodyNote(
        fullChordNotePool,
        prevMA.melody,
        melodicSmoothness,
        'MelodyAccompaniment',
      );
      const accompaniment = generateAccompanimentVoicing(
        melody,
        chordRootMidi,
        chordPcs,
        fullChordNotePool,
        prevMA.accompaniment,
        melodicSmoothness,
        numAccompanimentVoices,
      );
      currentMeasureNotes = { melody, accompaniment };
      console.log(
        `   Melody+Acc Voicing: M=${midiToNoteName(melody)} Acc=[${accompaniment.map(midiToNoteName).join(', ')}]`,
      );
    }

    // Check Voice Leading Rules for the generated voicing
    checkVoiceLeadingRules(
      currentMeasureNotes,
      previousNotes,
      generationStyle,
      measureIndex,
      0,
      dissonanceStrictness,
    );

    // --- Add Notes/Rests to Measure (MusicXML) ---
    // Assuming one chord per measure, notes last for the whole measure for simplicity
    // TODO: Adapt this loop to handle multiple chords/beats per measure if needed
    const noteDurationTicks = meterBeats * beatDurationTicks; // Duration for the whole measure note
    const noteType = getMusicXMLDurationType(beatValue * (1 / meterBeats)); // Get type for the whole measure (e.g., whole, half) - Needs refinement for complex meters

    if (generationStyle === 'SATB') {
      const { soprano, alto, tenor, bass } =
        currentMeasureNotes as PreviousNotesSATB;
      const notes = { soprano, alto, tenor, bass };

      // Staff 1: Soprano (voice 1), Alto (voice 1, chord)
      const staff1Notes = [notes.soprano, notes.alto];
      let staff1Stem = 'up'; // Default stem direction for treble staff
      // Determine stem based on highest note (Soprano if present, else Alto)
      const highestStaff1 = notes.soprano ?? notes.alto;
      if (highestStaff1 !== null && highestStaff1 >= 71) {
        // Note is B4 or higher
        staff1Stem = 'down';
      }
      addNotesToStaffXML(
        measureBuilder,
        staff1Notes,
        '1',
        '1',
        staff1Stem,
        noteDurationTicks,
        noteType,
      );

      // Backup before adding Staff 2 notes
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${noteDurationTicks}`)
        .up()
        .up();

      // Staff 2: Tenor (voice 2), Bass (voice 2, chord)
      const staff2Notes = [notes.tenor, notes.bass];
      let staff2Stem = 'down'; // Default stem direction for bass staff
      // Determine stem based on highest note (Tenor if present, else Bass) - Bass stems often down unless Tenor is low
      const highestStaff2 = notes.tenor ?? notes.bass;
      if (highestStaff2 !== null && highestStaff2 <= 55) {
        // Note is G3 or lower
        staff2Stem = 'up';
      }
      addNotesToStaffXML(
        measureBuilder,
        staff2Notes,
        '2',
        '2',
        staff2Stem,
        noteDurationTicks,
        noteType,
      );
    } else {
      // MelodyAccompaniment Style
      const { melody, accompaniment } =
        currentMeasureNotes as PreviousNotesMelodyAccompaniment;

      // Staff 1: Melody (voice 1)
      let melodyStem = 'up';
      if (melody !== null && melody >= 71) {
        // B4 or higher
        melodyStem = 'down';
      }
      addNotesToStaffXML(
        measureBuilder,
        [melody],
        '1',
        '1',
        melodyStem,
        noteDurationTicks,
        noteType,
      );

      // Backup before adding Staff 2 notes
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${noteDurationTicks}`)
        .up()
        .up();

      // Staff 2: Accompaniment (voice 2, using chord tag)
      let accompStem = 'down'; // Default for accomp in bass clef
      const highestAccomp = accompaniment.filter((n) => n !== null).pop(); // Get highest non-null note
      if (
        highestAccomp !== undefined &&
        highestAccomp !== null &&
        highestAccomp <= 55
      ) {
        // G3 or lower
        accompStem = 'up';
      } else if (accompaniment.every((n) => n === null)) {
        // If all rests, stem direction doesn't matter, but needs a note element
      }
      // Accompaniment notes need to be sorted high to low for typical Bass clef stem down chords? No, XML handles it. Low to high is fine.
      addNotesToStaffXML(
        measureBuilder,
        accompaniment,
        '2',
        '2',
        accompStem,
        noteDurationTicks,
        noteType,
      );
    }

    // Update previous notes state for the next measure
    previousNotes = { ...currentMeasureNotes }; // Shallow copy is fine here

    measureBuilder.up(); // Close measure
  } // End for each measure

  partBuilder.up(); // Close part <part>
  console.log('Generation complete. Returning MusicXML string.');
  const xmlString = root.end({ prettyPrint: true });
  return xmlString;
}

/**
 * Helper function to add a group of notes (or rests) belonging to the same logical
 * voice/chord block onto a specific staff in the MusicXML measure.
 * Handles rests if the primary note is null. Uses <chord/> for subsequent notes.
 *
 * @param measureBuilder - The xmlbuilder2 element for the current measure.
 * @param notes - Array of MIDI notes (or nulls) to add. First note determines duration/type.
 * @param staffNumber - The staff number ('1' or '2').
 * @param voiceNumber - The voice number ('1', '2', etc.).
 * @param stemDirection - The desired stem direction ('up' or 'down').
 * @param durationTicks - The duration in MusicXML divisions.
 * @param noteType - The MusicXML note type string (e.g., 'quarter').
 */
function addNotesToStaffXML(
  measureBuilder: XMLBuilder,
  notes: (number | null)[],
  staffNumber: string,
  voiceNumber: string,
  stemDirection: string,
  durationTicks: number,
  noteType: string,
): void {
  let firstElementAdded = false;

  for (let i = 0; i < notes.length; i++) {
    const midi = notes[i];

    if (midi === null) {
      // If it's the *first* note and it's null, add a rest for the voice
      if (!firstElementAdded) {
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${durationTicks}`)
          .up()
          .ele('voice')
          .txt(voiceNumber)
          .up()
          .ele('staff')
          .txt(staffNumber)
          .up()
          // <type> for rests is optional but can be included
          // .ele('type').txt(noteType).up()
          .up(); // note
        firstElementAdded = true; // Rest counts as the first element
      }
      // If subsequent notes are null, just skip them - the first note/rest holds the duration.
      continue;
    }

    // If midi is a valid note
    const pitch = midiToMusicXMLPitch(midi);
    if (pitch) {
      const noteEl = measureBuilder.ele('note');

      // Add <chord/> tag if it's not the first actual note in this block
      if (firstElementAdded) {
        noteEl.ele('chord').up();
      }

      // Add pitch details
      const pitchEl = noteEl.ele('pitch');
      pitchEl.ele('step').txt(pitch.step).up();
      if (pitch.alter !== undefined) {
        pitchEl.ele('alter').txt(`${pitch.alter}`).up();
      }
      pitchEl.ele('octave').txt(`${pitch.octave}`).up();
      pitchEl.up(); // pitch

      // Add duration, voice, type ONLY to the first actual note element
      if (!firstElementAdded) {
        noteEl.ele('duration').txt(`${durationTicks}`).up();
        noteEl.ele('type').txt(noteType).up();
        // Add notations like fermata to the first note?
      }

      noteEl.ele('stem').txt(stemDirection).up();
      noteEl.ele('voice').txt(voiceNumber).up();
      noteEl.ele('staff').txt(staffNumber).up();
      // Add notehead notations if needed? <notehead>parenthsis</notehead>

      noteEl.up(); // note
      firstElementAdded = true; // Mark that a note/rest has been added for this voice/staff block
    } else {
      console.warn(
        `Could not convert MIDI ${midi} to MusicXML pitch. Skipping note.`,
      );
      // If it's the first note and it fails, add a rest?
      if (!firstElementAdded) {
        measureBuilder
          .ele('note')
          .ele('rest')
          .up()
          .ele('duration')
          .txt(`${durationTicks}`)
          .up()
          .ele('voice')
          .txt(voiceNumber)
          .up()
          .ele('staff')
          .txt(staffNumber)
          .up()
          .up(); // note
        firstElementAdded = true;
      }
    }
  }

  // If after iterating through all notes, nothing was added (e.g., input was empty array or all nulls/invalid)
  // We should add a rest to ensure time progresses correctly.
  if (!firstElementAdded && notes.length > 0) {
    // Check notes.length > 0 to avoid adding rest for empty input array
    console.warn(
      `No valid notes or rests added for voice ${voiceNumber} on staff ${staffNumber}. Adding placeholder rest.`,
    );
    measureBuilder
      .ele('note')
      .ele('rest')
      .up()
      .ele('duration')
      .txt(`${durationTicks}`)
      .up()
      .ele('voice')
      .txt(voiceNumber)
      .up()
      .ele('staff')
      .txt(staffNumber)
      .up()
      .up(); // note
  }
}

// --- Optional: Example Usage ---
/*
// To run this example:
// 1. Make sure you have Node.js and npm installed.
// 2. Install dependencies: npm install tonal xmlbuilder2
// 3. Compile TypeScript: tsc generation.ts (or use ts-node)
// 4. Run JavaScript: node generation.js

import * as fs from 'fs'; // Node.js file system module

try {
    const key = "Eb"; // Test Eb Major
    const measures = 8;
    const meter = "4/4";
    const progression = generateChordProgression(key, measures, 5); // Moderate complexity

    // --- Settings for Melody + Accompaniment ---
    const settingsMelodyAccomp: GenerationSettings = {
        melodicSmoothness: 6, // Prioritize smooth melody
        dissonanceStrictness: 4, // Relaxed rules for accompaniment
        generationStyle: 'MelodyAccompaniment',
        numAccompanimentVoices: 3 // Standard 3-note accompaniment
    };

    console.log(`\nGenerating ${measures}m of ${key} ${meter} (Melody + Accompaniment)...`);
    const xmlOutputMelodyAccomp = generateVoices(progression, key, meter, measures, settingsMelodyAccomp);
    const filenameMelodyAccomp = 'generated_melody_accomp.musicxml';
    fs.writeFileSync(filenameMelodyAccomp, xmlOutputMelodyAccomp);
    console.log(`MusicXML saved to ${filenameMelodyAccomp}`);


    // --- Settings for SATB ---
     const settingsSATB: GenerationSettings = {
        melodicSmoothness: 5,
        dissonanceStrictness: 7, // Stricter rules for SATB
        generationStyle: 'SATB'
        // numAccompanimentVoices is ignored for SATB
    };
    console.log(`\nGenerating ${measures}m of ${key} ${meter} (SATB Chorale)...`);
    const xmlOutputSATB = generateVoices(progression, key, meter, measures, settingsSATB);
    const filenameSATB = 'generated_satb_chorale.musicxml';
    fs.writeFileSync(filenameSATB, xmlOutputSATB);
    console.log(`MusicXML saved to ${filenameSATB}`);


} catch (error) {
    console.error("\n--- ERROR DURING GENERATION ---");
    if (error instanceof Error) {
        console.error(error.message);
        if(error.stack) console.error(error.stack.split('\n').slice(0, 5).join('\n')); // Log first few lines of stack
    } else {
        console.error(error);
    }
}
*/
