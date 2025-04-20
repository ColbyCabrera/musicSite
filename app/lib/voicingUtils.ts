// src/voicingUtils.ts
import * as Tonal from 'tonal';
import { VOICE_RANGES } from './constants';
import { midiToNoteName } from './harmonyUtils'; // Import if needed for logging

/**
 * Selects the "best" MIDI note from allowed notes based on target, previous note, and smoothness.
 * Prioritizes stepwise motion if available and smoothness is high. Penalizes repetition.
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
  const smoothnessWeight = smoothnessPref / 10.0; // Normalize smoothness 0.0 to 1.0

  // Scoring Logic
  allowedNotes.forEach((note) => {
    let score = Math.abs(note - targetMidi); // Base score: Closeness to target

    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);

      // --- Penalize Repetition ---
      // Add a penalty for repeating the previous note.
      // The penalty decreases slightly as smoothness preference increases (high smoothness might favor repetition over leaps).
      if (interval === 0) {
        score += 5 * (1.0 - smoothnessWeight * 0.5); // Additive penalty for repetition
      }
      // --- Score based on interval size ---
      else if (interval <= 2) {
        // Stepwise: Strong bonus, increasing with smoothness
        score *= 0.4 * (1.0 - smoothnessWeight * 0.5);
      } else if (interval <= avoidLeapThreshold) {
        // Small/Medium Leap: Moderate penalty, increasing with smoothness and interval size
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.6);
      } else {
        // Large Leap: Strong penalty, increasing with smoothness and interval size
        score *= 1.5 + (interval / 12.0) * smoothnessWeight * 1.5;
      }
    } else {
      // No previous note: Slight penalty for distance from target
      score *= 1.0 + (Math.abs(note - targetMidi) / 24.0) * 0.1;
    }

    // Update Best Note
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    } else if (previousNoteMidi !== null && Math.abs(score - minScore) < 0.1) {
      // Tie-breaker for smoothness (prefer smaller interval if scores are very close)
      if (
        Math.abs(note - previousNoteMidi) <
        Math.abs(bestNote - previousNoteMidi)
      ) {
        minScore = score;
        bestNote = note;
      }
    }
  });

  // --- Post-selection Check: Override large leap if a good stepwise option exists? ---
  // (Keep this logic as it helps enforce smoothness when desired)
  if (
    previousNoteMidi !== null &&
    smoothnessPref > 5 &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    const stepNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi!) <= 2 && n !== previousNoteMidi, // Exclude repeated notes here too
    );
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

      // Calculate how much worse (further from target) the step note is compared to the leaped note
      const targetClosenessFactor =
        minScore > 0
          ? minStepTargetScore / minScore
          : minStepTargetScore > 0
            ? 2.0
            : 1.0;
      // Define how much worse the step note can be to still override the leap
      // Higher smoothness means we tolerate a step note that's further from the target
      const LEAP_OVERRIDE_THRESHOLD = 1.5 + smoothnessWeight * 1.0; // Range 1.5 to 2.5

      if (targetClosenessFactor < LEAP_OVERRIDE_THRESHOLD) {
        console.log(
          `    [Voicing Info] Smoothness Override: Leap to ${midiToNoteName(bestNote)} replaced by Step to ${midiToNoteName(bestStepNote)}`,
        ); // Debug
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
