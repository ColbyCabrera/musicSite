// generate.ts (compatibility wrapper)
// Original implementation moved to generationEngine.ts for clarity.
export { generateVoices, generateMusicalData, generateScore } from './generationEngine';
export type { GenerateScoreOptions } from './generationEngine';
export { mapDifficultyToSettings } from './difficulty';
