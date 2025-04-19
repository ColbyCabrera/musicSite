// src/config.ts
// Description: Configuration constants for music generation.

// --- Types ---
export type VoiceName = 'soprano' | 'alto' | 'tenor' | 'bass';

// --- Constants ---

/** Defines the standard order of voices from highest to lowest. */
export const VOICE_ORDER: ReadonlyArray<VoiceName> = [
  'soprano',
  'alto',
  'tenor',
  'bass',
];

/** Standard MIDI note ranges for SATB voices. */
export const VOICE_RANGES: Readonly<Record<VoiceName, [number, number]>> = {
  soprano: [60, 81], // C4 to A5
  alto: [55, 74], // G3 to D5
  tenor: [48, 69], // C3 to A4
  bass: [40, 62], // E2 to D4
};

/** Maximum interval allowed between adjacent upper voices (in semitones). */
export const VOICE_SPACING_LIMIT = {
  soprano_alto: 12, // Perfect Octave
  alto_tenor: 12, // Perfect Octave
  tenor_bass: 19, // Perfect Twelfth (Octave + Perfect Fifth) - adjust if needed
};

/** Default octave used when converting pitch classes to notes without explicit octave. */
export const DEFAULT_OCTAVE: number = 4;

// Add other constants if they existed in your original config.js
