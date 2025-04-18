// js/tonal-helpers.js
// Description: Utility functions interacting primarily with the Tonal.js library.

import { DEFAULT_OCTAVE } from './config.js';

/**
 * Converts a note name (e.g., "C#4", "Db5") to its corresponding MIDI number.
 * @param {string} noteName - The note name in scientific pitch notation.
 * @returns {number | null} The MIDI number, or null if the note name is invalid.
 */
export function noteNameToMidi(noteName) {
    return Tonal.Note.midi(noteName);
}

/**
 * Converts a MIDI number to its note name in scientific pitch notation (e.g., "C#4").
 * Prefers sharps by default for ambiguous notes (like A#/Bb).
 * @param {number} midi - The MIDI number.
 * @param {boolean} [useSharps=true] - Whether to prefer sharp notation over flats.
 * @returns {string | null} The note name, or null if the MIDI number is invalid.
 */
export function midiToNoteName(midi, useSharps = true) {
    if (midi === null || midi === undefined) return null;
    return Tonal.Note.fromMidi(midi, { sharps: useSharps });
}

/**
 * Converts a MIDI number to a VexFlow-compatible key string (e.g., "c#/4", "ab/5").
 * Attempts to determine the correct enharmonic spelling based on the provided key signature.
 * @param {number} midi - The MIDI number.
 * @param {string} keyName - The current key signature (e.g., "C", "Eb", "F#m").
 * @returns {string | null} The VexFlow key string (note/octave), or null if MIDI is invalid.
 */
export function midiToVexflowKey(midi, keyName) {
    if (midi === null || midi === undefined) return null;

    const pc = Tonal.Note.pitchClass(Tonal.Note.fromMidi(midi));
    const keyInfo = Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
    const preferSharps = keyInfo ? keyInfo.alteration > 0 : pc.includes("#");

    const scaleName = keyName + (keyInfo && keyInfo.type === "minor" ? " harmonic minor" : " major");
    const scaleNotes = Tonal.Scale.get(scaleName).notes;

    let noteInScale = null;
    if (scaleNotes && scaleNotes.length > 0) {
        for (const scaleNote of scaleNotes) {
            if (Tonal.Note.midi(scaleNote + DEFAULT_OCTAVE) % 12 === midi % 12) {
                noteInScale = Tonal.Note.simplify(scaleNote);
                break;
            }
        }
    }

    let finalNoteName;
    if (noteInScale && (noteInScale === pc || Tonal.Note.enharmonic(noteInScale) === pc)) {
        finalNoteName = noteInScale;
    } else {
        finalNoteName = Tonal.Note.fromMidi(midi, { sharps: preferSharps });
    }

    const noteComponents = Tonal.Note.get(finalNoteName);
    const vexOctave = Math.floor(midi / 12) - 1;
    return `${noteComponents.letter.toLowerCase()}${noteComponents.acc}/${vexOctave}`;
}

/**
 * Calculates the MIDI note numbers for a chord specified by its Roman numeral in a given key.
 * @param {string} roman - The Roman numeral (e.g., "I", "V7", "ii").
 * @param {string} keyName - The key context (e.g., "C", "Gm").
 * @returns {number[]} An array of MIDI note numbers for the chord, or empty array on error.
 */
export function getChordNotesFromRoman(roman, keyName) {
    try {
        const keyDetails = Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
        if (!keyDetails || !keyDetails.chords || !keyDetails.chordScales) {
            console.warn(`Could not get valid key details or chords for key "${keyName}". Roman: "${roman}"`);
            return [];
        }

        const romanMap = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
        const baseRomanMatch = roman.match(/([iv]+)/i);
        if (!baseRomanMatch) {
            console.warn(`Could not parse base Roman numeral from "${roman}" in key "${keyName}".`);
            return [];
        }
        const baseRomanUpper = baseRomanMatch[1].toUpperCase();
        const scaleDegreeIndex = romanMap[baseRomanUpper];

        if (scaleDegreeIndex === undefined) {
            console.warn(`Could not map Roman numeral "${baseRomanUpper}" (from "${roman}") to index.`);
            return [];
        }

        const diatonicChords = keyDetails.chords;
        if (scaleDegreeIndex >= diatonicChords.length) {
            console.warn(`Index ${scaleDegreeIndex} out of bounds for diatonic chords in key "${keyName}".`);
            return [];
        }

        let chordSymbol = diatonicChords[scaleDegreeIndex];

        if (roman.includes("7") && !chordSymbol.includes("7")) {
            const seventhChordSymbol = chordSymbol + "7";
            const chordInfo = Tonal.Chord.get(seventhChordSymbol);
            if (!chordInfo.empty) {
                chordSymbol = seventhChordSymbol;
            } else {
                console.warn(`Input "${roman}" requested 7th, but "${seventhChordSymbol}" invalid. Using "${chordSymbol}".`);
            }
        }

        const chord = Tonal.Chord.get(chordSymbol);
        if (!chord || chord.empty || !chord.notes || chord.notes.length === 0) {
            console.warn(`Could not get valid notes for chord symbol "${chordSymbol}" from Roman "${roman}" in ${keyName}`);
            return [];
        }

        const rootNote = Tonal.Note.get(chord.tonic);
        const rootOctaveGuess = (rootNote.letter === "A" || rootNote.letter === "B") ? 3 : 4;
        const rootMidiGuess = Tonal.Note.midi(rootNote.letter + rootNote.acc + rootOctaveGuess);

        if (rootMidiGuess === null) {
            console.warn(`Could not determine root MIDI for chord "${chordSymbol}".`);
            return [];
        }
        const rootNoteName = Tonal.Note.fromMidi(rootMidiGuess);
        if (!rootNoteName) {
           console.warn(`Could not get note name from root MIDI ${rootMidiGuess} for chord ${chordSymbol}.`);
           return [];
        }

        return chord.intervals
            .map((interval) => {
                try {
                    const transposedNoteName = Tonal.transpose(rootNoteName, interval);
                    if (!transposedNoteName) {
                        console.warn(`Tonal.transpose returned null for ${rootNoteName} + ${interval}`);
                        return null;
                    }
                    return Tonal.Note.midi(transposedNoteName);
                } catch (transposeError) {
                    console.error(`Error during Tonal.transpose(${rootNoteName}, ${interval}):`, transposeError);
                    return null;
                }
            })
            .filter((midi) => midi !== null);

    } catch (error) {
        console.error(`Unexpected error getting chord notes for Roman "${roman}" in key "${keyName}":`, error);
        return [];
    }
}

/**
 * Expands a base set of chord MIDI notes across several octaves.
 * @param {number[]} baseChordNotes - An array of MIDI notes representing the core chord.
 * @param {number} [numOctavesBelow=2] - Number of octaves to extend downwards.
 * @param {number} [numOctavesAbove=3] - Number of octaves to extend upwards.
 * @returns {number[]} A sorted array of unique MIDI notes spanning the specified octave range.
 */
export function getExtendedChordNotePool(baseChordNotes, numOctavesBelow = 2, numOctavesAbove = 3) {
    if (!baseChordNotes || baseChordNotes.length === 0) return [];
    const pool = new Set();
    for (let i = -numOctavesBelow; i <= numOctavesAbove; i++) {
        baseChordNotes.forEach((note) => {
            if (note !== null) {
                pool.add(note + i * 12);
            }
        });
    }
    return [...pool].sort((a, b) => a - b);
}