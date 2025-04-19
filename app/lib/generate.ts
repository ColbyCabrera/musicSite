// src/generate.ts
import * as Tonal from 'tonal';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

import { VOICE_ORDER_SATB, VOICE_RANGES } from './constants'; // Import necessary constants
import {
  GenerationSettings,
  PreviousNotes,
  PreviousNotesSATB,
  PreviousNotesMelodyAccompaniment,
} from './types';
import {
  getChordNotesFromRoman,
  getExtendedChordNotePool,
  midiToNoteName,
} from './harmonyUtils';
import { assignSopranoOrMelodyNote, findClosestNote } from './voicingUtils'; // Import general utils
import { assignBassNoteSATB, assignInnerVoicesSATB } from './voicingSATB'; // Import SATB utils
import { generateAccompanimentVoicing } from './voicingMelodyAccomp'; // Import M+A utils
import { checkVoiceLeadingRules } from './rules';
import {
  midiToMusicXMLPitch,
  getMusicXMLDurationType,
  addNotesToStaffXML,
  getNoteTypeFromDuration,
} from './musicxmlUtils';

/**
 * Generates the voice data as a MusicXML string using xmlbuilder2.
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
  const {
    melodicSmoothness,
    dissonanceStrictness,
    generationStyle = 'MelodyAccompaniment',
    numAccompanimentVoices = 3,
  } = generationSettings;

  // --- Key, Meter Validation & Setup ---
  let keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails) throw new Error('Invalid key signature: ' + keySignature);

  // Calculate 'fifths' for MusicXML key signature
  const keyProps = Tonal.Mode.get(keyDetails.keySignature);
  const keyFifths = getFifths(keyDetails.tonic); // See implementation below
  const keyMode = keyDetails.type === 'major' ? 'major' : 'minor';

  const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
  if (!meterMatch)
    throw new Error("Invalid meter format. Use 'beats/beatValue'.");
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
    .txt('AI Music Generator (TS Refactored)')
    .up()
    .ele('encoding-date')
    .txt(new Date().toISOString().split('T')[0])
    .up()
    .up()
    .up();

  root
    .ele('part-list')
    .ele('score-part', { id: 'P1' })
    .ele('part-name')
    .txt(generationStyle === 'SATB' ? 'Choral SATB' : 'Melody + Accompaniment')
    .up()
    .up() // score-part
    .up(); // part-list

  const partBuilder = root.ele('part', { id: 'P1' });

  // --- Voicing State & XML Parameters ---
  let previousNotes: PreviousNotes;
  if (generationStyle === 'SATB') {
    previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
  } else {
    previousNotes = {
      melody: null,
      accompaniment: Array(numAccompanimentVoices).fill(null),
    };
  }

  const divisions = 4; // Divisions per quarter note (can be increased for finer rhythm)
  const beatDurationTicks = divisions * (4 / beatValue);

  // --- Generate Measures ---
  for (let measureIndex = 0; measureIndex < numMeasures; measureIndex++) {
    const roman = chordProgression[measureIndex] ?? 'I';
    console.log(`--- Measure ${measureIndex + 1} (${roman}) ---`);
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
      attributes.up();
    }

    const noteDurationTicks = meterBeats * beatDurationTicks;
    const noteType = getNoteTypeFromDuration(noteDurationTicks, divisions);

    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${measureIndex + 1}: Chord error "${roman}". Adding rests.`,
      );
      // Staff 1 Rest
      addNotesToStaffXML(
        measureBuilder,
        [null],
        '1',
        '1',
        'up',
        noteDurationTicks,
        noteType,
      );
      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${noteDurationTicks}`)
        .up()
        .up();
      // Staff 2 Rest
      addNotesToStaffXML(
        measureBuilder,
        [null],
        '2',
        '2',
        'down',
        noteDurationTicks,
        noteType,
      );

      if (generationStyle === 'SATB')
        previousNotes = { soprano: null, alto: null, tenor: null, bass: null };
      else
        previousNotes = {
          melody: null,
          accompaniment: Array(numAccompanimentVoices).fill(null),
        };

      measureBuilder.up();
      continue;
    }

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
    } else {
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
    }

    checkVoiceLeadingRules(
      currentMeasureNotes,
      previousNotes,
      generationStyle,
      measureIndex,
      0,
      dissonanceStrictness,
    );

    if (generationStyle === 'SATB') {
      const { soprano, alto, tenor, bass } =
        currentMeasureNotes as PreviousNotesSATB;
      const staff1Notes = [soprano, alto];
      let staff1Stem = 'up';
      const highestStaff1 = soprano ?? alto;
      if (highestStaff1 !== null && highestStaff1 >= 71) staff1Stem = 'down';
      addNotesToStaffXML(
        measureBuilder,
        staff1Notes,
        '1',
        '1',
        staff1Stem,
        noteDurationTicks,
        noteType,
      );

      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${noteDurationTicks}`)
        .up()
        .up();

      const staff2Notes = [tenor, bass];
      let staff2Stem = 'down';
      const highestStaff2 = tenor ?? bass;
      if (highestStaff2 !== null && highestStaff2 <= 55) staff2Stem = 'up';
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
      const { melody, accompaniment } =
        currentMeasureNotes as PreviousNotesMelodyAccompaniment;
      let melodyStem = 'up';
      if (melody !== null && melody >= 71) melodyStem = 'down';
      addNotesToStaffXML(
        measureBuilder,
        [melody],
        '1',
        '1',
        melodyStem,
        noteDurationTicks,
        noteType,
      );

      measureBuilder
        .ele('backup')
        .ele('duration')
        .txt(`${noteDurationTicks}`)
        .up()
        .up();

      let accompStem = 'down';
      const highestAccomp = accompaniment.filter((n) => n !== null).pop();
      if (
        highestAccomp !== undefined &&
        highestAccomp !== null &&
        highestAccomp <= 55
      ) {
        accompStem = 'up';
      }
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

    previousNotes = currentMeasureNotes;
    measureBuilder.up();
  }

  partBuilder.up();
  console.log('Generation complete. Returning MusicXML string.');
  return root.end({ prettyPrint: true });
}

// A reasonable implementation for getFifths based on the tonic note.
// This mapping follows the circle of fifths for major keys, which is commonly used in MusicXML.
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

  // Normalize the tonic (e.g., trim spaces)
  const normalized = tonic.trim();

  if (normalized in keyFifthsMap) {
    return keyFifthsMap[normalized];
  } else {
    throw new Error('Unsupported tonic for key signature: ' + tonic);
  }
}
