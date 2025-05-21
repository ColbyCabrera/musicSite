// src/musicxmlUtils.ts
import * as Tonal from 'tonal';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { MusicXMLPitch } from './types';
import { midiToNoteName } from './harmonyUtils';

/**
 * Converts a MIDI number to a MusicXML Pitch object.
 * @param midi - MIDI note number.
 * @returns MusicXMLPitch object or null if invalid.
 */
export function midiToMusicXMLPitch(midi: number): MusicXMLPitch | null {
    const noteName = midiToNoteName(midi);
    if (!noteName) return null;

    try {
        const noteDetails = Tonal.Note.get(noteName);
        if (noteDetails.empty || !noteDetails.letter || noteDetails.oct === undefined || noteDetails.oct === null) {
            console.warn(`Could not get complete Tonal details for note: ${noteName} (MIDI: ${midi})`);
            return null;
        }

        const step = noteDetails.letter;
        const octave = noteDetails.oct;
        let alterNum: number | undefined = undefined;

        switch (noteDetails.acc) {
            case '#': alterNum = 1; break;
            case 'b': alterNum = -1; break;
            case '##': alterNum = 2; break;
            case 'bb': alterNum = -2; break;
            default: alterNum = undefined;
        }
        return { step, alter: alterNum, octave };
    } catch (error) {
        console.error(`Error getting MusicXML details for note "${noteName}" (MIDI: ${midi}):`, error);
        return null;
    }
}

/**
 * Determines the MusicXML duration type string based on the beat value of the time signature.
 * Assumes the duration corresponds to one beat.
 * @param beatValue - The denominator of the time signature (e.g., 4 for quarter note beat).
 * @returns MusicXML duration type string (e.g., "quarter", "eighth").
 */
export function getMusicXMLDurationType(beatValue: number): string {
    switch (beatValue) {
        case 1: return 'whole';
        case 2: return 'half';
        case 4: return 'quarter';
        case 8: return 'eighth';
        case 16: return '16th';
        case 32: return '32nd';
        default:
            console.warn(`Unsupported beat value ${beatValue}, defaulting type to 'quarter'.`);
            return 'quarter';
    }
}

/**
 * Calculates the MusicXML note type for a given duration relative to divisions per quarter.
 * Example: duration=4, divisions=4 -> quarter; duration=8, divisions=4 -> half
 * @param durationTicks Duration in MusicXML divisions.
 * @param divisions Divisions per quarter note.
 * @returns MusicXML type string.
 */
export function getNoteTypeFromDuration(durationTicks: number, divisions: number): string {
     const quarterNoteTicks = divisions;
     const ratio = durationTicks / quarterNoteTicks;

     if (ratio >= 4) return 'whole';      // Or longer? MusicXML supports breve etc.
     if (ratio >= 2) return 'half';
     if (ratio >= 1) return 'quarter';
     if (ratio >= 0.5) return 'eighth';
     if (ratio >= 0.25) return '16th';
     if (ratio >= 0.125) return '32nd';
     // Add 64th etc. if needed
     console.warn(`Could not determine note type for duration ${durationTicks} with ${divisions} divisions. Defaulting to 'quarter'.`);
     return 'quarter'; // Fallback
 }