// src/voicingUtils.ts
import * as Tonal from 'tonal';
import { VOICE_RANGES } from './constants';
import { midiToNoteName } from './theory/harmony'; // Used for logging, can be removed if logs are stripped
import { MelodicState, GenerationStyle } from './types';

/**
 * Selects the "best" MIDI note from a list of allowed notes based on several criteria:
 * proximity to a `targetMidi`, voice leading smoothness from a `previousNoteMidi`,
 * preference for stepwise motion (controlled by `smoothnessPref`), and penalization
 * of large leaps or excessive repetition.
 *
 * The scoring logic is heuristic and aims to produce musically sensible choices.
 *
 * @param {number} targetMidi - The ideal target MIDI note, often derived from the center of a voice's range
 *                              or a point of melodic attraction.
 * @param {number[]} allowedNotes - An array of valid MIDI note numbers that the voice is allowed to move to.
 *                                  This array **must be sorted in ascending order** for some internal logic.
 * @param {number | null} previousNoteMidi - The MIDI note of this voice from the previous musical event.
 *                                           If `null` (e.g., at the beginning of a piece), some voice leading
 *                                           heuristics are adjusted.
 * @param {number} smoothnessPref - A preference value (0-10) for stepwise motion. Higher values
 *                                  more strongly penalize leaps and favor smaller intervals.
 * @param {number} [avoidLeapThreshold=Tonal.Interval.semitones('P5') ?? 7] - The interval size in semitones
 *                                  that is considered a "leap" and will be penalized more heavily.
 *                                  Defaults to a perfect fifth (7 semitones).
 * @returns {number | null} The chosen MIDI note number from `allowedNotes`, or `null` if `allowedNotes` is empty.
 */
export function findClosestNote(
  targetMidi: number,
  allowedNotes: number[],
  previousNoteMidi: number | null,
  smoothnessPref: number,
  avoidLeapThreshold: number = Tonal.Interval.semitones('P5') ?? 7,
): number | null {
  if (!allowedNotes || allowedNotes.length === 0) {
    return null; // No notes to choose from.
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
      const direction = Math.sign(note - previousNoteMidi);
      const targetDirection = Math.sign(targetMidi - previousNoteMidi);

      // Strongly penalize direction changes
      if (
        direction !== 0 &&
        targetDirection !== 0 &&
        direction !== targetDirection
      ) {
        score *= 2.0;
      }

      // Extremely high penalty for repetition to avoid oscillation
      if (interval === 0) {
        score += 8 * (1.0 - smoothnessWeight * 0.3); // Increased base penalty
      }
      // Scoring based on interval size with direction consideration
      else if (interval <= 2) {
        // Stepwise: Strong bonus, increasing with smoothness
        score *= 0.3 * (1.0 - smoothnessWeight * 0.6);
        // Extra bonus for continuing in the same direction
        if (direction === targetDirection) {
          score *= 0.7;
        }
      } else if (interval <= avoidLeapThreshold) {
        // Small/Medium Leap: Higher penalty
        score *=
          1.2 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.8);
        if (direction !== targetDirection) {
          score *= 1.3; // Additional penalty for changing direction
        }
      } else {
        // Large Leap: Very high penalty
        score *= 2.0 + (interval / 12.0) * smoothnessWeight * 2.0;
        if (direction !== targetDirection) {
          score *= 1.5; // Even higher penalty for large leaps that change direction
        }
      }
    } else {
      // No previous note: Prefer notes closer to the middle of the range
      score *= 1.0 + (Math.abs(note - targetMidi) / 24.0) * 0.2;
    }

    // Update Best Note
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });

  // Post-selection smoothness check for high smoothness preference
  if (previousNoteMidi !== null && smoothnessPref >= 7) {
    const stepNotes = allowedNotes.filter(
      (n) =>
        Math.abs(n - previousNoteMidi!) <= 2 &&
        n !== previousNoteMidi &&
        Math.sign(n - previousNoteMidi!) ===
          Math.sign(targetMidi - previousNoteMidi!),
    );

    if (stepNotes.length > 0) {
      bestNote = stepNotes.reduce((best, current) =>
        Math.abs(current - targetMidi) < Math.abs(best - targetMidi)
          ? current
          : best,
      );
    }
  }

  return bestNote;
}

/**
 * Assigns a MIDI note for the Soprano voice (in SATB style) or the main Melody line
 * (in MelodyAccompaniment style).
 *
 * For SATB style, it selects a chord tone from `fullChordNotePool` within the Soprano's range,
 * aiming for smoothness from the `previousNote`.
 *
 * For MelodyAccompaniment style, it employs a more complex selection strategy:
 * - It considers chord tones from `fullChordNotePool`.
 * - It also considers diatonic notes (passing tones) from the current `keySignature`.
 * - It uses `melodicState` (last direction and streak) to guide melodic contour,
 *   preferring continued motion or controlled changes in direction.
 * - It weights choices to favor chord tones and diatonic steps, with a small chance for chromaticism.
 * - Aims to avoid oscillation by penalizing direct repetition if a streak continues.
 *
 * @param {number[]} fullChordNotePool - An array of all available MIDI notes for the current chord across multiple octaves.
 * @param {number | null} previousNote - The MIDI note of this voice/part from the previous musical event.
 * @param {number} smoothness - A preference (0-10) for smooth voice leading.
 * @param {GenerationStyle} style - The musical style ('SATB' or 'MelodyAccompaniment') which dictates
 *                                  the selection strategy and voice range.
 * @param {string} [keySignature='C'] - The current key signature (e.g., "C", "Gm"). Used primarily for
 *                                      MelodyAccompaniment style to determine diatonic notes.
 * @param {MelodicState} [melodicState] - Optional. The current melodic state (last direction and streak),
 *                                        used to guide melody generation in MelodyAccompaniment style.
 * @returns {number | null} The chosen MIDI note number, or `null` if no suitable note can be found.
 */
export function assignSopranoOrMelodyNote(
  fullChordNotePool: number[],
  previousNote: number | null,
  smoothness: number,
  style: GenerationStyle,
  keySignature: string = 'C',
  melodicState?: MelodicState,
): number | null {
  if (style === 'SATB') {
    const [minRange, maxRange] = VOICE_RANGES.soprano; // Use soprano range for SATB
    const availableNotes = fullChordNotePool
      .filter((n) => n >= minRange && n <= maxRange)
      .sort((a, b) => a - b);

    if (availableNotes.length === 0) {
      console.warn('[WARN] No valid soprano notes found in range.');
      return null;
    }

    return findClosestNote(
      previousNote ?? availableNotes[Math.floor(availableNotes.length / 2)],
      availableNotes,
      previousNote,
      smoothness,
      7, // Soprano leap threshold
    );
  }

  // For Melody+Accompaniment style
  const [minRange, maxRange] = VOICE_RANGES.melody;
  let availableNotes: number[] = [];

  // Get the key's scale notes
  let keyDetails =
    Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
  if (!keyDetails) {
    console.warn('[WARN] Invalid key signature, defaulting to C major scale');
    keyDetails = Tonal.Key.majorKey('C');
  }

  const scaleNotes = keyDetails.scale;
  const diatonicPitchClasses = new Set(
    scaleNotes.map((note) => Tonal.Note.chroma(note)),
  );

  // If we have a previous note, include both diatonic and chord options
  if (previousNote !== null) {
    const maxInitialStep = Math.min(4, Math.max(2, Math.floor(smoothness / 2)));
    const currentDirection = melodicState?.lastDirection ?? 0;
    const streak = melodicState?.directionStreak ?? 0;

    // Stronger direction bias that increases with streak
    const directionBias = Math.min(0.9, 0.4 + streak * 0.15);
    const minStreakForChange = 3;

    // Define ranges based on direction bias
    let preferredRange: number[];
    if (currentDirection > 0) {
      preferredRange = Array.from(
        { length: maxInitialStep },
        (_, i) => previousNote + (i + 1),
      );
    } else if (currentDirection < 0) {
      preferredRange = Array.from(
        { length: maxInitialStep },
        (_, i) => previousNote - (i + 1),
      );
    } else {
      const midpoint = (minRange + maxRange) / 2;
      if (previousNote > midpoint + 6) {
        preferredRange = Array.from(
          { length: maxInitialStep },
          (_, i) => previousNote - (i + 1),
        );
      } else if (previousNote < midpoint - 6) {
        preferredRange = Array.from(
          { length: maxInitialStep },
          (_, i) => previousNote + (i + 1),
        );
      } else {
        preferredRange = Array.from(
          { length: maxInitialStep },
          (_, i) => previousNote + (Math.random() < 0.5 ? i + 1 : -(i + 1)),
        );
      }
    }

    // Add momentum effect
    const momentumBoost = Math.min(15, streak * 3);

    // First, add chord tones with high weight
    fullChordNotePool
      .filter(
        (n) =>
          n >= minRange &&
          n <= maxRange &&
          Math.abs(n - previousNote) <= maxInitialStep * 2,
      )
      .forEach((n) => {
        for (let weight = 0; weight < 12; weight++) {
          availableNotes.push(n);
        }
      });

    // Then add diatonic passing tones in the preferred direction
    for (const note of preferredRange) {
      if (note >= minRange && note <= maxRange) {
        // Only add diatonic notes that are not chord tones
        if (
          diatonicPitchClasses.has(note % 12) &&
          !fullChordNotePool.includes(note)
        ) {
          // Add diatonic non-chord tones with medium-high weight
          for (let weight = 0; weight < 8 + momentumBoost; weight++) {
            availableNotes.push(note);
          }
        }
      }
    }

    // Add other nearby diatonic notes with lower weight
    for (let i = -maxInitialStep; i <= maxInitialStep; i++) {
      const note = previousNote + i;
      if (
        note >= minRange &&
        note <= maxRange &&
        !preferredRange.includes(note) &&
        !fullChordNotePool.includes(note)
      ) {
        if (diatonicPitchClasses.has(note % 12)) {
          // Add other diatonic notes with very low weight
          availableNotes.push(note);
        }
      }
    }

    // Only add chromatic notes with extremely low probability
    if (Math.random() < 0.05) {
      // 5% chance to even consider chromatic notes
      for (const note of preferredRange) {
        if (
          note >= minRange &&
          note <= maxRange &&
          !diatonicPitchClasses.has(note % 12) &&
          !fullChordNotePool.includes(note)
        ) {
          // Add each chromatic note only once with very low weight
          availableNotes.push(note);
        }
      }
    }

    // Strong oscillation prevention
    const oscillationPenalty = Math.max(0.2, streak * 0.3);
    if (
      availableNotes.includes(previousNote) &&
      Math.random() < oscillationPenalty
    ) {
      availableNotes = availableNotes.filter((n) => n !== previousNote);
    }
  } else {
    // If no previous note, start with chord tones near the middle of the range
    availableNotes = fullChordNotePool.filter(
      (n) => n >= minRange && n <= maxRange,
    );

    // Prefer starting in the middle register
    const midpoint = (minRange + maxRange) / 2;
    availableNotes.sort(
      (a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint),
    );
  }

  // Remove duplicates and sort
  availableNotes = Array.from(new Set(availableNotes)).sort((a, b) => a - b);

  if (availableNotes.length === 0) {
    console.warn('[WARN] No valid melody notes found in range.');
    return null;
  }

  // Select note with strong preference for chord tones and diatonic notes
  let selectedNote = findClosestNote(
    previousNote ?? availableNotes[Math.floor(availableNotes.length / 2)],
    availableNotes,
    previousNote,
    smoothness,
    7,
  );

  // Update melodic state if provided
  if (selectedNote !== null && previousNote !== null && melodicState) {
    const newDirection = Math.sign(selectedNote - previousNote);
    if (newDirection === melodicState.lastDirection && newDirection !== 0) {
      melodicState.directionStreak++;
    } else {
      if (newDirection !== 0) {
        melodicState.directionStreak = 1;
      }
      melodicState.lastDirection = newDirection;
    }
  }

  return selectedNote;
}
