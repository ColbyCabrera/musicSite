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
} from './types';
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

// --- Orchestrator Function ---

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

// --- Core Music Generation Logic ---

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
  const {
    melodicSmoothness,
    dissonanceStrictness,
    generationStyle = 'MelodyAccompaniment',
    numAccompanimentVoices = 3,
  } = generationSettings;

  // --- Key, Meter Validation & Setup ---
  const keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails) throw new Error('Invalid key signature: ' + keySignature);

  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error("Invalid meter format. Use 'beats/beatValue'.");
  const [, beatsStr, beatValueStr] = meterMatch;
  const meterBeats = parseInt(beatsStr, 10);
  const beatValue = parseInt(beatValueStr, 10);
  if (![1, 2, 4, 8, 16, 32].includes(beatValue))
    throw new Error('Unsupported beat value: ' + beatValue);
  if (meterBeats <= 0) throw new Error('Meter beats must be positive.');

  // --- Voicing State & Timing Parameters ---
  let previousNotes: PreviousNotes;
  if (generationStyle === 'SATB') {
    previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
  } else {
    previousNotes = {
      melody: null,
      accompaniment: Array(numAccompanimentVoices).fill(null),
    };
  }

  const divisions = 4; // Divisions per quarter note (for MusicXML timing)
  const beatDurationTicks = divisions * (4 / beatValue);
  const measureDurationTicks = meterBeats * beatDurationTicks;
  const defaultNoteType = getNoteTypeFromDuration(
    measureDurationTicks,
    divisions,
  ); // Assuming whole measure notes for now

  const generatedMeasures: MeasureData[] = [];

  // --- Generate Measures ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const roman = chordProgression[measureIndex] ?? 'I';
    console.log(`--- Measure ${measureIndex + 1} (${roman}) ---`);
    const baseChordNotes = getChordNotesFromRoman(roman, keySignature);
    const measureEvents: MusicalEvent[] = [];

    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}". Adding rests.`,
      );
      // Staff 1 Rest
      measureEvents.push({
        type: 'rest',
        durationTicks: measureDurationTicks,
        staffNumber: '1',
        voiceNumber: '1', // Voice 1 on Staff 1
        noteType: defaultNoteType,
      });
      // Staff 2 Rest
      measureEvents.push({
        type: 'rest',
        durationTicks: measureDurationTicks,
        staffNumber: '2',
        voiceNumber: '2', // Voice 2 on Staff 2 (can adjust voice numbers if needed)
        noteType: defaultNoteType,
      });

      // Reset previous notes state for rests
      if (generationStyle === 'SATB') {
        previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
      } else {
        previousNotes = {
          melody: null,
          accompaniment: Array(numAccompanimentVoices).fill(null),
        };
      }
    } else {
      // --- Generate Notes for this Measure ---
      const chordRootMidi = baseChordNotes[0];
      const chordPcs = baseChordNotes.map((n) => n % 12);
      const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);
      let currentMeasureNotes: PreviousNotes;

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
        const { tenorNoteMidi: tenor, altoNoteMidi: alto } =
          assignInnerVoicesSATB(
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

        // Add SATB notes to events
        const staff1Notes = [soprano, alto].filter(
          (n) => n !== null,
        ) as number[];
        const staff2Notes = [tenor, bass].filter((n) => n !== null) as number[];

        let staff1Stem: 'up' | 'down' = 'up';
        if (soprano !== null && soprano >= 71) staff1Stem = 'down'; // Simple stem logic
        let staff2Stem: 'up' | 'down' = 'down';
        if (tenor !== null && tenor <= 55) staff2Stem = 'up'; // Simple stem logic

        // Staff 1 (Soprano/Alto) - Voice 1
        staff1Notes.forEach((midi, index) => {
          measureEvents.push({
            type: 'note',
            midi: midi,
            durationTicks: measureDurationTicks,
            staffNumber: '1',
            voiceNumber: '1',
            stemDirection: staff1Stem,
            noteType: defaultNoteType,
            isChordElement: index > 0,
          });
        });
        if (staff1Notes.length === 0) {
          // Add rest if no notes on staff 1
          measureEvents.push({
            type: 'rest',
            durationTicks: measureDurationTicks,
            staffNumber: '1',
            voiceNumber: '1',
            noteType: defaultNoteType,
          });
        }

        // Staff 2 (Tenor/Bass) - Voice 2
        staff2Notes.forEach((midi, index) => {
          measureEvents.push({
            type: 'note',
            midi: midi,
            durationTicks: measureDurationTicks,
            staffNumber: '2',
            voiceNumber: '2',
            stemDirection: staff2Stem,
            noteType: defaultNoteType,
            isChordElement: index > 0,
          });
        });
        if (staff2Notes.length === 0) {
          // Add rest if no notes on staff 2
          measureEvents.push({
            type: 'rest',
            durationTicks: measureDurationTicks,
            staffNumber: '2',
            voiceNumber: '2',
            noteType: defaultNoteType,
          });
        }
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

        // Add Melody/Accompaniment notes to events
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

        // Staff 1 (Melody) - Voice 1
        if (melody !== null) {
          measureEvents.push({
            type: 'note',
            midi: melody,
            durationTicks: measureDurationTicks,
            staffNumber: '1',
            voiceNumber: '1',
            stemDirection: melodyStem,
            noteType: defaultNoteType,
            isChordElement: false,
          });
        } else {
          measureEvents.push({
            type: 'rest',
            durationTicks: measureDurationTicks,
            staffNumber: '1',
            voiceNumber: '1',
            noteType: defaultNoteType,
          });
        }

        // Staff 2 (Accompaniment) - Voice 2
        const validAccompNotes = accompaniment.filter(
          (n) => n !== null,
        ) as number[];
        validAccompNotes.forEach((midi, index) => {
          measureEvents.push({
            type: 'note',
            midi: midi,
            durationTicks: measureDurationTicks,
            staffNumber: '2',
            voiceNumber: '2',
            stemDirection: accompStem,
            noteType: defaultNoteType,
            isChordElement: index > 0,
          });
        });
        if (validAccompNotes.length === 0 && numAccompanimentVoices > 0) {
          // Add rest if no notes on staff 2
          measureEvents.push({
            type: 'rest',
            durationTicks: measureDurationTicks,
            staffNumber: '2',
            voiceNumber: '2',
            noteType: defaultNoteType,
          });
        }
      }

      // Check Rules and Update State
      checkVoiceLeadingRules(
        currentMeasureNotes,
        previousNotes,
        generationStyle,
        measureIndex,
        0,
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

// --- MusicXML Generation Function ---

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

  const divisions = 4; // Standard divisions per quarter note - could be configurable

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
    // We need to group events by their logical time position (start of measure here)
    // and staff/voice, then use backup/forward for correct XML layout.
    // For simplicity with whole-measure notes, we process staff 1 then staff 2.

    // Filter events for Staff 1
    const staff1Events = measureData.events.filter(
      (e) => e.staffNumber === '1',
    );
    if (staff1Events.length > 0) {
      // Group by voice on staff 1 (assuming voice '1' for now)
      const voice1Events = staff1Events.filter((e) => e.voiceNumber === '1'); // Adjust if more voices per staff
      addMusicalEventsToXML(measureBuilder, voice1Events);
    } else {
      // Add placeholder rest if staff is empty but should exist
      addMusicalEventsToXML(measureBuilder, [
        {
          type: 'rest',
          durationTicks: meterBeats * divisions * (4 / beatValue), // Full measure duration
          staffNumber: '1',
          voiceNumber: '1',
          noteType: getNoteTypeFromDuration(
            meterBeats * divisions * (4 / beatValue),
            divisions,
          ),
        },
      ]);
    }

    // Backup to beginning of measure to write Staff 2
    measureBuilder
      .ele('backup')
      .ele('duration')
      .txt(`${meterBeats * divisions * (4 / beatValue)}`)
      .up()
      .up();

    // Filter events for Staff 2
    const staff2Events = measureData.events.filter(
      (e) => e.staffNumber === '2',
    );
    if (staff2Events.length > 0) {
      // Group by voice on staff 2 (assuming voice '2' for now)
      const voice2Events = staff2Events.filter((e) => e.voiceNumber === '2'); // Adjust if more voices per staff
      addMusicalEventsToXML(measureBuilder, voice2Events);
    } else {
      // Add placeholder rest if staff is empty but should exist
      addMusicalEventsToXML(measureBuilder, [
        {
          type: 'rest',
          durationTicks: meterBeats * divisions * (4 / beatValue), // Full measure duration
          staffNumber: '2',
          voiceNumber: '2',
          noteType: getNoteTypeFromDuration(
            meterBeats * divisions * (4 / beatValue),
            divisions,
          ),
        },
      ]);
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
  events.forEach((event, index) => {
    const noteEl = measureBuilder.ele('note');

    if (event.type === 'rest') {
      noteEl.ele('rest').up();
      noteEl.ele('duration').txt(`${event.durationTicks}`).up();
      // noteEl.ele('type').txt(event.noteType).up(); // Type often optional for rests
    } else if (
      event.type === 'note' &&
      event.midi !== null &&
      event.midi !== undefined
    ) {
      if (event.isChordElement && index > 0) {
        // Add <chord/> if it's part of a simultaneous chord
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

      // Add duration/type only to the first note of a chord/beat
      if (!event.isChordElement || index === 0) {
        noteEl.ele('duration').txt(`${event.durationTicks}`).up();
        noteEl.ele('type').txt(event.noteType).up();
      }

      if (event.stemDirection) {
        noteEl.ele('stem').txt(event.stemDirection).up();
      }
    } else {
      console.warn(
        `Invalid event type or missing MIDI for note event. Skipping.`,
        event,
      );
      return; // Skip this event
    }

    noteEl.ele('voice').txt(event.voiceNumber).up();
    noteEl.ele('staff').txt(event.staffNumber).up();
    noteEl.up(); // note
  });
}

// --- XML Helper Functions --- (Moved getFifths here)

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
  const normalized = Tonal.Note.simplify(tonic.trim()); // Simplify accidentals (e.g., E# -> F)
  if (normalized in keyFifthsMap) {
    return keyFifthsMap[normalized];
  } else {
    // Try relative minor's major tonic
    const majTonic = Tonal.Note.transpose(normalized, 'm3'); // Get relative major tonic
    if (majTonic in keyFifthsMap) {
      return keyFifthsMap[majTonic];
    }
    throw new Error(
      `Unsupported tonic for key signature: ${tonic} (normalized: ${normalized})`,
    );
  }
}
