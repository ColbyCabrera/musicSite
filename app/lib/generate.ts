// src/generate.ts
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

// import { VOICE_ORDER_SATB, VOICE_RANGES } from './constants'; // Keep if needed by helpers
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
} from './types'; // Make sure KeyDetails, TimingInfo, MeasureGenerationContext are defined in types.ts
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
  // getMusicXMLDurationType, // Now calculated internally or passed in data
  addNotesToStaffXML, // Keep MusicXML helpers
  getNoteTypeFromDuration, // Keep MusicXML helpers
} from './musicxmlUtils';

// Add at the file level, before the functions
interface MelodicState {
  lastDirection: number; // -1: down, 0: repeat, 1: up
  directionStreak: number; // How many times we've moved in the same direction
}

// --- Orchestrator Function --- (Unchanged)
/**
 * Generates the voice data as a MusicXML string.
 * Orchestrates the generation of musical data and its conversion to MusicXML.
 * @param chordProgression - Array of Roman numeral chord symbols.
 * @param keySignature - The key signature (e.g., "C", "Gm").
 * @param meter - The time signature (e.g., "4/4").
 * @param numMeasures - The number of measures to generate.
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
 * Validates key and meter, calculates timing information.
 */
function initializeGenerationParameters(
  keySignature: string,
  meter: string,
): { keyDetails: KeyDetails; timingInfo: TimingInfo } {
  // Key Validation
  const keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails) throw new Error('Invalid key signature: ' + keySignature);

  // Meter Validation and Parsing
  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error("Invalid meter format. Use 'beats/beatValue'.");
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);
  if (![1, 2, 4, 8, 16, 32].includes(beatValue))
    throw new Error('Unsupported beat value: ' + beatValue);
  if (meterBeats <= 0) throw new Error('Meter beats must be positive.');

  // Timing Calculation
  const divisions = 4; // Divisions per quarter note
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
 * Initializes the state for tracking previous notes based on generation style.
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
 * Defines a rhythmic pattern for a measure, adding some variation.
 * Example: [1, 0.5, 0.5, 1] might represent Q, E, E, Q in 4/4.
 * Duration values are factors relative to the beatDurationTicks.
 * @param timingInfo - Timing information for the measure.
 * @param complexity - A value (e.g., 0-10) influencing variation (higher = more chance of shorter notes). Default 3.
 * @returns Array of duration factors (relative to beat duration).
 */
function getRhythmicPattern(
  timingInfo: TimingInfo,
  complexity: number = 3,
): number[] {
  const { meterBeats, beatDurationTicks, measureDurationTicks } = timingInfo;
  const patternFactors: number[] = [];
  let currentTicks = 0;
  const complexityThreshold = Math.max(0.1, Math.min(0.9, complexity / 10)); // Normalize complexity to 0.1-0.9 range

  console.log(
    `  Generating rhythm for ${meterBeats} beats. Complexity threshold: ${complexityThreshold.toFixed(2)}`,
  );

  // --- Rhythmic Choices ---
  // Define possible rhythmic units per beat (factors relative to beat duration)
  // Format: [probability_weight, [factor1, factor2, ...]]
  const beatPatterns: [number, number[]][] = [
    [1.0 - complexityThreshold, [1.0]], // Simple: One beat (e.g., Quarter note) - Higher chance if complexity is low
    [complexityThreshold, [0.5, 0.5]], // Varied: Two half-beats (e.g., Two Eighth notes) - Higher chance if complexity is high
    // Add more complex patterns here:
    // [complexityThreshold * 0.5, [0.75, 0.25]], // Dotted Eighth + Sixteenth (requires higher divisions)
    // [complexityThreshold * 0.4, [0.5, 1.0, 0.5]] // Eighth, Quarter, Eighth (Syncopated - complex handling)
  ];

  // --- Generate Pattern Beat by Beat ---
  for (let i = 0; i < meterBeats; i++) {
    if (currentTicks >= measureDurationTicks) break; // Stop if measure is full

    // Calculate remaining ticks in the measure *for this beat*
    const remainingTicksInMeasure = measureDurationTicks - currentTicks;
    const remainingTicksForThisBeat = Math.min(
      beatDurationTicks,
      remainingTicksInMeasure,
    );

    // Filter patterns that fit within the remaining beat duration
    let possiblePatterns = beatPatterns.filter((p) => {
      const patternTotalFactor = p[1].reduce((sum, factor) => sum + factor, 0);
      return (
        patternTotalFactor * beatDurationTicks <=
        remainingTicksForThisBeat + 0.001
      ); // Allow for tiny float errors
    });

    // If no patterns fit (e.g., end of measure with odd duration), add a single event to fill
    if (possiblePatterns.length === 0) {
      if (remainingTicksForThisBeat > 0) {
        const factor = remainingTicksForThisBeat / beatDurationTicks;
        console.log(
          `    Beat ${i + 1}: No standard pattern fits ${remainingTicksForThisBeat} ticks. Adding factor ${factor.toFixed(2)}.`,
        );
        patternFactors.push(factor);
        currentTicks += remainingTicksForThisBeat;
      }
      continue; // Move to next beat or end
    }

    // --- Weighted Random Selection ---
    const totalWeight = possiblePatterns.reduce((sum, p) => sum + p[0], 0);
    let randomChoice = Math.random() * totalWeight;
    let chosenFactors: number[] = [1.0]; // Default just in case

    for (const pattern of possiblePatterns) {
      randomChoice -= pattern[0]; // Subtract weight
      if (randomChoice <= 0) {
        chosenFactors = pattern[1];
        break;
      }
    }

    console.log(
      `    Beat ${i + 1}: Chose factors [${chosenFactors.join(', ')}]`,
    );
    patternFactors.push(...chosenFactors);
    currentTicks += chosenFactors.reduce(
      (sum, factor) => sum + factor * beatDurationTicks,
      0,
    );
  } // End beat loop

  // --- Final Adjustment (Optional but recommended) ---
  // Recalculate total ticks from factors and adjust the last note if needed due to float inaccuracies
  let finalTotalTicks = patternFactors.reduce(
    (sum, factor) => sum + factor * beatDurationTicks,
    0,
  );
  if (
    Math.abs(finalTotalTicks - measureDurationTicks) > 0.01 &&
    patternFactors.length > 0
  ) {
    // If difference is significant
    const diff = measureDurationTicks - finalTotalTicks;
    const lastFactor = patternFactors.pop()!;
    const lastDurationTicks = lastFactor * beatDurationTicks;
    const adjustedLastDurationTicks = lastDurationTicks + diff;
    if (adjustedLastDurationTicks > 0) {
      patternFactors.push(adjustedLastDurationTicks / beatDurationTicks);
      console.log(
        `  Adjusting final rhythm factor to ensure measure fills exactly. Original end: ${finalTotalTicks.toFixed(2)}, Target: ${measureDurationTicks}`,
      );
    } else {
      console.warn(
        `  Could not adjust final rhythm factor, duration would be <= 0.`,
      );
      patternFactors.push(lastFactor); // Put it back if adjustment fails
    }
  }

  console.log(
    `  Final rhythm factors: [${patternFactors.map((f) => f.toFixed(2)).join(', ')}]`,
  );
  return patternFactors;
}

/**
 * Generates musical events for a single rhythmic event (e.g., a beat) within a measure.
 * Includes arpeggiation for Melody/Accompaniment style during shorter durations.
 * @param baseChordNotes - Root position MIDI notes for the current chord.
 * @param requiredBassPc - The required bass pitch class for inversion (null if root pos).
 * @param previousNotes - The notes from the *immediately preceding* event.
 * @param generationSettings - Global generation settings.
 * @param keyDetails - Key information.
 * @param timingInfo - Timing information.
 * @param eventDurationTicks - The duration for *this specific event* in ticks.
 * @param melodicState - Optional melodic state parameter for tracking melody direction.
 * @returns { currentNotes: PreviousNotes; eventNotes: MusicalEvent[] } - The notes chosen for this event and the corresponding MusicXML events.
 */
function generateNotesForEvent(
  baseChordNotes: number[], // Root position notes
  requiredBassPc: number | null,
  previousNotes: PreviousNotes,
  generationSettings: GenerationSettings,
  keyDetails: KeyDetails,
  timingInfo: TimingInfo,
  eventDurationTicks: number,
  melodicState?: MelodicState, // Add optional melodic state parameter
): { currentNotes: PreviousNotes; eventNotes: MusicalEvent[] } {
  const {
    melodicSmoothness,
    generationStyle,
    numAccompanimentVoices = 3,
  } = generationSettings;
  const { divisions, beatDurationTicks } = timingInfo;

  const chordRootMidi = baseChordNotes[0];
  const chordPcs = baseChordNotes.map((n) => n % 12);
  const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);
  let currentNotes: PreviousNotes;
  const eventNotes: MusicalEvent[] = [];
  const eventNoteType = getNoteTypeFromDuration(eventDurationTicks, divisions);

  console.log(
    `    Generating event (Duration: ${eventDurationTicks} ticks / Type: ${eventNoteType})`,
  );

  if (generationStyle === 'SATB') {
    // --- SATB Logic (Unchanged) ---
    const prevSATB = previousNotes as PreviousNotesSATB;
    const bass = assignBassNoteSATB(
      requiredBassPc,
      chordRootMidi,
      fullChordNotePool,
      prevSATB.bass,
      melodicSmoothness,
    );
    const soprano = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevSATB.soprano,
      melodicSmoothness,
      'SATB',
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
    currentNotes = { soprano, alto, tenor, bass };
    console.log(
      `      SATB Voicing: S=${midiToNoteName(soprano)} A=${midiToNoteName(alto)} T=${midiToNoteName(tenor)} B=${midiToNoteName(bass)} (Req Bass PC: ${requiredBassPc})`,
    );
    const staff1Notes = [soprano, alto];
    const staff2Notes = [tenor, bass];
    let staff1Stem: 'up' | 'down' =
      soprano !== null && soprano >= 71 ? 'down' : 'up';
    let staff2Stem: 'up' | 'down' =
      tenor !== null && tenor <= 55 ? 'up' : 'down';
    // SATB events are still block chords for the whole event duration
    eventNotes.push(
      ...createStaffEvents(
        staff1Notes,
        '1',
        '1',
        staff1Stem,
        eventDurationTicks,
        eventNoteType,
      ),
    );
    eventNotes.push(
      ...createStaffEvents(
        staff2Notes,
        '2',
        '2',
        staff2Stem,
        eventDurationTicks,
        eventNoteType,
      ),
    );
  } else {
    // --- MelodyAccompaniment Style ---
    const prevMA = previousNotes as PreviousNotesMelodyAccompaniment;

    // --- Generate Melody ---
    const melody = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevMA.melody,
      melodicSmoothness,
      'MelodyAccompaniment',
      keyDetails.tonic, // Pass the key signature here
      melodicState // Pass the melodic state
    );
    let melodyStem: 'up' | 'down' =
      melody !== null && melody >= 71 ? 'down' : 'up';
    // Add melody event(s) - might be a single note or could be split if implementing rests within melody later
    eventNotes.push(
      ...createStaffEvents(
        [melody],
        '1',
        '1',
        melodyStem,
        eventDurationTicks,
        eventNoteType,
      ),
    );

    // --- Generate Accompaniment ---
    // Always generate the potential voicing first
    const accompanimentVoicing = generateAccompanimentVoicing(
      melody,
      chordRootMidi,
      chordPcs,
      fullChordNotePool,
      prevMA.accompaniment, // Use previous voicing for smoothness targeting
      melodicSmoothness,
      numAccompanimentVoices,
    );
    // Filter out nulls and sort low to high for arpeggiation
    const validAccompNotes = accompanimentVoicing
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    /**
     * Arpeggiation criteria:
     * - Event duration is shorter than a full beat
     * - At least 2 accompaniment notes are available
     */
    const ARPEGGIATE_THRESHOLD_TICKS = beatDurationTicks;
    const shouldArpeggiate =
      eventDurationTicks < ARPEGGIATE_THRESHOLD_TICKS &&
      validAccompNotes.length > 1;

    // Set stem direction based on note range
    let accompStemDirection: 'up' | 'down' = 'down';
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
      const arpeggioNoteDuration = Math.max(
        1,
        Math.floor(eventDurationTicks / numArpeggioNotes),
      );
      let remainingTicks = eventDurationTicks;

      // Create ascending arpeggio pattern
      for (let i = 0; i < numArpeggioNotes; i++) {
        const noteMidi = validAccompNotes[i];
        // Last note fills any remaining time to ensure total duration is exact
        const currentNoteDuration =
          i === numArpeggioNotes - 1 ? remainingTicks : arpeggioNoteDuration;

        if (currentNoteDuration <= 0) continue;

        const arpeggioNoteType = getNoteTypeFromDuration(
          currentNoteDuration,
          divisions,
        );

        eventNotes.push({
          type: 'note',
          midi: noteMidi,
          durationTicks: currentNoteDuration,
          staffNumber: '2',
          voiceNumber: '2',
          stemDirection: accompStemDirection,
          noteType: arpeggioNoteType,
          isChordElement: false,
        });
        remainingTicks -= currentNoteDuration;
      }
    } else {
      console.log(
        `      Accompaniment: Block Chord [${validAccompNotes.map(midiToNoteName).join(', ')}]`,
      );
      eventNotes.push(
        ...createStaffEvents(
          validAccompNotes,
          '2',
          '2', // Accompaniment voice(s)
          accompStemDirection,
          eventDurationTicks, // Duration is for the whole block
          eventNoteType,
        ),
      );
    }

    // --- Update State ---
    // Melody state is the single note generated.
    // Accompaniment state should reflect the notes chosen in the voicing, even if arpeggiated,
    // so the *next* voicing calculation has a smooth target.
    currentNotes = { melody, accompaniment: accompanimentVoicing };
  } // End MelodyAccompaniment Style

  return { currentNotes, eventNotes };
}

/**
 * Creates note or rest events for a single staff and voice.
 * Handles both single notes and chords, automatically determining
 * whether to create a rest or a sequence of notes.
 * 
 * @param notes Array of MIDI note numbers (null for rests)
 * @param staffNumber Target staff number
 * @param voiceNumber Voice number within the staff
 * @param stemDirection Direction of note stems
 * @param durationTicks Duration in MusicXML divisions
 * @param noteType MusicXML note type
 * @returns Array of note/rest events with the specified properties
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
 * Used for padding measures or handling error cases.
 * 
 * @param durationTicks Duration to fill in MusicXML divisions
 * @param noteType MusicXML note type (e.g., 'quarter', 'half')
 * @param staff Staff number ('1' or '2')
 * @param voice Voice number within the staff
 * @returns Array of rest events with the specified duration
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
 * Generates the core musical data (notes, rests, timing) based on inputs.
 * Does NOT handle MusicXML formatting.
 * @returns {GeneratedPieceData} An intermediate data structure representing the music.
 */
function generateMusicalData(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): GeneratedPieceData {
  const { dissonanceStrictness, generationStyle, numAccompanimentVoices } =
    generationSettings;

  // --- Initialization ---
  const { keyDetails, timingInfo } = initializeGenerationParameters(
    keySignature,
    meter,
  );
  let previousNotes = initializePreviousNotes(
    generationStyle,
    numAccompanimentVoices,
  );
  const generatedMeasures: MeasureData[] = [];

  // Initialize melodic state
  const melodicState: MelodicState = {
    lastDirection: 0,
    directionStreak: 0,
  };

  // --- Generate Measures Loop ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const romanWithInv = chordProgression[measureIndex] ?? 'I';
    console.log(`--- Measure ${measureIndex + 1} (${romanWithInv}) ---`);

    const chordInfo = getChordInfoFromRoman(romanWithInv, keySignature);
    let measureEvents: MusicalEvent[] = [];
    let currentMeasureNotes: PreviousNotes | null = null;

    if (!chordInfo) {
      // --- Handle Chord Error ---
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${romanWithInv}". Adding rests.`,
      );
      // Add rests for the whole measure duration
      const restType = getNoteTypeFromDuration(
        timingInfo.measureDurationTicks,
        timingInfo.divisions,
      );
      measureEvents.push(
        ...generateRestEventsForDuration(
          timingInfo.measureDurationTicks,
          restType,
          '1',
          '1',
        ),
      );
      measureEvents.push(
        ...generateRestEventsForDuration(
          timingInfo.measureDurationTicks,
          restType,
          '2',
          '2',
        ),
      );
      // Reset previous notes state for the next measure
      previousNotes = initializePreviousNotes(
        generationStyle,
        numAccompanimentVoices,
      );
      currentMeasureNotes = { ...previousNotes }; // Store the reset state
    } else {
      // --- Generate Rhythmic Events for Valid Chord ---
      const { notes: baseChordNotes, requiredBassPc } = chordInfo;
      const rhythmicPatternFactors = getRhythmicPattern(timingInfo); // e.g., [1.0, 1.0, 1.0, 1.0] for 4/4 beat = quarter
      let currentTickInMeasure = 0;

      // Loop through the rhythmic events defined for this measure
      for (
        let eventIndex = 0;
        eventIndex < rhythmicPatternFactors.length;
        eventIndex++
      ) {
        const durationFactor = rhythmicPatternFactors[eventIndex];
        const eventDurationTicks = Math.round(
          timingInfo.beatDurationTicks * durationFactor,
        );

        if (
          currentTickInMeasure + eventDurationTicks >
          timingInfo.measureDurationTicks
        ) {
          console.warn(
            `Event ${eventIndex + 1} exceeds measure duration. Truncating.`,
          );
          // eventDurationTicks = timingInfo.measureDurationTicks - currentTickInMeasure; // Removed truncate for now
          // Instead, just skip if duration is zero or negative
          if (timingInfo.measureDurationTicks - currentTickInMeasure <= 0)
            continue;
        }
        if (eventDurationTicks <= 0) continue; // Skip zero-duration events

        // Generate notes for this specific event
        const eventResult = generateNotesForEvent(
          baseChordNotes,
          requiredBassPc,
          previousNotes, // Pass the notes from the *previous event*
          generationSettings,
          keyDetails,
          timingInfo,
          eventDurationTicks,
          melodicState, // Pass the melodic state
        );

        // Add the generated events to the measure's list
        measureEvents.push(...eventResult.eventNotes);

        // Check Rules between previous event and this one
        // Use eventIndex as the "beatIndex" for logging/context
        checkVoiceLeadingRules(
          eventResult.currentNotes, // Notes generated for *this* event
          previousNotes, // Notes from the *previous* event
          generationStyle,
          measureIndex,
          eventIndex, // Pass the event index within the measure
          dissonanceStrictness,
        );

        // Update previousNotes state for the *next* event
        previousNotes = eventResult.currentNotes;
        currentTickInMeasure += eventDurationTicks;
      } // End rhythmic event loop

      // Store the notes from the *last* event of the measure
      currentMeasureNotes = previousNotes;

      // Add trailing rests if the rhythm pattern didn't fill the measure
      if (currentTickInMeasure < timingInfo.measureDurationTicks) {
        const remainingTicks =
          timingInfo.measureDurationTicks - currentTickInMeasure;
        const restType = getNoteTypeFromDuration(
          remainingTicks,
          timingInfo.divisions,
        );
        console.log(`Adding trailing rest of ${remainingTicks} ticks.`);
        measureEvents.push(
          ...generateRestEventsForDuration(remainingTicks, restType, '1', '1'),
        );
        measureEvents.push(
          ...generateRestEventsForDuration(remainingTicks, restType, '2', '2'),
        );
      }
    } // End chord valid block

    generatedMeasures.push({
      measureNumber: measureIndex + 1,
      romanNumeral: romanWithInv, // Store the full numeral with inversion
      events: measureEvents, // Store all events generated for this measure
    });

    // Update previousNotes to the state at the end of the measure for the start of the next measure
    // This happens implicitly as 'previousNotes' is updated in the loop
    if (currentMeasureNotes) {
      previousNotes = currentMeasureNotes;
    } else {
      // If the measure had an error, previousNotes was already reset
    }
  } // End measure loop

  // --- Construct Final Data Structure ---
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
 * Handles the complete conversion of internal music representation to MusicXML format.
 * 
 * Key features:
 * - Creates a two-staff score (treble/bass clef)
 * - Properly handles key signatures in both major and minor
 * - Supports multi-voice writing with proper backup elements
 * - Maintains clean voice separation across measures
 * - Includes roman numeral harmony markers
 * 
 * @param data - The complete musical piece data to convert
 * @returns A well-formatted MusicXML string ready for file output
 */
function createMusicXMLString(data: GeneratedPieceData): string {
  const { metadata, measures } = data;

  // Calculate key signature details
  const keyDetails =
    Tonal.Key.majorKey(metadata.keySignature) ??
    Tonal.Key.minorKey(metadata.keySignature);
  if (!keyDetails) {
    throw new Error(
      'Internal Error: Invalid key signature in metadata: ' +
        metadata.keySignature,
    );
  }
  const keyFifths = getFifths(keyDetails.tonic);
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';

  // Parse and validate time signature
  const meterMatch = metadata.meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch) {
    throw new Error(
      'Internal Error: Invalid meter format in metadata: ' + metadata.meter,
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

/** Helper to add a sequence of musical events (notes/rests) for a single voice to the XML measure */
function addMusicalEventsToXML(
  measureBuilder: XMLBuilder,
  events: MusicalEvent[],
): void {
  // No need for currentTick tracking here if events are sequential per voice
  events.forEach((event) => {
    // console.log("Adding event to XML:", event); // Debugging
    const noteEl = measureBuilder.ele('note');

    if (event.type === 'rest') {
      noteEl.ele('rest').up();
      // Optionally add measure="yes" attribute for whole rests
      // if (event.durationTicks === measureDurationTicks) { // Need measureDurationTicks here
      //     noteEl.down().attr('measure', 'yes');
      //     noteEl.up();
      // }
    } else if (
      event.type === 'note' &&
      event.midi !== null &&
      event.midi !== undefined
    ) {
      if (event.isChordElement) {
        noteEl.ele('chord').up();
      }

      const pitch = midiToMusicXMLPitch(event.midi);
      if (pitch) {
        const pitchEl = noteEl.ele('pitch');
        pitchEl.ele('step').txt(pitch.step).up();
        if (pitch.alter !== undefined) {
          pitchEl.ele('alter').txt(`${pitch.alter}`).up();
        }
        pitchEl.ele('octave').txt(`${pitch.octave}`).up();
        pitchEl.up(); // pitch
      } else {
        console.warn(
          `Could not get MusicXML pitch for MIDI ${event.midi}. Adding rest instead.`,
        );
        noteEl.ele('rest').up(); // Add rest as fallback
      }

      if (event.stemDirection) {
        noteEl.ele('stem').txt(event.stemDirection).up();
      }
      // Always add type for notes unless it's part of a chord *and* we want it handled differently
      // Standard practice is to include type even for chord elements
      noteEl.ele('type').txt(event.noteType).up();
    } else {
      console.warn(
        `Invalid event type or missing MIDI for note event. Skipping.`,
        event,
      );
      noteEl.remove(); // Remove the incomplete note element
      return; // Skip this event
    }

    // Duration always added
    noteEl.ele('duration').txt(`${event.durationTicks}`).up();
    noteEl.ele('voice').txt(event.voiceNumber).up();
    noteEl.ele('staff').txt(event.staffNumber).up();

    // TODO: Add notations like ties, slurs, dots later if needed

    noteEl.up(); // note
  });
}

/**
 * Converts between a key signature's tonic and its corresponding number of sharps/flats
 * in MusicXML format. Handles both major and minor keys.
 * 
 * @param tonic The tonic note of the key (e.g., "C", "F#", "Bb")
 * @returns Number of fifths (-7 to +7) for the key signature
 */
function getFifths(tonic: string): number {
  const normalizedTonic = tonic.trim(); // Good practice, though Tonal functions often handle it.

  const majorKeyDetails = Tonal.Key.majorKey(normalizedTonic);
  if (majorKeyDetails && typeof majorKeyDetails.alteration === 'number') {
    // console.log(`Major key ${normalizedTonic}: ${majorKeyDetails.alteration} fifths`);
    return majorKeyDetails.alteration;
  }

  const minorKeyDetails = Tonal.Key.minorKey(normalizedTonic);
  if (minorKeyDetails && typeof minorKeyDetails.alteration === 'number') {
    // console.log(`Minor key ${normalizedTonic}: ${minorKeyDetails.alteration} fifths`);
    return minorKeyDetails.alteration;
  }

  console.warn(
    `Unsupported tonic for key signature: ${tonic}. Defaulting to 0 fifths.`,
  );
  return 0;
}
