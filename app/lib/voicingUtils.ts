// src/voicingUtils.ts
import * as Tonal from 'tonal';
import { VOICE_RANGES } from './constants';
import { midiToNoteName } from './harmonyUtils'; // Import if needed for logging

/**
 * Selects the "best" MIDI note from allowed notes based on target, previous note, and smoothness.
 * Prioritizes stepwise motion if available and smoothness is high.
 * @param targetMidi - The ideal target MIDI note (e.g., based on range center).
 * @param allowedNotes - Array of valid MIDI notes (in range, in chord). MUST be sorted ascending.
 * @param previousNoteMidi - MIDI note of this voice in the previous chord/beat.
 * @param smoothnessPref - Preference for stepwise motion (0-10, higher means more preference).
 * @param avoidLeapThreshold - Interval size (semitones) considered a leap to be penalized. Defaults to Perfect 5th (7).
 * @returns {number | null} The chosen MIDI note, or null if no suitable note.
 */
export function findClosestNote(
    targetMidi: number,
    allowedNotes: number[], // Assumed sorted ascending
    previousNoteMidi: number | null,
    smoothnessPref: number,
    avoidLeapThreshold: number = Tonal.Interval.semitones('P5') ?? 7,
): number | null {
    if (!allowedNotes || allowedNotes.length === 0) {
        return null;
    }
    if (allowedNotes.length === 1) {
        return allowedNotes[0];
    }

    let bestNote: number = allowedNotes[0];
    let minScore: number = Infinity;

    // Scoring Logic
    allowedNotes.forEach((note) => {
        let score = Math.abs(note - targetMidi); // Base score: Closeness to target

        if (previousNoteMidi !== null) {
            const interval = Math.abs(note - previousNoteMidi);
            const smoothnessWeight = smoothnessPref / 10.0;

            if (interval === 0) { // Repeated note
                score *= 0.8 + 0.2 * (1.0 - smoothnessWeight); // Slight penalty, reduced by smoothness
            } else if (interval <= 2) { // Stepwise
                score *= 0.4 * (1.0 - smoothnessWeight * 0.5); // Strong bonus, increases with smoothness
            } else if (interval <= avoidLeapThreshold) { // Small/Medium Leap
                score *= 1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.6); // Moderate penalty
            } else { // Large Leap
                score *= 1.5 + (interval / 12.0) * smoothnessWeight * 1.5; // Strong penalty
            }
        } else { // No previous note
             score *= 1.0 + (Math.abs(note - targetMidi) / 24.0) * 0.1; // Slight penalty for distance from target
        }

        // Update Best Note
        if (score < minScore) {
            minScore = score;
            bestNote = note;
        } else if (previousNoteMidi !== null && Math.abs(score - minScore) < 0.1) { // Tie-breaker for smoothness
            if (Math.abs(note - previousNoteMidi) < Math.abs(bestNote - previousNoteMidi)) {
                minScore = score;
                bestNote = note;
            }
        }
    });

     // Post-selection Check: Override large leap if a good stepwise option exists?
     if (
        previousNoteMidi !== null &&
        smoothnessPref > 5 &&
        Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
    ) {
        const stepNotes = allowedNotes.filter(n => Math.abs(n - previousNoteMidi!) <= 2);
        if (stepNotes.length > 0) {
             let bestStepNote = stepNotes[0];
             let minStepTargetScore = Math.abs(bestStepNote - targetMidi);

             stepNotes.forEach((stepNote) => {
                 let stepTargetScore = Math.abs(stepNote - targetMidi);
                 if (stepTargetScore < minStepTargetScore) {
                     minStepTargetScore = stepTargetScore;
                     bestStepNote = stepNote;
                 }
             });

            const targetClosenessFactor = minScore > 0 ? minStepTargetScore / minScore : (minStepTargetScore > 0 ? 2.0 : 1.0);
            const LEAP_OVERRIDE_THRESHOLD = 1.5 + (10 - smoothnessPref) / 10.0; // Range 1.5 to 2.5

            if (targetClosenessFactor < LEAP_OVERRIDE_THRESHOLD) {
                 // console.log(` Smoothness Override: Leap ${midiToNoteName(bestNote)} replaced by Step ${midiToNoteName(bestStepNote)}`); // Debug
                 bestNote = bestStepNote;
             }
        }
    }

    return bestNote;
}


/** Assigns a MIDI note for the Soprano voice (SATB context) or Melody line. */
export function assignSopranoOrMelodyNote(
    fullChordNotePool: number[],
    previousSopranoMidi: number | null,
    smoothness: number,
    style: 'SATB' | 'MelodyAccompaniment',
): number | null {
    const [minRange, maxRange] =
        style === 'SATB' ? VOICE_RANGES.soprano : VOICE_RANGES.melody;
    const allowedNotes = fullChordNotePool.filter(
        (n) => n >= minRange && n <= maxRange,
    );

    if (allowedNotes.length === 0) {
        console.warn(
            `${style}: No valid soprano/melody notes found in range [${minRange}-${maxRange}]. Pool: ${fullChordNotePool.map(midiToNoteName).join(', ')}`,
        );
        return null;
    }

    const targetMidi =
        previousSopranoMidi !== null
            ? previousSopranoMidi + 1 // Target slightly above previous
            : (minRange + maxRange) / 2; // Target middle of the range initially

    return findClosestNote(
        targetMidi,
        allowedNotes.sort((a, b) => a - b), // Ensure sorted
        previousSopranoMidi,
        smoothness,
        7, // Standard leap threshold
    );
}