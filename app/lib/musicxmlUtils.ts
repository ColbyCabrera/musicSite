// src/musicxmlUtils.ts
import * as Tonal from 'tonal';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { MusicXMLPitch } from './types';
import { midiToNoteName } from './harmonyUtils';

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
        console.warn(`midiToMusicXMLPitch: Could not get note name for MIDI: ${midi}`);
        return null;
    }

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
            console.warn(`Unsupported beat value ${beatValue}, defaulting type to 'quarter'.`);
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
        console.warn(`getNoteTypeFromDuration: Invalid divisions value (${divisions}). Defaulting to 'quarter'.`);
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

     console.warn(`getNoteTypeFromDuration: Could not determine standard note type for duration ${durationTicks} with ${divisions} divisions per quarter. Ratio to quarter: ${ratioToQuarter}. Defaulting to 'quarter'.`);
     return 'quarter'; // Fallback for very short or unusual durations
 }


/**
 * Adds a sequence of notes and/or rests to a MusicXML measure for a specific staff and voice.
 * This function handles the creation of `<note>` elements, including pitch, duration, type,
 * stem direction, and voice/staff assignments. It also correctly adds the `<chord/>` element
 * for notes that are part of a chord (i.e., sound simultaneously with the preceding note in the same voice).
 *
 * @param {XMLBuilder} measureBuilder - The `xmlbuilder2` instance representing the current `<measure>` element
 *                                      to which notes/rests will be added.
 * @param {(number | null)[]} notes - An array of MIDI note numbers. A `null` value in the array will be
 *                                    interpreted as a rest if it's the first element of a segment,
 *                                    or skipped if it's a subsequent null in a chord context.
 * @param {string} staffNumber - The staff number (e.g., "1", "2") where these events belong.
 * @param {string} voiceNumber - The voice number (e.g., "1", "2") within the staff.
 * @param {string} stemDirection - The desired stem direction ("up" or "down") for notes.
 * @param {number} durationTicks - The duration in MusicXML divisions for each event in this group.
 *                                 If representing a chord, all notes share this duration.
 * @param {string} noteType - The MusicXML note type string (e.g., "quarter", "eighth") for these events.
 */
export function addNotesToStaffXML(
    measureBuilder: XMLBuilder, // Type from xmlbuilder2/lib/interfaces
    notes: (number | null)[], // Array of MIDI notes, null for rests within a "chord" context
    staffNumber: string,
    voiceNumber: string,
    stemDirection: string,
    durationTicks: number,
    noteType: string,
): void {
    let firstElementAdded = false;

    for (let i = 0; i < notes.length; i++) {
        const midi = notes[i];

        if (midi === null) {
            if (!firstElementAdded) {
                // Add a rest if it's the first element and it's null
                measureBuilder.ele('note')
                    .ele('rest').up()
                    .ele('duration').txt(`${durationTicks}`).up()
                    .ele('voice').txt(voiceNumber).up()
                    .ele('staff').txt(staffNumber).up()
                    // .ele('type').txt(noteType).up() // Optional for rests
                .up(); // note
                firstElementAdded = true;
            }
            // Skip subsequent nulls
            continue;
        }

        // Valid MIDI note
        const pitch = midiToMusicXMLPitch(midi);
        if (pitch) {
            const noteEl = measureBuilder.ele('note');

            if (firstElementAdded) {
                noteEl.ele('chord').up(); // Add <chord/> for subsequent notes in this block
            }

            // Pitch details
            const pitchEl = noteEl.ele('pitch');
            pitchEl.ele('step').txt(pitch.step).up();
            if (pitch.alter !== undefined) {
                pitchEl.ele('alter').txt(`${pitch.alter}`).up();
            }
            pitchEl.ele('octave').txt(`${pitch.octave}`).up();
            pitchEl.up(); // pitch

            // Add duration, type, etc. ONLY to the first element
            if (!firstElementAdded) {
                noteEl.ele('duration').txt(`${durationTicks}`).up();
                noteEl.ele('type').txt(noteType).up();
            }

            noteEl.ele('stem').txt(stemDirection).up();
            noteEl.ele('voice').txt(voiceNumber).up();
            noteEl.ele('staff').txt(staffNumber).up();
            noteEl.up(); // note

            firstElementAdded = true;
        } else {
             console.warn(`Could not convert MIDI ${midi} to MusicXML pitch. Skipping note.`);
             // Add placeholder rest if the *first* element fails conversion
             if (!firstElementAdded) {
                 measureBuilder.ele('note')
                     .ele('rest').up()
                     .ele('duration').txt(`${durationTicks}`).up()
                     .ele('voice').txt(voiceNumber).up()
                     .ele('staff').txt(staffNumber).up()
                 .up();
                 firstElementAdded = true;
            }
        }
    }

     // If after looping, nothing was added (e.g., notes was empty or all invalid), add a placeholder rest
     if (!firstElementAdded && notes.length > 0) { // Check notes.length to avoid adding rest for an initially empty array
         console.warn(`No valid notes/rests added for voice ${voiceNumber} on staff ${staffNumber}. Adding placeholder rest.`);
          measureBuilder.ele('note')
              .ele('rest').up()
              .ele('duration').txt(`${durationTicks}`).up()
              .ele('voice').txt(voiceNumber).up()
              .ele('staff').txt(staffNumber).up()
          .up();
     }
}