import generateMA from '../generateMA'; // Default import
import { Note } from 'tonal';
import { InvalidRangeError } from '../generationUtils'; // Assuming this is the correct path

// Mock dependencies if necessary, e.g., getChordInfoFromRoman, generateRhythm, Gemini API
jest.mock('../harmonyUtils', () => ({
  ...jest.requireActual('../harmonyUtils'),
  getChordInfoFromRoman: jest.fn().mockImplementation((roman, key) => {
    // Provide a simple mock implementation for testing
    if (roman === 'I' && key === 'C') return { notes: [60, 64, 67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
    if (roman === 'V' && key === 'C') return { notes: [67, 71, 74], noteNames: ['G4', 'B4', 'D5'], requiredBassPc: null };
    if (roman === 'IV' && key === 'C') return { notes: [65, 69, 72], noteNames: ['F4', 'A4', 'C5'], requiredBassPc: null };
    if (roman === 'ii' && key === 'C') return { notes: [62, 65, 69], noteNames: ['D4', 'F4', 'A4'], requiredBassPc: null };
    // Fallback for other chords or keys if needed for more complex tests
    return { notes: [60, 64, 67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
  }),
}));

jest.mock('../rhythm', () => ({
  ...jest.requireActual('../rhythm'),
  generateRhythm: jest.fn().mockImplementation((meter, complexity) => {
    // Simple rhythm: two quarter notes for 4/4
    if (meter === '4/4') return [4, 4];
    // Simple rhythm: three quarter notes for 3/4
    if (meter === '3/4') return [4, 4, 4];
    return [4, 4]; // Default
  }),
}));

// Mock the Gemini API call within generateMA to avoid actual API calls during tests
jest.mock('@google/genai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { // Adjusted for v0.13.0: generateContent is directly on models
        generateContent: mockGenerateContent,
      },
    })),
    HarmBlockThreshold: {}, // Add other exports if needed by the module
    HarmCategory: {},
  };
});


describe('generateMA', () => {
  // Access the mock directly for assertions or to set mock return values per test
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Re-assign mockGenerateContent before each test if needed, or get it from the module
    // This assumes the mock structure from above.
    const GenAI = require('@google/genai');
    mockGenerateContent = GenAI.GoogleGenAI().models.generateContent;


    // Mock a successful API response for accompaniment by default for most tests
    // Tests specifically for AI accompaniment failure can override this.
    mockGenerateContent.mockResolvedValue({
      // Simulate the structure of the response object based on v0.13.0
      // It should directly contain a `text` property for the generated content.
      text: JSON.stringify([
        { note: 'C3', rhythm: 4 },
        { note: 'E3', rhythm: 4 },
        { note: 'G3', rhythm: 4 },
        { note: 'C3', rhythm: 4 },
      ]),
    });
  });

  describe('generateMelody component (via generateMA)', () => {
    const progression = ['I', 'V'];
    const key = 'C';
    const meter = '4/4';

    test('should generate a melody without range constraints if min/max are null', async () => {
      const rangeConstraints = {
        melody: { min: null as any, max: null as any }, // Test null case
        accompaniment: { min: 'C2', max: 'C4' },
      };
      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      // Further checks could verify notes are generally within a reasonable default octave
      // e.g. melody.every(n => Note.octave(n.note) >= 3 && Note.octave(n.note) <= 5)
      // This depends on the default behavior of generateMelody when no range is given.
    });

    test('should generate a melody where notes are already within the specified range', async () => {
      const rangeConstraints = {
        melody: { min: 'C4', max: 'C5' }, // Range where C4, G4, D5 etc. fit
        accompaniment: { min: 'C2', max: 'C4' },
      };
      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      melody.forEach(item => {
        const midi = Note.midi(item.note);
        expect(midi).toBeGreaterThanOrEqual(Note.midi('C4') as number);
        expect(midi).toBeLessThanOrEqual(Note.midi('C5') as number);
      });
    });

    test('should clamp notes to the max range if they go above (testing convertNoteWithRange)', async () => {
      const rangeConstraints = {
        melody: { min: 'C4', max: 'E4' }, // Very narrow range: C4, D4, E4
        accompaniment: { min: 'C2', max: 'C4' },
      };
      // Mock getChordInfoFromRoman to return notes that would likely go out of range
      (require('../harmonyUtils').getChordInfoFromRoman as jest.Mock).mockImplementation((roman, key) => {
        if (roman === 'I') return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null }; // G4 (midi 67) is above E4 (midi 64)
        if (roman === 'V') return { notes: [67,71,74], noteNames: ['G4', 'B4', 'D5'], requiredBassPc: null }; // All above or at edge
        return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
      });

      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      let clampedOrShifted = false;
      melody.forEach(item => {
        const midi = Note.midi(item.note);
        expect(midi).toBeLessThanOrEqual(Note.midi('E4') as number);
        if (item.note === 'E4') { // If G4 was clamped to E4
            // This check relies on knowing the input notes from the mock and the scale.
            // If a note was originally G4 (from 'I' or 'V') and is now E4, it was clamped.
            clampedOrShifted = true;
        }
      });
      // This is a soft check. A more robust check would be to inspect calls to convertNoteWithRange if it were mocked,
      // or to have more deterministic note generation for precise output checking.
      // Given the current structure, we check if any note landed on the boundary, implying clamping might have occurred.
      // console.log('Melody for clamping (max E4):', melody);
      expect(melody.some(item => item.note === 'E4')).toBe(true); // Expect some notes to be clamped to E4
    });

    test('should clamp notes to the min range if they go below (testing convertNoteWithRange)', async () => {
      const rangeConstraints = {
        melody: { min: 'G4', max: 'C5' }, // Range G4, A4, B4, C5
        accompaniment: { min: 'C2', max: 'C4' },
      };
      (require('../harmonyUtils').getChordInfoFromRoman as jest.Mock).mockImplementation((roman, key) => {
        if (roman === 'I') return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null }; // C4, E4 are below G4
        if (roman === 'V') return { notes: [55,59,62], noteNames: ['G3', 'B3', 'D4'], requiredBassPc: null }; // All below G4
        return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
      });

      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      melody.forEach(item => {
        const midi = Note.midi(item.note);
        expect(midi).toBeGreaterThanOrEqual(Note.midi('G4')as number);
      });
      // console.log('Melody for clamping (min G4):', melody);
      expect(melody.some(item => item.note === 'G4')).toBe(true); // Expect some notes to be clamped to G4
    });

    test('should shift notes by octave to fit range (testing convertNoteWithRange)', async () => {
      const rangeConstraints = {
        melody: { min: 'C5', max: 'G5' }, // High range
        accompaniment: { min: 'C2', max: 'C4' },
      };
       // Mock to provide notes in C4 octave, expecting them to be shifted to C5
      (require('../harmonyUtils').getChordInfoFromRoman as jest.Mock).mockImplementation((roman, key) => {
        if (roman === 'I') return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
        return { notes: [60,64,67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null };
      });

      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      let shifted = false;
      melody.forEach(item => {
        const midi = Note.midi(item.note);
        const octave = Note.octave(item.note);
        expect(midi).toBeGreaterThanOrEqual(Note.midi('C5') as number);
        expect(midi).toBeLessThanOrEqual(Note.midi('G5') as number);
        if (octave === 5) { // If C4 became C5, E4 became E5 etc.
            shifted = true;
        }
      });
      // console.log('Melody for octave shift (C5-G5):', melody);
      // Check if the first note (expected to be C based on 'I' chord and starting note logic) is C5
      // This assumes the starting note logic will also be affected by putInRange.
      // The starting note in generateMelody is tonic + '4', so C4.
      // It should be converted to C5.
      expect(melody[0].note).toBe('C5');
      expect(shifted).toBe(true);
    });

    test('should handle InvalidRangeError from convertNoteWithRange gracefully (e.g. min > max)', async () => {
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn(); // Mock console.warn

      const rangeConstraints = {
        melody: { min: 'C5', max: 'C4' }, // Invalid range
        accompaniment: { min: 'C2', max: 'C4' },
      };

      // No need to mock getChordInfoFromRoman to throw, convertNoteWithRange itself handles InvalidRangeError
      // by catching it and returning the original note. We want to ensure this path is tested.
      // The warning "Invalid range for note..." should appear.

      const { melody } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(melody.length).toBeGreaterThan(0);
      // Expect console.warn to have been called due to the InvalidRangeError being caught by convertNoteWithRange
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[convertNoteWithRange] Invalid range for note'));

      // Melody notes should be in their original form (e.g. C4, G4) as convertNoteWithRange returns original note on InvalidRangeError
      // For 'I' chord (C4, E4, G4) and 'V' (G4, B4, D5)
      // The starting note is C4.
      expect(melody[0].note).toBe('C4'); // Starting note remains C4
      // Other notes should also be in their original, unshifted/unclamped form.
      // This is harder to assert precisely without knowing the exact sequence of generated notes.
      // But we can check that octaves are not all 5, for example.
      expect(melody.some(n => Note.octave(n.note) === 4)).toBe(true);

      console.warn = originalConsoleWarn; // Restore original console.warn
    });

  });

  // TODO: Add tests for AI Accompaniment specific logic if generateMA handles that
  // For example, test what happens if the Gemini API call fails or returns malformed data.
  describe('generateMA with AI Accompaniment', () => {
    const progression = ['I'];
    const key = 'C';
    const meter = '4/4';
    const rangeConstraints = {
      melody: { min: 'C4', max: 'C5' },
      accompaniment: { min: 'C2', max: 'C4' },
    };

    test('should return AI generated accompaniment when enabled', async () => {
      const expectedAccompaniment = [
        { note: 'C3', rhythm: 4 }, { note: 'E3', rhythm: 4 },
        { note: 'G3', rhythm: 4 }, { note: 'C3', rhythm: 4 }
      ];
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(expectedAccompaniment) });

      const { accompaniment } = await generateMA(progression, key, meter, rangeConstraints, true);
      expect(accompaniment).toEqual(expectedAccompaniment);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    test('should return empty accompaniment when AI is disabled', async () => {
      const { accompaniment } = await generateMA(progression, key, meter, rangeConstraints, false);
      expect(accompaniment).toEqual([]);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    test('should throw GenerationError if AI response is not valid JSON', async () => {
      mockGenerateContent.mockResolvedValue({ text: "This is not JSON" });
      await expect(generateMA(progression, key, meter, rangeConstraints, true))
        .rejects.toThrowError(/Failed to parse accompaniment from API response/);
    });

    test('should throw ApiError if Gemini API call fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error("API Network Error"));
        await expect(generateMA(progression, key, meter, rangeConstraints, true))
            .rejects.toThrowError(/Failed to generate accompaniment using Gemini API: API Network Error/);
    });

    test('should throw ApiError if no text response from Gemini API', async () => {
        mockGenerateContent.mockResolvedValue({ text: undefined }); // Simulate undefined text response
        await expect(generateMA(progression, key, meter, rangeConstraints, true))
            .rejects.toThrowError('Received no text response from Gemini API.');
    });

  });
});
