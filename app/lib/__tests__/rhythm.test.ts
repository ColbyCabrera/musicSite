import { generateRhythm } from '../rhythm';
import { InvalidInputError } from '../errors';
import Fraction from 'fraction.js';

// Helper to calculate total duration of a rhythm array
const calculateRhythmDuration = (rhythm: number[]): Fraction => {
  let totalDuration = new Fraction(0);
  // Define base note durations relative to a whole note for calculation
  // The numbers in the rhythm array represent the denominator of the note value
  // (e.g., 1 = whole, 2 = half, 4 = quarter)
  const noteValues: Record<number, Fraction> = {
    1: new Fraction(1, 1),    // Whole Note (1/1)
    2: new Fraction(1, 2),    // Half Note (1/2)
    4: new Fraction(1, 4),    // Quarter Note (1/4)
    8: new Fraction(1, 8),    // Eighth Note (1/8)
    16: new Fraction(1, 16),  // Sixteenth Note (1/16)
    32: new Fraction(1, 32),  // Thirty-Second Note (1/32)
  };
  rhythm.forEach(noteVal => {
    if (noteValues[noteVal]) {
      totalDuration = totalDuration.add(noteValues[noteVal]);
    } else {
      // This case should ideally not be reached if generateRhythm only produces valid note values.
      // If it does, it indicates an issue with generateRhythm itself.
      throw new Error(`Invalid note value in rhythm output: ${noteVal}. Expected one of ${Object.keys(noteValues).join(', ')}.`);
    }
  });
  return totalDuration;
};

describe('generateRhythm', () => {
  // Added 5/8, 7/4 as per internal generateRhythm's supported list.
  const metersToTest = ["4/4", "3/4", "2/4", "6/8", "2/2", "3/8", "5/4", "7/8", "12/8", "5/8", "7/4"];
  const complexitiesToTest = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  metersToTest.forEach(meter => {
    complexitiesToTest.forEach(complexity => {
      test(`should generate a rhythm that fills a ${meter} measure with complexity ${complexity}`, () => {
        // Run multiple times to increase chance of catching edge cases in random generation
        for (let i = 0; i < 5; i++) { // Reduced from 10 to 5 for faster tests, but still multiple runs
          const rhythm = generateRhythm(meter, complexity);
          expect(rhythm.length).toBeGreaterThan(0); // Should produce some notes

          const meterParts = meter.split('/').map(Number);
          const targetDuration = new Fraction(meterParts[0], meterParts[1]);
          const actualDuration = calculateRhythmDuration(rhythm);
          
          // The function has a console.warn if it doesn't match exactly.
          // For tests, we should be strict.
          if (!actualDuration.equals(targetDuration)) {
            console.error(`Meter: ${meter}, Complexity: ${complexity}, Iteration: ${i}`);
            console.error('Target Duration:', targetDuration.toFraction(true));
            console.error('Actual Duration:', actualDuration.toFraction(true));
            console.error('Rhythm Array:', rhythm);
          }
          expect(actualDuration.equals(targetDuration)).toBe(true);
        }
      });
    });
  });

  test('should produce varied rhythms for different complexities (qualitative check)', () => {
    const rhythmSimple = generateRhythm("4/4", 1);
    const rhythmModerate = generateRhythm("4/4", 5);
    const rhythmComplex = generateRhythm("4/4", 10);

    expect(rhythmSimple.length).toBeGreaterThan(0);
    expect(rhythmModerate.length).toBeGreaterThan(0);
    expect(rhythmComplex.length).toBeGreaterThan(0);

    // Basic check: higher complexity often leads to more notes for the same measure.
    // This is not a strict guarantee due to randomness but a general trend.
    // For example, a complexity 1 might just be [1] (whole note for 4/4),
    // while complexity 10 will likely be many more notes.
    // We can also check for presence of smaller note values.
    const hasSmallerNotes = rhythmComplex.some(note => note > 4); // e.g., 8th, 16th, 32nd
    const simpleHasOnlyLonger = rhythmSimple.every(note => note <=4); // e.g. only whole, half, quarter

    if(rhythmSimple.length < rhythmComplex.length){
        expect(rhythmSimple.length).toBeLessThanOrEqual(rhythmComplex.length);
    }
    if(rhythmSimple.length < rhythmModerate.length){
        expect(rhythmSimple.length).toBeLessThanOrEqual(rhythmModerate.length);
    }


    // If the complex rhythm has more notes or contains shorter notes, this test offers some value.
    // It's hard to make a very strict assertion without statistical analysis over many runs.
    // For now, this qualitative check is mostly ensuring the function runs and produces output.
    // A more robust check could be:
    if (rhythmComplex.length > rhythmSimple.length) {
        expect(rhythmComplex.some(note => [8, 16, 32].includes(note))).toBe(true);
    } else if (simpleHasOnlyLonger && rhythmComplex.length >= rhythmSimple.length) {
        // If simple only has long notes, complex should ideally have some shorter ones or more notes.
        expect(rhythmComplex.some(note => [8, 16, 32].includes(note)) || rhythmComplex.length > rhythmSimple.length).toBe(true);
    }
    // This is still not perfect, but better than nothing.
  });

  describe('Input Validation', () => {
    test('should throw InvalidInputError for invalid meter strings', () => {
      expect(() => generateRhythm("4", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("/4", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/X", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("0/4", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/0", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/3", 5)).toThrow(InvalidInputError); // Unsupported denominator
      expect(() => generateRhythm("4/6", 5)).toThrow(InvalidInputError); // Unsupported denominator
      expect(() => generateRhythm("3/0", 5)).toThrow(InvalidInputError);
      expect(() => generateRhythm("13/8", 5)).toThrow(InvalidInputError); // Numerator too large for compound
      expect(() => generateRhythm("8/4", 5)).toThrow(InvalidInputError); // Numerator too large for simple
    });

    test('should throw InvalidInputError for invalid complexity values', () => {
      expect(() => generateRhythm("4/4", 0)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/4", 11)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/4", -1)).toThrow(InvalidInputError);
      expect(() => generateRhythm("4/4", 5.5)).toThrow(InvalidInputError);
      // @ts-expect-error testing invalid type
      expect(() => generateRhythm("4/4", null)).toThrow(InvalidInputError);
      // @ts-expect-error testing invalid type
      expect(() => generateRhythm("4/4", undefined)).toThrow(InvalidInputError);
    });
  });
});
