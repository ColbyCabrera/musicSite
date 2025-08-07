// generationEngine.ts
// Core music generation engine (migrated from generate.ts for clearer naming & organization)
// Exports low-level generation plus a high-level wrapper `generateScore` supporting a difficulty slider.

import * as Tonal from 'tonal';
import { InvalidInputError } from './errors';
import {
  parseMeter,
  InvalidMeterError as InvalidMeterUtilError,
} from './generationUtils';
import {
  GenerationSettings,
  PreviousNotes,
  PreviousNotesSATB,
  PreviousNotesMelodyAccompaniment,
  MeasureData,
  MusicalEvent,
  GeneratedPieceData,
  KeyDetails,
  TimingInfo,
} from './types';
import { getChordInfoFromRoman, getExtendedChordNotePool } from './theory/harmony';
// Explicitly import from rhythm/index to avoid colliding with legacy rhythm.ts
import { generateBeatFactorPattern } from './rhythm/index';
import { assignSopranoOrMelodyNote } from './voicingUtils';
import { assignBassNoteSATB, assignInnerVoicesSATB } from './voicingSATB';
import { generateAccompanimentVoicing } from './voicingMelodyAccomp';
import { checkVoiceLeadingRules } from './rules';
import { getNoteTypeFromDuration } from './musicxmlUtils';
import { createMusicXMLString } from './musicXmlWriter';
import { mapDifficultyToSettings } from './difficulty';

interface MelodicStateInternal {
  lastDirection: number;
  directionStreak: number;
}
interface ProcessMeasureResultInternal {
  measureEvents: MusicalEvent[];
  notesAtEndOfMeasure: PreviousNotes;
}

/**
 * High-level options for score generation.
 * Provide musical context and (optionally) a difficulty slider or fine‑grained overrides.
 */
export interface GenerateScoreOptions {
  chordProgression: string[];
  keySignature: string;
  meter: string;
  numMeasures: number;
  style?: GenerationSettings['generationStyle'];
  difficulty?: number; // 0-10
  overrides?: Partial<GenerationSettings>;
}

/**
 * Convenience wrapper: generate a MusicXML string for given inputs.
 * Applies difficulty slider mapping then delegates to the lower level engine.
 */
export function generateScore(options: GenerateScoreOptions): string {
  const {
    chordProgression,
    keySignature,
    meter,
    numMeasures,
    style = 'MelodyAccompaniment',
    difficulty = 5,
    overrides = {},
  } = options;
  const base = mapDifficultyToSettings(difficulty, style);
  const settings: GenerationSettings = {
    ...base,
    ...overrides,
    generationStyle: style,
  } as GenerationSettings;
  return generateVoices(
    chordProgression,
    keySignature,
    meter,
    numMeasures,
    settings,
  );
}

export function generateVoices(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): string {
  const musicalData = generateMusicalData(
    chordProgression,
    keySignature,
    meter,
    numMeasures,
    generationSettings,
  );
  return createMusicXMLString(musicalData);
}

function initializeGenerationParameters(
  keySignature: string,
  meter: string,
): { keyDetails: KeyDetails; timingInfo: TimingInfo } {
  const keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails || !keyDetails.tonic)
    throw new InvalidInputError('Invalid key signature: ' + keySignature);
  let meterBeats: number;
  let beatValue: number;
  try {
    const parsed = parseMeter(meter);
    meterBeats = parsed.beats;
    beatValue = parsed.beatType;
  } catch (e) {
    if (e instanceof InvalidMeterUtilError)
      throw new InvalidInputError(e.message);
    throw new InvalidInputError(
      'Meter processing failed: ' + (e as Error).message,
    );
  }
  const divisions = 4;
  const beatDurationTicks = divisions * (4 / beatValue);
  const measureDurationTicks = meterBeats * beatDurationTicks;
  const defaultNoteType = getNoteTypeFromDuration(
    measureDurationTicks,
    divisions,
  );
  return {
    keyDetails,
    timingInfo: {
      meterBeats,
      beatValue,
      divisions,
      beatDurationTicks,
      measureDurationTicks,
      defaultNoteType,
    },
  };
}

function initializePreviousNotes(
  style: GenerationSettings['generationStyle'],
  numAccompanimentVoices: number = 3,
): PreviousNotes {
  return style === 'SATB'
    ? { soprano: null, alto: null, tenor: null, bass: null }
    : { melody: null, accompaniment: Array(numAccompanimentVoices).fill(null) };
}

// Rhythm pattern now supplied by rhythm module (generateBeatFactorPattern)

function createStaffEvents(
  notes: (number | null)[],
  staffNumber: string,
  voiceNumber: string,
  stemDirection: 'up' | 'down',
  durationTicks: number,
  noteType: string,
): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  const valid = notes.filter((n): n is number => n !== null);
  if (!valid.length)
    events.push({
      type: 'rest',
      durationTicks,
      staffNumber,
      voiceNumber,
      noteType,
    });
  else
    valid.forEach((midi, idx) =>
      events.push({
        type: 'note',
        midi,
        durationTicks,
        staffNumber,
        voiceNumber,
        stemDirection,
        noteType,
        isChordElement: idx > 0,
      }),
    );
  return events;
}

function generateRestEventsForDuration(
  durationTicks: number,
  noteType: string,
  staff: '1' | '2',
  voice: string,
): MusicalEvent[] {
  return [
    {
      type: 'rest',
      durationTicks,
      staffNumber: staff,
      voiceNumber: voice,
      noteType,
    },
  ];
}

function generateNotesForEvent(
  baseChordNotes: number[],
  requiredBassPc: number | null,
  previousNotes: PreviousNotes,
  generationSettings: GenerationSettings,
  keyDetails: KeyDetails,
  timingInfo: TimingInfo,
  eventDurationTicks: number,
  melodicState?: MelodicStateInternal,
): { currentNotes: PreviousNotes; eventNotes: MusicalEvent[] } {
  const {
    melodicSmoothness,
    generationStyle,
    numAccompanimentVoices = 3,
  } = generationSettings;
  const { divisions, beatDurationTicks } = timingInfo;
  const chordRootMidi = baseChordNotes[0];
  const chordPcs = baseChordNotes.map((n) => n % 12);
  const fullPool = getExtendedChordNotePool(baseChordNotes);
  let currentNotes: PreviousNotes;
  const eventNotes: MusicalEvent[] = [];
  const eventNoteType = getNoteTypeFromDuration(eventDurationTicks, divisions);
  if (generationStyle === 'SATB') {
    const prevSATB = previousNotes as PreviousNotesSATB;
    const bass = assignBassNoteSATB(
      requiredBassPc,
      chordRootMidi,
      fullPool,
      prevSATB.bass,
      melodicSmoothness,
    );
    const soprano = assignSopranoOrMelodyNote(
      fullPool,
      prevSATB.soprano,
      melodicSmoothness,
      'SATB',
      keyDetails.tonic,
      melodicState as any,
    );
    const { tenorNoteMidi: tenor, altoNoteMidi: alto } = assignInnerVoicesSATB(
      chordPcs,
      fullPool,
      prevSATB.tenor,
      prevSATB.alto,
      soprano,
      bass,
      melodicSmoothness,
      keyDetails,
    );
    currentNotes = { soprano, alto, tenor, bass };
    const staff1 = [soprano, alto].filter((n) => n !== null) as number[];
    const staff2 = [tenor, bass].filter((n) => n !== null) as number[];
    const stem1: 'up' | 'down' =
      soprano !== null && soprano >= 71 ? 'down' : 'up';
    const stem2: 'up' | 'down' = tenor !== null && tenor <= 55 ? 'up' : 'down';
    if (staff1.length)
      eventNotes.push(
        ...createStaffEvents(
          staff1,
          '1',
          '1',
          stem1,
          eventDurationTicks,
          eventNoteType,
        ),
      );
    if (staff2.length)
      eventNotes.push(
        ...createStaffEvents(
          staff2,
          '2',
          '2',
          stem2,
          eventDurationTicks,
          eventNoteType,
        ),
      );
  } else {
    const prevMA = previousNotes as PreviousNotesMelodyAccompaniment;
    const melody = assignSopranoOrMelodyNote(
      fullPool,
      prevMA.melody,
      melodicSmoothness,
      'MelodyAccompaniment',
      keyDetails.tonic,
      melodicState as any,
    );
    const melodyStem: 'up' | 'down' =
      melody !== null && melody >= 71 ? 'down' : 'up';
    if (melody !== null)
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
    const accompanimentVoicing = generateAccompanimentVoicing(
      melody,
      chordRootMidi,
      chordPcs,
      fullPool,
      prevMA.accompaniment,
      melodicSmoothness,
      numAccompanimentVoices,
    );
    const validAccomp = accompanimentVoicing
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    const shouldArp =
      eventDurationTicks < beatDurationTicks && validAccomp.length > 1;
    let accompStem: 'up' | 'down' = 'down';
    if (validAccomp.length && validAccomp[validAccomp.length - 1] <= 55)
      accompStem = 'up';
    if (shouldArp) {
      const num = validAccomp.length;
      const baseDur = Math.max(1, Math.floor(eventDurationTicks / num));
      let remaining = eventDurationTicks;
      for (let i = 0; i < num; i++) {
        const midi = validAccomp[i];
        const dur = i === num - 1 ? remaining : baseDur;
        if (dur <= 0) continue;
        const arpType = getNoteTypeFromDuration(dur, divisions);
        eventNotes.push({
          type: 'note',
          midi,
          durationTicks: dur,
          staffNumber: '2',
          voiceNumber: '2',
          stemDirection: accompStem,
          noteType: arpType,
          isChordElement: false,
        });
        remaining -= dur;
      }
    } else if (validAccomp.length) {
      eventNotes.push(
        ...createStaffEvents(
          validAccomp,
          '2',
          '2',
          accompStem,
          eventDurationTicks,
          eventNoteType,
        ),
      );
    }
    currentNotes = { melody, accompaniment: accompanimentVoicing };
  }
  return { currentNotes, eventNotes };
}

function processMeasure(
  romanWithInv: string,
  keySignature: string,
  measurePreviousNotes: PreviousNotes,
  generationSettings: GenerationSettings,
  keyDetails: KeyDetails,
  timingInfo: TimingInfo,
  melodicState: MelodicStateInternal,
  measureIndex: number,
): ProcessMeasureResultInternal {
  const {
    generationStyle,
    numAccompanimentVoices,
    rhythmicComplexity,
    dissonanceStrictness,
  } = generationSettings;
  const currentEvents: MusicalEvent[] = [];
  let eventPrev = { ...measurePreviousNotes } as PreviousNotes;
  let chordInfoResult;
  try {
    chordInfoResult = getChordInfoFromRoman(romanWithInv, keySignature);
  } catch {
    chordInfoResult = null;
  }
  if (!chordInfoResult) {
    const restType = getNoteTypeFromDuration(
      timingInfo.measureDurationTicks,
      timingInfo.divisions,
    );
    currentEvents.push(
      ...generateRestEventsForDuration(
        timingInfo.measureDurationTicks,
        restType,
        '1',
        '1',
      ),
      ...generateRestEventsForDuration(
        timingInfo.measureDurationTicks,
        restType,
        '2',
        '2',
      ),
    );
    return {
      measureEvents: currentEvents,
      notesAtEndOfMeasure: initializePreviousNotes(
        generationStyle,
        numAccompanimentVoices,
      ),
    };
  }
  const { notes: baseChordNotes, requiredBassPc } = chordInfoResult;
  const rhythmFactors = generateBeatFactorPattern(timingInfo, rhythmicComplexity);
  let tick = 0;
  for (let eventIndex = 0; eventIndex < rhythmFactors.length; eventIndex++) {
    if (tick >= timingInfo.measureDurationTicks) break;
    const factor = rhythmFactors[eventIndex];
    let duration = Math.round(timingInfo.beatDurationTicks * factor);
    if (tick + duration > timingInfo.measureDurationTicks)
      duration = timingInfo.measureDurationTicks - tick;
    if (duration <= 0) continue;
    const result = generateNotesForEvent(
      baseChordNotes,
      requiredBassPc,
      eventPrev,
      generationSettings,
      keyDetails,
      timingInfo,
      duration,
      melodicState,
    );
    currentEvents.push(...result.eventNotes);
    checkVoiceLeadingRules(
      result.currentNotes,
      eventPrev,
      generationStyle,
      measureIndex,
      eventIndex,
      dissonanceStrictness,
    );
    eventPrev = result.currentNotes;
    tick += duration;
  }
  if (tick < timingInfo.measureDurationTicks) {
    const remaining = timingInfo.measureDurationTicks - tick;
    if (remaining > 0) {
      const restType = getNoteTypeFromDuration(remaining, timingInfo.divisions);
      currentEvents.push(
        ...generateRestEventsForDuration(remaining, restType, '1', '1'),
        ...generateRestEventsForDuration(remaining, restType, '2', '2'),
      );
    }
  }
  return { measureEvents: currentEvents, notesAtEndOfMeasure: eventPrev };
}

export function generateMusicalData(
  chordProgression: string[],
  keySignature: string,
  meter: string,
  numMeasures: number,
  generationSettings: GenerationSettings,
): GeneratedPieceData {
  const { generationStyle, numAccompanimentVoices } = generationSettings;
  const { keyDetails, timingInfo } = initializeGenerationParameters(
    keySignature,
    meter,
  );
  let prevForNext = initializePreviousNotes(
    generationStyle,
    numAccompanimentVoices,
  );
  const measures: MeasureData[] = [];
  const melodicState: MelodicStateInternal = {
    lastDirection: 0,
    directionStreak: 0,
  };
  for (let i = 0; i < numMeasures; i++) {
    const roman = chordProgression[i] ?? 'I';
    const res = processMeasure(
      roman,
      keySignature,
      prevForNext,
      generationSettings,
      keyDetails,
      timingInfo,
      melodicState,
      i,
    );
    measures.push({
      measureNumber: i + 1,
      romanNumeral: roman,
      events: res.measureEvents,
    });
    prevForNext = res.notesAtEndOfMeasure;
  }
  return {
    metadata: {
      title: `Generated Music (${generationStyle} Style)`,
      software: 'Music Generator',
      encodingDate: new Date().toISOString().split('T')[0],
      partName:
        generationStyle === 'SATB' ? 'Choral SATB' : 'Melody + Accompaniment',
      keySignature,
      meter,
      numMeasures,
      generationStyle,
      divisions: timingInfo.divisions,
    },
    measures,
  };
}

/**
 * Developer helper: Accepts a space / comma separated chord progression string (e.g. "I vi ii V7 I")
 * and returns generated MusicXML directly. Suitable for quick experiments in scripts / playgrounds.
 *
 * Example:
 *   generateScoreFromString("I vi ii V7 I", { keySignature: 'C', meter: '4/4', numMeasures: 5 });
 */
export function generateScoreFromString(
  progression: string,
  opts: Omit<GenerateScoreOptions, 'chordProgression' | 'numMeasures'> & { numMeasures?: number },
): string {
  const chordProgression = progression
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const numMeasures = opts.numMeasures ?? chordProgression.length;
  return generateScore({
    chordProgression,
    numMeasures,
    keySignature: opts.keySignature,
    meter: opts.meter,
    style: opts.style,
    difficulty: opts.difficulty,
    overrides: opts.overrides,
  });
}
