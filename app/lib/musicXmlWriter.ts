// app/lib/musicXmlWriter.ts
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { GeneratedPieceData, MusicalEvent } from './types'; // MeasureData is part of GeneratedPieceData
import { midiToMusicXMLPitch, getNoteTypeFromDuration } from './musicxmlUtils';
import { GenerationError } from './errors';

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
    `[WARN] Unsupported tonic for key signature: ${tonic}. Defaulting to 0 fifths.`,
  );
  return 0;
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
      console.warn(`[WARN] addMusicalEventsToXML: Could not get MusicXML pitch for MIDI ${event.midi}. Adding rest instead for event:`, event);
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
    console.warn(`[WARN] addMusicalEventsToXML: Invalid event type or missing MIDI for note. Skipping XML generation for event:`, event);
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
export function createMusicXMLString(data: GeneratedPieceData): string {
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
      const measureDurationTicks = meterBeats * metadata.divisions * (4 / beatValue); // Use metadata.divisions
      const restType = getNoteTypeFromDuration(measureDurationTicks, metadata.divisions); // Use metadata.divisions
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
      const measureDurationTicks = meterBeats * metadata.divisions * (4 / beatValue); // Use metadata.divisions
      const restType = getNoteTypeFromDuration(measureDurationTicks, metadata.divisions); // Use metadata.divisions
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
