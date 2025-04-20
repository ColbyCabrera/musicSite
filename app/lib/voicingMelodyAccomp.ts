// src/voicingMelodyAccomp.ts
import { VOICE_RANGES, MELODY_ACCOMPANIMENT_SPACING_LIMIT } from './constants';
import { findClosestNote } from './voicingUtils';
import { midiToNoteName } from './harmonyUtils';

/**
 * Generates accompaniment voicing (typically 3 notes) for Melody+Accompaniment style.
 * Aims for common keyboard voicings below the melody.
 * @param melodyNoteMidi - The MIDI note of the melody line.
 * @param chordRootMidi - The root MIDI note of the current chord (for grounding).
 * @param chordPcs - The pitch classes present in the current chord.
 * @param fullChordNotePool - All available MIDI notes for the chord across octaves.
 * @param previousAccompanimentNotes - Array of MIDI notes from the previous accompaniment chord.
 * @param smoothness - Smoothness preference (0-10).
 * @param numVoices - Number of notes desired in the accompaniment chord (e.g., 3).
 * @returns { (number | null)[] } An array of MIDI notes for the accompaniment, ordered lowest to highest.
 */
export function generateAccompanimentVoicing(
    melodyNoteMidi: number | null,
    chordRootMidi: number,
    chordPcs: number[],
    fullChordNotePool: number[],
    previousAccompanimentNotes: (number | null)[],
    smoothness: number,
    numVoices: number = 3,
): (number | null)[] {
    if (melodyNoteMidi === null) {
        console.warn('Accompaniment: Cannot generate voicing without melody note.');
        return Array(numVoices).fill(null);
    }
    if (numVoices <= 0) return [];

    const [minRange, maxRange] = VOICE_RANGES.accompaniment;
    const chordRootPc = chordRootMidi % 12;

    let availableNotes = fullChordNotePool
        .filter(n =>
            n < melodyNoteMidi &&
            n >= minRange &&
            n <= maxRange &&
            (melodyNoteMidi - n < MELODY_ACCOMPANIMENT_SPACING_LIMIT) // Check spacing below melody
        )
        .sort((a, b) => a - b);

    if (availableNotes.length < numVoices) {
        console.warn(`Accompaniment: Not enough notes (${availableNotes.length}) in pool for ${numVoices}-note chord. Using available.`);
        if (availableNotes.length === 0) {
            console.error('Accompaniment: No available notes found at all.');
            return Array(numVoices).fill(null);
        }
        numVoices = availableNotes.length;
    }

    let accompanimentNotes: (number | null)[] = [];
    let remainingPcs = new Set(chordPcs);
    let currentAvailableNotes = [...availableNotes]; // Copy to modify

    // --- 1. Assign Lowest Note ---
    let lowestNote: number | null = null;
    const bassTargetMidi = previousAccompanimentNotes[0] ?? (chordRootMidi - 12);
    const rootOptionsLowest = currentAvailableNotes.filter(n => n % 12 === chordRootPc && n < minRange + 12);
    const allRootOptions = currentAvailableNotes.filter(n => n % 12 === chordRootPc);
    let bassCandidates: number[] = [];

    if (rootOptionsLowest.length > 0) {
        bassCandidates = rootOptionsLowest;
    } else if (allRootOptions.length > 0) {
        bassCandidates = allRootOptions;
    } else {
        bassCandidates = currentAvailableNotes; // Use any note if root unavailable
        console.warn(`Accompaniment: Chord root PC ${chordRootPc} not found in available notes. Choosing lowest.`);
    }

    lowestNote = findClosestNote(
        bassTargetMidi,
        bassCandidates,
        previousAccompanimentNotes[0] ?? null,
        smoothness,
        9, // Bass leap threshold
    );

    if (lowestNote === null) {
        console.warn('Accompaniment: Could not assign bass note. Using fallback.');
        return Array(numVoices).fill(null);
    }

    accompanimentNotes.push(lowestNote);
    remainingPcs.delete(lowestNote % 12);

    // --- 2. Assign Upper Notes ---
    // Filter available notes that would create spans larger than an octave from lowest note
    currentAvailableNotes = currentAvailableNotes.filter(n => n > lowestNote! && n <= lowestNote! + 12);

    let upperNotesAssigned = 0;
    const maxOctaveSpan = 12; // Maximum span of one octave in semitones

    while (accompanimentNotes.length < numVoices && currentAvailableNotes.length > 0) {
        let targetMidi: number;
        const prevAccompNote = previousAccompanimentNotes[accompanimentNotes.length];

        if (prevAccompNote !== null) {
            targetMidi = prevAccompNote;
        } else {
            // If no previous note, aim for a balanced voicing within the octave span
            const span = maxOctaveSpan;
            const spacing = span / (numVoices - 1);
            targetMidi = lowestNote + Math.round(spacing * upperNotesAssigned);
        }

        // Find closest note that maintains the octave limit
        const validCandidates = currentAvailableNotes.filter(n =>
            n >= lowestNote! && // Must be above bass
            n <= lowestNote! + maxOctaveSpan // Must be within octave span
        );

        if (validCandidates.length === 0) break;

        const nextNote = findClosestNote(
            targetMidi,
            validCandidates,
            prevAccompNote,
            smoothness,
            6, // Smaller leap threshold for inner voices
        );

        if (nextNote === null) break;

        accompanimentNotes.push(nextNote);
        currentAvailableNotes = currentAvailableNotes.filter(n => n !== nextNote);
        remainingPcs.delete(nextNote % 12);
        upperNotesAssigned++;
    }

    // Fill remaining positions with nulls if needed
    while (accompanimentNotes.length < numVoices) {
        accompanimentNotes.push(null);
    }

    return accompanimentNotes;
}