// src/constants.ts

/**
 * Defines the standard order of voices from highest to lowest for SATB (Soprano, Alto, Tenor, Bass) music.
 * This order is often used for iterating or processing voices in a specific sequence.
 */
export type VoiceNameSATB = 'soprano' | 'alto' | 'tenor' | 'bass';

/**
 * An immutable array specifying the conventional order of SATB voices.
 * @readonly
 */
export const VOICE_ORDER_SATB: ReadonlyArray<VoiceNameSATB> = [
    'soprano',
    'alto',
    'tenor',
    'bass',
];

/**
 * Defines standard MIDI note ranges for SATB voices and also for Melody/Accompaniment generation styles.
 * Each voice or part is mapped to a tuple `[minMidi, maxMidi]`.
 * - `soprano`: C4 (MIDI 60) to A5 (MIDI 81)
 * - `alto`: G3 (MIDI 55) to D5 (MIDI 74)
 * - `tenor`: C3 (MIDI 48) to A4 (MIDI 69)
 * - `bass`: E2 (MIDI 40) to D4 (MIDI 62)
 * - `melody`: C4 (MIDI 60) to C6 (MIDI 84) - Slightly wider range for melodic lines.
 * - `accompaniment`: C2 (MIDI 36) to C5 (MIDI 72) - Typical keyboard accompaniment range.
 * @readonly
 */
export const VOICE_RANGES: Readonly<
    Record<VoiceNameSATB | 'melody' | 'accompaniment', [minMidi: number, maxMidi: number]>
> = {
    soprano: [60, 81],
    alto: [55, 74],
    tenor: [48, 69],
    bass: [40, 62],
    melody: [60, 84],
    accompaniment: [36, 72],
};

/**
 * Specifies the maximum allowed interval (in semitones) between adjacent upper voices in SATB style
 * to maintain good voice leading and avoid excessive spacing.
 * - `soprano_alto`: Maximum interval between Soprano and Alto (e.g., Perfect Octave = 12 semitones).
 * - `alto_tenor`: Maximum interval between Alto and Tenor (e.g., Perfect Octave = 12 semitones).
 * - `tenor_bass`: Maximum interval between Tenor and Bass (e.g., Perfect Twelfth = 19 semitones).
 * @readonly
 */
export const VOICE_SPACING_LIMIT_SATB: Readonly<{
    soprano_alto: number;
    alto_tenor: number;
    tenor_bass: number;
}> = {
    soprano_alto: 12, // Perfect Octave
    alto_tenor: 12, // Perfect Octave
    tenor_bass: 19, // Perfect Twelfth (Octave + Perfect Fifth) - Can be larger than upper voices
};

/**
 * Maximum allowed interval (in semitones) between the melody voice and the highest note
 * of the accompaniment in Melody+Accompaniment style.
 * This helps prevent the accompaniment from overshadowing or clashing with the melody.
 * Default is 24 semitones (Two Octaves), but this can be adjusted.
 * @readonly
 */
export const MELODY_ACCOMPANIMENT_SPACING_LIMIT: number = 24; // Two Octaves

/**
 * Default MIDI octave used when converting pitch classes (e.g., "C", "F#") to full note names
 * with octaves (e.g., "C4", "F#4") if no explicit octave is provided.
 * Octave 4 is typically considered the middle octave on a piano.
 * @readonly
 */
export const DEFAULT_OCTAVE: number = 4;