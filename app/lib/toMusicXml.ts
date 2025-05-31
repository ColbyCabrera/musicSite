// src/toMusicXml.ts
import { XMLBuilder, create } from 'xmlbuilder2';
import * as Tonal from 'tonal';

/**
 * Represents a musical note with its pitch and rhythm.
 * Used as input for generating MusicXML.
 */
interface NoteObject {
  /** The scientific pitch notation of the note (e.g., "C4", "F#5", "Bb3", or "rest"). */
  note?: string;
  /**
   * A numerical representation of the note's rhythm/duration.
   * For example, 1 for whole, 2 for half, 4 for quarter, 8 for eighth, 16 for sixteenth.
   * Optional, can be null.
   */
  rhythm?: number | null;
}

/**
 * Holds information about a specific rhythmic value in MusicXML context.
 */
interface RhythmInfo {
  /** The MusicXML note type string (e.g., "quarter", "half", "eighth"). */
  type: string;
  /** The duration of the note in MusicXML divisions (ticks). */
  duration: number;
}

/**
 * Represents the constituent parts of a musical pitch for MusicXML.
 */
interface PitchInfo {
  /** The note's letter name (A, B, C, D, E, F, G). */
  step: string;
  /**
   * The alteration of the note:
   * - -2: double flat
   * - -1: flat
   * -  0: natural (often omitted in MusicXML if no accidental is displayed, e.g. C in C major)
   * -  1: sharp
   * -  2: double sharp
   */
  alter?: number;
  /** The octave number as a string (e.g., "4" for the octave containing middle C). */
  octave: string;
}

/**
 * Parses a note string in scientific pitch notation (e.g., "C#4", "Bb3", or "rest")
 * into its fundamental components: step (letter), alteration (accidental), and octave.
 * If "rest" is provided, it returns a structure representing a rest.
 *
 * @param {string} noteStr - The note string to parse.
 * @returns {PitchInfo} A `PitchInfo` object. For rests or unparseable notes,
 *                      it returns a default structure (e.g., empty step/octave).
 */
function getNoteDetails(noteStr: string): PitchInfo {
  if (noteStr.toLowerCase() === 'rest') {
    // Return a representation for a rest.
    return { step: '', alter: 0, octave: '' };
  }

  const noteDetails = Tonal.Note.get(noteStr);

  // Check if Tonal.js could parse the note into meaningful components.
  if (noteDetails.empty || !noteDetails.letter || typeof noteDetails.oct !== 'number') {
    console.warn(`Could not parse pitched note string with Tonal: ${noteStr}`);
    return { step: '', alter: 0, octave: '' }; // Default for unparseable pitched notes
  }

  const step = noteDetails.letter;
  // noteDetails.alt provides the numerical alteration: 1 for #, -1 for b, 2 for ##, -2 for bb
  // It can be undefined for notes without accidentals (like C in C major scale context from Tonal functions,
  // but Tonal.Note.get('C4').alt is undefined, which we want as 0).
  const alter = noteDetails.alt !== undefined ? noteDetails.alt : 0;
  const octave = String(noteDetails.oct);

  return { step, alter, octave };
}

const RHYTHM_MAP_DIVISIONS: number = 4;

const rhythmMap = new Map<number, RhythmInfo>([
  [1, { type: 'whole', duration: RHYTHM_MAP_DIVISIONS * 4 }],
  [2, { type: 'half', duration: RHYTHM_MAP_DIVISIONS * 2 }],
  [4, { type: 'quarter', duration: RHYTHM_MAP_DIVISIONS * 1 }],
  [8, { type: 'eighth', duration: RHYTHM_MAP_DIVISIONS / 2 }],
  [16, { type: '16th', duration: RHYTHM_MAP_DIVISIONS / 4 }],
  [32, { type: '32nd', duration: RHYTHM_MAP_DIVISIONS / 8 }],
]);

interface ScoreData {
  /** Array of NoteObject representing the melody line. */
  melody: NoteObject[];
  /** Array of NoteObject representing the accompaniment. */
  accompaniment: NoteObject[];
}

interface PieceAttributes {
  divisions: number;
  keyFifths: number;
  keyMode: string;
  timeBeats: number;
  timeBeatType: number;
  measureDurationTicks: number;
}

interface PartInfo {
  id: string;
  name: string;
  clefSign: 'G' | 'F' | 'C';
  clefLine: number;
}

function buildPartMeasures(
  partBuilder: XMLBuilder,
  notes: NoteObject[],
  partInfo: PartInfo,
  pieceAttributes: PieceAttributes,
) {
  let currentMeasureTicks = 0;
  let measureNumber = 1;
  let noteBuffer = [...notes];

  while (noteBuffer.length > 0 || (measureNumber === 1 && currentMeasureTicks === 0) || (currentMeasureTicks > 0 && currentMeasureTicks < pieceAttributes.measureDurationTicks)) {
    const measureElement = partBuilder.ele('measure', { number: `${measureNumber}` });

    if (measureNumber === 1) {
      const attributes = measureElement.ele('attributes');
      attributes.ele('divisions').txt(`${pieceAttributes.divisions}`).up();
      const key = attributes.ele('key');
      key.ele('fifths').txt(`${pieceAttributes.keyFifths}`).up();
      key.ele('mode').txt(pieceAttributes.keyMode).up();
      key.up();
      const time = attributes.ele('time');
      time.ele('beats').txt(`${pieceAttributes.timeBeats}`).up();
      time.ele('beat-type').txt(`${pieceAttributes.timeBeatType}`).up();
      time.up();
      attributes.ele('staves').txt('1').up();
      const clef = attributes.ele('clef');
      clef.ele('sign').txt(partInfo.clefSign).up();
      clef.ele('line').txt(`${partInfo.clefLine}`).up();
      clef.up();
      attributes.up();
    }

    let measureFilledInLoop = false;
    while (currentMeasureTicks < pieceAttributes.measureDurationTicks && noteBuffer.length > 0) {
      measureFilledInLoop = true;
      const noteObj = noteBuffer[0];

      if (!noteObj.rhythm) {
        console.warn(`Skipping note object with no rhythm: ${JSON.stringify(noteObj)}`);
        noteBuffer.shift();
        continue;
      }
      const rhythmInfo = rhythmMap.get(noteObj.rhythm);
      if (!rhythmInfo) {
        console.warn(`Skipping note with unrecognized rhythm: ${noteObj.rhythm}`);
        noteBuffer.shift();
        continue;
      }

      if (currentMeasureTicks + rhythmInfo.duration > pieceAttributes.measureDurationTicks) {
        break;
      }

      noteBuffer.shift();

      const noteElement = measureElement.ele('note');
      const isRest = noteObj.note?.toLowerCase() === 'rest';

      if (isRest) {
        noteElement.ele('rest').up();
      } else if (noteObj.note) {
        const pitchInfo = getNoteDetails(noteObj.note); // Use the new function name
        // Since getNoteDetails now always returns a PitchInfo (even for rests/unparseable),
        // we check if it's a "real" note by seeing if step is populated.
        if (pitchInfo.step) {
          const pitch = noteElement.ele('pitch');
          pitch.ele('step').txt(pitchInfo.step).up();
          if (pitchInfo.alter !== undefined && pitchInfo.alter !== 0) { // Only add alter if not 0
            pitch.ele('alter').txt(`${pitchInfo.alter}`).up();
          }
          pitch.ele('octave').txt(pitchInfo.octave).up();
          pitch.up();
          // Accidental display logic
          if (pitchInfo.alter !== undefined && pitchInfo.alter !== 0) {
            let accidentalText = '';
            switch (pitchInfo.alter) {
              case 1:
                accidentalText = 'sharp';
                break;
              case -1:
                accidentalText = 'flat';
                break;
              case 2:
                accidentalText = 'double-sharp';
                break;
              case -2:
                accidentalText = 'flat-flat';
                break;
            }
            if (accidentalText) {
              noteElement.ele('accidental').txt(accidentalText).up();
            }
          }
        } else {
          noteElement.ele('rest').up();
          console.warn(`Unparseable note string '${noteObj.note}', adding rest instead.`);
        }
      } else {
        noteElement.ele('rest').up();
      }

      noteElement.ele('duration').txt(`${rhythmInfo.duration}`).up();
      if (!isRest && rhythmInfo.type) {
          noteElement.ele('type').txt(rhythmInfo.type).up();
      }
      noteElement.ele('voice').txt('1').up();
      noteElement.ele('staff').txt('1').up();
      noteElement.up();

      currentMeasureTicks += rhythmInfo.duration;
    }

    if (currentMeasureTicks < pieceAttributes.measureDurationTicks) {
      const remainingTicks = pieceAttributes.measureDurationTicks - currentMeasureTicks;
      if (remainingTicks > 0) {
        const restElement = measureElement.ele('note');
        restElement.ele('rest').up();
        restElement.ele('duration').txt(`${remainingTicks}`).up();
        restElement.ele('voice').txt('1').up();
        restElement.ele('staff').txt('1').up();
        restElement.up();
        currentMeasureTicks += remainingTicks;
        measureFilledInLoop = true;
      }
    }

    measureElement.up();

    if (currentMeasureTicks >= pieceAttributes.measureDurationTicks) {
        currentMeasureTicks = 0;
        measureNumber++;
    } else if (noteBuffer.length === 0 && !measureFilledInLoop && measureNumber > 1) {
        break;
    }

    if (measureNumber > 1000) {
        console.error("Measure count exceeded 1000. Aborting.");
        break;
    }
    if (noteBuffer.length === 0 && currentMeasureTicks === 0) {
        break;
    }
  }
}

export function scoreToMusicXML(
  scoreData: ScoreData,
  keySignature: string,
  timeSignature: string,
  title: string = 'Generated Score',
): string {
  const divisions = RHYTHM_MAP_DIVISIONS;

  const keyDetails = Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  let keyFifths = 0;
  let keyMode = 'major';
  if (keyDetails && typeof keyDetails.alteration === 'number' && keyDetails.type) {
    keyFifths = keyDetails.alteration;
    keyMode = keyDetails.type;
  } else {
    console.warn(`Could not determine key signature details for "${keySignature}". Defaulting to C major.`);
  }

  const timeSigMatch = timeSignature.match(/^(\d+)\/(\d+)$/);
  let timeBeats = 4;
  let timeBeatType = 4;
  if (timeSigMatch) {
    timeBeats = parseInt(timeSigMatch[1], 10);
    timeBeatType = parseInt(timeSigMatch[2], 10);
  } else {
    console.warn(`Invalid time signature format "${timeSignature}". Defaulting to 4/4.`);
  }
  const ticksPerBeat = divisions * (4 / timeBeatType);
  const measureDurationTicks = timeBeats * ticksPerBeat;

  const pieceAttributes: PieceAttributes = {
    divisions,
    keyFifths,
    keyMode,
    timeBeats,
    timeBeatType,
    measureDurationTicks,
  };

  const root = create({ version: '1.0', encoding: 'UTF-8', standalone: false }) // Added standalone: false
    .dtd({
      pubID: '-//Recordare//DTD MusicXML 4.0 Partwise//EN',
      sysID: 'http://www.musicxml.org/dtds/partwise.dtd',
    })
    .ele('score-partwise', { version: '4.0' });

  root.ele('work').ele('work-title').txt(title).up().up();
  const identification = root.ele('identification');
  identification.ele('software').txt('AI Music Generation Tool').up();
  identification.ele('encoding-date').txt(new Date().toISOString().split('T')[0]).up();
  identification.up();

  const partList = root.ele('part-list');
  partList.ele('score-part', { id: 'P1' }).ele('part-name').txt('Melody').up().up();
  partList.ele('score-part', { id: 'P2' }).ele('part-name').txt('Accompaniment').up().up();
  partList.up();

  const melodyPartBuilder = root.ele('part', { id: 'P1' });
  const melodyPartInfo: PartInfo = { id: 'P1', name: 'Melody', clefSign: 'G', clefLine: 2};
  buildPartMeasures(melodyPartBuilder, scoreData.melody, melodyPartInfo, pieceAttributes);
  melodyPartBuilder.up();

  const accompanimentPartBuilder = root.ele('part', { id: 'P2' });
  const accompanimentPartInfo: PartInfo = { id: 'P2', name: 'Accompaniment', clefSign: 'F', clefLine: 4};
  buildPartMeasures(accompanimentPartBuilder, scoreData.accompaniment, accompanimentPartInfo, pieceAttributes);
  accompanimentPartBuilder.up();

  return root.end({ prettyPrint: true });
}
