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
 * Defines a simple rhythmic pattern for a measure.
 * Example: [1, 1, 1, 1] for four quarter notes in 4/4.
 * Duration values are relative to the beatDurationTicks.
 * @param timingInfo - Timing information for the measure.
 * @returns Array of duration factors (relative to beat duration).
 */
function getRhythmicPattern(timingInfo: TimingInfo): number[] {
  const { meterBeats, beatDurationTicks, measureDurationTicks } = timingInfo;
  // Simple default: Fill the measure with beats
  // TODO: Implement more varied rhythms based on settings
  const pattern: number[] = [];
  let remainingTicks = measureDurationTicks;
  for (let i = 0; i < meterBeats; i++) {
    if (remainingTicks >= beatDurationTicks) {
      pattern.push(1.0); // Add one beat duration
      remainingTicks -= beatDurationTicks;
    } else if (remainingTicks > 0) {
      // Add partial beat if measure doesn't divide evenly (unlikely with common meters)
      pattern.push(remainingTicks / beatDurationTicks);
      remainingTicks = 0;
      console.warn('Measure duration not multiple of beat duration?');
    } else {
      break;
    }
  }
  if (remainingTicks > 0) {
    console.warn(
      `Rhythmic pattern doesn't fill measure. Remaining ticks: ${remainingTicks}`,
    );
    // Optionally try to add a final short note/rest
  }
  // For now, let's just return meterBeats * 1.0
  return Array(meterBeats).fill(1.0);

  // Example: Fixed pattern for 4/4 - Quarter, Quarter, Half
  // if (timingInfo.meterBeats === 4 && timingInfo.beatValue === 4) {
  //     return [1.0, 1.0, 2.0]; // Factors relative to beat duration
  // }
  // return Array(timingInfo.meterBeats).fill(1.0); // Default: one note per beat
}

/**
 * Generates musical events for a single rhythmic event (e.g., a beat) within a measure.
 * @param baseChordNotes - Root position MIDI notes for the current chord.
 * @param requiredBassPc - The required bass pitch class for inversion (null if root pos).
 * @param previousNotes - The notes from the *immediately preceding* event.
 * @param generationSettings - Global generation settings.
 * @param keyDetails - Key information.
 * @param timingInfo - Timing information.
 * @param eventDurationTicks - The duration for *this specific event* in ticks.
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
): { currentNotes: PreviousNotes; eventNotes: MusicalEvent[] } {
  const {
    melodicSmoothness,
    generationStyle,
    numAccompanimentVoices = 3,
  } = generationSettings;
  const { divisions } = timingInfo; // divisions needed for note type calc

  const chordRootMidi = baseChordNotes[0]; // Root of the chord
  const chordPcs = baseChordNotes.map((n) => n % 12); // Root position pitch classes
  const fullChordNotePool = getExtendedChordNotePool(baseChordNotes); // Pool based on root pos notes
  let currentNotes: PreviousNotes;
  const eventNotes: MusicalEvent[] = [];
  const noteType = getNoteTypeFromDuration(eventDurationTicks, divisions);

  console.log(
    `    Generating event (Duration: ${eventDurationTicks} ticks / Type: ${noteType})`,
  );

  if (generationStyle === 'SATB') {
    const prevSATB = previousNotes as PreviousNotesSATB;

    // Assign Bass first, respecting inversion
    const bass = assignBassNoteSATB(
      requiredBassPc, // Pass the required PC
      chordRootMidi, // Still useful fallback target
      fullChordNotePool,
      prevSATB.bass,
      melodicSmoothness,
    );

    // Assign Soprano (independent of inversion for now)
    const soprano = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevSATB.soprano,
      melodicSmoothness,
      'SATB',
    );

    // Assign Inner Voices (using the actual chosen bass note)
    const { tenorNoteMidi: tenor, altoNoteMidi: alto } = assignInnerVoicesSATB(
      chordPcs, // Use root position PCs for doubling rules
      fullChordNotePool,
      prevSATB.tenor,
      prevSATB.alto,
      soprano,
      bass, // Pass the potentially inverted bass note
      melodicSmoothness,
      keyDetails,
    );

    currentNotes = { soprano, alto, tenor, bass };
    console.log(
      `      SATB Voicing: S=${midiToNoteName(soprano)} A=${midiToNoteName(alto)} T=${midiToNoteName(tenor)} B=${midiToNoteName(bass)} (Req Bass PC: ${requiredBassPc})`,
    );

    // Create SATB events for this specific duration
    const staff1Notes = [soprano, alto];
    const staff2Notes = [tenor, bass];
    let staff1Stem: 'up' | 'down' =
      soprano !== null && soprano >= 71 ? 'down' : 'up';
    let staff2Stem: 'up' | 'down' =
      tenor !== null && tenor <= 55 ? 'up' : 'down';

    eventNotes.push(
      ...createStaffEvents(
        staff1Notes,
        '1',
        '1', // Voice 1 on Staff 1 (Soprano/Alto)
        staff1Stem,
        eventDurationTicks,
        noteType,
      ),
    );
    eventNotes.push(
      ...createStaffEvents(
        staff2Notes,
        '2',
        '2', // Voice 2 on Staff 2 (Tenor/Bass) - Simple 2-voice setup for now
        staff2Stem,
        eventDurationTicks,
        noteType,
      ),
    );
  } else {
    // MelodyAccompaniment Style
    const prevMA = previousNotes as PreviousNotesMelodyAccompaniment;
    const melody = assignSopranoOrMelodyNote(
      fullChordNotePool,
      prevMA.melody,
      melodicSmoothness,
      'MelodyAccompaniment',
    );

    // Accompaniment voicing needs the *actual* bass note if inverted
    // However, generateAccompanimentVoicing primarily uses root/pcs/pool.
    // We might adapt it later to prioritize the inverted bass note if needed.
    // For now, let it generate based on root position info.
    const accompaniment = generateAccompanimentVoicing(
      melody,
      chordRootMidi,
      chordPcs,
      fullChordNotePool,
      prevMA.accompaniment,
      melodicSmoothness,
      numAccompanimentVoices,
    );
    currentNotes = { melody, accompaniment };
    console.log(
      `      Melody+Acc Voicing: M=${midiToNoteName(melody)} Acc=[${accompaniment.map(midiToNoteName).join(', ')}]`,
    );

    // Create Melody/Accompaniment events for this duration
    let melodyStem: 'up' | 'down' =
      melody !== null && melody >= 71 ? 'down' : 'up';
    let accompStem: 'up' | 'down' = 'down';
    const highestAccomp = accompaniment.filter((n) => n !== null).pop();
    if (
      highestAccomp !== undefined &&
      highestAccomp !== null &&
      highestAccomp <= 55
    ) {
      accompStem = 'up';
    }

    eventNotes.push(
      ...createStaffEvents(
        [melody],
        '1',
        '1', // Melody voice
        melodyStem,
        eventDurationTicks,
        noteType,
      ),
    );
    eventNotes.push(
      ...createStaffEvents(
        accompaniment,
        '2',
        '2', // Accompaniment voice(s) - treated as single voice for now
        accompStem,
        eventDurationTicks,
        noteType,
      ),
    );
  }

  return { currentNotes, eventNotes };
}

/**
 * Creates note or rest events for a single staff and voice.
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
    // Add rest if no valid notes provided for this staff/voice group
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
        isChordElement: index > 0, // Mark subsequent notes as part of a chord
      });
    });
  }
  return events;
}

// generateRestEventsForMeasure (Now takes duration as argument)
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
  // Initial state *before* the first measure
  let previousNotes = initializePreviousNotes(
    generationStyle,
    numAccompanimentVoices,
  );
  const generatedMeasures: MeasureData[] = [];

  // --- Generate Measures Loop ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const romanWithInv = chordProgression[measureIndex] ?? 'I'; // Get the roman numeral including inversion
    console.log(`--- Measure ${measureIndex + 1} (${romanWithInv}) ---`);

    const chordInfo = getChordInfoFromRoman(romanWithInv, keySignature); // Use the new function
    let measureEvents: MusicalEvent[] = []; // Accumulate events for this measure
    let currentMeasureNotes: PreviousNotes | null = null; // Tracks notes at the *end* of the measure

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
    },
    measures: generatedMeasures,
  };

  return pieceData;
}

// --- MusicXML Generation Function --- (Largely Unchanged, but uses new data structures)

/**
 * Creates a MusicXML string from the intermediate musical data structure.
 * @param data - The GeneratedPieceData object.
 * @returns {string} The MusicXML string.
 */
function createMusicXMLString(data: GeneratedPieceData): string {
  const { metadata, measures } = data;

  // --- Key, Meter, Fifths Calculation --- (Similar to before)
  const keyDetails =
    Tonal.Key.majorKey(metadata.keySignature) ??
    Tonal.Key.minorKey(metadata.keySignature);
  if (!keyDetails)
    throw new Error(
      'Internal Error: Invalid key signature in metadata: ' +
        metadata.keySignature,
    );
  const keyFifths = getFifths(keyDetails.tonic);
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';

  const meterMatch = metadata.meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error(
      'Internal Error: Invalid meter format in metadata: ' + metadata.meter,
    );
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);

  // Use a consistent divisions value (e.g., 4 or higher for smaller notes)
  const divisions = 4; // Divisions per quarter note - MUST match generation calculations

  // --- MusicXML Document Setup --- (Similar to before)
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });
  // ... (work title, identification, part-list - same as before) ...
  root.ele('work').ele('work-title').txt(metadata.title).up().up();
  root
    .ele('identification')
    .ele('encoding')
    .ele('software')
    .txt(metadata.software)
    .up()
    .ele('encoding-date')
    .txt(metadata.encodingDate)
    .up()
    .up()
    .up();

  root
    .ele('part-list')
    .ele('score-part', { id: 'P1' })
    .ele('part-name')
    .txt(metadata.partName)
    .up()
    .up() // score-part
    .up(); // part-list

  const partBuilder = root.ele('part', { id: 'P1' });

  // --- Build Measures ---
  measures.forEach((measureData, measureIndex) => {
    const measureBuilder = partBuilder.ele('measure', {
      number: `${measureData.measureNumber}`,
    });

    // Add Attributes in First Measure (Similar to before)
    if (measureIndex === 0) {
      const attributes = measureBuilder.ele('attributes');
      attributes.ele('divisions').txt(`${divisions}`).up(); // Use consistent divisions
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
      attributes.ele('staves').txt('2').up();
      attributes
        .ele('clef', { number: '1' })
        .ele('sign')
        .txt('G')
        .up()
        .ele('line')
        .txt('2')
        .up()
        .up();
      attributes
        .ele('clef', { number: '2' })
        .ele('sign')
        .txt('F')
        .up()
        .ele('line')
        .txt('4')
        .up()
        .up();
      attributes.up(); // attributes
    }

    // Add Harmony (Roman Numeral) - Use the full numeral now
    measureBuilder
      .ele('harmony')
      // Could try to parse root/kind, but 'other' with text is safer for complex numerals
      .ele('root')
      .ele('root-step')
      .up()
      .up() // Placeholder
      .ele('kind')
      .txt('other')
      .att('text', measureData.romanNumeral)
      .up() // Use stored roman numeral
      .up(); // harmony

    // --- Process Musical Events for the Measure ---
    // Group events by staff and voice
    // Assuming Voice 1 = Staff 1 (S/Melody), Voice 2 = Staff 2 (T/Accomp) for now
    const voice1Events = measureData.events.filter(
      (e) => e.voiceNumber === '1',
    );
    const voice2Events = measureData.events.filter(
      (e) => e.voiceNumber === '2',
    );

    // Add Voice 1 events
    if (voice1Events.length > 0) {
      addMusicalEventsToXML(measureBuilder, voice1Events);
    } else {
      // Add full measure rest for voice 1 if no events exist (shouldn't happen if generation logic is correct)
      console.warn(
        `Measure ${measureData.measureNumber}: No events found for Voice 1.`,
      );
      const measureDurationTicks = meterBeats * divisions * (4 / beatValue);
      const restType = getNoteTypeFromDuration(measureDurationTicks, divisions);
      addMusicalEventsToXML(measureBuilder, [
        {
          type: 'rest',
          durationTicks: measureDurationTicks,
          staffNumber: '1',
          voiceNumber: '1',
          noteType: restType,
        },
      ]);
    }

    // Backup before adding Voice 2 events
    const totalVoice1Duration = voice1Events.reduce(
      (sum, ev) => sum + ev.durationTicks,
      0,
    );
    if (voice2Events.length > 0) {
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${totalVoice1Duration}`) // Backup by the total duration of voice 1
        .up()
        .up();

      // Add Voice 2 events
      addMusicalEventsToXML(measureBuilder, voice2Events);
    } else {
      // Add full measure rest for voice 2 if no events exist
      console.warn(
        `Measure ${measureData.measureNumber}: No events found for Voice 2.`,
      );
      const measureDurationTicks = meterBeats * divisions * (4 / beatValue);
      const restType = getNoteTypeFromDuration(measureDurationTicks, divisions);
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${totalVoice1Duration}`)
        .up() // Backup first
        .up();
      addMusicalEventsToXML(measureBuilder, [
        {
          type: 'rest',
          durationTicks: measureDurationTicks,
          staffNumber: '2',
          voiceNumber: '2',
          noteType: restType,
        },
      ]);
    }

    measureBuilder.up(); // measure
  }); // measures.forEach

  partBuilder.up(); // part
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

/** Calculates the 'fifths' value for MusicXML key signature. */
function getFifths(tonic: string): number {
  const keyFifthsMap: { [key: string]: number } = {
    C: 0,
    G: 1,
    D: 2,
    A: 3,
    E: 4,
    B: 5,
    'F#': 6,
    'C#': 7,
    F: -1,
    Bb: -2,
    Eb: -3,
    Ab: -4,
    Db: -5,
    Gb: -6,
    Cb: -7,
  };
  const normalized = Tonal.Note.simplify(tonic.trim());
  if (normalized in keyFifthsMap) {
    return keyFifthsMap[normalized];
  } else {
    const majTonic = Tonal.Note.transpose(normalized, 'm3');
    if (majTonic in keyFifthsMap) {
      return keyFifthsMap[majTonic];
    }
    console.warn(
      `Unsupported tonic for key signature: ${tonic} (normalized: ${normalized}). Defaulting to 0.`,
    );
    return 0; // Fallback
  }
}
