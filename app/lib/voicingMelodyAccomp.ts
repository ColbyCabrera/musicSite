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

    if (lowestNote !== null) {
        accompanimentNotes.push(lowestNote);
        remainingPcs.delete(lowestNote % 12);
        currentAvailableNotes = currentAvailableNotes.filter((n) => n > lowestNote!); // Remove chosen and below
    } else {
        console.error('Accompaniment: Failed to assign lowest note.');
        return Array(numVoices).fill(null);
    }

    // --- 2. Assign Remaining Voices ---
    for (let i = 1; i < numVoices; i++) {
        if (currentAvailableNotes.length === 0) {
            console.warn(`Accompaniment: Ran out of notes after ${accompanimentNotes.length} voice(s).`);
            accompanimentNotes.push(null);
            continue;
        }

        const previousNote = previousAccompanimentNotes[i] ?? previousAccompanimentNotes[i-1] ?? lowestNote;
        const targetMidi = previousNote !== null ? previousNote : lowestNote! + 7; // Target near prev or ~P5 above lowest

        const neededPcNotes = currentAvailableNotes.filter((n) => remainingPcs.has(n % 12));
        let candidates: number[] = (neededPcNotes.length > 0) ? neededPcNotes : currentAvailableNotes;

        const chosenNote = findClosestNote(targetMidi, candidates, previousNote, smoothness, 7);

        if (chosenNote !== null) {
            accompanimentNotes.push(chosenNote);
            remainingPcs.delete(chosenNote % 12);
            currentAvailableNotes = currentAvailableNotes.filter((n) => n > chosenNote); // Remove chosen and potentially notes below
        } else {
            console.warn(`Accompaniment: Failed to assign voice ${i + 1}.`);
            accompanimentNotes.push(null);
        }
    }

    while (accompanimentNotes.length < numVoices) { // Pad if needed
        accompanimentNotes.push(null);
    }

    return accompanimentNotes.sort((a, b) => (a ?? -1) - (b ?? -1)); // Sort low to high
}