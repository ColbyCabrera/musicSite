// Public barrel exports for music generation library.
// Prefer importing from this file for stable API surface.

export { generateScore, generateVoices, generateMusicalData, generateScoreFromString } from './generationEngine';
export { mapDifficultyToSettings } from './difficulty';
export { getChordInfoFromRoman, getExtendedChordNotePool, midiToNoteName } from './theory/harmony';
export { generateBeatFactorPattern, generateNoteValueSequence, factorsToDurations } from './rhythm/index';
export type { GenerationSettings, GeneratedPieceData, MusicalEvent, MeasureData } from './types';
