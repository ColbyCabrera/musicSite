// src/voicingMelodyAccomp.ts
import { VOICE_RANGES, MELODY_ACCOMPANIMENT_SPACING_LIMIT } from './constants';
import { findClosestNote } from './voicingUtils';
// import { midiToNoteName } from './harmonyUtils'; // Not used directly, only for console.warn/error

/**
 * Generates an accompaniment voicing, typically consisting of three notes, suitable for
 * a "Melody + Accompaniment" musical style. The function aims to create common keyboard-style
 * voicings that sit below the melody line.
 *
 * The process involves:
 * 1. Filtering available notes from the `fullChordNotePool` based on range, proximity to melody, and chord membership.
 * 2. Assigning the lowest note, prioritizing the chord root if available in a suitable low register.
 * 3. Assigning subsequent upper notes, aiming for smooth voice leading from `previousAccompanimentNotes`
 *    and maintaining a limited octave span from the lowest note.
 *
 * @param {number | null} melodyNoteMidi - The MIDI note number of the current melody note.
 *                                         If `null`, the function cannot generate a sensible voicing and returns nulls.
 * @param {number} chordRootMidi - The MIDI note number of the root of the current chord. Used for grounding the voicing.
 * @param {number[]} chordPcs - An array of pitch classes (0-11) present in the current chord.
 *                              Used to ensure accompaniment notes are chord tones.
 * @param {number[]} fullChordNotePool - An array of all available MIDI notes for the current chord across multiple octaves.
 * @param {(number | null)[]} previousAccompanimentNotes - An array of MIDI notes from the accompaniment chord
 *                                                        of the previous musical event. Used to guide smooth voice leading.
 *                                                        The length should match `numVoices`.
 * @param {number} smoothness - A preference value (0-10) for smooth voice leading. Higher values more strongly
 *                              prioritize stepwise motion or small leaps.
 * @param {number} [numVoices=3] - The desired number of notes in the accompaniment chord (typically 3).
 * @returns {(number | null)[]} An array of MIDI note numbers representing the accompaniment voicing,
 *                              ordered from lowest to highest. If a suitable note cannot be found for a voice,
 *                              `null` is used for that position. Returns an array of nulls if critical
 *                              input (like `melodyNoteMidi`) is missing or if no notes can be placed.
 */
export function generateAccompanimentVoicing(
    melodyNoteMidi: number | null,
    chordRootMidi: number,
    chordPcs: number[], // Ensure this represents the *current* chord's pitch classes
    fullChordNotePool: number[],
    previousAccompanimentNotes: (number | null)[],
    smoothness: number,
    numVoices: number = 3,
): (number | null)[] {
    if (melodyNoteMidi === null) {
        // console.warn('Accompaniment: Cannot generate voicing without a melody note to voice under.');
        return Array(numVoices).fill(null);
    }
    if (numVoices <= 0) {
        return [];
    }

    const [minRange, maxRange] = VOICE_RANGES.accompaniment; // Destructure min/max MIDI values for accompaniment range
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