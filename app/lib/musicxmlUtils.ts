// src/musicxmlUtils.ts
import * as Tonal from 'tonal';
// XMLBuilder is not used in this file after addNotesToStaffXML was moved.
import { MusicXMLPitch } from './types';
import { midiToNoteName } from './harmonyUtils';
import { MusicTheoryError } from './errors'; // Added import

/**
 * Converts a MIDI note number to a `MusicXMLPitch` object, which represents
 * the note's step, alteration (sharps/flats), and octave for MusicXML.
 *
 * @param {number} midi - The MIDI note number (e.g., 60 for C4).
 * @returns {MusicXMLPitch | null} A `MusicXMLPitch` object containing the step (A-G),
 *          optional alteration value (-2 to 2), and octave number. Returns `null`
 *          if the MIDI number cannot be converted or results in invalid note details.
 */
export function midiToMusicXMLPitch(midi: number): MusicXMLPitch | null {
    const noteName = midiToNoteName(midi); // Converts MIDI to a scientific pitch name like "C#4"
    if (!noteName) {
        console.warn(`[WARN] midiToMusicXMLPitch: Could not get note name for MIDI: ${midi}`);
        return null;
    }

    try {
        const noteDetails = Tonal.Note.get(noteName);
        if (noteDetails.empty || !noteDetails.letter || noteDetails.oct === undefined || noteDetails.oct === null) {
            console.warn(`[WARN] Could not get complete Tonal details for note: ${noteName} (MIDI: ${midi})`);
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
        throw new MusicTheoryError(`Error getting MusicXML details for note "${noteName}" (MIDI: ${midi}): ${(error as Error).message}`);
    }
}

/**
 * Determines the MusicXML note type string (e.g., "quarter", "eighth") based on the
 * beat value of a time signature. This function assumes the duration being determined
 * corresponds to a single beat of that beat value.
 * For example, if `beatValue` is 4, it returns "quarter".
 *
 * @param {number} beatValue - The denominator of the time signature, representing the note value
 *                             that constitutes one beat (e.g., 4 for a quarter note beat, 8 for an eighth note beat).
 * @returns {string} The corresponding MusicXML note type string. Defaults to "quarter"
 *                   if the beat value is unsupported, with a warning.
 */
export function getMusicXMLDurationType(beatValue: number): string {
    switch (beatValue) {
        case 1: return 'whole'; // e.g., in 1/1 time, a whole note is one beat
        case 2: return 'half';
        case 4: return 'quarter';
        case 8: return 'eighth';
        case 16: return '16th';
        case 32: return '32nd';
        default:
            console.warn(`[WARN] Unsupported beat value ${beatValue}, defaulting type to 'quarter'.`);
            return 'quarter';
    }
}

/**
 * Calculates the MusicXML note type (e.g., "quarter", "eighth") for a given duration in ticks,
 * relative to a specified number of divisions per quarter note.
 * For example, if `divisions` is 4 (meaning a quarter note has 4 ticks), then a `durationTicks`
 * of 4 would return "quarter", 8 would return "half", and 2 would return "eighth".
 *
 * @param {number} durationTicks - The duration of the note/rest in MusicXML ticks/divisions.
 * @param {number} divisions - The number of divisions per quarter note, as defined in MusicXML attributes.
 * @returns {string} The MusicXML note type string. Defaults to "quarter" if the duration
 *                   doesn't map to a standard type, with a warning.
 */
export function getNoteTypeFromDuration(durationTicks: number, divisions: number): string {
     if (divisions <= 0) {
        console.warn(`[WARN] getNoteTypeFromDuration: Invalid divisions value (${divisions}). Defaulting to 'quarter'.`);
        return 'quarter';
     }
     const quarterNoteTicks = divisions; // Ticks for one quarter note
     const ratioToQuarter = durationTicks / quarterNoteTicks; // How many quarter notes this duration represents

     // Determine type based on ratio to a quarter note
     if (ratioToQuarter >= 4) return 'whole';       // 4 quarter notes = 1 whole note
     if (ratioToQuarter >= 2) return 'half';        // 2 quarter notes = 1 half note
     if (ratioToQuarter >= 1) return 'quarter';     // 1 quarter note
     if (ratioToQuarter >= 0.5) return 'eighth';    // 0.5 quarter notes = 1 eighth note
     if (ratioToQuarter >= 0.25) return '16th';     // 0.25 quarter notes = 1 sixteenth note
     if (ratioToQuarter >= 0.125) return '32nd';    // 0.125 quarter notes = 1 thirty-second note
     // Add 64th etc. if needed for higher precision and smaller note values
     // if (ratioToQuarter >= 0.0625) return '64th';

     console.warn(`[WARN] getNoteTypeFromDuration: Could not determine standard note type for duration ${durationTicks} with ${divisions} divisions per quarter. Ratio to quarter: ${ratioToQuarter}. Defaulting to 'quarter'.`);
     return 'quarter'; // Fallback for very short or unusual durations
 }


// The function addNotesToStaffXML was removed as its logic is now part of
// addMusicalEventsToXML in musicXmlWriter.ts.
// The console.warn calls from addNotesToStaffXML should be reviewed in that context.