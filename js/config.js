// js/config.js
// Description: Contains constant values used throughout the application.
// NOTE: Values derived from Tonal functions are pre-calculated to avoid
// dependency timing issues during module loading.

export const MIDI_NOTE_C0 = 12;
export const DEFAULT_OCTAVE = 4;
export const VOICE_ORDER = ["soprano", "alto", "tenor", "bass"];

// Define typical voice ranges using pre-calculated MIDI note numbers.
// C4=60, A5=81 | G3=55, E5=76 | C3=48, G4=67 | E2=40, C4=60
export const VOICE_RANGES = {
    soprano: [60, 81],
    alto:    [55, 76],
    tenor:   [48, 67],
    bass:    [40, 60],
};

// Define typical maximum spacing between adjacent voices in pre-calculated semitones.
// P8 = 12 semitones | P12 = 19 semitones
export const VOICE_SPACING_LIMIT = {
    soprano_alto: 12,
    alto_tenor:   12,
    tenor_bass:   19,
};

// Remove the Tonal check from *this file* as it no longer directly uses Tonal at load time.
// Other modules like tonal-helpers.js will still need Tonal globally when their functions are CALLED.