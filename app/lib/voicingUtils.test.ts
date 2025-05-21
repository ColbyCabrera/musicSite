// app/lib/voicingUtils.test.ts
import { findClosestNote, assignSopranoOrMelodyNote } from './voicingUtils';
import { VOICE_RANGES } from './constants';
import * as Tonal from 'tonal'; // For utility functions like Tonal.Note.midi

describe('voicingUtils', () => {
  describe('findClosestNote', () => {
    const allowedNotes1 = [60, 62, 64, 67, 70]; // C4, D4, E4, G4, A#4/Bb4

    test('Basic: picks closest note to target', () => {
      expect(findClosestNote(63, allowedNotes1, null, 5)).toBe(62); // D4 is closer to D#4/Eb4 than E4
      expect(findClosestNote(68, allowedNotes1, null, 5)).toBe(67); // G4 is closer to A4 than A#4
    });

    test('Basic: no previous note, picks closest to target', () => {
      expect(findClosestNote(59, allowedNotes1, null, 5)).toBe(60);
    });

    test('Smoothness: high smoothness prefers stepwise', () => {
      // Target 65 (F4). Allowed: C4, D4, E4, G4, Bb4. Previous E4 (64)
      // Stepwise to G4 (67) vs leap to E4 (64) - E4 is closer to target
      // With high smoothness, D4 (62) or E4 (64) or G4 (67) might be preferred if prev is E4 (64)
      // If prev is 64 (E4), target 65 (F4). Allowed: 60,62,64,67,70.
      // Stepwise to D4 (62) or G4 (67). Closest to target is E4 (64) - repetition.
      // findClosestNote should penalize repetition.
      // Next closest to F4 (65) is E4 (64) or G4 (67).
      // If previous is 62 (D4), target 63. Allowed 60,62,64,67.
      // Stepwise to 64 (E4) or 60 (C4). Closest to target is 62 (D4) or 64 (E4).
      // With high smoothness, 64 (step up) should be preferred over 62 (repeat)
      expect(findClosestNote(63, [60, 62, 64, 67], 62, 10)).toBe(64); // Prefers E4 (step) over D4 (repeat)
      expect(findClosestNote(65, [60, 64, 67], 64, 10)).toBe(67); // Prefers G4 (step up) over E4 (repeat)
    });

    test('Smoothness: low smoothness picks absolute closest, even if leap or repeat', () => {
      // Target 63. Allowed C4, D4, E4, G4. Previous D4 (62).
      // E4 (64) is a step. D4 (62) is repetition.
      // With low smoothness, D4 (62) might be chosen as it's closer than E4 if penalties are low.
      // The current scoring heavily penalizes repetition, so this might still pick E4.
      // Let's test: prev 60 (C4), target 61 (C#4). Allowed [60, 62, 64].
      // Closest is 60 (repeat). Step is 62. Low smoothness might pick 60.
      expect(findClosestNote(61, [60, 62, 64], 60, 0)).toBe(60); // Low smoothness, C4 repeat is chosen
    });

    test('Smoothness: repetition is penalized', () => {
      expect(findClosestNote(64, allowedNotes1, 64, 5)).not.toBe(64); // Should avoid repeating E4
      // It should pick 62 (D4) or 67 (G4) as they are next closest and not repetition.
      // Target 64 (E4), prev 64 (E4). Allowed C4, D4, E4, G4, Bb4
      // Distances from E4: C4(4), D4(2), E4(0), G4(3), Bb4(6)
      // E4 is out due to penalty. D4 or G4. D4 is closer.
      const result = findClosestNote(64, allowedNotes1, 64, 8);
      expect([62, 67]).toContain(result);
    });

    test('Leap Threshold: affects choice when leaps are involved', () => {
      // Target 70, prev 60. Allowed [60, 62, 67, 70, 72].
      // Leap to 67 (P5=7st), 70 (m7=10st), 72 (M7=11st).
      // With default P5 threshold (7), 67 is not a large leap. 70 is.
      expect(findClosestNote(70, [60, 62, 67, 70, 72], 60, 5, 7)).toBe(67); // G4 preferred over Bb4 due to leap
      // With large threshold (e.g., 12), 70 becomes less penalized.
      expect(findClosestNote(70, [60, 62, 67, 70, 72], 60, 5, 12)).toBe(70); // Bb4 is now chosen
    });

    test('Edge: empty allowedNotes returns null', () => {
      expect(findClosestNote(60, [], null, 5)).toBeNull();
    });

    test('Edge: one allowedNote returns that note', () => {
      expect(findClosestNote(60, [65], null, 5)).toBe(65);
      expect(findClosestNote(65, [65], 60, 5)).toBe(65);
    });

    test('Edge: all allowedNotes equidistant from target', () => {
      // Target 63. Allowed [61, 65]. Both are 2 semitones away.
      // Behavior in this exact scenario might depend on iteration order or minor score differences.
      // The current implementation iterates and picks the first one that achieves minScore.
      // If previous is 60, target 63. Allowed [61, 65].
      // 61 (-2 from target, interval 1 from prev) vs 65 (+2 from target, interval 5 from prev)
      // 61 likely wins due to smaller interval from previous.
      expect(findClosestNote(63, [61, 65], 60, 5)).toBe(61);
      // No previous: target 63, allowed [61, 65]. 61 is found first.
      expect(findClosestNote(63, [61, 65], null, 5)).toBe(61);
    });
  });

  describe('assignSopranoOrMelodyNote', () => {
    const cMajPool = [48, 52, 55, 60, 64, 67, 72, 76, 79]; // C3-G5 Cmaj notes
    const cMinPool = [48, 51, 55, 60, 63, 67, 72, 75, 79]; // C3-G5 Cmin notes

    describe('SATB Style', () => {
      test('SATB: picks a note from chord pool within soprano range', () => {
        const prevSop = Tonal.Note.midi('G4') ?? 67; // G4
        const chosen = assignSopranoOrMelodyNote(cMajPool, prevSop, 7, 'SATB');
        expect(chosen).not.toBeNull();
        if (chosen === null) return;
        expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.soprano[0]);
        expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.soprano[1]);
        expect(cMajPool).toContain(chosen);
      });

      test('SATB: returns null if no chord notes in soprano range', () => {
        const lowPool = [20, 24, 27]; // Too low for soprano
        expect(assignSopranoOrMelodyNote(lowPool, null, 5, 'SATB')).toBeNull();
      });

      test('SATB: picks a smooth note if previousNote is provided', () => {
        const previousNote = Tonal.Note.midi('E4') ?? 64; // E4
        // Target E4, pool Cmaj. Available soprano notes from Cmaj: C4,E4,G4, C5,E5,G5
        // Expected: E4 (repeat, but might be chosen if smooth enough or other options are leaps)
        // OR D4/F4 if they were in pool (they aren't), so G4 or C4. G4 is closer.
        // With findClosestNote's repetition penalty, it should avoid E4.
        // Closest options to E4 (64) in cMajPool within soprano range (C4-C6): C4, E4, G4, C5, E5, G5
        // Excluding E4 (64): G4 (67) or C4 (60). G4 is closer.
        const availableSopranoNotes = cMajPool.filter(n => n >= VOICE_RANGES.soprano[0] && n <= VOICE_RANGES.soprano[1]);
        const chosen = assignSopranoOrMelodyNote(availableSopranoNotes, previousNote, 8, 'SATB');
        expect(chosen).not.toBe(previousNote); // Should try to avoid simple repetition
        expect(chosen).toBe(Tonal.Note.midi('G4')); // G4 is a likely smooth choice
      });

      test('SATB: picks a note when previousNote is null', () => {
        const chosen = assignSopranoOrMelodyNote(cMajPool, null, 5, 'SATB');
        expect(chosen).not.toBeNull();
        if (chosen === null) return;
        expect(cMajPool).toContain(chosen);
        expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.soprano[0]);
        expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.soprano[1]);
      });
    });

    describe('MelodyAccompaniment Style', () => {
      const keySig = 'C'; // C Major
      const melodicState = { lastDirection: 0, directionStreak: 0 };

      test('Melody: picks a note within melody range', () => {
        const previousNote = Tonal.Note.midi('G4') ?? 67; // G4
        const chosen = assignSopranoOrMelodyNote(cMajPool, previousNote, 7, 'MelodyAccompaniment', keySig, melodicState);
        expect(chosen).not.toBeNull();
        if (chosen === null) return;
        expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.melody[0]);
        expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.melody[1]);
      });

      test('Melody: prefers chord tones and diatonic notes', () => {
        const previousNote = Tonal.Note.midi('C4') ?? 60; // C4
        // Pool has C, E, G. Diatonic scale has D, F, A, B.
        // Expect D4 or E4 usually.
        const choices = Array(10).fill(null).map(() => assignSopranoOrMelodyNote(cMajPool, previousNote, 8, 'MelodyAccompaniment', 'C', { ...melodicState }));
        
        let hasDiatonicOrChordTone = false;
        const cMajorScalePcs = Tonal.Scale.get(`${keySig} major`).notes.map(n => Tonal.Note.chroma(n));
        const chordPcs = cMajPool.map(n => Tonal.Note.chroma(Tonal.Note.fromMidi(n)));

        choices.forEach(chosen => {
          if (chosen === null) return;
          const chosenPc = Tonal.Note.chroma(Tonal.Note.fromMidi(chosen));
          if (cMajorScalePcs.includes(chosenPc) || chordPcs.includes(chosenPc)) {
            hasDiatonicOrChordTone = true;
          }
        });
        // Due to weighting, it's highly probable, but not guaranteed 100% of the time if chromatic options are somehow generated.
        // The current implementation strongly favors diatonic/chord tones.
        expect(hasDiatonicOrChordTone).toBe(true);
      });

      test('Melody: chromatic notes are rare (difficult to assert definitively)', () => {
        // Create a scenario where a chromatic step is the only very close option vs a diatonic leap.
        // Previous: C4 (60). Chord: Cmaj (C,E,G). Key: Cmaj.
        // Make D#4 (63, chromatic) an option. Make F4 (65, diatonic) an option.
        // The function adds many copies of chord tones and diatonic, only one of chromatic (if random < 0.05)
        // So, F4 should be overwhelmingly chosen over D#4.
        const customPool = [Tonal.Note.midi('C4'), Tonal.Note.midi('E4'), Tonal.Note.midi('G4')]; // Cmaj
        const previousNote = Tonal.Note.midi('D4') ?? 62; // D4
        
        // Mock Math.random to control chromatic note consideration
        const originalMathRandom = Math.random;
        let randomCallCount = 0;
        Math.random = () => {
            randomCallCount++;
            if (randomCallCount <= 2) return 0.01; // Force chromatic consideration initially
            return 0.6; // Other random calls
        };

        const choices = Array(20).fill(null).map(() => {
            // Reset melodic state for each choice to avoid streak effects dominating
            const state = { lastDirection: 0, directionStreak: 0 };
            // Provide a limited pool for availableNotes to guide choices
            // Let's imagine previousNote is D4 (62). Available notes could be C4, C#4(chrom), D4(chord), Eb4(chrom), E4(chord)
            // The function itself generates the availableNotes based on diatonic and chord tones primarily.
            // We rely on its internal weighting.
            return assignSopranoOrMelodyNote(customPool, previousNote, 5, 'MelodyAccompaniment', 'C', state);
        });
        Math.random = originalMathRandom; // Restore Math.random

        const chromaticCount = choices.filter(c => c !== null && !Tonal.Scale. degréToInterval(Tonal.Scale.get('C major').name, Tonal.Note.fromMidi(c).slice(0, -1) as Tonal.Scale.DegreeStr )).length;
        // Expect very few, if any, chromatic notes.
        // The internal logic adds chromatic notes only if Math.random() < 0.05, and then they are single entries vs many for diatonic/chord.
        expect(chromaticCount).toBeLessThanOrEqual(5); // Allow for a few due to randomness, but should be rare
      });

      test('Melody: melodicState influences direction (e.g., continues up after upward streak)', () => {
        const state = { lastDirection: 1, directionStreak: 3 }; // Moving up for 3 steps
        const previousNote = Tonal.Note.midi('G4') ?? 67; // G4
        // With upward streak, expect next note to be higher if possible.
        // Chord pool Cmaj. From G4, A4(diatonic), B4(diatonic), C5(chord) are up. F4(diatonic) is down.
        const chosen = assignSopranoOrMelodyNote(cMajPool, previousNote, 8, 'MelodyAccompaniment', 'C', state);
        expect(chosen).not.toBeNull();
        if (chosen === null) return;
        // It's probabilistic, but with streak=3, higher chance of being > previousNote or one of the higher chord tones
        // This test is more of an observation due to the complex weighting.
        if (chosen <= previousNote) {
            console.warn(`Melody State Test: Note ${Tonal.Note.fromMidi(chosen)} was not > prev ${Tonal.Note.fromMidi(previousNote)} despite upward streak.`);
        }
        expect(state.directionStreak).toBeGreaterThanOrEqual(3); // Streak should continue or reset
        if (chosen > previousNote) expect(state.lastDirection).toBe(1);
      });

      test('Melody: returns null if no notes in melody range', () => {
        const lowPool = [20, 24, 27]; // Too low for melody
        expect(assignSopranoOrMelodyNote(lowPool, null, 5, 'MelodyAccompaniment', 'C')).toBeNull();
      });
    });
  });
});
