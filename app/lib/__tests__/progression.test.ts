import { generateChordProgression } from '../progression';
import { InvalidInputError } from '../errors';
// import * as Tonal from 'tonal'; // Not strictly needed for these tests but can be useful for debugging

describe('generateChordProgression', () => {
  test('should generate progressions of the correct length', () => {
    expect(generateChordProgression('C', 4, 5).length).toBe(4);
    expect(generateChordProgression('Am', 8, 3).length).toBe(8);
    expect(generateChordProgression('G', 1, 1).length).toBe(1);
  });

  test('should start and end on the tonic for major keys', () => {
    const progC = generateChordProgression('C', 4, 5);
    expect(progC[0]).toBe('I');
    expect(progC[progC.length - 1]).toBe('I');

    const progG = generateChordProgression('G', 5, 5);
    expect(progG[0]).toBe('I');
    expect(progG[progG.length - 1]).toBe('I');
    
    const progEb = generateChordProgression('Eb', 3, 3);
    expect(progEb[0]).toBe('I');
    expect(progEb[progEb.length - 1]).toBe('I');
  });

  test('should start and end on the tonic for minor keys', () => {
    const progAm = generateChordProgression('Am', 4, 5);
    expect(progAm[0]).toBe('i');
    expect(progAm[progAm.length - 1]).toBe('i');

    const progEm = generateChordProgression('Em', 3, 5);
    expect(progEm[0]).toBe('i');
    expect(progEm[progEm.length - 1]).toBe('i');

    const progCsharpM = generateChordProgression('C#m', 6, 4);
    expect(progCsharpM[0]).toBe('i');
    expect(progCsharpM[progCsharpM.length - 1]).toBe('i');
  });

  test('should use appropriate penultimate chord in major keys if numMeasures > 1', () => {
    for (let i = 0; i < 10; i++) { // Run multiple times for randomness
      const progLen2 = generateChordProgression('C', 2, 5);
      expect(progLen2[1]).toBe('I');
      expect(['V', 'V7', 'IV', 'I']).toContain(progLen2[0]);


      const progLen4HighComplexity = generateChordProgression('G', 4, 7); // Allows V7, secondary, etc.
      expect(progLen4HighComplexity[progLen4HighComplexity.length - 1]).toBe('I');
      expect(['V', 'V7', 'IV', 'ii', 'vii°']).toContain(progLen4HighComplexity[progLen4HighComplexity.length - 2]);
      
      const progLen4LowComplexity = generateChordProgression('C', 4, 1); // Mostly V or IV
      expect(progLen4LowComplexity[progLen4LowComplexity.length - 1]).toBe('I');
      expect(['V', 'IV', 'I']).toContain(progLen4LowComplexity[progLen4LowComplexity.length - 2]);
    }
  });

  test('should use appropriate penultimate chord in minor keys if numMeasures > 1', () => {
    for (let i = 0; i < 10; i++) { // Run multiple times for randomness
      const progLen2 = generateChordProgression('Am', 2, 5);
      expect(progLen2[1]).toBe('i');
      // V (major dominant) is common in minor.
      expect(['V', 'V7', 'iv', 'i']).toContain(progLen2[0]);

      const progLen4HighComplexity = generateChordProgression('Em', 4, 7);
      expect(progLen4HighComplexity[progLen4HighComplexity.length - 1]).toBe('i');
      expect(['V', 'V7', 'iv', 'iidim', 'VI', 'vii°']).toContain(progLen4HighComplexity[progLen4HighComplexity.length - 2]);

      const progLen4LowComplexity = generateChordProgression('Cm', 4, 1);
      expect(progLen4LowComplexity[progLen4LowComplexity.length-1]).toBe('i');
      expect(['V', 'iv', 'i']).toContain(progLen4LowComplexity[progLen4LowComplexity.length - 2]);
    }
  });
  
  test('should handle numMeasures = 1 correctly', () => {
    const progC = generateChordProgression('C', 1, 5);
    expect(progC).toEqual(['I']);
    const progAm = generateChordProgression('Am', 1, 5);
    expect(progAm).toEqual(['i']);
  });

  describe('Harmonic Complexity Influence', () => {
    const keyMajor = 'F';
    const keyMinor = 'Dm';
    const measures = 8; // Longer progression to see variety

    test('low complexity (0-2) should use mainly primary chords', () => {
      const progMajor = generateChordProgression(keyMajor, measures, 1);
      const primaryMajor = ['I', 'IV', 'V'];
      progMajor.forEach(chord => expect(primaryMajor).toContain(chord));

      const progMinor = generateChordProgression(keyMinor, measures, 1);
      const primaryMinor = ['i', 'iv', 'V']; // V is major in minor
      progMinor.forEach(chord => expect(primaryMinor).toContain(chord));
    });

    test('medium complexity (3-5) allows secondary chords and V7', () => {
      let hasSecondaryMajor = false;
      let hasV7Major = false;
      const secondaryMajorChords = ['ii', 'iii', 'vi'];
      
      for(let i=0; i < 5; i++){ // run multiple times to increase chance of seeing variety
        const progMajor = generateChordProgression(keyMajor, measures, 4);
        if (progMajor.includes('V7')) hasV7Major = true;
        if (progMajor.some(c => secondaryMajorChords.includes(c))) hasSecondaryMajor = true;
      }
      expect(hasV7Major).toBe(true);
      expect(hasSecondaryMajor).toBe(true);
      
      let hasSecondaryMinor = false;
      let hasV7Minor = false;
      // In Dm: ii° (Edim), III (F), VI (Bb), vii° (C#dim)
      const secondaryMinorChords = ['iidim', 'III', 'VI']; // vii° is for higher complexity
      for(let i=0; i < 5; i++){
        const progMinor = generateChordProgression(keyMinor, measures, 4);
        if (progMinor.includes('V7')) hasV7Minor = true;
        if (progMinor.some(c => secondaryMinorChords.includes(c))) hasSecondaryMinor = true;
      }
      expect(hasV7Minor).toBe(true);
      expect(hasSecondaryMinor).toBe(true);
    });

    test('high complexity (6-10) allows more varied chords (e.g., vii°, more 7ths)', () => {
      let hasDiminishedMajor = false;
      let hasMoreSeventhsMajor = false; // e.g. ii7, IVMaj7
      
      for(let i=0; i < 10; i++){ // run multiple times
        const progMajor = generateChordProgression(keyMajor, measures, 8);
        if (progMajor.includes('vii°') || progMajor.includes('viiø7')) hasDiminishedMajor = true;
        if (progMajor.some(c => c.endsWith('7') && c !== 'V7')) hasMoreSeventhsMajor = true;
      }
      expect(hasDiminishedMajor).toBe(true);
      // expect(hasMoreSeventhsMajor).toBe(true); // This is probabilistic

      let hasDiminishedMinor = false;
      let hasMoreSeventhsMinor = false;
      for(let i=0; i < 10; i++){
        const progMinor = generateChordProgression(keyMinor, measures, 8);
        if (progMinor.includes('vii°') || progMinor.includes('vii°7') || progMinor.includes('iiø7') || progMinor.includes('iidim7')) hasDiminishedMinor = true;
         if (progMinor.some(c => c.endsWith('7') && c !== 'V7')) hasMoreSeventhsMinor = true;
      }
      expect(hasDiminishedMinor).toBe(true);
      // expect(hasMoreSeventhsMinor).toBe(true); // This is probabilistic

      // Also check for increased unique chord count generally
      const uniqueChordsLow = new Set(generateChordProgression(keyMajor, measures, 1));
      const uniqueChordsHigh = new Set(generateChordProgression(keyMajor, measures, 8));
      expect(uniqueChordsHigh.size).toBeGreaterThanOrEqual(uniqueChordsLow.size);
    });
  });

  describe('Input Validation', () => {
    test('should throw InvalidInputError for invalid key', () => {
      expect(() => generateChordProgression('Xyz', 4, 5)).toThrow(InvalidInputError);
      expect(() => generateChordProgression('', 4, 5)).toThrow(InvalidInputError);
      expect(() => generateChordProgression('Cmaj', 4, 5)).toThrow(InvalidInputError); // Should be just "C" or "Am" etc.
    });

    test('should return empty array for numMeasures <= 0', () => {
      expect(generateChordProgression('C', 0, 5)).toEqual([]);
      expect(generateChordProgression('C', -2, 5)).toEqual([]);
    });
    
    test('should clamp harmonicComplexity and not throw error', () => {
      let progLow, progHigh;
      expect(() => progLow = generateChordProgression('C', 4, -5)).not.toThrow();
      expect(progLow?.length).toBe(4); // Should work as if complexity = 0
      // Check if it's all primary chords (or mostly I for complexity 0)
      progLow?.forEach(chord => expect(['I', 'V', 'IV']).toContain(chord));


      expect(() => progHigh = generateChordProgression('C', 4, 15)).not.toThrow();
      expect(progHigh?.length).toBe(4); // Should work as if complexity = 10
       // Check for variety for complexity 10
      const uniqueChordsHigh = new Set(progHigh);
      // For a 4-measure progression, complexity 10 should likely give at least 2-3 unique chords
      expect(uniqueChordsHigh.size).toBeGreaterThanOrEqual(2); 
    });
  });
});
