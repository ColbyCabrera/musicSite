// src/types.ts
import * as Tonal from 'tonal';

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
export type PreviousNotes =
  | PreviousNotesSATB
  | PreviousNotesMelodyAccompaniment;

/** Represents a single note or rest event within a measure for XML generation */
export interface MusicalEvent {
  type: 'note' | 'rest';
  midi?: number | null; // MIDI pitch (null for rest)
  durationTicks: number;
  staffNumber: string; // '1' or '2'
  voiceNumber: string; // '1', '2', etc. (within staff)
  stemDirection?: 'up' | 'down'; // Required for notes, optional for rests
  noteType: string; // MusicXML note type ('quarter', 'half', etc.)
  isChordElement?: boolean; // True if this note is part of a chord after the first note
}

/** Represents the musical content of a single measure */
export interface MeasureData {
  measureNumber: number;
  romanNumeral: string; // The chord symbol for this measure
  events: MusicalEvent[]; // All notes and rests in the measure, in XML order
}

/** Represents the overall generated musical piece */
export interface GeneratedPieceData {
  metadata: {
    title: string;
    software: string;
    encodingDate: string;
    partName: string;
    keySignature: string; // e.g., "C", "Gm"
    meter: string; // e.g., "4/4"
    numMeasures: number;
    generationStyle: GenerationSettings['generationStyle'];
  };
  measures: MeasureData[];
}

export type KeyDetails = Tonal.Key.Key; // Or define your own interface based on Tonal.Key.Key properties

export interface TimingInfo {
  meterBeats: number;
  beatValue: number;
  divisions: number;
  beatDurationTicks: number;
  measureDurationTicks: number;
  defaultNoteType: string;
}

export interface MeasureGenerationContext {
  baseChordNotes: number[];
  previousNotes: PreviousNotes;
  generationSettings: GenerationSettings;
  keyDetails: KeyDetails;
  timingInfo: TimingInfo;
  measureIndex: number; // Optional: If needed by helper functions
}
