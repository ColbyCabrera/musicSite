// harmony.ts (migrated from harmonyUtils.ts)
// Purpose: music theory helpers (Roman numeral parsing, chord construction, extended pools)
// This file is part of the refactor toward clearer domain-based organization.
import * as Tonal from 'tonal';
import { ChordInfo } from '../types';
import { MusicTheoryError, InvalidInputError } from '../errors';

const ROMAN_MAP: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const MAJOR_KEY_DEFAULT_SEVENTHS: Record<number, string> = { 0: 'maj7', 1: 'm7', 2: 'm7', 3: 'maj7', 4: '7', 5: 'm7', 6: 'm7b5' };
const MINOR_KEY_DEFAULT_SEVENTHS: Record<number, string> = { 0: 'm7', 1: 'm7b5', 2: 'maj7', 3: 'm7', 4: '7', 5: 'maj7', 6: 'dim7' };

function parseRomanNumeral(romanWithInversion: string): { baseRoman: string; bassInterval: string | null } {
  const figuredBassMatch = romanWithInversion.match(/^(.*?)(?:(64|65|43|42|6|7|2))(?![a-zA-Z#b])$/);
  const slashMatch = romanWithInversion.match(/^(.*?)\/([#b]?\d+)$/);
  let baseRoman: string;
  let bassInterval: string | null = '1';
  if (figuredBassMatch) {
    baseRoman = figuredBassMatch[1];
    const figure = figuredBassMatch[2];
    switch (figure) {
      case '6': bassInterval = '3'; break;
      case '64': bassInterval = '5'; break;
      case '65': bassInterval = '3'; break;
      case '43': bassInterval = '5'; break;
      case '42':
      case '2': bassInterval = '7'; break;
      default: bassInterval = '1';
    }
  } else if (slashMatch) {
    baseRoman = slashMatch[1];
    bassInterval = slashMatch[2];
  } else {
    const endsWithNumericFigure = romanWithInversion.match(/(\d+)$/);
    if (endsWithNumericFigure) {
      const numericEnding = endsWithNumericFigure[1];
      const isCommonExtensionNumber = ['7','9','11','13'].includes(numericEnding);
      const potentialBasePart = romanWithInversion.substring(0, romanWithInversion.length - numericEnding.length);
      const isValidRomanStem = /^[#b]?[ivxlcdmIVXLCDM]+$/i.test(potentialBasePart);
      if (!isCommonExtensionNumber && isValidRomanStem) {
        throw new InvalidInputError(`parseRomanNumeral: Unrecognized or invalid figured bass notation "${numericEnding}" in Roman numeral "${romanWithInversion}".`);
      }
    }
    baseRoman = romanWithInversion;
  }
  if (!baseRoman) throw new MusicTheoryError(`parseRomanNumeral: Could not parse base Roman numeral from "${romanWithInversion}".`);
  return { baseRoman, bassInterval };
}

function getKeyDetails(keyName: string) {
  let keyDetails: any = Tonal.Key.majorKey(keyName);
  if (!keyDetails || !keyDetails.tonic) keyDetails = Tonal.Key.minorKey(keyName);
  if (!keyDetails || !keyDetails.tonic)
    throw new InvalidInputError(`getKeyDetails: Could not get valid key details for key "${keyName}".`);
  return keyDetails;
}

function getInitialDiatonicChordSymbol(baseRomanUpper: string, scaleDegreeIndex: number, keyDetails: any, keyName: string): string | null {
  const keyType = keyDetails.type;
  let diatonicChords: readonly string[] | undefined;
  let diatonicHarmonicChords: readonly string[] | undefined;
  if (keyType === 'major') diatonicChords = keyDetails.chords;
  else { diatonicChords = keyDetails.natural.chords; diatonicHarmonicChords = keyDetails.harmonic.chords; }
  if (!diatonicChords || scaleDegreeIndex >= diatonicChords.length)
    throw new MusicTheoryError(`getInitialDiatonicChordSymbol: Scale degree index ${scaleDegreeIndex} (${baseRomanUpper}) out of bounds for key "${keyName}".`);
  let initialSymbol = diatonicChords[scaleDegreeIndex];
  if (keyType === 'minor') {
    if (scaleDegreeIndex === 4 && diatonicHarmonicChords && diatonicHarmonicChords.length > scaleDegreeIndex)
      initialSymbol = diatonicHarmonicChords[scaleDegreeIndex];
    else if (scaleDegreeIndex === 6 && diatonicHarmonicChords && diatonicHarmonicChords.length > scaleDegreeIndex)
      initialSymbol = diatonicHarmonicChords[scaleDegreeIndex];
  }
  return initialSymbol;
}

function applyChordModifications(currentChordSymbol: string, baseRomanInput: string, keyDetails: any, scaleDegreeIndex: number): string {
  let finalChordSymbol = currentChordSymbol;
  const keyType = keyDetails.type;
  const currentChordDetails = Tonal.Chord.get(currentChordSymbol);
  if (currentChordDetails.empty || !currentChordDetails.tonic)
    throw new MusicTheoryError(`applyChordModifications: Invalid initial diatonic chord symbol "${currentChordSymbol}" for Roman "${baseRomanInput}".`);
  const tonic = currentChordDetails.tonic;
  const qualityMatch = baseRomanInput.match(/(dim|o|\+|aug|M|m|maj|min)$/i);
  const requestedQualitySymbol = qualityMatch ? qualityMatch[1].toLowerCase() : null;
  if (requestedQualitySymbol) {
    let qualityToApply = '';
    if (['maj','M'].includes(requestedQualitySymbol)) qualityToApply = 'M';
    else if (['min','m'].includes(requestedQualitySymbol)) qualityToApply = 'm';
    else if (['dim','o'].includes(requestedQualitySymbol)) qualityToApply = 'dim';
    else if (['aug','+'].includes(requestedQualitySymbol)) qualityToApply = 'aug';
    if (qualityToApply) {
      const potentialNewSymbol = tonic + qualityToApply;
      const checkChord = Tonal.Chord.get(potentialNewSymbol);
      if (!checkChord.empty) finalChordSymbol = checkChord.symbol;
    }
  }
  const requestedSeventh = baseRomanInput.includes('7');
  const requestedHalfDim = baseRomanInput.includes('ø') || baseRomanInput.includes('hd');
  const requestedFullDim = baseRomanInput.includes('°') || (baseRomanInput.toLowerCase().includes('dim') && requestedSeventh);
  if (requestedSeventh) {
    const triadDetails = Tonal.Chord.get(finalChordSymbol);
    if (triadDetails.empty || !triadDetails.tonic)
      throw new MusicTheoryError(`applyChordModifications: Cannot add 7th; invalid triad symbol "${finalChordSymbol}".`);
    let seventhChordType = '';
    if (requestedHalfDim) seventhChordType = 'm7b5';
    else if (requestedFullDim) seventhChordType = 'dim7';
    else {
      if (keyType === 'major') seventhChordType = MAJOR_KEY_DEFAULT_SEVENTHS[scaleDegreeIndex];
      else seventhChordType = MINOR_KEY_DEFAULT_SEVENTHS[scaleDegreeIndex];
      if (!seventhChordType) {
        if (triadDetails.type === 'major') seventhChordType = '7';
        else if (triadDetails.type === 'minor') seventhChordType = 'm7';
        else if (triadDetails.type === 'diminished') seventhChordType = 'm7b5';
        else seventhChordType = '7';
      }
    }
    if (seventhChordType) {
      const potentialSeventhSymbol = triadDetails.tonic + seventhChordType;
      const seventhChordInfo = Tonal.Chord.get(potentialSeventhSymbol);
      if (!seventhChordInfo.empty) finalChordSymbol = seventhChordInfo.symbol;
    }
  }
  return finalChordSymbol;
}

function getChordNotesAndBass(finalChordSymbol: string, bassInterval: string | null, keyType: 'major' | 'minor', keyTonic: string) {
  const finalChord = Tonal.Chord.get(finalChordSymbol);
  if (finalChord.empty || !finalChord.notes || finalChord.notes.length === 0 || !finalChord.tonic)
    throw new MusicTheoryError(`getChordNotesAndBass: Invalid final chord symbol "${finalChordSymbol}".`);
  const chordTonicNote = Tonal.Note.get(finalChord.tonic);
  let rootOctaveGuess = 3;
  if (['F','G','A','B'].includes(chordTonicNote.letter)) rootOctaveGuess = 2;
  if (keyType === 'minor' && (keyTonic.startsWith('A') || keyTonic.startsWith('B'))) rootOctaveGuess = 2;
  let rootMidi = Tonal.Note.midi(finalChord.tonic + rootOctaveGuess);
  if (rootMidi !== null && rootMidi < 36) {
    const higherMidi = Tonal.Note.midi(finalChord.tonic + (rootOctaveGuess + 1));
    if (higherMidi) rootMidi = higherMidi;
  }
  if (rootMidi !== null && rootMidi > 72) {
    const lowerMidi = Tonal.Note.midi(finalChord.tonic + (rootOctaveGuess - 1));
    if (lowerMidi && lowerMidi >= 36) rootMidi = lowerMidi;
  }
  if (rootMidi === null) throw new MusicTheoryError(`getChordNotesAndBass: Could not determine root MIDI for "${finalChordSymbol}".`);
  const rootNoteNameWithOctave = Tonal.Note.fromMidi(rootMidi)!;
  const chordNotesMidi: number[] = [];
  const noteNames: string[] = [];
  finalChord.intervals.forEach((interval) => {
    const transposedNoteName = Tonal.transpose(rootNoteNameWithOctave, interval);
    const midi = Tonal.Note.midi(transposedNoteName);
    if (midi !== null) { chordNotesMidi.push(midi); noteNames.push(transposedNoteName); }
  });
  if (!chordNotesMidi.length) throw new MusicTheoryError(`getChordNotesAndBass: No MIDI notes for chord symbol "${finalChordSymbol}".`);
  const sortedIndices = Array.from(chordNotesMidi.keys()).sort((a,b)=>chordNotesMidi[a]-chordNotesMidi[b]);
  const sortedMidiNotes = sortedIndices.map(i=>chordNotesMidi[i]);
  const sortedNoteNames = sortedIndices.map(i=>noteNames[i]);
  let requiredBassPc: number | null = null;
  if (bassInterval && !['1','1P','P1'].includes(bassInterval)) {
    const bassNoteName = Tonal.transpose(rootNoteNameWithOctave, bassInterval);
    const bassNoteDetails = Tonal.Note.get(bassNoteName);
    if (bassNoteDetails && typeof bassNoteDetails.chroma === 'number') requiredBassPc = bassNoteDetails.chroma;
  }
  return { notes: sortedMidiNotes, noteNames: sortedNoteNames, requiredBassPc };
}

export function getChordInfoFromRoman(fullRomanWithInversion: string, keyNameInput: string) {
  const { baseRoman, bassInterval } = parseRomanNumeral(fullRomanWithInversion);
  const keyDetails = getKeyDetails(keyNameInput);
  const keyType = keyDetails.type as 'major' | 'minor';
  const keyTonic = keyDetails.tonic;
  const baseRomanMatch = baseRoman.match(/([ivxlcIVXLC]+)/i);
  if (!baseRomanMatch)
    throw new MusicTheoryError(`getChordInfoFromRoman: Could not extract Roman letters from base "${baseRoman}".`);
  const baseRomanUpper = baseRomanMatch[1].toUpperCase();
  const scaleDegreeIndex = (ROMAN_MAP as any)[baseRomanUpper];
  if (scaleDegreeIndex === undefined)
    throw new MusicTheoryError(`getChordInfoFromRoman: Unknown Roman numeral "${baseRomanUpper}".`);
  let currentChordSymbol = getInitialDiatonicChordSymbol(baseRomanUpper, scaleDegreeIndex, keyDetails, keyNameInput);
  if (!currentChordSymbol)
    throw new MusicTheoryError(`Failed to get initial diatonic chord for "${baseRomanUpper}" in key "${keyNameInput}".`);
  currentChordSymbol = applyChordModifications(currentChordSymbol, baseRoman, keyDetails, scaleDegreeIndex);
  return getChordNotesAndBass(currentChordSymbol, bassInterval, keyType, keyTonic);
}

export function getExtendedChordNotePool(baseChordNotes: number[]): number[] {
  const pool: Set<number> = new Set();
  if (!baseChordNotes || !baseChordNotes.length) return [];
  [-2,-1,0,1,2,3,4].forEach(o=>{
    baseChordNotes.forEach(midi=>{
      if (midi !== null) {
        const note = midi + o*12;
        if (note >= 21 && note <= 108) pool.add(note);
      }
    });
  });
  return Array.from(pool).sort((a,b)=>a-b);
}

export function midiToNoteName(midi: number | null): string | null {
  if (midi === null || !Number.isInteger(midi) || midi < 0 || midi > 127) return null;
  try { return Tonal.Note.fromMidi(midi); } catch { return null; }
}
