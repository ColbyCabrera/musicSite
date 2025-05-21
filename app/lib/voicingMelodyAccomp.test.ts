// app/lib/voicingMelodyAccomp.test.ts
import { generateAccompanimentVoicing } from './voicingMelodyAccomp';
import { VOICE_RANGES, MELODY_ACCOMPANIMENT_SPACING_LIMIT } from './constants';
import { getExtendedChordNotePool, midiToNoteName } from './harmonyUtils';
import * as Tonal from 'tonal';

describe('generateAccompanimentVoicing', () => {
  // C Major chord
  const cMajorRootMidi = Tonal.Note.midi('C4') ?? 60;
  const cMajorPcs = (Tonal.Chord.get('C').notes as string[]).map(Tonal.Note.chroma);
  const cMajorPool = getExtendedChordNotePool([cMajorRootMidi, Tonal.Note.midi('E4')??64, Tonal.Note.midi('G4')??67]);

  // G Major chord
  const gMajorRootMidi = Tonal.Note.midi('G3') ?? 55;
  const gMajorPcs = (Tonal.Chord.get('G').notes as string[]).map(Tonal.Note.chroma);
  const gMajorPool = getExtendedChordNotePool([gMajorRootMidi, Tonal.Note.midi('B3')??59, Tonal.Note.midi('D4')??62]);

  const defaultSmoothness = 5;
  const defaultNumVoices = 3;

  describe('Basic Voicing', () => {
    const melodyC5 = Tonal.Note.midi('C5') ?? 72; // C5
    const previousAccompNull = [null, null, null];

    test('C Major chord, Melody C5, 3 voices', () => {
      const result = generateAccompanimentVoicing(
        melodyC5, cMajorRootMidi, cMajorPcs, cMajorPool, previousAccompNull, defaultSmoothness, defaultNumVoices
      );
      expect(result.length).toBe(defaultNumVoices);

      let previousNoteValue = -1; // for sorted check
      result.forEach(note => {
        if (note === null) return; // Allow nulls if not enough notes found, but basic case should find notes
        expect(cMajorPcs).toContain(Tonal.Note.chroma(Tonal.Note.fromMidi(note)));
        expect(note).toBeGreaterThanOrEqual(VOICE_RANGES.accompaniment[0]);
        expect(note).toBeLessThanOrEqual(VOICE_RANGES.accompaniment[1]);
        expect(note).toBeLessThan(melodyC5);
        if (previousNoteValue !== -1) {
            expect(note).toBeGreaterThanOrEqual(previousNoteValue);
        }
        previousNoteValue = note;
      });

      const highestAccomp = result.filter(n => n !== null).pop() as number | undefined;
      if (highestAccomp !== undefined) {
        expect(melodyC5 - highestAccomp).toBeLessThanOrEqual(MELODY_ACCOMPANIMENT_SPACING_LIMIT);
        expect(melodyC5 - highestAccomp).toBeGreaterThanOrEqual(0); // ensure not above melody
      } else {
        // if all notes are null, this test part doesn't apply.
        // However, for a basic C major chord and C5 melody, we expect non-null notes.
        expect(highestAccomp).not.toBeUndefined(); 
      }
      // Example expected output: [C4, E4, G4] -> [60, 64, 67] or similar
      // Depending on findClosestNote, could be [G3, C4, E4] -> [55, 60, 64]
      // For melody C5 (72), root C4(60). Prev [n,n,n].
      // Bass target ~C3 (48). Lowest in pool for C is C3(48), C4(60). C3 selected.
      // Notes are [48, 60, 64] -> C3, C4, E4
      expect(result[0]).toBe(Tonal.Note.midi('C3')); 
      expect(result[1]).toBe(Tonal.Note.midi('C4'));
      expect(result[2]).toBe(Tonal.Note.midi('E4'));
    });

    test('G Major chord, Melody G4, 3 voices', () => {
      const melodyG4 = Tonal.Note.midi('G4') ?? 67;
      const result = generateAccompanimentVoicing(
        melodyG4, gMajorRootMidi, gMajorPcs, gMajorPool, previousAccompNull, defaultSmoothness, defaultNumVoices
      );
      expect(result.length).toBe(defaultNumVoices);
      result.forEach(note => {
        if (note === null) return;
        expect(gMajorPcs).toContain(Tonal.Note.chroma(Tonal.Note.fromMidi(note)));
        expect(note).toBeLessThan(melodyG4);
      });
      // Melody G4(67). Root G3(55). Prev [n,n,n]. Bass target G2(43).
      // Lowest G in pool: G2(43), G3(55). G2 selected.
      // Notes [43, 55, 59] -> G2, G3, B3
      expect(result[0]).toBe(Tonal.Note.midi('G2'));
      expect(result[1]).toBe(Tonal.Note.midi('G3'));
      expect(result[2]).toBe(Tonal.Note.midi('B3'));
    });
  });

  describe('Smoothness', () => {
    const melodyG4 = Tonal.Note.midi('G4') ?? 67;
    const prevAccomp = [Tonal.Note.midi('G2')??43, Tonal.Note.midi('B2')??47, Tonal.Note.midi('D3')??50]; // Gmaj previous

    test('Picks notes closer to previous accompaniment with high smoothness', () => {
      // Chord Cmaj. Melody G4(67). Prev GBD [43,47,50].
      // Bass target G2(43). Cmaj pool. Lowest C is C2(36) or C3(48). C2 is closer to target.
      // Next target B2(47). Cmaj pool. Closest C,E,G. E3(52) or G2(43 - taken by bass if C2 chosen) or C3(48)
      // Next target D3(50). Cmaj pool. Closest C,E,G. E3(52) or C3(48)
      // If bass is C2(36): Notes could be C2(36), G2(43), C3(48) for smoothness to GBD.
      // Let's test with Cmaj, melody G4. Previous GBD.
      // Bass for Cmaj: target G2(43) or B1(35). Closest C is C2(36) or C3(48).
      // If C2(36) is bass:
      //   Next target B2(47). Available Cmaj > C2: E2(40), G2(43), C3(48), E3(52), G3(55)...
      //   Closest to B2(47) is C3(48) or G2(43).
      //   Next target D3(50). Available Cmaj > prev: E3(52), G3(55)...
      //   Closest to D3(50) is E3(52).
      // Result: [C2(36), G2(43), E3(52)] or [C2(36), C3(48), E3(52)]
      const resultHighSmooth = generateAccompanimentVoicing(
        melodyG4, cMajorRootMidi, cMajorPcs, cMajorPool, prevAccomp, 10, defaultNumVoices
      );
      // Expect notes to be generally close to [43, 47, 50] while being Cmaj chord tones.
      // Bass: C2 (36) is closest to G2 (43) among C notes.
      // Voice 2: Target B2 (47). From Cmaj pool > 36: E2(40), G2(43), C3(48). G2 (43) is closest.
      // Voice 3: Target D3 (50). From Cmaj pool > 43: C3(48), E3(52). C3 (48) is closer.
      // So, [36, 43, 48] -> C2, G2, C3
      expect(resultHighSmooth).toEqual([Tonal.Note.midi('C2'), Tonal.Note.midi('G2'), Tonal.Note.midi('C3')]);
      
      const resultLowSmooth = generateAccompanimentVoicing(
        melodyG4, cMajorRootMidi, cMajorPcs, cMajorPool, prevAccomp, 0, defaultNumVoices
      );
      // With low smoothness, it might pick different notes, less tied to prevAccomp.
      // Bass: C2 (36).
      // Voice 2: Target B2 (47), but less penalty for leaps. Still likely G2(43) or C3(48).
      // Voice 3: Target D3 (50), Still likely C3(48) or E3(52).
      // The outcome can be similar if the closest notes are also the smoothest.
      // The key is that `findClosestNote` behaves differently.
      // This test is more about ensuring it runs and produces valid output.
      // Exact output for low smoothness is harder to predict without deep diving into findClosestNote scoring.
      expect(resultLowSmooth.length).toBe(defaultNumVoices);
      resultLowSmooth.forEach(n => expect(n === null || cMajorPcs.includes(Tonal.Note.chroma(Tonal.Note.fromMidi(n)))).toBe(true));
    });
  });

  describe('Number of Voices', () => {
    const melodyA4 = Tonal.Note.midi('A4') ?? 69;
    test('2 voices', () => {
      const result = generateAccompanimentVoicing(melodyA4, cMajorRootMidi, cMajorPcs, cMajorPool, [null,null], 5, 2);
      expect(result.length).toBe(2);
      expect(result.filter(n => n !== null).length).toBeLessThanOrEqual(2);
    });
    test('4 voices', () => {
      const result = generateAccompanimentVoicing(melodyA4, cMajorRootMidi, cMajorPcs, cMajorPool, [null,null,null,null], 5, 4);
      expect(result.length).toBe(4);
      // Cmaj has 3 PCs. With 4 voices, one note will be doubled or some will be null if pool is small.
      // Pool cMajorPool is large.
      // Bass: C3 (48)
      // V2 target ~E3. E3 (52)
      // V3 target ~G3. G3 (55)
      // V4 target ~C4. C4 (60)
      // Expected: [48, 52, 55, 60] -> C3 E3 G3 C4
      expect(result).toEqual([Tonal.Note.midi('C3'),Tonal.Note.midi('E3'),Tonal.Note.midi('G3'),Tonal.Note.midi('C4')]);
    });
  });

  describe('Limited fullChordNotePool', () => {
    const melodyG4 = Tonal.Note.midi('G4') ?? 67;
    const limitedPool = [Tonal.Note.midi('C3')??48, Tonal.Note.midi('E3')??52]; // Only C3, E3 available below G4

    test('availableNotes.length < numVoices', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = generateAccompanimentVoicing(melodyG4, cMajorRootMidi, cMajorPcs, limitedPool, [null,null,null], 5, 3);
      // Expect warning about not enough notes.
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Accompaniment: Not enough notes (2) in pool for 3-note chord. Using available."));
      // Should return a chord with availableNotes.length notes, others null.
      // Bass target C2(36). Closest in pool is C3(48).
      // Next target E3(52). Closest is E3(52).
      // Result [48, 52, null]
      expect(result.length).toBe(3);
      expect(result.filter(n => n !== null).length).toBe(2);
      expect(result).toEqual([48, 52, null]);
      consoleWarnSpy.mockRestore();
    });

    test('availableNotes.length === 0', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const veryLimitedPool = [Tonal.Note.midi('C5')??72, Tonal.Note.midi('E5')??76]; // All notes >= melody G4
      const result = generateAccompanimentVoicing(melodyG4, cMajorRootMidi, cMajorPcs, veryLimitedPool, [null,null,null], 5, 3);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Accompaniment: No available notes found at all.");
      expect(result).toEqual([null, null, null]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('melodyNoteMidi is null', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = generateAccompanimentVoicing(null, cMajorRootMidi, cMajorPcs, cMajorPool, [null,null,null], 5, 3);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Accompaniment: Cannot generate voicing without melody note.");
      expect(result).toEqual([null, null, null]);
      consoleWarnSpy.mockRestore();
    });

    test('numVoices <= 0', () => {
      expect(generateAccompanimentVoicing(Tonal.Note.midi('C5')??72, cMajorRootMidi, cMajorPcs, cMajorPool, [], 5, 0)).toEqual([]);
      expect(generateAccompanimentVoicing(Tonal.Note.midi('C5')??72, cMajorRootMidi, cMajorPcs, cMajorPool, [], 5, -1)).toEqual([]);
    });

    test('fullChordNotePool is empty', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = generateAccompanimentVoicing(Tonal.Note.midi('C5')??72, cMajorRootMidi, cMajorPcs, [], [null,null,null], 5, 3);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Accompaniment: No available notes found at all.");
      expect(result).toEqual([null, null, null]);
      consoleErrorSpy.mockRestore();
    });

    test('melodyNoteMidi is very low', () => {
      const melodyC3 = Tonal.Note.midi('C3') ?? 48; // Very low melody
      // Most of cMajorPool will be above or too close to C3.
      // Available: only notes < C3 from cMajorPool (e.g. G2, E2, C2 from extended pool)
      // From cMajorPool (C4,E4,G4 extended): C2(36),E2(40),G2(43) are valid below C3(48)
      const result = generateAccompanimentVoicing(melodyC3, cMajorRootMidi, cMajorPcs, cMajorPool, [null,null,null], 5, 3);
      expect(result.length).toBe(3);
      // Bass target C2(36). Closest is C2(36).
      // Next target E2(40). Closest is E2(40).
      // Next target G2(43). Closest is G2(43).
      // Result: [36, 40, 43] -> C2, E2, G2
      expect(result).toEqual([Tonal.Note.midi('C2'), Tonal.Note.midi('E2'), Tonal.Note.midi('G2')]);
      result.forEach(note => {
        if (note === null) return;
        expect(note).toBeLessThan(melodyC3);
      });
    });
  });
});
