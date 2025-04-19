// src/constants.ts

/** Defines the standard order of voices from highest to lowest for SATB. */
export type VoiceNameSATB = 'soprano' | 'alto' | 'tenor' | 'bass';
export const VOICE_ORDER_SATB: ReadonlyArray<VoiceNameSATB> = [
    'soprano',
    'alto',
    'tenor',
    'bass',
];

/** Standard MIDI note ranges for SATB voices. Also used for Melody/Accompaniment ranges. */
export const VOICE_RANGES: Readonly<
    Record<VoiceNameSATB | 'melody' | 'accompaniment', [number, number]>
> = {
    soprano: [60, 81], // C4 to A5
    alto: [55, 74], // G3 to D5
    tenor: [48, 69], // C3 to A4
    bass: [40, 62], // E2 to D4
    // Ranges for Melody + Accompaniment Style
    melody: [60, 84], // C4 to C6 - Slightly wider range for melody
    accompaniment: [36, 72], // C2 to C5 - Typical keyboard accompaniment range
};

/** Maximum interval allowed between adjacent upper voices (SATB). */
export const VOICE_SPACING_LIMIT_SATB = {
    soprano_alto: 12, // Perfect Octave
    alto_tenor: 12, // Perfect Octave
    tenor_bass: 19, // Perfect Twelfth (Octave + Perfect Fifth)
};

/** Maximum interval allowed between melody and highest accompaniment voice. */
export const MELODY_ACCOMPANIMENT_SPACING_LIMIT = 24; // Two Octaves (adjustable)

/** Default octave used when converting pitch classes to notes without explicit octave. */
export const DEFAULT_OCTAVE: number = 4;