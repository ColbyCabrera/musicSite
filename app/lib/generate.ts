// src/generate.ts
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { InvalidInputError, MusicTheoryError, GenerationError } from './errors';

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
  midiToMusicXMLPitch, // Keep MusicXML helpers
  getNoteTypeFromDuration,
} from './musicxmlUtils';

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

  console.log('Generation complete. Returning MusicXML string.');
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

  // Meter Validation and Parsing
  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch) {
    throw new InvalidInputError(
      "Invalid meter format. Expected 'beats/beatValue', e.g., '4/4'. Received: " +
        meter,
    );
  }
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);

  if (isNaN(meterBeats) || isNaN(beatValue) || meterBeats <= 0) { // Added isNaN checks
    throw new InvalidInputError(
      `Invalid meter beats or beat value: ${beatsStr}/${beatValueStr}. Both must be positive numbers.`,
    );
  }
  if (![1, 2, 4, 8, 16, 32].includes(beatValue)) {
    throw new InvalidInputError(
      'Unsupported beat value: ' +
        beatValue +
        '. Must be one of 1, 2, 4, 8, 16, 32.',
    );
  }

  // Timing Calculation
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

  // console.log( // Example of a log that can be verbose during normal operation
  //   `  getRhythmicPattern: Generating for ${meterBeats} beats. Complexity Factor: ${subdivisionChance.toFixed(2)}. Measure Ticks: ${measureDurationTicks}, Beat Ticks: ${beatDurationTicks}`
  // );

  // Define available rhythmic patterns per beat.
  // Each entry: [probabilityWeight, [arrayOfDurationFactors]]
  // These factors are relative to one beatDurationTicks.
  // Factors are relative to one beatDurationTicks.
  const beatPatterns: [number, number[]][] = [
    // Higher weight for simpler patterns if subdivisionChance is low.
    [1.0 - subdivisionChance, [1.0]], // e.g., Quarter note in 4/4
    // Higher weight for subdivided patterns if subdivisionChance is high.
    [subdivisionChance, [0.5, 0.5]], // e.g., Two Eighth notes
    // Example of more complex patterns (can be expanded if divisions allow):
    // [subdivisionChance * 0.7, [0.75, 0.25]], // Dotted Eighth + Sixteenth
    // [subdivisionChance * 0.5, [0.25, 0.25, 0.5]], // Two Sixteenths + Eighth
  ];

  // Iterate through each beat of the measure
  for (let beatIndex = 0; beatIndex < meterBeats; beatIndex++) {
    if (accumulatedTicks >= measureDurationTicks) {
      // Measure is already full or exceeded
      // console.log( // Log if needed for debugging specific cases
      //  `    Beat ${beatIndex + 1}/${meterBeats}: Measure full (Accumulated: ${accumulatedTicks}, Target: ${measureDurationTicks}). Skipping further rhythm generation.`
      // );
      break;
    }

    const remainingMeasureTicks = measureDurationTicks - accumulatedTicks;
    // Ticks available for the current beat; cannot exceed remaining measure ticks or standard beat duration.
    const currentBeatAvailableTicks = Math.min(
      beatDurationTicks,
      remainingMeasureTicks,
    );

    if (currentBeatAvailableTicks <= 0) { // No time left in the measure for this beat
        // console.log(`    Beat ${beatIndex + 1}/${meterBeats}: No time left in measure for this beat.`);
        continue;
    }

    // Filter patterns that can fit within the available ticks for this beat.
    const applicablePatterns = beatPatterns.filter((patternOption) => {
      const patternDurationTicks =
        patternOption[1].reduce((sum, factor) => sum + factor, 0) *
        beatDurationTicks;
      // Allow for minor floating point inaccuracies (+0.001)
      return patternDurationTicks <= currentBeatAvailableTicks + 0.001;
    });

    let chosenFactors: number[];
    if (applicablePatterns.length === 0) {
      // No standard pattern fits (e.g., beat is partially filled, or near end of measure).
      // Fill the remaining available ticks for this beat with a single duration.
      chosenFactors = [currentBeatAvailableTicks / beatDurationTicks];
      // console.log( // Example: log for debugging specific conditions
      //  `    Beat ${beatIndex + 1}/${meterBeats}: No standard pattern fits ${currentBeatAvailableTicks.toFixed(2)} ticks. Using custom factor: ${chosenFactors[0].toFixed(2)}.`
      // );
    } else {
      // Perform weighted random selection from applicable patterns.
      const totalWeight = applicablePatterns.reduce(
        (sum, p) => sum + p[0],
        0,
      );
      let randomRoll = Math.random() * totalWeight;
      // Default to the last applicable pattern if totalWeight is 0 or randomRoll logic fails.
      chosenFactors = applicablePatterns[applicablePatterns.length - 1][1];

      for (const pattern of applicablePatterns) {
        randomRoll -= pattern[0];
        if (randomRoll <= 0) {
          chosenFactors = pattern[1];
          break;
        }
      }
      // console.log( // Example: log for debugging specific conditions
      //  `    Beat ${beatIndex + 1}/${meterBeats}: Chose factors [${chosenFactors.map((f) => f.toFixed(2)).join(', ')}] for available ${currentBeatAvailableTicks.toFixed(2)} ticks.`
      // );
    }

    patternFactors.push(...chosenFactors);
    const ticksForChosenFactors = chosenFactors.reduce(
      (sum, factor) => sum + factor * beatDurationTicks,
      0,
    );
    accumulatedTicks += ticksForChosenFactors;

  } // End beat loop

  // Final adjustment: Ensure the sum of durations from factors exactly matches measureDurationTicks.
  // This corrects potential floating-point arithmetic inaccuracies or slight over/under fills from beat-by-beat generation.
  let totalPatternTicks = patternFactors.reduce(
    (sum, factor) => sum + Math.round(factor * beatDurationTicks), // Use rounded ticks for sum to avoid float issues here
    0,
  );
  
  // Refined adjustment logic to ensure the sum of durations precisely matches measureDurationTicks.
  if (patternFactors.length > 0) {
    const differenceTicks = measureDurationTicks - totalPatternTicks; // totalPatternTicks is sum of rounded ticks

    if (Math.abs(differenceTicks) > 0.01) { // If there's a non-negligible difference
      const lastFactorIndex = patternFactors.length - 1;
      // Get the duration of the last factor in original (potentially fractional) ticks
      const lastFactorDurationOriginalTicks = patternFactors[lastFactorIndex] * beatDurationTicks;
      // Adjust this original duration by the difference
      const adjustedLastFactorDurationTicks = lastFactorDurationOriginalTicks + differenceTicks;

      if (adjustedLastFactorDurationTicks > 0) {
        // Convert the adjusted tick duration back to a factor
        patternFactors[lastFactorIndex] = adjustedLastFactorDurationTicks / beatDurationTicks;
        // console.log( // Useful for debugging adjustment precision
        //   `  getRhythmicPattern: Adjusted last factor. Original total ticks from rounded factors: ${totalPatternTicks.toFixed(2)}. Target: ${measureDurationTicks.toFixed(2)}. Diff: ${differenceTicks.toFixed(2)}. New last factor duration: ${adjustedLastFactorDurationTicks.toFixed(2)}`
        // );
      } else {
        // If adjustment makes the last note zero or negative, this is problematic.
        // This might indicate an issue with the initial pattern generation or very small measure durations.
        // It's safer to log a warning. The measure might not be perfectly filled.
        console.warn(
          `  getRhythmicPattern: Final adjustment for measure failed. Adjusted last duration would be <= 0 (${adjustedLastFactorDurationTicks.toFixed(2)}). Total ticks from factors: ${totalPatternTicks.toFixed(2)} vs target ${measureDurationTicks.toFixed(2)}. Factors: [${patternFactors.map(f => f.toFixed(3)).join(',')}]`
        );
      }
    }
  } else if (measureDurationTicks > 0 && accumulatedTicks <=0) { // Check accumulatedTicks to ensure it didn't just skip all beats because measure was full
    // If no factors were generated for a measure that should have duration,
    // (e.g., all beats had 0 available ticks, which is unlikely if measureDurationTicks > 0),
    // fill with a single factor representing the whole measure duration.
    patternFactors.push(measureDurationTicks / beatDurationTicks);
    console.warn(
      `  getRhythmicPattern: No rhythmic factors generated for a measure with target duration ${measureDurationTicks}. Filled with a single factor.`
    );
  }

  // Final logging for verification, can be commented out for less verbosity
  // const finalSumOfTicks = patternFactors.reduce((s, f) => s + f * beatDurationTicks, 0);
  // if (Math.abs(finalSumOfTicks - measureDurationTicks) > 0.01) { // Use a small tolerance for float comparison
  //   console.log(
  //     `  getRhythmicPattern: End of generation. Target Ticks: ${measureDurationTicks.toFixed(2)}, Actual Ticks from Factors: ${finalSumOfTicks.toFixed(2)}. Factors: [${patternFactors.map((f) => f.toFixed(3)).join(', ')}]`
  //   );
  // }
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

  // console.log( // Can be verbose, enable for debugging specific event generation
  //  `    generateNotesForEvent: Style ${generationStyle}, Duration: ${eventDurationTicks} ticks, Type: ${eventNoteType}, ReqBassPc: ${requiredBassPc}`
  // );

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
    // console.log( // Useful for debugging SATB voicings
    //  `      SATB Voicing: S=${midiToNoteName(soprano)} A=${midiToNoteName(alto)} T=${midiToNoteName(tenor)} B=${midiToNoteName(bass)}`
    // );

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
      console.log(
        `      Accompaniment: Arpeggiating [${validAccompNotes.map(midiToNoteName).join(', ')}]`,
      );
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
        console.warn(`Arpeggiation Warning: ${remainingArpeggioTicks} ticks remaining after arpeggiating ${eventDurationTicks} total. This may indicate a calculation error.`);
        // Potentially, the last note's duration could be adjusted here if this case occurs.
        // However, with current logic (last note takes all remaining), this should not be hit.
      }

    } else {
      // If not arpeggiating, create a block chord for the accompaniment.
      console.log(
        `      Accompaniment: Block Chord [${validAccompNotes.map(midiToNoteName).join(', ')}] for ${eventDurationTicks} ticks.`, // Log duration
      );
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
function generateMusicalData(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): GeneratedPieceData {
  const { dissonanceStrictness, generationStyle, numAccompanimentVoices, rhythmicComplexity } =
    generationSettings;

  // --- 1. Initialization ---
  // Validates key/meter and calculates timing. Can throw InvalidInputError.
  const { keyDetails, timingInfo } = initializeGenerationParameters(keySignature, meter);
  let previousNotesHolder = initializePreviousNotes(generationStyle, numAccompanimentVoices); // Holds notes from the end of the previous successfully processed event/measure
  const generatedMeasures: MeasureData[] = [];

  // Initialize melodic state for melody generation (if applicable)
  const melodicState: MelodicState = { lastDirection: 0, directionStreak: 0 };

  console.log(`Generating ${numMeasures} measures in ${keySignature} ${generationStyle} style.`);

  // --- 2. Generate Measures Loop ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const romanWithInv = chordProgression[measureIndex] ?? 'I'; // Default to 'I' if progression is too short
    // console.log(`--- Measure ${measureIndex + 1} (${romanWithInv}) ---`);

    let chordInfoResult;
    try {
      chordInfoResult = getChordInfoFromRoman(romanWithInv, keySignature);
    } catch (e) { // Catch errors from getChordInfoFromRoman (e.g., MusicTheoryError)
        console.warn(`generateMusicalData: Measure ${measureIndex + 1}: Error processing Roman numeral "${romanWithInv}". Error: ${(e as Error).message}. Adding rests.`);
        chordInfoResult = null; // Treat as if chordInfo was null
    }
    
    const currentMeasureEvents: MusicalEvent[] = [];
    let notesAtEndOfCurrentMeasure: PreviousNotes | null = null;

    if (!chordInfoResult) {
      // --- Handle Chord Parsing Error or null result ---
      // console.warn is now handled above or within getChordInfoFromRoman for specific MusicTheoryErrors
      // For this function, if chordInfoResult is null, we just add rests.
      const restType = getNoteTypeFromDuration(timingInfo.measureDurationTicks, timingInfo.divisions);
      currentMeasureEvents.push(...generateRestEventsForDuration(timingInfo.measureDurationTicks, restType, '1', '1'));
      currentMeasureEvents.push(...generateRestEventsForDuration(timingInfo.measureDurationTicks, restType, '2', '2'));
      
      // Reset previous notes state, as context is broken by the error.
      previousNotesHolder = initializePreviousNotes(generationStyle, numAccompanimentVoices);
      notesAtEndOfCurrentMeasure = { ...previousNotesHolder };
    } else {
      // --- Valid Chord: Generate Rhythmic Events ---
      const { notes: baseChordNotes, requiredBassPc } = chordInfoResult; // Use chordInfoResult
      const rhythmicPatternFactors = getRhythmicPattern(timingInfo, rhythmicComplexity);
      let currentTickInMeasure = 0;

      // Loop through each rhythmic event factor in the measure's pattern
      for (let eventIndex = 0; eventIndex < rhythmicPatternFactors.length; eventIndex++) {
        if (currentTickInMeasure >= timingInfo.measureDurationTicks) {
          // console.log(`  Measure ${measureIndex + 1} already filled at ${currentTickInMeasure} ticks. Skipping remaining rhythmic factors.`);
          break; // Measure is full
        }

        const durationFactor = rhythmicPatternFactors[eventIndex];
        let eventDurationTicks = Math.round(timingInfo.beatDurationTicks * durationFactor);

        // Truncate event duration if it would overflow the measure
        if (currentTickInMeasure + eventDurationTicks > timingInfo.measureDurationTicks) {
          const originalEventDuration = eventDurationTicks;
          eventDurationTicks = timingInfo.measureDurationTicks - currentTickInMeasure;
          console.warn(
            `  generateMusicalData: Measure ${measureIndex + 1}, Event ${eventIndex + 1}: Duration factor ${durationFactor.toFixed(2)} (orig: ${originalEventDuration} ticks) truncated to ${eventDurationTicks} ticks to fit measure. Current: ${currentTickInMeasure}/${timingInfo.measureDurationTicks}.`,
          );
        }

        // Skip if event duration is zero or negative (e.g., after truncation or if factor was 0)
        if (eventDurationTicks <= 0) {
          // console.log(`  Measure ${measureIndex + 1}, Event ${eventIndex + 1}: Skipping event with non-positive duration ${eventDurationTicks}.`);
          continue;
        }
        
        // Generate notes for this specific rhythmic event using notes from the *previous event* as context
        const eventGenerationResult = generateNotesForEvent(
          baseChordNotes,
          requiredBassPc,
          previousNotesHolder, // Context from the previous successful event
          generationSettings,
          keyDetails,
          timingInfo,
          eventDurationTicks,
          melodicState, // Pass and update melodic state for melody lines
        );

        currentMeasureEvents.push(...eventGenerationResult.eventNotes); // Add generated XML events

        // Perform voice leading checks against the previous set of notes
        checkVoiceLeadingRules(
          eventGenerationResult.currentNotes, // Notes chosen for *this* event
          previousNotesHolder, // Notes from the *previous* event
          generationStyle,
          measureIndex,
          eventIndex, // "Beat index" or event number within measure for context
          dissonanceStrictness,
        );

        // Update previousNotesHolder to the notes generated in *this* event for the *next* event's context
        previousNotesHolder = eventGenerationResult.currentNotes;
        currentTickInMeasure += eventDurationTicks;
      } // End rhythmic event loop for the measure

      notesAtEndOfCurrentMeasure = previousNotesHolder; // Store notes from the last event of this measure

      // Add trailing rests if the rhythmic pattern didn't exactly fill the measure
      if (currentTickInMeasure < timingInfo.measureDurationTicks) {
        const remainingTicks = timingInfo.measureDurationTicks - currentTickInMeasure;
        if (remainingTicks > 0) { // Ensure there are actually ticks remaining
            const restType = getNoteTypeFromDuration(remainingTicks, timingInfo.divisions);
            // console.log(`  Measure ${measureIndex + 1}: Adding trailing rest of ${remainingTicks} ticks.`);
            currentMeasureEvents.push(...generateRestEventsForDuration(remainingTicks, restType, '1', '1'));
            currentMeasureEvents.push(...generateRestEventsForDuration(remainingTicks, restType, '2', '2'));
        }
      }
    } // End valid chord processing block

    generatedMeasures.push({
      measureNumber: measureIndex + 1,
      romanNumeral: romanWithInv,
      events: currentMeasureEvents,
    });

    // Update the main previousNotesHolder to the state at the end of the *current measure*
    // This provides context for the beginning of the *next measure*.
    if (notesAtEndOfCurrentMeasure) {
      previousNotesHolder = notesAtEndOfCurrentMeasure;
    } else {
      // This case should ideally not be reached if errors correctly reset previousNotesHolder.
      // If it is, reset to avoid carrying over undefined state.
      console.warn(`generateMusicalData: Measure ${measureIndex + 1} ended with no note context. Resetting for next measure.`);
      previousNotesHolder = initializePreviousNotes(generationStyle, numAccompanimentVoices);
    }
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

// --- MusicXML Generation Function --- (Improved Documentation)

/**
 * Creates a MusicXML string from the intermediate musical data structure.
 * Converts the intermediate `GeneratedPieceData` structure into a complete MusicXML string.
 * This function handles the setup of the score, parts, measures, attributes (key, time, clef),
 * harmony annotations (Roman numerals), and the placement of notes and rests onto staves.
 *
 * Key MusicXML features handled:
 * - Score partwise structure.
 * - Work metadata (title).
 * - Identification (encoding software, date).
 * - Part list with part names.
 * - Two-staff system (typically treble for staff 1, bass for staff 2).
 * - Measure attributes: divisions, key signature, time signature, clefs.
 * - Harmony elements for Roman numeral display.
 * - Note elements with pitch (step, alter, octave), duration, type, voice, staff, and stem.
 * - Chord elements for notes sounding simultaneously in the same voice.
 * - Rest elements with duration, voice, and staff.
 * - Backup elements for multi-voice writing on a single staff (though current implementation uses one voice per staff primarily).
 *
 * @param {GeneratedPieceData} data - The complete musical data object, typically generated by `generateMusicalData`.
 * @returns {string} A string containing the fully formatted MusicXML representation of the score.
 * @throws {GenerationError} If crucial metadata like key or meter is found to be invalid during XML construction,
 *                           indicating an internal inconsistency from earlier generation stages.
 */
function createMusicXMLString(data: GeneratedPieceData): string {
  const { metadata, measures } = data;

  // Calculate key signature details
  const keyDetails =
    Tonal.Key.majorKey(metadata.keySignature) ??
    Tonal.Key.minorKey(metadata.keySignature);
  if (!keyDetails || !keyDetails.tonic) { // Added !keyDetails.tonic
    // This should ideally not happen if inputs were validated earlier.
    // Throwing a GenerationError as this points to an internal inconsistency.
    throw new GenerationError(
      'createMusicXMLString: Invalid key signature found in metadata: ' +
        metadata.keySignature,
    );
  }
  const keyFifths = getFifths(keyDetails.tonic); // Assumes getFifths handles unknown tonics gracefully or throws
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';

  // Parse and validate time signature from metadata
  const meterMatch = metadata.meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch) {
    throw new GenerationError( // Should be caught by initializeGenerationParameters, but good to have a check
      'createMusicXMLString: Invalid meter format in metadata: ' + metadata.meter,
    );
  }
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);

  // Set up XML document with MusicXML 4.0 DTD
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });

  // Add metadata
  root.ele('work')
    .ele('work-title').txt(metadata.title).up()
  .up();
  
  root.ele('identification')
    .ele('encoding')
      .ele('software').txt(metadata.software).up()
      .ele('encoding-date').txt(metadata.encodingDate).up()
    .up()
  .up();

  // Define score parts (single part with two staves)
  root.ele('part-list')
    .ele('score-part', { id: 'P1' })
      .ele('part-name').txt(metadata.partName).up()
    .up()
  .up();

  // Begin main musical content
  const partBuilder = root.ele('part', { id: 'P1' });

  // Process each measure
  measures.forEach((measureData, measureIndex) => {
    const measureBuilder = partBuilder.ele('measure', {
      number: `${measureData.measureNumber}`,
    });

    // First measure needs complete attribute set
    if (measureIndex === 0) {
      const attributes = measureBuilder.ele('attributes');
      // MusicXML divisions = ticks per quarter note
      attributes.ele('divisions').txt(`${metadata.divisions}`).up(); // Use metadata.divisions
      
      // Key signature
      attributes.ele('key')
        .ele('fifths').txt(`${keyFifths}`).up()
        .ele('mode').txt(keyMode).up()
      .up();
      
      // Time signature
      attributes.ele('time')
        .ele('beats').txt(`${meterBeats}`).up()
        .ele('beat-type').txt(`${beatValue}`).up()
      .up();
      
      // Two-staff setup with appropriate clefs
      attributes.ele('staves').txt('2').up();
      attributes.ele('clef', { number: '1' })
        .ele('sign').txt('G').up()
        .ele('line').txt('2').up()
      .up();
      attributes.ele('clef', { number: '2' })
        .ele('sign').txt('F').up()
        .ele('line').txt('4').up()
      .up();
      attributes.up();
    }

    // Add roman numeral analysis
    measureBuilder.ele('harmony')
      .ele('root')
        .ele('root-step').up()
      .up()
      .ele('kind')
        .txt('other')
        .att('text', measureData.romanNumeral)
      .up()
    .up();

    // Sort events by voice/staff
    const voice1Events = measureData.events.filter(
      (e) => e.voiceNumber === '1'
    );
    const voice2Events = measureData.events.filter(
      (e) => e.voiceNumber === '2'
    );

    // Process voice 1 (upper staff)
    if (voice1Events.length > 0) {
      addMusicalEventsToXML(measureBuilder, voice1Events);
    } else {
      // Add fallback full measure rest
      const measureDurationTicks = meterBeats * 4 * (4 / beatValue);
      const restType = getNoteTypeFromDuration(measureDurationTicks, 4);
      addMusicalEventsToXML(measureBuilder, [{
        type: 'rest',
        durationTicks: measureDurationTicks,
        staffNumber: '1',
        voiceNumber: '1',
        noteType: restType,
      }]);
    }

    // Process voice 2 (lower staff)
    const totalVoice1Duration = voice1Events.reduce(
      (sum, ev) => sum + ev.durationTicks,
      0
    );
    
    // Backup to start of measure for voice 2
    if (voice2Events.length > 0) {
      measureBuilder.ele('backup')
        .ele('duration').txt(`${totalVoice1Duration}`).up()
      .up();
      addMusicalEventsToXML(measureBuilder, voice2Events);
    } else {
      // Add fallback full measure rest
      const measureDurationTicks = meterBeats * 4 * (4 / beatValue);
      const restType = getNoteTypeFromDuration(measureDurationTicks, 4);
      measureBuilder.ele('backup')
        .ele('duration').txt(`${totalVoice1Duration}`).up()
      .up();
      addMusicalEventsToXML(measureBuilder, [{
        type: 'rest',
        durationTicks: measureDurationTicks,
        staffNumber: '2',
        voiceNumber: '2',
        noteType: restType,
      }]);
    }

    measureBuilder.up();
  });

  partBuilder.up();
  return root.end({ prettyPrint: true });
}

/**
 * Adds a sequence of `MusicalEvent` objects (notes or rests) for a single voice
 * to a given measure in the MusicXML structure.
 * It correctly handles creating `<note>` elements with nested `<pitch>`, `<duration>`,
 * `<type>`, etc., or `<rest>` elements. It also adds `<chord/>` for subsequent notes
 * in a simultaneous group within the same voice.
 *
 * @param {XMLBuilder} measureBuilder - The `xmlbuilder2` XMLBuilder instance for the current `<measure>` element.
 * @param {MusicalEvent[]} events - An array of `MusicalEvent` objects to be added to this measure for a single voice.
 */
function addMusicalEventsToXML(
  measureBuilder: XMLBuilder,
  events: MusicalEvent[],
): void {
  events.forEach((event) => {
    // console.log("addMusicalEventsToXML: Adding event:", event); // Verbose, enable for deep XML debugging
    const noteEl = measureBuilder.ele('note');

    if (event.type === 'rest') {
      noteEl.ele('rest').up();
    // TODO: Consider adding measure="yes" for whole measure rests if applicable.
    // This would require passing measureDurationTicks and comparing.
    // Example: if (event.durationTicks === measureDurationTicks && event.voiceNumber === '1' && /* other voices also full rest */ ) {
    //   noteEl.attribute('measure', 'yes');
      // }
  } else if (event.type === 'note' && event.midi !== null && event.midi !== undefined) {
    // If this note is part of a chord (i.e., not the first note of a simultaneous group in this voice)
      if (event.isChordElement) {
      noteEl.ele('chord').up(); // Indicates it sounds with the previous non-chord note in the same voice
      }

      const pitch = midiToMusicXMLPitch(event.midi);
      if (pitch) {
        const pitchEl = noteEl.ele('pitch');
        pitchEl.ele('step').txt(pitch.step).up();
      if (pitch.alter !== undefined && pitch.alter !== 0) { // Only add alter if it's non-zero
          pitchEl.ele('alter').txt(`${pitch.alter}`).up();
        }
        pitchEl.ele('octave').txt(`${pitch.octave}`).up();
      pitchEl.up(); // End pitch
      } else {
      // Fallback if MIDI to pitch conversion fails (should be rare)
      console.warn(`addMusicalEventsToXML: Could not get MusicXML pitch for MIDI ${event.midi}. Adding rest instead for event:`, event);
      noteEl.ele('rest').up(); // Add a rest as a fallback to maintain rhythm
      }

      if (event.stemDirection) {
        noteEl.ele('stem').txt(event.stemDirection).up();
      }
    // MusicXML type (e.g., quarter, eighth) is crucial for visual representation.
      noteEl.ele('type').txt(event.noteType).up();
    // TODO: Add dot (<dot/>) element here if the note is dotted, based on event.isDotted or similar.
    
    } else {
    // Invalid event type or missing MIDI for a note event.
    console.warn(`addMusicalEventsToXML: Invalid event type or missing MIDI for note. Skipping XML generation for event:`, event);
    noteEl.remove(); // Remove the malformed <note> element from the XML tree.
    return; // Skip this event entirely.
    }

  // These elements are common to both notes and rests.
  noteEl.ele('duration').txt(`${event.durationTicks}`).up(); // Duration in divisions.
    noteEl.ele('voice').txt(event.voiceNumber).up();
    noteEl.ele('staff').txt(event.staffNumber).up();

  // TODO: Future enhancements: notations (ties, slurs, accents, etc.), lyrics.
  // if (event.tieStart) noteEl.ele('notations').ele('tied', {type: 'start'}).up().up();
  // if (event.tieStop) noteEl.ele('notations').ele('tied', {type: 'stop'}).up().up();

  noteEl.up(); // End note element
  });
}

/**
 * Calculates the number of sharps or flats (fifths) for a given key signature's tonic,
 * as required by the MusicXML `<key>` element.
 * It handles both major and minor keys.
 *
 * @param {string} tonic - The tonic note of the key (e.g., "C", "F#", "Bb", "gm", "c#m").
 *                         Tonal.js can often infer mode from case or explicit "m".
 * @returns {number} The number of fifths, where positive values are sharps (e.g., G major = 1 sharp)
 *                   and negative values are flats (e.g., F major = -1 flat). Returns 0 for C major/A minor.
 *                   Logs a warning and returns 0 if the tonic is unsupported.
 */
function getFifths(tonic: string): number {
  const normalizedTonic = tonic.trim();

  // Tonal.Key.majorKey and minorKey return an object with an 'alteration' property,
  // which is the number of fifths.
  const majorKeyDetails = Tonal.Key.majorKey(normalizedTonic);
  if (majorKeyDetails && typeof majorKeyDetails.alteration === 'number') {
    
    return majorKeyDetails.alteration;
  }

  const minorKeyDetails = Tonal.Key.minorKey(normalizedTonic);
  if (minorKeyDetails && typeof minorKeyDetails.alteration === 'number') {
    
    return minorKeyDetails.alteration;
  }

  console.warn(
    `Unsupported tonic for key signature: ${tonic}. Defaulting to 0 fifths.`,
  );
  return 0;
}
