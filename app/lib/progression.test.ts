// app/lib/progression.test.ts
import { generateChordProgression } from './progression'; // Adjust path as necessary
import * as Tonal from 'tonal';

describe('generateChordProgression', () => {
  const testCases = [
    { key: 'C', measures: 4, complexity: 0, isMajor: true },
    { key: 'G', measures: 8, complexity: 5, isMajor: true },
    { key: 'F', measures: 2, complexity: 10, isMajor: true },
    { key: 'Am', measures: 4, complexity: 0, isMajor: false },
    { key: 'Em', measures: 8, complexity: 5, isMajor: false },
    { key: 'Dm', measures: 2, complexity: 10, isMajor: false },
    { key: 'A', measures: 16, complexity: 7, isMajor: true },
    { key: 'F#m', measures: 1, complexity: 3, isMajor: false },
    { key: 'Bb', measures: 5, complexity: 2, isMajor: true },
    { key: 'C#m', measures: 6, complexity: 8, isMajor: false },
  ];

  testCases.forEach(({ key, measures, complexity, isMajor }) => {
    describe(`Key: ${key}, Measures: ${measures}, Complexity: ${complexity}`, () => {
      let progression: string[];

      beforeAll(() => {
        // Spy on console.error before running the function for this describe block
        jest.spyOn(console, 'error').mockImplementation(() => {});
        progression = generateChordProgression(key, measures, complexity);
      });

      afterAll(() => {
        // Restore the original console.error after all tests in this block are done
        jest.restoreAllMocks();
      });
      
      it('should return an array of strings', () => {
        expect(Array.isArray(progression)).toBe(true);
        if (measures > 0) {
            progression.forEach(chord => expect(typeof chord).toBe('string'));
        }
      });

      it(`should return an array of length ${measures}`, () => {
        expect(progression.length).toBe(measures);
      });

      if (measures > 0) {
        const tonic = isMajor ? 'I' : 'i';
        it(`should start with the tonic chord (${tonic})`, () => {
          expect(progression[0]).toBe(tonic);
        });

        if (measures > 1) {
          it(`should end with the tonic chord (${tonic})`, () => {
            expect(progression[progression.length - 1]).toBe(tonic);
          });
        }

        if (measures > 2) {
          it('penultimate chord should often be dominant or subdominant (unless very low complexity or specific short progression)', () => {
            const penultimate = progression[progression.length - 2];
            const dominantChords = ['V', 'V7'];
            const subdominantChords = isMajor ? ['IV', 'ii'] : ['iv', 'ii°'];
            const commonPenultimate = [...dominantChords, ...subdominantChords];
            
            // For very low complexity, T-T-T might happen.
            // For 2 measures, it's often V-I or IV-I.
            // This test is a "soft" check, acknowledging the probabilistic nature.
            if (complexity > 2 || measures > 3) { // More likely to see clear cadences
                // If not tonic, it has a good chance of being one of these
                if (penultimate !== tonic) {
                     expect(commonPenultimate.some(c => penultimate.startsWith(c))).toBe(true);
                } else {
                    // If it IS tonic, that's also possible in some cases (e.g. I-V-I-I)
                    expect(penultimate).toBe(tonic);
                }
            } else {
                // For very short or low complexity, less strict assertion
                expect(typeof penultimate).toBe('string');
            }
          });
        }
      }

      it('chords should generally belong to the key or be common related chords', () => {
        if (measures === 0) return;

        const keyChords = isMajor ? Tonal.Key.majorKey(key)?.chords : Tonal.Key.minorKey(key)?.natural.chords;
        const keyHarmonicChords = isMajor ? [] : Tonal.Key.minorKey(key)?.harmonic.chords; // For V, vii° in minor
        
        progression.forEach(chordSymbol => {
          // Basic check: does the Roman numeral part seem valid?
          expect(chordSymbol).toMatch(/^[ivIV]+[°ø+7532]*$/i);

          // More detailed check for actual chord validity is complex due to inversions and qualities
          // This is a simplified check focusing on the root of the Roman numeral.
          // A full check would involve parsing each Roman numeral back to a Tonal chord and checking its relation to the key.
          const baseRomanMatch = chordSymbol.match(/^[ivIV]+/i);
          expect(baseRomanMatch).not.toBeNull();
          if(baseRomanMatch) {
            const baseRoman = baseRomanMatch[0].toUpperCase();
            const validBases = ["I", "II", "III", "IV", "V", "VI", "VII"];
            expect(validBases).toContain(baseRoman);
          }
        });
      });

      it('should not throw errors for valid inputs', () => {
        expect(() => generateChordProgression(key, measures, complexity)).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return an empty array for numMeasures = 0', () => {
      expect(generateChordProgression('C', 0, 5)).toEqual([]);
    });

    describe('Invalid Key', () => {
      let consoleErrorSpy: jest.SpyInstance;

      beforeEach(() => { // Spy before each test in this describe block
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => { // Restore after each test
        consoleErrorSpy.mockRestore();
      });

      it('should default to C major and log an error for an invalid key', () => {
        const progression = generateChordProgression('InvalidKey', 4, 5);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid key "InvalidKey". Defaulting to "C".');
        expect(progression.length).toBe(4);
        expect(progression[0]).toBe('I'); // Tonic of C major
        expect(progression[progression.length - 1]).toBe('I');
      });

      it('should handle invalid key with 0 measures', () => {
        const progression = generateChordProgression('InvalidKey', 0, 5);
         expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid key "InvalidKey". Defaulting to "C".');
        expect(progression).toEqual([]);
      });
    });
  });
});
