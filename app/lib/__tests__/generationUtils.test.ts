// app/lib/__tests__/generationUtils.test.ts
import { parseMeter, InvalidMeterError, ParsedMeter, isInRange, putInRange, InvalidRangeError } from '../generationUtils';
import * as Tonal from 'tonal';

describe('parseMeter', () => {
  // Test cases for valid meter strings
  const validCases: Array<[string, ParsedMeter]> = [
    ['4/4', { beats: 4, beatType: 4 }],
    ['3/4', { beats: 3, beatType: 4 }],
    ['2/2', { beats: 2, beatType: 2 }],
    ['6/8', { beats: 6, beatType: 8 }],
    ['12/8', { beats: 12, beatType: 8 }],
    ['2/4', { beats: 2, beatType: 4 }],
    ['5/4', { beats: 5, beatType: 4 }],
    ['7/8', { beats: 7, beatType: 8 }],
    [' 4 / 4 ', { beats: 4, beatType: 4 }], // Test with spaces
    ['04/04', { beats: 4, beatType: 4 }], // Test with leading zeros
  ];

  validCases.forEach(([input, expected]) => {
    it(`should parse valid meter string "${input}" correctly`, () => {
      expect(parseMeter(input)).toEqual(expected);
    });
  });

  // Test cases for invalid meter strings with expected error messages
  const invalidCases: Array<[string | null | undefined, string]> = [
    ['4/5', 'Invalid beat type. Must be a power of 2 (e.g., 2, 4, 8).'],
    ['abc', 'Invalid meter string format. Expected "beats/beatType".'],
    ['3', 'Invalid meter string format. Expected "beats/beatType".'],
    ['', 'Meter string cannot be empty.'],
    ['0/4', 'Beats and beat type must be positive integers.'],
    ['4/0', 'Beats and beat type must be positive integers.'],
    ['-3/4', 'Beats and beat type must be positive integers.'],
    ['3/-4', 'Beats and beat type must be positive integers.'],
    ['3.0/4', 'Beats and beat type must be integers.'],
    ['4/4.0', 'Beats and beat type must be integers.'],
    ['4/abc', 'Beat type is not a number.'],
    ['abc/4', 'Beats is not a number.'],
    [null, 'Meter string cannot be null or undefined.'],
    [undefined, 'Meter string cannot be null or undefined.'],
    ['4/4/4', 'Invalid meter string format. Expected "beats/beatType".'],
    ['4 / 3.0', 'Beats and beat type must be integers.'],
    [' / ', 'Beats is not a valid integer string.'],
    ['1 / two', 'Beat type is not a number.'],
    ['4 /  ', 'Beat type is not a valid integer string.'],
    ['  / 4', 'Beats is not a valid integer string.'],
  ];

  invalidCases.forEach(([input, expectedErrorMessage]) => {
    it(`should throw InvalidMeterError with message "${expectedErrorMessage}" for invalid input: ${String(input)}`, () => {
      let error: Error | undefined;
      try {
        parseMeter(input as string);
      } catch (e:any) {
        error = e;
      }
      expect(error).toBeDefined();
      if (error) {
        expect(error.name).toBe('InvalidMeterError');
        expect(error.message).toBe(expectedErrorMessage);
      }
    });
  });
});

describe('isInRange', () => {
  const C4 = Tonal.Note.midi('C4') as number; // 60
  const D4 = Tonal.Note.midi('D4') as number; // 62
  const E4 = Tonal.Note.midi('E4') as number; // 64
  const C5 = Tonal.Note.midi('C5') as number; // 72
  const minRange = D4; // 62
  const maxRange = C5; // 72

  it('should return true for notes within the range', () => {
    expect(isInRange(E4, minRange, maxRange)).toBe(true);
    expect(isInRange(D4, minRange, maxRange)).toBe(true); // Boundary
    expect(isInRange(C5, minRange, maxRange)).toBe(true); // Boundary
  });

  it('should return false for notes outside the range', () => {
    expect(isInRange(C4, minRange, maxRange)).toBe(false); // Below
    expect(isInRange(Tonal.Note.midi('C#5') as number, minRange, maxRange)).toBe(false); // Above (73)
  });

  it('should throw an error if minMidiNote > maxMidiNote for isInRange', () => {
    let error: Error | undefined;
    try {
      isInRange(E4, maxRange, minRange);
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    if (error) {
      expect(error.name).toBe('InvalidRangeError');
      expect(error.message).toBe('Invalid range: minMidiNote cannot be greater than maxMidiNote.');
    }
  });
});

describe('putInRange', () => {
  const C4 = Tonal.Note.midi('C4') as number; // 60
  const D4 = Tonal.Note.midi('D4') as number; // 62
  const E4 = Tonal.Note.midi('E4') as number; // 64
  const B4 = Tonal.Note.midi('B4') as number; // 71
  const C5 = Tonal.Note.midi('C5') as number; // 72

  const minMidi = D4; // 62
  const maxMidi = B4; // 71

  it('should return the same note if it is already in range', () => {
    expect(putInRange(E4, minMidi, maxMidi)).toBe(E4);
    expect(putInRange(minMidi, minMidi, maxMidi)).toBe(minMidi);
    expect(putInRange(maxMidi, minMidi, maxMidi)).toBe(maxMidi);
  });

  it('should transpose notes below range up by octaves and clamp if necessary', () => {
    // C4 (60) is below D4 (62). Transposed up: C5 (72). 72 > maxMidi (71). Clamped to 71.
    expect(putInRange(C4, minMidi, maxMidi)).toBe(maxMidi); // Expected B4 (71)

    // C3 (48) is below D4 (62). Transposed up: C4 (60). Still below. Transposed up: C5 (72). Clamped to 71.
    const C3 = Tonal.Note.midi('C3') as number;
    expect(putInRange(C3, minMidi, maxMidi)).toBe(maxMidi); // Expected B4 (71)

    // E3 (52) is below D4 (62). Transposed up: E4 (64). This is in range.
    const E3 = Tonal.Note.midi('E3') as number;
    expect(putInRange(E3, minMidi, maxMidi)).toBe(E4); // Expected E4 (64)
  });

  it('should transpose notes above range down by octaves and clamp if necessary', () => {
    // C5 (72) is above B4 (71). Transposed down: C4 (60). 60 < minMidi (62). Clamped to 62.
    expect(putInRange(C5, minMidi, maxMidi)).toBe(minMidi); // Expected D4 (62)

    // C6 (84) is above B4 (71). Transposed down: C5 (72). Still above. Transposed down: C4 (60). Clamped to 62.
    const C6 = Tonal.Note.midi('C6') as number;
    expect(putInRange(C6, minMidi, maxMidi)).toBe(minMidi); // Expected D4 (62)

    // A4 (69) is in range D4(62)-B4(71).
    // A5 (81) is above. Transposed down: A4 (69). This is in range.
    const A5 = Tonal.Note.midi('A5') as number;
    expect(putInRange(A5, minMidi, maxMidi)).toBe(Tonal.Note.midi('A4') as number); // Expected A4 (69)
  });

  it('should throw an error if minMidiNote > maxMidiNote for putInRange', () => {
     let error: Error | undefined;
     try {
       putInRange(C4, maxMidi, minMidi);
     } catch (e: any) {
       error = e;
     }
     expect(error).toBeDefined();
     if (error) {
       expect(error.name).toBe('InvalidRangeError');
       expect(error.message).toBe('Invalid range: minMidiNote cannot be greater than maxMidiNote.');
     }
  });
});
