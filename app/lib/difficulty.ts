// difficulty.ts - map a unified difficulty slider (0-10) to GenerationSettings
import { GenerationSettings, GenerationStyle } from './types';

export function mapDifficultyToSettings(difficulty: number, style: GenerationStyle): GenerationSettings {
  const clamped = Math.min(10, Math.max(0, Math.round(difficulty)));
  const rhythmicComplexity = Math.min(10, Math.round(clamped * 1.1));
  const melodicSmoothness = Math.min(10, Math.max(0, 10 - clamped));
  const dissonanceStrictness = Math.min(10, Math.max(0, 10 - clamped * 0.8));
  const harmonicComplexity = Math.min(10, Math.round(3 + clamped * 0.5));
  return {
    generationStyle: style,
    rhythmicComplexity,
    melodicSmoothness,
    dissonanceStrictness,
    harmonicComplexity,
    numAccompanimentVoices: style === 'MelodyAccompaniment' ? 3 : undefined,
  };
}
