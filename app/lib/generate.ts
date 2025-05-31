// src/generate.ts
import * as Tonal from 'tonal';
// create and XMLBuilder are no longer used directly in this file.
// They are used by musicXmlWriter.ts
import { InvalidInputError, MusicTheoryError, GenerationError } from './errors';
import { parseMeter, InvalidMeterError as InvalidMeterUtilError } from './generationUtils'; // Renamed to avoid conflict

import {
  GenerationSettings,
  PreviousNotes,
  PreviousNotesSATB,
  PreviousNotesMelodyAccompaniment,
  MeasureData, // NEW
  MusicalEvent, // NEW
  GeneratedPieceData, // NEW
  KeyDetails, // Assuming this type exists or define it based on Tonal.Key.Key
  TimingInfo,
  MeasureGenerationContext,
} from './types';
import {
  getChordInfoFromRoman,
  getExtendedChordNotePool,
  midiToNoteName,
} from './harmonyUtils';
import { assignSopranoOrMelodyNote } from './voicingUtils'; // Keep general utils
import { assignBassNoteSATB, assignInnerVoicesSATB } from './voicingSATB'; // Keep SATB utils
import { generateAccompanimentVoicing } from './voicingMelodyAccomp'; // Keep M+A utils
import { checkVoiceLeadingRules } from './rules';
import {
  getNoteTypeFromDuration, // midiToMusicXMLPitch is now used in musicXmlWriter.ts
} from './musicxmlUtils';
import { createMusicXMLString } from './musicXmlWriter';

/**
 * Represents the melodic state used for guiding melody generation.
 * This includes tracking the last direction of movement and the number of consecutive
 * movements in that direction (streak).
 */
interface MelodicState {
  /** The last melodic direction: -1 for down, 0 for repeat/start, 1 for up. */
  lastDirection: number;
  /** The number of consecutive times the melody has moved in the `lastDirection`. */
  directionStreak: number;
}

interface ProcessMeasureResult {
  measureEvents: MusicalEvent[];
  notesAtEndOfMeasure: PreviousNotes;
  // melodicState is mutable, so we don't strictly need to return it if the original object is modified.
  // However, if we wanted to treat it immutably within processMeasure, we'd return it.
  // For now, let's assume melodicState is mutated directly.
}

/**
 * Orchestrates the entire music generation process.
 * It first generates an intermediate musical data structure based on the inputs,
 * then converts this structure into a MusicXML string.
 *
 * @param {string[]} chordProgression - An array of Roman numeral chord symbols (e.g., ["I", "V7", "vi", "IV"]).
 * @param {string} keySignature - The key signature for the piece (e.g., "C", "Gm", "F#maj").
 * @param {string} meter - The time signature in "beats/beatValue" format (e.g., "4/4", "3/4").
 * @param {number} numMeasures - The total number of measures to generate.
 * @param {GenerationSettings} generationSettings - An object containing settings that control the generation style and parameters.
 * @returns {string} A string containing the generated music in MusicXML format.
 * @throws {InvalidInputError} If the provided key signature or meter is invalid.
 * @throws {MusicTheoryError} If there's an issue resolving musical elements (e.g., Roman numerals).
 * @throws {GenerationError} If an unexpected internal error occurs during generation.
 */
export function generateVoices(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): string {
  // 1. Generate the intermediate musical data structure
  const musicalData = generateMusicalData(
    chordProgression,
    keySignature,
    meter,
    numMeasures,
    generationSettings,
  );

  // 2. Convert the musical data structure to a MusicXML string
  const musicXMLString = createMusicXMLString(musicalData);

  console.info('[INFO] Generation complete. Returning MusicXML string.');
  return musicXMLString;
}

// --- Helper Functions ---

/**
 * Validates the provided key signature and meter, then calculates essential timing information
 * used throughout the generation process.
 *
 * @param {string} keySignature - The key signature (e.g., "C", "Gm").
 * @param {string} meter - The time signature (e.g., "4/4").
 * @returns {{ keyDetails: KeyDetails; timingInfo: TimingInfo }} An object containing:
 *            - `keyDetails`: Information about the key (tonic, type, etc.) from Tonal.js.
 *            - `timingInfo`: Calculated timing values like ticks per beat and measure.
 * @throws {InvalidInputError} If the key signature or meter format is invalid or unsupported.
 */
function initializeGenerationParameters(
  keySignature: string,
  meter: string,
): { keyDetails: KeyDetails; timingInfo: TimingInfo } {
  const keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails || !keyDetails.tonic) { // Added !keyDetails.tonic for robustness
    throw new InvalidInputError('Invalid key signature: ' + keySignature);
  }

  let meterBeats: number;
  let beatValue: number;

  try {
    const parsed = parseMeter(meter);
    meterBeats = parsed.beats;
    beatValue = parsed.beatType;
  } catch (e) {
    if (e instanceof InvalidMeterUtilError) {
      // Propagate the message from parseMeter's InvalidMeterError, but as an InvalidInputError
      throw new InvalidInputError(e.message);
    }
    // For other unexpected errors from parseMeter (if any)
    throw new InvalidInputError("Meter processing failed: " + (e as Error).message);
  }

  // Timing Calculation
  // TODO: Consider making divisions a configurable parameter in GenerationSettings
  const divisions = 4; // Divisions per quarter note (hardcoded for now, could be a setting)
  const beatDurationTicks = divisions * (4 / beatValue);
  const measureDurationTicks = meterBeats * beatDurationTicks;
  const defaultNoteType = getNoteTypeFromDuration(
    measureDurationTicks,
    divisions,
  );

  const timingInfo: TimingInfo = {
    meterBeats,
    beatValue,
    divisions,
    beatDurationTicks,
    measureDurationTicks,
    defaultNoteType,
  };

  return { keyDetails, timingInfo };
}

/**
 * Initializes the data structure for tracking the last played notes for each voice/part.
 * The structure depends on the chosen generation style (SATB or MelodyAccompaniment).
 *
 * @param {GenerationSettings['generationStyle']} style - The music generation style.
 * @param {number} [numAccompanimentVoices=3] - The number of voices in the accompaniment (used for MelodyAccompaniment style).
 * @returns {PreviousNotes} An initialized `PreviousNotes` object with all note slots set to `null`.
 */
function initializePreviousNotes(
  style: GenerationSettings['generationStyle'],
  numAccompanimentVoices: number = 3,
): PreviousNotes {
  if (style === 'SATB') {
    return { soprano: null, alto: null, tenor: null, bass: null };
  } else {
    return {
      melody: null,
      accompaniment: Array(numAccompanimentVoices).fill(null),
    };
  }
}

/**
 * Defines a rhythmic pattern for a measure, creating a sequence of duration factors.
 * These factors are relative to the `beatDurationTicks`. For example, in 4/4 time,
 * if `beatDurationTicks` corresponds to a quarter note, a factor of 1.0 is a quarter note,
 * 0.5 is an eighth note, etc.
 *
 * The function attempts to fill the measure duration (`measureDurationTicks`) by selecting
 * rhythmic patterns for each beat.
 *
 * @param {TimingInfo} timingInfo - An object containing detailed timing information for the current piece,
 *                                  such as beats per measure, ticks per beat, and total measure duration in ticks.
 * @param {number} [complexity=3] - A numerical value (typically 0-10, though the function maps it to 0.1-0.9)
 *                                  that influences the probability of choosing more rhythmically complex patterns.
 *                                  Higher values increase the chance of shorter, more subdivided notes.
 * @returns {number[]} An array of duration factors. Each factor is relative to the duration of a single beat
 *                     (defined in `timingInfo.beatDurationTicks`). For example, in a 4/4 measure where a beat
 *                     is a quarter note, a factor of 1.0 represents a quarter note duration, 0.5 represents
 *                     an eighth note, and 2.0 would represent a half note. The sum of durations derived from
 *                     these factors should ideally fill one complete measure.
 */
function getRhythmicPattern(
  timingInfo: TimingInfo,
  complexity: number = 3, // Default complexity, will be normalized
): number[] {
  const { meterBeats, beatDurationTicks, measureDurationTicks } = timingInfo;
  const patternFactors: number[] = [];
  let accumulatedTicks = 0;

  // Normalize complexity to a probability factor (0.1 to 0.9).
  // Higher complexity increases the chance of selecting patterns with shorter notes.
  const subdivisionChance = Math.max(0.1, Math.min(0.9, complexity / 10));

  // Define available rhythmic patterns that can be applied to a single beat.
  // Each inner array represents a pattern option and contains:
  //   - [0]: A probability weight. Higher values make the pattern more likely to be chosen.
  //          The weights are influenced by `subdivisionChance`.
  //   - [1]: An array of duration factors. These factors are relative to `beatDurationTicks`.
  //          For example, in 4/4 time where `beatDurationTicks` is for a quarter note:
  //            - `[1.0]` represents a single quarter note.
  //            - `[0.5, 0.5]` represents two eighth notes.
  // The sum of factors in the array determines the total duration of that pattern element relative to a single beat.
  const beatPatterns: [number, number[]][] = [
    // Simpler patterns (e.g., a single note filling the beat) get higher weight if `subdivisionChance` is low.
    [1.0 - subdivisionChance, [1.0]], // e.g., One quarter note in 4/4.
    // Subdivided patterns (e.g., multiple shorter notes within a beat) get higher weight if `subdivisionChance` is high.
    [subdivisionChance, [0.5, 0.5]], // e.g., Two eighth notes in 4/4.
    // TODO: Consider expanding with more complex patterns, ensuring `divisions` in `TimingInfo` supports them.
    // Examples:
    // [subdivisionChance * 0.7, [0.75, 0.25]], // Dotted Eighth + Sixteenth
    // [subdivisionChance * 0.5, [0.25, 0.25, 0.5]], // Two Sixteenths + Eighth
  ];

  // Iterate through each beat of the measure to build the rhythmic pattern.
  for (let beatIndex = 0; beatIndex < meterBeats; beatIndex++) {
    if (accumulatedTicks >= measureDurationTicks) {
      // Measure is already full or exceeded
      break;
    }

    const remainingMeasureTicks = measureDurationTicks - accumulatedTicks;
    // Ticks available for the current beat; cannot exceed remaining measure ticks or standard beat duration.
    const currentBeatAvailableTicks = Math.min(
      beatDurationTicks,
      remainingMeasureTicks,
    );

    if (currentBeatAvailableTicks <= 0) { // No time left in the measure for this beat
        continue;
    }

    // Filter the available `beatPatterns` to find those that can fit within the `currentBeatAvailableTicks`.
    // This ensures that a chosen pattern doesn't exceed the time remaining for the current beat,
    // especially important if the beat is already partially filled or if it's the last beat of a measure
    // that might not be a full beat's duration (e.g. an anacrusis, though not explicitly handled here).
    const applicablePatterns = beatPatterns.filter((patternOption) => {
      // Calculate the total duration in ticks for the current patternOption.
      const patternDurationTicks =
        patternOption[1].reduce((sum, factor) => sum + factor, 0) * beatDurationTicks;
      // Check if this pattern's duration is less than or equal to the available ticks for this beat.
      // A small tolerance (0.001) is added to handle potential floating-point inaccuracies.
      return patternDurationTicks <= currentBeatAvailableTicks + 0.001;
    });

    let chosenFactors: number[];
    if (applicablePatterns.length === 0) {
      // If no standard pattern from `beatPatterns` fits (e.g., `currentBeatAvailableTicks` is too small
      // or an unusual fraction of a beat), create a single duration factor that fills exactly
      // the `currentBeatAvailableTicks`.
      chosenFactors = [currentBeatAvailableTicks / beatDurationTicks];
    } else {
      // If there are applicable standard patterns, perform a weighted random selection.
      // 1. Calculate the sum of all probability weights of the applicable patterns.
      const totalWeight = applicablePatterns.reduce((sum, p) => sum + p[0], 0,);
      // 2. Generate a random number between 0 and totalWeight.
      let randomRoll = Math.random() * totalWeight;
      // 3. Set a default choice to the last applicable pattern. This acts as a fallback
      //    if the random selection logic somehow fails (e.g. if totalWeight is 0, though guarded against).
      chosenFactors = applicablePatterns[applicablePatterns.length - 1][1];

      // 4. Iterate through applicable patterns, subtracting their weight from `randomRoll`.
      //    The first pattern for which `randomRoll` becomes less than or equal to 0 is chosen.
      //    This implements the weighted random selection.
      for (const pattern of applicablePatterns) {
        randomRoll -= pattern[0];
        if (randomRoll <= 0) {
          chosenFactors = pattern[1];
          break;
        }
      }
    }

    patternFactors.push(...chosenFactors);
    const ticksForChosenFactors = chosenFactors.reduce(
      (sum, factor) => sum + factor * beatDurationTicks,
      0,
    );
    accumulatedTicks += ticksForChosenFactors;

  } // End beat loop

  // --- Final Adjustment to Ensure Precise Measure Duration ---
  // The beat-by-beat generation process and floating-point arithmetic with factors can lead to
  // the sum of generated durations slightly deviating from the target `measureDurationTicks`.
  // This section aims to correct such discrepancies by adjusting the last rhythmic factor.

  // Calculate the total duration in ticks based on the generated `patternFactors`.
  // Using `Math.round()` for each factor's contribution to `totalPatternTicksInMeasure` helps
  // align with how durations are often handled as integers in MusicXML and avoids compounding
  // very small floating point errors before the final adjustment.
  const totalPatternTicksInMeasure = patternFactors.reduce(
    (sum, factor) => sum + Math.round(factor * beatDurationTicks),
    0,
  );
  
  // If there are any generated factors and a notable difference exists:
  if (patternFactors.length > 0) {
    // Calculate the difference between the target measure duration and the generated total.
    const differenceInTicks = measureDurationTicks - totalPatternTicksInMeasure;

    // If the difference is significant (more than a tiny fraction of a tick):
    if (Math.abs(differenceInTicks) > 0.01) {
      const lastFactorIndex = patternFactors.length - 1;
      // Original duration of the last factor in (potentially fractional) ticks.
      const lastFactorOriginalDurationTicks = patternFactors[lastFactorIndex] * beatDurationTicks;
      // Adjust the last factor's original duration by the calculated difference.
      const adjustedLastFactorDurationTicks = lastFactorOriginalDurationTicks + differenceInTicks;

      if (adjustedLastFactorDurationTicks > 0) {
        // If the adjusted duration is positive, update the last factor.
        // Convert the adjusted tick duration back into a factor relative to `beatDurationTicks`.
        patternFactors[lastFactorIndex] = adjustedLastFactorDurationTicks / beatDurationTicks;
      } else {
        // If the adjustment makes the last factor's duration zero or negative, this is problematic.
        // This could indicate an issue with initial pattern generation or very small measure durations
        // where the adjustment logic is too aggressive.
        // A warning is logged, and the pattern might not perfectly fill the measure.
        console.warn(
          `[WARN] getRhythmicPattern: Final adjustment for measure failed. Adjusted last duration would be <= 0 (${adjustedLastFactorDurationTicks.toFixed(2)}). Original total from rounded factors: ${totalPatternTicksInMeasure.toFixed(2)} vs target ${measureDurationTicks.toFixed(2)}. Factors: [${patternFactors.map(f => f.toFixed(3)).join(',')}]`
        );
      }
    }
  } else if (measureDurationTicks > 0 && accumulatedTicks <= 0) {
    // This handles a rare edge case: if no factors were generated at all for a measure that should have duration
    // (e.g., if `meterBeats` was 0 or some other unusual state where the beat loop didn't run).
    // In such a case, fill the measure with a single rhythmic event that spans the entire measure duration.
    patternFactors.push(measureDurationTicks / beatDurationTicks);
    console.warn(
      `[WARN] getRhythmicPattern: No rhythmic factors generated for a measure with target duration ${measureDurationTicks}. Filled with a single factor for the whole measure.`
    );
  }

  return patternFactors;
}

/**
 * Generates musical events for a single rhythmic event (e.g., a beat) within a measure.
 * Includes arpeggiation for Melody/Accompaniment style during shorter durations.
 * Generates the musical notes for a single rhythmic event within a measure.
 * This function handles voicing for different styles (SATB, MelodyAccompaniment) and
 * includes logic for arpeggiation in the MelodyAccompaniment style for shorter durations.
 *
 * @param {number[]} baseChordNotes - An array of MIDI note numbers representing the current chord in root position (sorted).
 * @param {(number | null)} requiredBassPc - The pitch class (0-11) of the required bass note for the current chord inversion.
 *                                        Null if the chord is in root position or no specific bass is required.
 * @param {PreviousNotes} previousNotes - An object holding the MIDI notes of all voices/parts from the immediately preceding rhythmic event.
 *                                      Used for voice leading and smoothness.
 * @param {GenerationSettings} generationSettings - Global settings for music generation, including style, smoothness, etc.
 * @param {KeyDetails} keyDetails - Information about the current key signature (tonic, type, scale).
 * @param {TimingInfo} timingInfo - Timing information for the piece (divisions, ticks per beat).
 * @param {number} eventDurationTicks - The duration of the current rhythmic event in MusicXML ticks.
 * @param {MelodicState} [melodicState] - Optional. State information for guiding melodic line generation,
 *                                     including last direction and streak. Used primarily for 'MelodyAccompaniment' style.
 * @returns {{ currentNotes: PreviousNotes; eventNotes: MusicalEvent[] }} An object containing:
 *            - `currentNotes`: The set of MIDI notes chosen for each voice/part in this event.
 *                              This will serve as `previousNotes` for the next event.
 *            - `eventNotes`: An array of `MusicalEvent` objects (notes or rests) ready for MusicXML conversion.
 * @throws {MusicTheoryError} If essential chord information (like rootMidi) is missing from `baseChordNotes`.
 */
function generateNotesForEvent(
  baseChordNotes: number[],
  requiredBassPc: number | null,
  previousNotes: PreviousNotes,
  generationSettings: GenerationSettings,
  keyDetails: KeyDetails,
  timingInfo: TimingInfo,
  eventDurationTicks: number,
  melodicState?: MelodicState,
): { currentNotes: PreviousNotes; eventNotes: MusicalEvent[] } {
  const {
    melodicSmoothness,
    generationStyle,
    numAccompanimentVoices = 3, // Default if not provided
  } = generationSettings;
  const { divisions, beatDurationTicks } = timingInfo;

  const chordRootMidi = baseChordNotes[0]; // Assumes baseChordNotes is sorted and has at least one note
  const chordPcs = baseChordNotes.map((n) => n % 12);
  const fullChordNotePool = getExtendedChordNotePool(baseChordNotes); // Extended pool for wider octave choices

  let currentNotes: PreviousNotes; // To store the notes chosen in this event for the next event's context
  const eventNotes: MusicalEvent[] = []; // MusicXML events generated for this single rhythmic event
  const eventNoteType = getNoteTypeFromDuration(eventDurationTicks, divisions); // e.g., "quarter", "eighth"

  if (generationStyle === 'SATB') {
    // --- SATB Voicing Logic ---
    const prevSATB = previousNotes as PreviousNotesSATB;

    // Determine bass note based on required pitch class (for inversions) or root.
    const bass = assignBassNoteSATB(
      requiredBassPc,
      chordRootMidi,
      fullChordNotePool,
      prevSATB.bass, // Previous bass note for smoothness
      melodicSmoothness,
    );

    // Determine soprano note.
    const soprano = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevSATB.soprano, // Previous soprano for smoothness
      melodicSmoothness,
      'SATB', // Style hint for assignSopranoOrMelodyNote
      keyDetails.tonic, // Key tonic might influence melodic choices
      melodicState, // Pass melodic state for contour logic (though less critical for SATB soprano typically)
    );

    // Determine inner voices (alto and tenor).
    const { tenorNoteMidi: tenor, altoNoteMidi: alto } = assignInnerVoicesSATB(
      chordPcs, // Pitch classes of the current chord
      fullChordNotePool, // Full range of notes for the chord
      prevSATB.tenor, // Previous tenor for smoothness
      prevSATB.alto, // Previous alto for smoothness
      soprano, // Current soprano (boundary for inner voices)
      bass, // Current bass (boundary for inner voices)
      melodicSmoothness,
      keyDetails, // Key details might influence inner voice choices (e.g., avoiding certain dissonances)
    );

    currentNotes = { soprano, alto, tenor, bass }; // Update current notes state

    // Prepare notes for XML: Staff 1 (Soprano, Alto), Staff 2 (Tenor, Bass)
    const staff1Notes = [soprano, alto].filter(n => n !== null) as number[];
    const staff2Notes = [tenor, bass].filter(n => n !== null) as number[];
    
    // Determine stem directions (simple heuristic based on pitch)
    let staff1Stem: 'up' | 'down' = (soprano !== null && soprano >= 71) ? 'down' : 'up'; // Approx G4 on treble
    let staff2Stem: 'up' | 'down' = (tenor !== null && tenor <= 55) ? 'up' : 'down'; // Approx G3 on bass

    // Create MusicXML events (block chords for SATB)
    if (staff1Notes.length > 0) {
      eventNotes.push(
        ...createStaffEvents(staff1Notes, '1', '1', staff1Stem, eventDurationTicks, eventNoteType),
      );
    }
    if (staff2Notes.length > 0) {
      eventNotes.push(
        ...createStaffEvents(staff2Notes, '2', '2', staff2Stem, eventDurationTicks, eventNoteType),
      );
    }
  } else {
    // --- Melody & Accompaniment Voicing Logic ---
    const prevMA = previousNotes as PreviousNotesMelodyAccompaniment;

    // Generate Melody note first.
    const melody = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevMA.melody, // Previous melody note for smoothness
      melodicSmoothness,
      'MelodyAccompaniment', // Style hint
      keyDetails.tonic,
      melodicState, // Pass melodic state for contour logic
    );
    // Determine stem direction for melody note.
    let melodyStem: 'up' | 'down' = (melody !== null && melody >= 71) ? 'down' : 'up'; // Approx G4

    // Add melody note event to Staff 1.
    if (melody !== null) {
      eventNotes.push(
        ...createStaffEvents([melody], '1', '1', melodyStem, eventDurationTicks, eventNoteType),
      );
    }


    // Generate Accompaniment notes (Staff 2).
    // This function aims to find a good voicing for the accompaniment based on various factors.
    const accompanimentVoicing = generateAccompanimentVoicing(
      melody, // Current melody note (to avoid collisions, maintain distance)
      chordRootMidi,
      chordPcs,
      fullChordNotePool,
      prevMA.accompaniment, // Previous accompaniment notes for smooth voice leading
      melodicSmoothness,
      numAccompanimentVoices,
    );
    // Filter out nulls (if any voice couldn't be placed) and sort low to high for arpeggiation or block chord.
    const validAccompNotes = accompanimentVoicing
      .filter((n): n is number => n !== null) // Type guard to ensure only numbers remain
      .sort((a, b) => a - b); // Sort from lowest to highest pitch

    /**
     * Arpeggiation criteria:
     * 1. Event duration is shorter than a full beat (defined by `ARPEGGIATE_THRESHOLD_TICKS`).
     * 2. At least 2 accompaniment notes are available to create an arpeggio.
     */
    const ARPEGGIATE_THRESHOLD_TICKS = beatDurationTicks;
    const shouldArpeggiate =
      eventDurationTicks < ARPEGGIATE_THRESHOLD_TICKS && // Arpeggiate if event is shorter than a beat
      validAccompNotes.length > 1; // And there are multiple notes to arpeggiate

    // Set stem direction based on note range for accompaniment
    let accompStemDirection: 'up' | 'down' = 'down'; // Default to down
    if (validAccompNotes.length > 0) {
      const highestAccompNote = validAccompNotes[validAccompNotes.length - 1];
      if (highestAccompNote <= 55) { // Notes below G3 get upward stems
        accompStemDirection = 'up';
      }
    }

    if (shouldArpeggiate) {
      // console.log(
      //   `      Accompaniment: Arpeggiating [${validAccompNotes.map(midiToNoteName).join(', ')}]`,
      // );
      // Distribute total duration evenly among arpeggiated notes
      const numArpeggioNotes = validAccompNotes.length;
      // Calculate base duration for each arpeggiated note, ensuring it's at least 1 tick.
      const baseArpeggioNoteDuration = Math.max(
        1, // Minimum 1 tick
        Math.floor(eventDurationTicks / numArpeggioNotes), // Integer division
      );
      let remainingArpeggioTicks = eventDurationTicks; // Total ticks to distribute

      // Create ascending arpeggio pattern
      for (let i = 0; i < numArpeggioNotes; i++) {
        const noteMidi = validAccompNotes[i];
        
        // The last note takes all remaining ticks to ensure the total event duration is met precisely.
        // Other notes take the baseArpeggioNoteDuration.
        const currentArpeggioNoteDuration =
          i === numArpeggioNotes - 1 ? remainingArpeggioTicks : baseArpeggioNoteDuration;

        // Skip if for some reason the calculated duration is not positive
        if (currentArpeggioNoteDuration <= 0) continue;

        const arpeggioNoteType = getNoteTypeFromDuration(
          currentArpeggioNoteDuration,
          divisions,
        );

        eventNotes.push({
          type: 'note',
          midi: noteMidi,
          durationTicks: currentArpeggioNoteDuration,
          staffNumber: '2', // Accompaniment staff
          voiceNumber: '2', // Accompaniment voice
          stemDirection: accompStemDirection,
          noteType: arpeggioNoteType,
          isChordElement: false, // Individual notes in an arpeggio are not chord elements in XML <chord/> sense
        });
        remainingArpeggioTicks -= currentArpeggioNoteDuration;
      }
       // Safety check: if remaining ticks are somehow still positive, it means durations didn't sum up.
      if (remainingArpeggioTicks > 0) {
        console.warn(`[WARN] Arpeggiation Warning: ${remainingArpeggioTicks} ticks remaining after arpeggiating ${eventDurationTicks} total. This may indicate a calculation error.`);
        // Potentially, the last note's duration could be adjusted here if this case occurs.
        // However, with current logic (last note takes all remaining), this should not be hit.
      }

    } else {
      // If not arpeggiating, create a block chord for the accompaniment.
      // console.log(
      //   `      Accompaniment: Block Chord [${validAccompNotes.map(midiToNoteName).join(', ')}] for ${eventDurationTicks} ticks.`, // Log duration
      // );
      if (validAccompNotes.length > 0) {
        eventNotes.push(
          ...createStaffEvents(
            validAccompNotes,
            '2', // Staff number
            '2', // Voice number for accompaniment on staff 2
            accompStemDirection,
            eventDurationTicks, // Duration for the entire block chord
            eventNoteType,
          ),
        );
      }
    }

    // Update current notes state for the next event.
    // The accompaniment part of the state should be the full chosen voicing,
    // not just the arpeggiated notes, to ensure smooth transitions to the *next* chord voicing.
    currentNotes = { melody, accompaniment: accompanimentVoicing };
  } // End of MelodyAccompaniment style block

  // Return the chosen notes for this event (for context of the next event)
  // and the list of MusicXML events generated.
  return { currentNotes, eventNotes };
}

/**
 * Creates note or rest events for a single staff and voice.
 * Creates an array of `MusicalEvent` objects (notes or rests) for a single staff and voice,
 * intended for later conversion to MusicXML.
 * If multiple valid MIDI notes are provided, they are created as a chord (the first note
 * is a standard note, subsequent notes have `isChordElement: true`).
 * If no valid notes are provided (e.g., `notes` is empty or contains only `null`), a single rest event is generated.
 *
 * @param {(number | null)[]} notes - An array of MIDI note numbers. A `null` value in the array
 *                                    is typically ignored unless it's the only content, leading to a rest.
 *                                    For chords, all numbers should be valid MIDI notes.
 * @param {string} staffNumber - The target staff number as a string (e.g., "1", "2").
 * @param {string} voiceNumber - The voice number within the staff as a string (e.g., "1", "2").
 * @param {('up' | 'down')} stemDirection - The desired direction of note stems in MusicXML.
 * @param {number} durationTicks - The duration of the event(s) in MusicXML divisions/ticks.
 * @param {string} noteType - The MusicXML note type string (e.g., "quarter", "eighth", "half").
 * @returns {MusicalEvent[]} An array of `MusicalEvent` objects. This will contain one rest event
 *                           if no valid notes are provided, or one or more note events if valid
 *                           MIDI notes are given.
 */
function createStaffEvents(
  notes: (number | null)[],
  staffNumber: string,
  voiceNumber: string,
  stemDirection: 'up' | 'down',
  durationTicks: number,
  noteType: string,
): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  const validNotes = notes.filter((n): n is number => n !== null);

  if (validNotes.length === 0) {
    events.push({
      type: 'rest',
      durationTicks: durationTicks,
      staffNumber: staffNumber,
      voiceNumber: voiceNumber,
      noteType: noteType,
    });
  } else {
    validNotes.forEach((midi, index) => {
      events.push({
        type: 'note',
        midi: midi,
        durationTicks: durationTicks,
        staffNumber: staffNumber,
        voiceNumber: voiceNumber,
        stemDirection: stemDirection,
        noteType: noteType,
        isChordElement: index > 0,
      });
    });
  }
  return events;
}

/**
 * Creates MusicXML events for rests that fill a specific duration.
 * Creates an array containing a single rest `MusicalEvent` for a specified duration,
 * staff, and voice. This is a utility for generating rests to fill time.
 *
 * @param {number} durationTicks - The duration of the rest in MusicXML divisions/ticks.
 * @param {string} noteType - The MusicXML note type string for the rest (e.g., "quarter", "whole").
 * @param {('1' | '2')} staff - The staff number ('1' for upper, '2' for lower) where the rest will be placed.
 * @param {string} voice - The voice number string (e.g., "1") for the rest on that staff.
 * @returns {MusicalEvent[]} An array containing one rest `MusicalEvent`.
 */
function generateRestEventsForDuration(
  durationTicks: number,
  noteType: string,
  staff: '1' | '2',
  voice: string,
): MusicalEvent[] {
  return [
    {
      type: 'rest',
      durationTicks: durationTicks,
      staffNumber: staff,
      voiceNumber: voice,
      noteType: noteType,
    },
  ];
}

// --- Core Music Generation Logic (Refactored) ---

/**
 * Processes a single measure, generating its musical events based on the chord, rhythm, and voice leading.
 *
 * @param romanWithInv The Roman numeral for the current measure.
 * @param keySignature The key signature of the piece.
 * @param measurePreviousNotes Notes from the end of the *previous* measure, for voice leading context.
 * @param generationSettings Global settings for generation.
 * @param keyDetails Details about the current key.
 * @param timingInfo Timing information for the piece.
 * @param melodicState Current melodic state (mutated by this function if melody generation occurs).
 * @param measureIndex Index of the current measure (for logging/context).
 * @returns {ProcessMeasureResult} The generated events and the state of notes at the end of this measure.
 */
function processMeasure(
  romanWithInv: string,
  keySignature: string,
  measurePreviousNotes: PreviousNotes, // Notes from the end of the PREVIOUS measure
  generationSettings: GenerationSettings,
  keyDetails: KeyDetails,
  timingInfo: TimingInfo,
  melodicState: MelodicState, // This can be mutated by generateNotesForEvent
  measureIndex: number,
): ProcessMeasureResult {
  const { generationStyle, numAccompanimentVoices, rhythmicComplexity, dissonanceStrictness } = generationSettings;
  const currentMeasureEvents: MusicalEvent[] = [];
  
  // This variable will track the 'previousNotes' context *within* the current measure,
  // updating from one rhythmic event to the next. It starts with the notes from the end of the previous measure.
  let eventPreviousNotesHolder = { ...measurePreviousNotes };

  let chordInfoResult;
  try {
    chordInfoResult = getChordInfoFromRoman(romanWithInv, keySignature);
  } catch (e) {
    console.warn(`[WARN] processMeasure: Measure ${measureIndex + 1}: Error processing Roman numeral "${romanWithInv}". Error: ${(e as Error).message}. Adding rests.`);
    chordInfoResult = null;
  }

  if (!chordInfoResult) {
    // --- Handle Chord Parsing Error or null result ---
    const restType = getNoteTypeFromDuration(timingInfo.measureDurationTicks, timingInfo.divisions);
    currentMeasureEvents.push(...generateRestEventsForDuration(timingInfo.measureDurationTicks, restType, '1', '1'));
    currentMeasureEvents.push(...generateRestEventsForDuration(timingInfo.measureDurationTicks, restType, '2', '2'));
    
    // If chord parsing fails, the context for the next measure is effectively reset.
    return {
      measureEvents: currentMeasureEvents,
      notesAtEndOfMeasure: initializePreviousNotes(generationStyle, numAccompanimentVoices),
    };
  }

  // --- Valid Chord: Generate Rhythmic Events ---
  const { notes: baseChordNotes, requiredBassPc } = chordInfoResult;
  const rhythmicPatternFactors = getRhythmicPattern(timingInfo, rhythmicComplexity);
  let currentTickInMeasure = 0;

  for (let eventIndex = 0; eventIndex < rhythmicPatternFactors.length; eventIndex++) {
    if (currentTickInMeasure >= timingInfo.measureDurationTicks) {
      break; 
    }

    const durationFactor = rhythmicPatternFactors[eventIndex];
    let eventDurationTicks = Math.round(timingInfo.beatDurationTicks * durationFactor);

    if (currentTickInMeasure + eventDurationTicks > timingInfo.measureDurationTicks) {
      const originalEventDuration = eventDurationTicks;
      eventDurationTicks = timingInfo.measureDurationTicks - currentTickInMeasure;
      console.warn(
        `[WARN] processMeasure: Measure ${measureIndex + 1}, Event ${eventIndex + 1}: Duration factor ${durationFactor.toFixed(2)} (orig: ${originalEventDuration} ticks) truncated to ${eventDurationTicks} ticks to fit measure. Current: ${currentTickInMeasure}/${timingInfo.measureDurationTicks}.`,
      );
    }

    if (eventDurationTicks <= 0) {
      continue;
    }
    
    const eventGenerationResult = generateNotesForEvent(
      baseChordNotes,
      requiredBassPc,
      eventPreviousNotesHolder, // Context from the previous event *within this measure*
      generationSettings,
      keyDetails,
      timingInfo,
      eventDurationTicks,
      melodicState, // Pass and allow mutation by assignSopranoOrMelodyNote
    );

    currentMeasureEvents.push(...eventGenerationResult.eventNotes);

    checkVoiceLeadingRules(
      eventGenerationResult.currentNotes, // Notes chosen for *this* event
      eventPreviousNotesHolder,       // Notes from the *previous event in this measure*
      generationStyle,
      measureIndex,
      eventIndex,
      dissonanceStrictness,
    );

    // Update eventPreviousNotesHolder for the *next event in this measure*
    eventPreviousNotesHolder = eventGenerationResult.currentNotes;
    currentTickInMeasure += eventDurationTicks;
  } // End rhythmic event loop for the measure

  // Add trailing rests if the rhythmic pattern didn't exactly fill the measure
  if (currentTickInMeasure < timingInfo.measureDurationTicks) {
    const remainingTicks = timingInfo.measureDurationTicks - currentTickInMeasure;
    if (remainingTicks > 0) {
      const restType = getNoteTypeFromDuration(remainingTicks, timingInfo.divisions);
      currentMeasureEvents.push(...generateRestEventsForDuration(remainingTicks, restType, '1', '1'));
      currentMeasureEvents.push(...generateRestEventsForDuration(remainingTicks, restType, '2', '2'));
    }
  }
  
  return {
    measureEvents: currentMeasureEvents,
    notesAtEndOfMeasure: eventPreviousNotesHolder, // This is the state at the end of the current measure
  };
}

/**
 * Generates the primary intermediate musical data structure (`GeneratedPieceData`) for a piece of music.
 * This function orchestrates the measure-by-measure generation of notes and rests based on
 * the provided chord progression, key, meter, and other settings. It does *not* produce
 * the final MusicXML string but rather the structured data that `createMusicXMLString` will use.
 *
 * @param {string[]} chordProgression - An array of Roman numeral chord symbols.
 * @param {string} keySignature - The key for the piece (e.g., "Cmaj", "Amin").
 * @param {string} meter - The time signature (e.g., "4/4").
 * @param {number} numMeasures - The total number of measures to generate.
 * @param {GenerationSettings} generationSettings - Configuration object for generation parameters.
 * @returns {GeneratedPieceData} An object containing metadata and an array of `MeasureData` objects,
 *                               representing the complete musical piece.
 * @throws {InvalidInputError} If `initializeGenerationParameters` fails due to invalid key/meter.
 * @throws {MusicTheoryError} If `getChordInfoFromRoman` or other music theory utilities fail critically.
 * @throws {GenerationError} For other unexpected errors during the generation logic.
 */
export function generateMusicalData(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): GeneratedPieceData {
  const { generationStyle, numAccompanimentVoices } = generationSettings;

  // --- 1. Initialization ---
  const { keyDetails, timingInfo } = initializeGenerationParameters(keySignature, meter);
  // previousNotesForNextMeasure will hold the notes state from the end of the *previous* measure,
  // to be passed as context to the *current* measure's processing.
  let previousNotesForNextMeasure = initializePreviousNotes(generationStyle, numAccompanimentVoices);
  const generatedMeasures: MeasureData[] = [];
  const melodicState: MelodicState = { lastDirection: 0, directionStreak: 0 }; // Initial melodic state

  console.info(`[INFO] Generating ${numMeasures} measures in ${keySignature} ${generationStyle} style.`);

  // --- 2. Generate Measures Loop ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const romanWithInv = chordProgression[measureIndex] ?? 'I'; // Default to 'I' if progression is too short


    const measureResult = processMeasure(
      romanWithInv,
      keySignature,
      previousNotesForNextMeasure, // Pass notes from the end of the previous measure
      generationSettings,          // Pass all settings for processMeasure to destructure as needed
      keyDetails,
      timingInfo,
      melodicState,                // Pass and allow mutation by functions within processMeasure
      measureIndex,
    );

    generatedMeasures.push({
      measureNumber: measureIndex + 1,
      romanNumeral: romanWithInv,
      events: measureResult.measureEvents,
    });

    // Update previousNotesForNextMeasure for the *next* iteration of the loop,
    // using the notes from the end of the measure just processed.
    previousNotesForNextMeasure = measureResult.notesAtEndOfMeasure;

  } // End measure loop

  // --- 3. Construct Final Data Structure ---
  const pieceData: GeneratedPieceData = {
    metadata: {
      title: `Generated Music (${generationStyle} Style)`,
      software: 'Music Generator',
      encodingDate: new Date().toISOString().split('T')[0],
      partName:
        generationStyle === 'SATB' ? 'Choral SATB' : 'Melody + Accompaniment',
      keySignature: keySignature,
      meter: meter,
      numMeasures: numMeasures,
      generationStyle: generationStyle,
      divisions: timingInfo.divisions, // Add this line
    },
    measures: generatedMeasures,
  };

  return pieceData;
}

// All MusicXML generation logic, including createMusicXMLString, 
// addMusicalEventsToXML, and getFifths, has been moved to app/lib/musicXmlWriter.ts.
// The function createMusicXMLString is imported from there and used in generateVoices.
