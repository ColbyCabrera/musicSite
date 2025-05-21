// app/lib/harmonyUtils.test.ts
import {
  getChordInfoFromRoman,
  midiToNoteName,
  getExtendedChordNotePool,
} from './harmonyUtils'; // Adjust path as necessary
import * as Tonal from 'tonal';

describe('harmonyUtils', () => {
  describe('getChordInfoFromRoman', () => {
    // Helper to sort MIDI notes for consistent comparison
    const sortMidi = (notes: number[]) => [...notes].sort((a, b) => a - b);

    // C Major Tests
    describe('C Major Key', () => {
      const key = 'C';
      it('should return correct info for I in C', () => {
        const result = getChordInfoFromRoman('I', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('CM').notes.map(Tonal.Note.midi)));
        expect(result.noteNames).toEqual(expect.arrayContaining(['C3', 'E3', 'G3'])); // Octave might vary based on implementation default
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for V7 in C', () => {
        const result = getChordInfoFromRoman('V7', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G7').notes.map(Tonal.Note.midi)));
        expect(result.noteNames).toEqual(expect.arrayContaining(['G3', 'B3', 'D4', 'F4']));
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for ii6 in C', () => {
        const result = getChordInfoFromRoman('ii6', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Dm').notes.map(Tonal.Note.midi)));
        expect(result.noteNames).toEqual(expect.arrayContaining(['D3', 'F3', 'A3']));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('F')); // Dm/F -> F is bass
      });

      it('should return correct info for IV64 in C', () => {
        const result = getChordInfoFromRoman('IV64', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('FM').notes.map(Tonal.Note.midi)));
        expect(result.noteNames).toEqual(expect.arrayContaining(['F3', 'A3', 'C4']));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('C')); // FM/C -> C is bass
      });

       it('should return correct info for V/5 in C (slash notation for root V)', () => {
        const result = getChordInfoFromRoman('V/5', key); // G/D
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('D'));
      });

      it('should return correct info for viidim7 in C', () => { // vii°7
        const result = getChordInfoFromRoman('vii°7', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Bdim7').notes.map(Tonal.Note.midi)));
         expect(result.noteNames).toEqual(expect.arrayContaining(['B2', 'D3', 'F3', 'Ab3']));
        expect(result.requiredBassPc).toBeNull();
      });

       it('should return correct info for Imaj7 in C', () => {
        const result = getChordInfoFromRoman('Imaj7', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Cmaj7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });
    });

    // A Minor Tests
    describe('A Minor Key', () => {
      const key = 'Am';
      it('should return correct info for i in Am', () => {
        const result = getChordInfoFromRoman('i', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Am').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for V7 in Am (harmonic minor)', () => {
        const result = getChordInfoFromRoman('V7', key); // E7 in Am
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('E7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for iiø7 in Am', () => { // Bm7b5
        const result = getChordInfoFromRoman('iiø7', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Bm7b5').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for iv6 in Am', () => { // Dm/F# - careful, Dm in Am is D F A. iv6 is Dm/F
        const result = getChordInfoFromRoman('iv6', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Dm').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('F'));
      });

      it('should return correct info for VII in Am (natural minor G major)', () => {
        const result = getChordInfoFromRoman('VII', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });

       it('should return correct info for vii°7 in Am (harmonic minor G#dim7)', () => {
        const result = getChordInfoFromRoman('vii°7', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G#dim7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull();
      });

      it('should return correct info for V42 in Am (E7/D)', () => {
        const result = getChordInfoFromRoman('V42', key);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('E7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('D'));
      });
    });

    // Figured Bass and Slash Notation Tests
    describe('Inversion Notations', () => {
      it('should handle V65 in C (G7/B)', () => {
        const result = getChordInfoFromRoman('V65', 'C');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('B'));
      });

      it('should handle ii43 in C (Dm7/A)', () => {
        const result = getChordInfoFromRoman('ii43', 'C');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Dm7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('A'));
      });
      
      it('should handle IV/5 in G (C/G)', () => {
        const result = getChordInfoFromRoman('IV/5', 'G');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('C').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBe(Tonal.Note.chroma('G'));
      });
    });
    
    // Qualities
     describe('Chord Qualities', () => {
      it('should handle i in Dm (Dm)', () => {
        const result = getChordInfoFromRoman('i', 'Dm');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Dm').notes.map(Tonal.Note.midi)));
      });
      it('should handle I in D (D)', () => {
        const result = getChordInfoFromRoman('I', 'D');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('D').notes.map(Tonal.Note.midi)));
      });
       it('should handle ii° in C (Ddim)', () => { // This is non-diatonic in C major, but tests quality override
        const result = getChordInfoFromRoman('ii°', 'C');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Ddim').notes.map(Tonal.Note.midi)));
      });
       it('should handle III+ in C (Eaug)', () => { // This is non-diatonic
        const result = getChordInfoFromRoman('III+', 'C');
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('Eaug').notes.map(Tonal.Note.midi)));
      });
    });

    // Applied/Secondary Dominants (Optional - depends on function's design)
    // Assuming the function does NOT currently support V/V syntax directly in the Roman numeral input.
    // These would typically be handled by pre-processing the Roman numeral string if needed.
    // For now, we'll test simple cases that might be interpreted if such syntax were partially supported.
    describe('Applied Dominants (Limited Scope based on current function)', () => {
      it('V7/V in C (D7 chord, should resolve to G). Test expects D7 if directly parsed.', () => {
        // Current function likely won't parse "V7/V". It would need to see "II7" or "D7" as input for C major context.
        // Or, if it tries to interpret V of G (which is D), then add a 7th.
        // This tests how it handles a more complex, potentially non-diatonic dominant.
        // Let's test what happens if we ask for "II7" in C, which is D7 (V7/V)
        const result = getChordInfoFromRoman('II7', 'C'); // D7 is the V7 of G (V in C)
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('D7').notes.map(Tonal.Note.midi))); // D F# A C
        expect(result.requiredBassPc).toBeNull();
      });
    });

    // Edge Cases
    describe('Edge Cases', () => {
      it('should return null for invalid Roman numeral "XYZ"', () => {
        expect(getChordInfoFromRoman('XYZ', 'C')).toBeNull();
      });
      it('should return null for invalid key "XyzMaj"', () => {
        expect(getChordInfoFromRoman('I', 'XyzMaj')).toBeNull();
      });
      it('should return null for Roman numeral out of bounds "VIII"', () => {
        expect(getChordInfoFromRoman('VIII', 'C')).toBeNull();
      });
       it('should return null for empty Roman numeral ""', () => {
        expect(getChordInfoFromRoman('', 'C')).toBeNull();
      });
       it('should handle root position 7th chord with explicit "7" figure (e.g. V7 in C)', () => {
        const result = getChordInfoFromRoman('V7', 'C'); // Same as V7
        expect(result).not.toBeNull();
        if (!result) return;
        expect(sortMidi(result.notes)).toEqual(sortMidi(Tonal.Chord.get('G7').notes.map(Tonal.Note.midi)));
        expect(result.requiredBassPc).toBeNull(); // Explicit 7 is root position
      });
    });
  });

  describe('midiToNoteName', () => {
    it('should convert valid MIDI numbers to note names', () => {
      expect(midiToNoteName(60)).toBe('C4');
      expect(midiToNoteName(69)).toBe('A4');
      expect(midiToNoteName(72)).toBe('C5');
      expect(midiToNoteName(48)).toBe('C3');
       expect(midiToNoteName(61)).toBe('C#4');
    });

    it('should return null for null input', () => {
      expect(midiToNoteName(null)).toBeNull();
    });

    it('should return null for out-of-range MIDI numbers', () => {
      expect(midiToNoteName(-1)).toBeNull();
      expect(midiToNoteName(128)).toBeNull();
    });
  });

  describe('getExtendedChordNotePool', () => {
    it('should create an extended pool for C major triad', () => {
      const cMajorRootPosMidi = Tonal.Chord.get('CM').notes.map(Tonal.Note.midi); // e.g., [48, 52, 55] or [60, 64, 67]
      const pool = getExtendedChordNotePool(cMajorRootPosMidi);
      
      // Check for notes from different octaves
      expect(pool).toEqual(expect.arrayContaining(cMajorRootPosMidi)); // Original octave
      
      const c3Midi = Tonal.Note.midi('C3'); // 48
      const e3Midi = Tonal.Note.midi('E3'); // 52
      const g3Midi = Tonal.Note.midi('G3'); // 55
      const c4Midi = Tonal.Note.midi('C4'); // 60
      const e4Midi = Tonal.Note.midi('E4'); // 64
      const g4Midi = Tonal.Note.midi('G4'); // 67
      const c5Midi = Tonal.Note.midi('C5'); // 72
      const e5Midi = Tonal.Note.midi('E5'); // 76
      const g5Midi = Tonal.Note.midi('G5'); // 79

      if (c3Midi) expect(pool).toContain(c3Midi);
      if (e3Midi) expect(pool).toContain(e3Midi);
      if (g3Midi) expect(pool).toContain(g3Midi);
      if (c4Midi) expect(pool).toContain(c4Midi);
      if (e4Midi) expect(pool).toContain(e4Midi);
      if (g4Midi) expect(pool).toContain(g4Midi);
      if (c5Midi) expect(pool).toContain(c5Midi);
      if (e5Midi) expect(pool).toContain(e5Midi);
      if (g5Midi) expect(pool).toContain(g5Midi);


      // Verify all notes in the pool belong to C, E, or G
      pool.forEach(noteMidi => {
        const noteName = Tonal.Note.fromMidi(noteMidi);
        expect(['C', 'E', 'G']).toContain(Tonal.Note.pitchClass(noteName));
      });
      // Check it's sorted
      expect([...pool].sort((a,b) => a-b)).toEqual(pool);
    });

    it('should return an empty array for an empty input array', () => {
      expect(getExtendedChordNotePool([])).toEqual([]);
    });

    it('should filter notes outside reasonable piano range (21-108)', () => {
      const lowChord = [10, 14, 17]; // Way too low
      const highChord = [110, 114, 117]; // Way too high
      const poolLow = getExtendedChordNotePool(lowChord);
      const poolHigh = getExtendedChordNotePool(highChord);
      const poolMixed = getExtendedChordNotePool([30, 100, 120]);

      poolLow.forEach(note => expect(note).toBeGreaterThanOrEqual(21));
      poolHigh.forEach(note => expect(note).toBeLessThanOrEqual(108));
      
      expect(poolMixed).toContain(30); // 30 + 0*12 = 30
      expect(poolMixed).toContain(42); // 30 + 1*12 = 42
      expect(poolMixed).toContain(100); // 100 + 0*12 = 100
      expect(poolMixed).not.toContain(120); // 120 is out of range
      expect(poolMixed).not.toContain(112); // 100 + 1*12 = 112 (out of range)
      expect(poolMixed).toContain(88); // 100 - 1*12 = 88
    });
  });
});
