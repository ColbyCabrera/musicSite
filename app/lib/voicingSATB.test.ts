// app/lib/voicingSATB.test.ts
import { assignBassNoteSATB, assignInnerVoicesSATB } from './voicingSATB';
import { VOICE_RANGES, VOICE_SPACING_LIMIT_SATB, DEFAULT_OCTAVE } from './constants';
import { getExtendedChordNotePool, midiToNoteName } from './harmonyUtils';
import * as Tonal from 'tonal';
import { KeyDetails } from './types';

describe('voicingSATB', () => {
  // Helper to create a basic KeyDetails object for testing
  const createKeyDetails = (tonic: string, type: 'major' | 'minor'): KeyDetails => {
    const details = type === 'major' ? Tonal.Key.majorKey(tonic) : Tonal.Key.minorKey(tonic);
    if (!details) throw new Error(`Test setup: Invalid key ${tonic} ${type}`);
    return details;
  };

  // C Major chord (C E G) - MIDI notes for C4 E4 G4
  const cMajorRootMidi = Tonal.Note.midi('C4') ?? 60;
  const cMajorPcs = (Tonal.Chord.get('C').notes as string[]).map(Tonal.Note.chroma);
  const cMajorPool = getExtendedChordNotePool([cMajorRootMidi, Tonal.Note.midi('E4')??64, Tonal.Note.midi('G4')??67]);

  // G Major chord (G B D) - MIDI notes for G3 B3 D4
  const gMajorRootMidi = Tonal.Note.midi('G3') ?? 55;
  const gMajorPcs = (Tonal.Chord.get('G').notes as string[]).map(Tonal.Note.chroma);
  const gMajorPool = getExtendedChordNotePool([gMajorRootMidi, Tonal.Note.midi('B3')??59, Tonal.Note.midi('D4')??62]);
  
  // D minor chord (D F A) - MIDI notes for D4 F4 A4
  const dMinorRootMidi = Tonal.Note.midi('D4') ?? 62;
  const dMinorPcs = (Tonal.Chord.get('Dm').notes as string[]).map(Tonal.Note.chroma);
  const dMinorPool = getExtendedChordNotePool([dMinorRootMidi, Tonal.Note.midi('F4')??65, Tonal.Note.midi('A4')??69]);


  describe('assignBassNoteSATB', () => {
    test('Root Position: picks root from pool within range', () => {
      const prevBass = Tonal.Note.midi('G2') ?? 43; // G2
      const chosen = assignBassNoteSATB(null, cMajorRootMidi, cMajorPool, prevBass, 5);
      expect(chosen).not.toBeNull();
      if (!chosen) return;
      expect(Tonal.Note.chroma(Tonal.Note.fromMidi(chosen))).toBe(Tonal.Note.chroma('C'));
      expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.bass[0]);
      expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.bass[1]);
      // Expect C3 (48) as it's a common choice from G2
      expect(chosen).toBe(Tonal.Note.midi('C3'));
    });

    test('Root Position: no previous note, picks a root note', () => {
      const chosen = assignBassNoteSATB(null, gMajorRootMidi, gMajorPool, null, 5);
      expect(chosen).not.toBeNull();
      if (!chosen) return;
      expect(Tonal.Note.chroma(Tonal.Note.fromMidi(chosen))).toBe(Tonal.Note.chroma('G'));
      expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.bass[0]);
      expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.bass[1]);
    });

    test('Inversion: picks 1st inversion (3rd in bass)', () => {
      const requiredPc = Tonal.Note.chroma('E'); // 3rd of C major
      const prevBass = Tonal.Note.midi('C3') ?? 48;
      const chosen = assignBassNoteSATB(requiredPc, cMajorRootMidi, cMajorPool, prevBass, 7);
      expect(chosen).not.toBeNull();
      if (!chosen) return;
      expect(Tonal.Note.chroma(Tonal.Note.fromMidi(chosen))).toBe(requiredPc);
      expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.bass[0]);
      expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.bass[1]);
       // Expect E3 (52) or E2 (40)
      expect([Tonal.Note.midi('E2'), Tonal.Note.midi('E3')]).toContain(chosen);
    });

    test('Inversion: picks 2nd inversion (5th in bass)', () => {
      const requiredPc = Tonal.Note.chroma('G'); // 5th of C major
      const prevBass = Tonal.Note.midi('E2') ?? 40;
      const chosen = assignBassNoteSATB(requiredPc, cMajorRootMidi, cMajorPool, prevBass, 7);
      expect(chosen).not.toBeNull();
      if (!chosen) return;
      expect(Tonal.Note.chroma(Tonal.Note.fromMidi(chosen))).toBe(requiredPc);
      expect(chosen).toBeGreaterThanOrEqual(VOICE_RANGES.bass[0]);
      expect(chosen).toBeLessThanOrEqual(VOICE_RANGES.bass[1]);
      // Expect G2 (43)
      expect(chosen).toBe(Tonal.Note.midi('G2'));
    });

    test('Inversion: required PC not in bass range, falls back to root', () => {
      const requiredPc = Tonal.Note.chroma('E'); // E
      const eOnlyLowPool = getExtendedChordNotePool([Tonal.Note.midi('E1')??28, Tonal.Note.midi('G1')??31, Tonal.Note.midi('C2')??36]); // E1 is too low
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const chosen = assignBassNoteSATB(requiredPc, Tonal.Note.midi('C2')??36, eOnlyLowPool, null, 5);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Required inversion PC ${requiredPc} not found in bass range`));
      expect(chosen).not.toBeNull();
      if (!chosen) return;
      expect(Tonal.Note.chroma(Tonal.Note.fromMidi(chosen))).toBe(Tonal.Note.chroma('C')); // Falls back to C2
      consoleWarnSpy.mockRestore();
    });
    
    test('Smoothness: High smoothness prefers closer notes', () => {
        // Target G2 (43). Previous C2 (36). Allowed G2(43), C3(48)
        // G2 is closer to target. C3 is smoother from C2.
        // The target is calculated based on previous note if available.
        // prev C2 (36), target will be around B1 (35).
        // Allowed from Cmaj: C2(36), E2(40), G2(43), C3(48), E3(52), G3(55)
        // Closest to 35 is C2(36). With smoothness, E2(40) or G2(43) might be chosen.
        // findClosestNote has repetition penalty, so C2 (36) should be less likely.
        // Between E2 (40) and G2 (43), E2 is closer (interval 4 vs 7 from C2)
        const prevBass = Tonal.Note.midi('C2') ?? 36;
        const chosen = assignBassNoteSATB(null, cMajorRootMidi, cMajorPool, prevBass, 10); // High smoothness
        expect(chosen).toBe(Tonal.Note.midi('E2')); // E2 is a smooth step
    });

    test('Edge: No notes in bass range returns null', () => {
      const highPool = getExtendedChordNotePool([Tonal.Note.midi('C5')??72, Tonal.Note.midi('E5')??76, Tonal.Note.midi('G5')??79]);
      expect(assignBassNoteSATB(null, Tonal.Note.midi('C5')??72, highPool, null, 5)).toBeNull();
    });

    test('Edge: Empty chordNotesPool returns null', () => {
      expect(assignBassNoteSATB(null, cMajorRootMidi, [], null, 5)).toBeNull();
    });
  });

  describe('assignInnerVoicesSATB', () => {
    const cMajKeyDetails = createKeyDetails('C', 'major');
    const aMinKeyDetails = createKeyDetails('Am', 'minor');

    // Soprano C5 (72), Bass C3 (48) for C Major chord
    const soprano1 = Tonal.Note.midi('C5') ?? 72;
    const bass1 = Tonal.Note.midi('C3') ?? 48;
    // Alto/Tenor previous notes
    const prevAlto1 = Tonal.Note.midi('G4') ?? 67;
    const prevTenor1 = Tonal.Note.midi('E4') ?? 64;

    test('Basic Voicing: C Major chord, S=C5, B=C3', () => {
      const { tenorNoteMidi, altoNoteMidi } = assignInnerVoicesSATB(
        cMajorPcs, cMajorPool, prevTenor1, prevAlto1, soprano1, bass1, 7, cMajKeyDetails
      );
      expect(altoNoteMidi).not.toBeNull();
      expect(tenorNoteMidi).not.toBeNull();
      if (!altoNoteMidi || !tenorNoteMidi) return;

      expect(altoNoteMidi).toBeGreaterThan(tenorNoteMidi); // Alto above Tenor
      expect(cMajorPool).toContain(altoNoteMidi);
      expect(cMajorPool).toContain(tenorNoteMidi);
      expect(altoNoteMidi).toBeGreaterThanOrEqual(VOICE_RANGES.alto[0]);
      expect(altoNoteMidi).toBeLessThanOrEqual(VOICE_RANGES.alto[1]);
      expect(tenorNoteMidi).toBeGreaterThanOrEqual(VOICE_RANGES.tenor[0]);
      expect(tenorNoteMidi).toBeLessThanOrEqual(VOICE_RANGES.tenor[1]);

      expect(soprano1 - altoNoteMidi).toBeLessThanOrEqual(VOICE_SPACING_LIMIT_SATB.soprano_alto);
      expect(altoNoteMidi - tenorNoteMidi).toBeLessThanOrEqual(VOICE_SPACING_LIMIT_SATB.alto_tenor);
      expect(tenorNoteMidi - bass1).toBeLessThanOrEqual(VOICE_SPACING_LIMIT_SATB.tenor_bass);
      // Expected: Alto G4 (67), Tenor E4 (64) -> based on previous notes
      expect(altoNoteMidi).toBe(prevAlto1);
      expect(tenorNoteMidi).toBe(prevTenor1);
    });

    test('Doubling: Avoid doubling leading tone (B in C Major)', () => {
      // Chord G7 (G B D F). Soprano F5 (77), Bass G2 (43). Key C Maj.
      // Leading tone is B. Inner voices should fill B and D.
      // If B or D are already S/B, then doubling of G or D (if B is LT).
      const g7Pcs = (Tonal.Chord.get('G7').notes as string[]).map(Tonal.Note.chroma);
      const g7Pool = getExtendedChordNotePool(Tonal.Chord.get('G7').notes.map(n => Tonal.Note.midi(n+'3'))); // Base G7 around G3
      const sopranoG7 = Tonal.Note.midi('F5') ?? 77; // F5
      const bassG7 = Tonal.Note.midi('G2') ?? 43;   // G2
      const prevAltoG7 = Tonal.Note.midi('D4') ?? 62; // D4
      const prevTenorG7 = Tonal.Note.midi('B3') ?? 59; // B3 (leading tone)

      const { tenorNoteMidi, altoNoteMidi } = assignInnerVoicesSATB(
        g7Pcs, g7Pool, prevTenorG7, prevAltoG7, sopranoG7, bassG7, 7, cMajKeyDetails
      );
      expect(altoNoteMidi).not.toBeNull();
      expect(tenorNoteMidi).not.toBeNull();
      if (!altoNoteMidi || !tenorNoteMidi) return;

      // Expected: Alto D4 (62), Tenor B3 (59)
      // Tonal.Note.chroma('B') is 11. Tonal.Note.chroma(Tonal.Note.fromMidi(prevTenorG7)) is 11.
      // The doubling logic should avoid making B too prominent if it's the LT.
      // In G7 (V7 in C), B is the 3rd. D is 5th. F is 7th. G is root.
      // S=F, B=G. Need B, D. Targets are B, D.
      // Alto likely D4, Tenor likely B3.
      expect(midiToNoteName(altoNoteMidi)).toBe('D4');
      expect(midiToNoteName(tenorNoteMidi)).toBe('B3');
      // Ensure LT (B) is not doubled if other options exist.
      // Here, S=F, B=G, A=D, T=B. PCs: F(5), G(7), D(2), B(11). All unique chord tones. No doubling needed.
    });
    
    test('Doubling: Root preferred for doubling if needed', () => {
      // C Major chord (C E G). Soprano G4 (67), Bass C3 (48).
      // PCs covered: G, C. Need E. One voice must double. Should double C (root) or G (5th).
      const sopranoC = Tonal.Note.midi('G4') ?? 67;
      const bassC = Tonal.Note.midi('C3') ?? 48;
      const prevAltoC = Tonal.Note.midi('E4') ?? 64;
      const prevTenorC = Tonal.Note.midi('C4') ?? 60; // Doubled root

      const { tenorNoteMidi, altoNoteMidi } = assignInnerVoicesSATB(
        cMajorPcs, cMajorPool, prevTenorC, prevAltoC, sopranoC, bassC, 7, cMajKeyDetails
      );
      expect(altoNoteMidi).not.toBeNull();
      expect(tenorNoteMidi).not.toBeNull();
      if (!altoNoteMidi || !tenorNoteMidi) return;
      // Expected: Alto E4 (64), Tenor C4 (60)
      expect(midiToNoteName(altoNoteMidi)).toBe('E4');
      expect(midiToNoteName(tenorNoteMidi)).toBe('C4');
      
      const altoPc = Tonal.Note.chroma(Tonal.Note.fromMidi(altoNoteMidi));
      const tenorPc = Tonal.Note.chroma(Tonal.Note.fromMidi(tenorNoteMidi));
      // One of them should be E. The other should be C or G.
      expect([altoPc, tenorPc]).toContain(Tonal.Note.chroma('E'));
      const doubledNotePc = altoPc === Tonal.Note.chroma('E') ? tenorPc : altoPc;
      expect([Tonal.Note.chroma('C'), Tonal.Note.chroma('G')]).toContain(doubledNotePc);
    });

    test('Edge: Soprano or Bass is null, returns nulls', () => {
      const { tenorNoteMidi, altoNoteMidi } = assignInnerVoicesSATB(
        cMajorPcs, cMajorPool, prevTenor1, prevAlto1, null, bass1, 7, cMajKeyDetails
      );
      expect(tenorNoteMidi).toBeNull();
      expect(altoNoteMidi).toBeNull();

      const result2 = assignInnerVoicesSATB(
        cMajorPcs, cMajorPool, prevTenor1, prevAlto1, soprano1, null, 7, cMajKeyDetails
      );
      expect(result2.tenorNoteMidi).toBeNull();
      expect(result2.altoNoteMidi).toBeNull();
    });

    test('Edge: Very restricted pool leading to nulls (e.g. only two notes far apart for S/B)', () => {
        const veryRestrictedPool = [Tonal.Note.midi('C3')??48, Tonal.Note.midi('C6')??84]; // Only C3 and C6
        const sopranoHighC = Tonal.Note.midi('C6') ?? 84;
        const bassLowC = Tonal.Note.midi('C3') ?? 48;
        // Chord PCs are just C. S=C, B=C. Need to double C twice for inner voices.
        // Alto must be < C6 and > C3. Tenor must be < Alto and > C3.
        // No notes available in the pool between C3 and C6.
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const { tenorNoteMidi, altoNoteMidi } = assignInnerVoicesSATB(
            [Tonal.Note.chroma('C')], // Chord is just C
            veryRestrictedPool, 
            null, null, 
            sopranoHighC, bassLowC, 
            5, cMajKeyDetails
        );
        // The internal logic will try to find notes.
        // _assignSingleInnerVoice will return null if candidateNotes is empty.
        expect(altoNoteMidi).toBeNull();
        expect(tenorNoteMidi).toBeNull();
        // Check for specific console messages if desired, e.g. "No notes in range satisfy all constraints"
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("No notes in range satisfy all constraints initially"));
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });
  });
});
