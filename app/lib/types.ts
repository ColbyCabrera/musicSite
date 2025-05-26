// src/types.ts
import * as Tonal from 'tonal';

/**
 * Represents the components of a musical pitch for MusicXML serialization.
 */
export interface MusicXMLPitch {
  /** The musical step (A-G). */
  step: string;
  /**
   * The alteration value (e.g., -1 for flat, 1 for sharp).
   * Optional, as 0 (natural) is often omitted in MusicXML.
   */
  alter?: number;
  /** The octave number (e.g., 4 for middle C's octave). */
  octave: number;
}

/**
 * Defines the available styles for music generation.
 * - `SATB`: Traditional four-part harmony (Soprano, Alto, Tenor, Bass).
 * - `MelodyAccompaniment`: A single melody line with a multi-note accompaniment.
 */
export type GenerationStyle = 'SATB' | 'MelodyAccompaniment';

/**
 * Configuration settings for the music generation process.
 */
export interface GenerationSettings {
  /** The overall musical style to generate. */
  generationStyle: GenerationStyle;
  /**
   * Controls preference for smaller melodic intervals (0-10).
   * Higher values favor smoother, stepwise motion.
   */
  melodicSmoothness: number;
  /**
   * Influences the complexity of chord choices (0-10).
   * Higher values may introduce more extended or altered chords.
   * (Currently used more in progression generation than voicing).
   */
  harmonicComplexity: number;
  /**
   * Determines the strictness of voice leading rule enforcement (0-10).
   * Higher values apply more rules or stricter checks.
   */
  dissonanceStrictness: number;
  /**
   * The number of voices in the accompaniment part, primarily for `MelodyAccompaniment` style.
   * Defaults to 3 if not specified.
   */
  numAccompanimentVoices?: number;
  /**
   * Controls the rhythmic complexity of generated patterns (0-10).
   * Higher values lead to more subdivided and varied rhythms.
   * (Used by `getRhythmicPattern` in `generate.ts` and `generateRhythm` in `rhythm.ts`).
   */
  rhythmicComplexity?: number; // Added based on usage in generate.ts
}

/**
 * Stores the last played MIDI note for each voice in an SATB arrangement.
 * Used to maintain context for voice leading and smoothness.
 */
export interface PreviousNotesSATB {
  /** MIDI note of the Soprano voice, or `null` if no previous note. */
  soprano: number | null;
  /** MIDI note of the Alto voice, or `null` if no previous note. */
  alto: number | null;
  /** MIDI note of the Tenor voice, or `null` if no previous note. */
  tenor: number | null;
  /** MIDI note of the Bass voice, or `null` if no previous note. */
  bass: number | null;
}

/**
 * Stores the last played MIDI note for the melody and each voice in the accompaniment.
 * Used for context in `MelodyAccompaniment` style generation.
 */
export interface PreviousNotesMelodyAccompaniment {
  /** MIDI note of the Melody line, or `null` if no previous note. */
  melody: number | null;
  /** An array of MIDI notes for each accompaniment voice, or `null` for voices without a previous note. */
  accompaniment: (number | null)[];
}

/**
 * A union type representing the previous note state, adaptable to either
 * `SATB` or `MelodyAccompaniment` generation styles.
 */
export type PreviousNotes =
  | PreviousNotesSATB
  | PreviousNotesMelodyAccompaniment;

/**
 * Tracks the state of a melodic line's contour to guide subsequent note choices.
 */
export interface MelodicState {
  /** The direction of the last melodic interval (-1 for down, 0 for repeat/start, 1 for up). */
  lastDirection: number;
  /** The number of consecutive times the melody has moved in the `lastDirection`. */
  directionStreak: number;
}

/**
 * Represents a single musical event (a note or a rest) within a measure,
 * formatted for easy conversion to MusicXML.
 */
export interface MusicalEvent {
  /** The type of event: 'note' or 'rest'. */
  type: 'note' | 'rest';
  /** The MIDI pitch of the note. `null` or `undefined` for rests or if the note is unpitched. */
  midi?: number | null;
  /** The duration of the event in MusicXML divisions (ticks). */
  durationTicks: number;
  /** The staff number on which the event occurs (e.g., "1" for upper staff, "2" for lower). */
  staffNumber: string;
  /** The voice number within the staff (e.g., "1"). */
  voiceNumber: string;
  /** The stem direction for notes. Optional, as rests don't have stems. */
  stemDirection?: 'up' | 'down';
  /** The MusicXML note type (e.g., "quarter", "eighth", "half"). */
  noteType: string;
  /**
   * Indicates if this note is part of a chord and should use the `<chord/>` element in MusicXML.
   * `true` for the second and subsequent notes of a chord played simultaneously in the same voice.
   */
  isChordElement?: boolean;
}

/**
 * Contains all musical events and associated information for a single measure.
 */
export interface MeasureData {
  /** The 1-indexed number of the measure within the piece. */
  measureNumber: number;
  /** The Roman numeral chord symbol associated with this measure (e.g., "V7", "ii", "I64"). */
  romanNumeral: string;
  /** An array of `MusicalEvent` objects that occur in this measure, in chronological order. */
  events: MusicalEvent[];
}

/**
 * Represents the complete generated musical piece, including metadata and all measure data.
 * This is the primary intermediate structure before MusicXML conversion.
 */
export interface GeneratedPieceData {
  /** Metadata associated with the generated piece. */
  metadata: {
    /** The title of the piece. */
    title: string;
    /** The name of the software used for generation. */
    software: string;
    /** The date of encoding/generation in YYYY-MM-DD format. */
    encodingDate: string;
    /** The name of the musical part (e.g., "Choral SATB", "Piano"). */
    partName: string;
    /** The key signature of the piece (e.g., "C", "Gm", "F#maj"). */
    keySignature: string;
    /** The time signature of the piece (e.g., "4/4", "3/4"). */
    meter: string;
    /** The total number of measures in the piece. */
    numMeasures: number;
    /** The generation style used for the piece. */
    generationStyle: GenerationStyle;
    /** The number of MusicXML divisions per quarter note. */
    divisions: number;
  };
  /** An array of `MeasureData` objects, each representing a measure in the piece. */
  measures: MeasureData[];
}

/**
 * Represents detailed information about a musical key, typically derived from Tonal.js.
 * This can include tonic, type (major/minor), scale, chords, etc.
 * Using `Tonal.Key.Key` directly or a custom interface mirroring its properties.
 */
export type KeyDetails = Tonal.Key.Key;

/**
 * Contains essential timing information for a piece of music, derived from its meter.
 */
export interface TimingInfo {
  /** The number of beats per measure (e.g., 4 for 4/4 time). */
  meterBeats: number;
  /** The note value that represents one beat (e.g., 4 for a quarter note beat in 4/4 time). */
  beatValue: number;
  /** The number of MusicXML divisions (ticks) per quarter note. */
  divisions: number;
  /** The duration of a single beat in MusicXML divisions (ticks). */
  beatDurationTicks: number;
  /** The total duration of a full measure in MusicXML divisions (ticks). */
  measureDurationTicks: number;
  /** The default MusicXML note type string (e.g., "quarter") for a single beat in the current meter. */
  defaultNoteType: string;
}

/**
 * Bundles contextual information required for generating a single measure.
 * This is an example, and might not be explicitly used if context is passed directly.
 * @deprecated May not be actively used; context is often passed directly to functions.
 */
export interface MeasureGenerationContext {
  /** MIDI notes of the current chord in root position. */
  baseChordNotes: number[];
  /** State of notes from the previous measure/event. */
  previousNotes: PreviousNotes;
  /** Global generation settings. */
  generationSettings: GenerationSettings;
  /** Details of the current key. */
  keyDetails: KeyDetails;
  /** Timing information for the piece. */
  timingInfo: TimingInfo;
  /** The 0-indexed number of the current measure being generated. */
  measureIndex: number;
}

/**
 * Represents the information extracted from a Roman numeral analysis for a specific chord.
 */
export interface ChordInfo {
  /** Array of MIDI note numbers for the chord in root position, sorted ascending. */
  notes: number[];
  /** Array of note names with octave numbers (e.g., "C4", "E#5") for the chord in root position, sorted ascending by MIDI value. */
  noteNames: string[];
  /** The pitch class (0-11) of the required bass note based on inversion (e.g., "V6/4" implies the 5th is in the bass). `null` for root position. */
  requiredBassPc: number | null;
}

/**
 * Represents an item with an associated weight, used for weighted random selection.
 * @template T The type of the item.
 */
export interface WeightedChoice<T> {
  /** The item to be chosen. */
  item: T;
  /** The weight associated with this item. Higher weights increase the probability of selection. */
  weight: number;
}
