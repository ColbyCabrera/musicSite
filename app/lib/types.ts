// src/types.ts
import * as Tonal from 'tonal';

/** Structure for MusicXML pitch representation */
export interface MusicXMLPitch {
  step: string; // C, D, E, F, G, A, B
  alter?: number; // -2, -1, 0, 1, 2 (0 is natural, often omitted)
  octave: number; // Standard octave number
}

/** Internal data structure used during music generation */
export type GenerationStyle = 'SATB' | 'MelodyAccompaniment';

/** Settings that control the music generation process */
export interface GenerationSettings {
  generationStyle: GenerationStyle;
  melodicSmoothness: number;       // 0-10: Higher values prefer smaller melodic intervals
  harmonicComplexity: number;      // 0-10: Higher values allow more complex chord choices
  dissonanceStrictness: number;    // 0-10: Higher values enforce stricter voice leading rules
  numAccompanimentVoices?: number; // Optional: Number of accompaniment voices (default 3)
}

/** State tracking for SATB voice generation */
export interface PreviousNotesSATB {
  soprano: number | null;
  alto: number | null;
  tenor: number | null;
  bass: number | null;
}

/** State tracking for melody + accompaniment generation */
export interface PreviousNotesMelodyAccompaniment {
  melody: number | null;
  accompaniment: (number | null)[];
}

/** Union type for state tracking during generation */
export type PreviousNotes = PreviousNotesSATB | PreviousNotesMelodyAccompaniment;

/** Musical event within a measure for XML generation */
export interface MusicalEvent {
  type: 'note' | 'rest';
  midi?: number | null;           // MIDI pitch (null for rest)
  durationTicks: number;          // Duration in MusicXML divisions
  staffNumber: string;            // Staff number ('1' or '2')
  voiceNumber: string;            // Voice number within staff
  stemDirection?: 'up' | 'down';  // Required for notes, optional for rests
  noteType: string;              // MusicXML note type (quarter, half, etc.)
  isChordElement?: boolean;      // True for subsequent notes in a chord
}

/** Musical content of a single measure */
export interface MeasureData {
  measureNumber: number;
  romanNumeral: string;          // Chord symbol for this measure
  events: MusicalEvent[];        // All notes/rests in measure order
}

/** Complete musical piece data structure */
export interface GeneratedPieceData {
  metadata: {
    title: string;
    software: string;
    encodingDate: string;
    partName: string;
    keySignature: string;        // e.g., "C", "Gm"
    meter: string;               // e.g., "4/4"
    numMeasures: number;
    generationStyle: GenerationStyle;
  };
  measures: MeasureData[];
}

export type KeyDetails = Tonal.Key.Key; // Or define your own interface based on Tonal.Key.Key properties

/** Timing information used during generation */
export interface TimingInfo {
  meterBeats: number;            // Number of beats per measure
  beatValue: number;             // Note value that gets one beat
  divisions: number;             // MusicXML divisions per quarter note
  beatDurationTicks: number;     // Duration of one beat in ticks
  measureDurationTicks: number;  // Duration of full measure in ticks
  defaultNoteType: string;       // Default note type for the meter
}

/** Context needed for measure generation */
export interface MeasureGenerationContext {
  baseChordNotes: number[];      // Root position chord notes
  previousNotes: PreviousNotes;  // State from previous measure
  generationSettings: GenerationSettings;
  keyDetails: KeyDetails;         
  timingInfo: TimingInfo;
  measureIndex: number;          // Current measure number (0-based)
}
