// src/types.ts

/** Structure for MusicXML pitch representation */
export interface MusicXMLPitch {
    step: string; // C, D, E, F, G, A, B
    alter?: number; // -2, -1, 0, 1, 2 (0 is natural, often omitted)
    octave: number; // Standard octave number
}

/** Structure to hold MIDI notes of the previous beat/measure end for SATB */
export interface PreviousNotesSATB {
    soprano: number | null;
    alto: number | null;
    tenor: number | null;
    bass: number | null;
}

/** Structure to hold MIDI notes of the previous beat/measure end for Melody+Accompaniment */
export interface PreviousNotesMelodyAccompaniment {
    melody: number | null;
    accompaniment: (number | null)[]; // Array for accompaniment notes
}

/** Settings controlling the generation process */
export interface GenerationSettings {
    melodicSmoothness: number; // Typically 0-10 (higher means smaller leaps preferred)
    dissonanceStrictness: number; // Typically 0-10 (higher means more SATB rules enforced)
    generationStyle: 'SATB' | 'MelodyAccompaniment'; // Choose the output style
    numAccompanimentVoices?: number; // Number of notes in accompaniment chord (default 3)
}

/** Represents either type of previous notes structure */
export type PreviousNotes = PreviousNotesSATB | PreviousNotesMelodyAccompaniment;