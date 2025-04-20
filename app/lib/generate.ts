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
  getChordNotesFromRoman,
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
 * Generates musical events for a single measure when the chord is valid.
 */
function generateNotesForMeasure(ctx: MeasureGenerationContext): {
  currentMeasureNotes: PreviousNotes;
  measureEvents: MusicalEvent[];
} {
  const {
    baseChordNotes,
    previousNotes,
    generationSettings,
    keyDetails,
    timingInfo,
  } = ctx;
  const {
    melodicSmoothness,
    generationStyle,
    numAccompanimentVoices = 3,
  } = generationSettings;
  const { measureDurationTicks, defaultNoteType } = timingInfo;

  const chordRootMidi = baseChordNotes[0];
  const chordPcs = baseChordNotes.map((n) => n % 12);
  const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);
  let currentMeasureNotes: PreviousNotes;
  const measureEvents: MusicalEvent[] = [];

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
      `    SATB Voicing: S=${midiToNoteName(soprano)} A=${midiToNoteName(alto)} T=${midiToNoteName(tenor)} B=${midiToNoteName(bass)}`,
    );

    // Create SATB events
    const staff1Notes = [soprano, alto];
    const staff2Notes = [tenor, bass];
    let staff1Stem: 'up' | 'down' = 'up';
    if (soprano !== null && soprano >= 71) staff1Stem = 'down'; // Simple stem logic
    let staff2Stem: 'up' | 'down' = 'down';
    if (tenor !== null && tenor <= 55) staff2Stem = 'up'; // Simple stem logic

    measureEvents.push(
      ...createStaffEvents(
        staff1Notes,
        '1',
        '1',
        staff1Stem,
        measureDurationTicks,
        defaultNoteType,
      ),
    );
    measureEvents.push(
      ...createStaffEvents(
        staff2Notes,
        '2',
        '2',
        staff2Stem,
        measureDurationTicks,
        defaultNoteType,
      ),
    );
  } else {
    // MelodyAccompaniment
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
      `    Melody+Acc Voicing: M=${midiToNoteName(melody)} Acc=[${accompaniment.map(midiToNoteName).join(', ')}]`,
    );

    // Create Melody/Accompaniment events
    let melodyStem: 'up' | 'down' = 'up';
    if (melody !== null && melody >= 71) melodyStem = 'down';
    let accompStem: 'up' | 'down' = 'down';
    const highestAccomp = accompaniment.filter((n) => n !== null).pop();
    if (
      highestAccomp !== undefined &&
      highestAccomp !== null &&
      highestAccomp <= 55
    )
      accompStem = 'up';

    measureEvents.push(
      ...createStaffEvents(
        [melody],
        '1',
        '1',
        melodyStem,
        measureDurationTicks,
        defaultNoteType,
      ),
    );
    measureEvents.push(
      ...createStaffEvents(
        accompaniment,
        '2',
        '2',
        accompStem,
        measureDurationTicks,
        defaultNoteType,
      ),
    );
  }

  return { currentMeasureNotes, measureEvents };
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

/**
 * Generates rest events for both staves when a chord error occurs.
 */
function generateRestEventsForMeasure(timingInfo: TimingInfo): MusicalEvent[] {
  const { measureDurationTicks, defaultNoteType } = timingInfo;
  return [
    {
      type: 'rest',
      durationTicks: measureDurationTicks,
      staffNumber: '1',
      voiceNumber: '1',
      noteType: defaultNoteType,
    },
    {
      type: 'rest',
      durationTicks: measureDurationTicks,
      staffNumber: '2',
      voiceNumber: '2',
      noteType: defaultNoteType,
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

  // --- Generate Measures Loop ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const roman = chordProgression[measureIndex] ?? 'I';
    console.log(`--- Measure ${measureIndex + 1} (${roman}) ---`);
    const baseChordNotes = getChordNotesFromRoman(roman, keySignature);
    let measureEvents: MusicalEvent[];
    let currentMeasureNotes: PreviousNotes | null = null;

    if (baseChordNotes.length === 0) {
      // --- Handle Chord Error ---
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}". Adding rests.`,
      );
      measureEvents = generateRestEventsForMeasure(timingInfo);
      // Reset previous notes state
      previousNotes = initializePreviousNotes(
        generationStyle,
        numAccompanimentVoices,
      );
    } else {
      // --- Generate Notes for Valid Chord ---
      const context: MeasureGenerationContext = {
        baseChordNotes,
        previousNotes,
        generationSettings,
        keyDetails,
        timingInfo,
        measureIndex, // Pass index if needed by helpers
      };
      const result = generateNotesForMeasure(context);
      measureEvents = result.measureEvents;
      currentMeasureNotes = result.currentMeasureNotes;

      // Check Rules and Update State
      checkVoiceLeadingRules(
        currentMeasureNotes,
        previousNotes,
        generationStyle,
        measureIndex,
        0, // Assuming only one event/beat per measure for now
        dissonanceStrictness,
      );
      previousNotes = currentMeasureNotes;
    }

    generatedMeasures.push({
      measureNumber: measureIndex + 1,
      romanNumeral: roman,
      events: measureEvents,
    });
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

  // --- Key, Meter, Fifths Calculation ---
  const keyDetails =
    Tonal.Key.majorKey(metadata.keySignature) ??
    Tonal.Key.minorKey(metadata.keySignature);
  if (!keyDetails)
    throw new Error(
      'Internal Error: Invalid key signature in metadata: ' +
        metadata.keySignature,
    );
  const keyFifths = getFifths(keyDetails.tonic); // Use helper below
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';

  const meterMatch = metadata.meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error(
      'Internal Error: Invalid meter format in metadata: ' + metadata.meter,
    );
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);

  const divisions = 4; // Standard divisions per quarter note - should match generation

  // --- MusicXML Document Setup ---
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });

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

    // Add Attributes in First Measure
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
      attributes.ele('staves').txt('2').up(); // Assuming 2 staves always for now
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
      attributes.up();
    }

    // Add Harmony (Roman Numeral as text) - Optional visual aid
    measureBuilder
      .ele('harmony')
      .ele('root')
      .ele('root-step')
      .up()
      .up() // Placeholder root, Tonal doesn't easily give root letter from Roman
      .ele('kind')
      .txt('other')
      .att('text', measureData.romanNumeral)
      .up()
      .up();

    // --- Process Musical Events for the Measure ---
    // Group events by staff and voice, then add with backup/forward
    const staff1Voice1Events = measureData.events.filter(
      (e) => e.staffNumber === '1' && e.voiceNumber === '1',
    );
    const staff2Voice2Events = measureData.events.filter(
      (e) => e.staffNumber === '2' && e.voiceNumber === '2',
    );

    // Add Staff 1 events
    if (staff1Voice1Events.length > 0) {
      addMusicalEventsToXML(measureBuilder, staff1Voice1Events);
    }

    // Backup if Staff 2 has events
    const measureDurationTicks = meterBeats * divisions * (4 / beatValue);
    if (staff2Voice2Events.length > 0) {
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${measureDurationTicks}`) // Assuming full measure backup needed
        .up()
        .up();

      // Add Staff 2 events
      addMusicalEventsToXML(measureBuilder, staff2Voice2Events);
    }

    measureBuilder.up(); // End measure element
  }); // End measures loop

  partBuilder.up(); // End part element
  return root.end({ prettyPrint: true });
}

/** Helper to add a sequence of musical events (notes/rests) for a single voice to the XML measure */
function addMusicalEventsToXML(
  measureBuilder: XMLBuilder,
  events: MusicalEvent[],
): void {
  // Keep track of current tick position if handling complex rhythms
  // let currentTick = 0;

  events.forEach((event) => {
    // Add <forward> or <backup> here if handling complex rhythms within a voice

    const noteEl = measureBuilder.ele('note');

    if (event.type === 'rest') {
      noteEl.ele('rest').up();
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
      // Type is added only if not a chord element or handled differently
      if (!event.isChordElement) {
        noteEl.ele('type').txt(event.noteType).up();
      }
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
    noteEl.up(); // note

    // Update currentTick if needed
    // currentTick += event.durationTicks;
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
