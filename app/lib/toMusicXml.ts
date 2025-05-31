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
   * - -1: flat
   * -  0: natural (often omitted in MusicXML if no accidental is displayed)
   * -  1: sharp
   */
  alter?: number;
  /** The octave number as a string (e.g., "4" for the octave containing middle C). */
  octave: string;
}

function parseNote(noteStr: string): PitchInfo | null {
  const noteDetails = Tonal.Note.get(noteStr);
  if (noteDetails.empty || !noteDetails.letter || noteDetails.oct === undefined) {
    console.warn(`Could not parse note string with Tonal: ${noteStr}`);
    return null;
  }

  const { letter: step, acc, oct: octaveNum } = noteDetails;
  let alter: number | undefined = undefined;
  if (acc === '#') {
    alter = 1;
  } else if (acc === 'b') {
    alter = -1;
  } else if (acc === '##') {
    alter = 2;
  } else if (acc === 'bb') {
    alter = -2;
  }

  return { step, alter, octave: octaveNum.toString() };
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
  melody: NoteObject[];
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
        const pitchInfo = parseNote(noteObj.note);
        if (pitchInfo) {
          const pitch = noteElement.ele('pitch');
          pitch.ele('step').txt(pitchInfo.step).up();
          if (pitchInfo.alter !== undefined) {
            pitch.ele('alter').txt(`${pitchInfo.alter}`).up();
          }
          pitch.ele('octave').txt(pitchInfo.octave).up();
          pitch.up();
          if (pitchInfo.alter !== undefined && pitchInfo.alter !== 0) {
             noteElement.ele('accidental').txt(pitchInfo.alter > 0 ? 'sharp' : 'flat').up();
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
        if (partInfo.id === 'P1' && measureNumber === 2 && pieceAttributes.timeBeats === 3) {
            // console.log(`DEBUG ${partInfo.id} M${measureNumber}: currentMeasureTicks=${currentMeasureTicks}, measureDurationTicks=${pieceAttributes.measureDurationTicks}, remainingTicks=${remainingTicks}`);
        }

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
