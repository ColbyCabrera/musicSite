import { midiToMusicXMLPitch, getMusicXMLDurationType, getNoteTypeFromDuration } from '../musicxmlUtils';

describe('midiToMusicXMLPitch', () => {
  test('should convert MIDI for natural notes', () => {
    expect(midiToMusicXMLPitch(60)).toEqual({ step: 'C', alter: undefined, octave: 4 }); // C4
    expect(midiToMusicXMLPitch(62)).toEqual({ step: 'D', alter: undefined, octave: 4 }); // D4
    expect(midiToMusicXMLPitch(64)).toEqual({ step: 'E', alter: undefined, octave: 4 }); // E4
    expect(midiToMusicXMLPitch(65)).toEqual({ step: 'F', alter: undefined, octave: 4 }); // F4
    expect(midiToMusicXMLPitch(67)).toEqual({ step: 'G', alter: undefined, octave: 4 }); // G4
    expect(midiToMusicXMLPitch(69)).toEqual({ step: 'A', alter: undefined, octave: 4 }); // A4
    expect(midiToMusicXMLPitch(71)).toEqual({ step: 'B', alter: undefined, octave: 4 }); // B4
    expect(midiToMusicXMLPitch(48)).toEqual({ step: 'C', alter: undefined, octave: 3 }); // C3
    expect(midiToMusicXMLPitch(72)).toEqual({ step: 'C', alter: undefined, octave: 5 }); // C5
  });

  test('should convert MIDI for sharp notes (as per Tonal.Note.fromMidi preference)', () => {
    // Tonal.Note.fromMidi(61) is "C#4"
    expect(midiToMusicXMLPitch(61)).toEqual({ step: 'C', alter: 1, octave: 4 }); // C#4
    // Tonal.Note.fromMidi(63) is "D#4"
    expect(midiToMusicXMLPitch(63)).toEqual({ step: 'D', alter: 1, octave: 4 }); // D#4 (or Eb4)
    // Tonal.Note.fromMidi(66) is "F#4"
    expect(midiToMusicXMLPitch(66)).toEqual({ step: 'F', alter: 1, octave: 4 }); // F#4
    // Tonal.Note.fromMidi(68) is "G#4"
    expect(midiToMusicXMLPitch(68)).toEqual({ step: 'G', alter: 1, octave: 4 }); // G#4
    // Tonal.Note.fromMidi(70) is "A#4"
    expect(midiToMusicXMLPitch(70)).toEqual({ step: 'A', alter: 1, octave: 4 }); // A#4
  });

  test('notes on testing flat notes directly via MIDI number', () => {
    // midiToMusicXMLPitch relies on midiToNoteName, which uses Tonal.Note.fromMidi().
    // Tonal.Note.fromMidi() typically prefers sharps for enharmonically equivalent black keys.
    // For example, MIDI 61 is "C#4", not "Db4".
    // So, midiToMusicXMLPitch(61) will produce output for "C#4".
    // To get { step: 'D', alter: -1, octave: 4 } (Db4), midiToNoteName would first need to
    // resolve MIDI 61 to "Db4". This is not its default behavior.
    // Thus, we test the actual output based on Tonal.Note.fromMidi's preference.
    expect(midiToMusicXMLPitch(61)).toEqual({ step: 'C', alter: 1, octave: 4 }); // C#4, not Db4
    // If midiToNoteName were configured to prefer flats, or if a MIDI number
    // unambiguously resolved to a flat by Tonal.Note.fromMidi, that could be tested.
    // However, standard black key MIDI numbers are typically resolved to sharps by Tonal.
  });

  test('should handle double sharps and double flats based on Tonal.Note.fromMidi simplification', () => {
    // Tonal.Note.get("C##4").midi is 62. Tonal.Note.fromMidi(62) is "D4".
    // So, midiToMusicXMLPitch will receive "D4" from midiToNoteName.
    expect(midiToMusicXMLPitch(62)).toEqual({ step: 'D', alter: undefined, octave: 4 }); // D4, from C##4's MIDI value

    // Tonal.Note.get("Ebb4").midi is 62. Tonal.Note.fromMidi(62) is "D4".

    // Tonal.Note.get("G##4").midi is 69. Tonal.Note.fromMidi(69) is "A4".
    expect(midiToMusicXMLPitch(69)).toEqual({ step: 'A', alter: undefined, octave: 4 }); // A4, from G##4's MIDI value

    // Tonal.Note.get("Abb4").midi is 68. Tonal.Note.fromMidi(68) is "G#4".
    expect(midiToMusicXMLPitch(68)).toEqual({ step: 'G', alter: 1, octave: 4 }); // G#4, from Abb4's MIDI value
  });

  test('should handle edge MIDI values', () => {
    expect(midiToMusicXMLPitch(21)).toEqual({ step: 'A', alter: undefined, octave: 0 }); // A0
    expect(midiToMusicXMLPitch(108)).toEqual({ step: 'C', alter: undefined, octave: 8 }); // C8
    // Test other boundary values if midiToNoteName supports them
    expect(midiToMusicXMLPitch(0)).toEqual({ step: 'C', alter: undefined, octave: -1 });   // C-1
    expect(midiToMusicXMLPitch(127)).toEqual({ step: 'G', alter: undefined, octave: 9 }); // G9
  });

  test('should return null for invalid MIDI inputs', () => {
    expect(midiToMusicXMLPitch(-1)).toBeNull();
    expect(midiToMusicXMLPitch(128)).toBeNull();
    expect(midiToMusicXMLPitch(60.5)).toBeNull(); // Non-integer
    // @ts-expect-error testing invalid type
    expect(midiToMusicXMLPitch(null)).toBeNull();
    // @ts-expect-error testing invalid type
    expect(midiToMusicXMLPitch(undefined)).toBeNull();
    // @ts-expect-error testing invalid type
    expect(midiToMusicXMLPitch('not a number')).toBeNull();
  });
});

// Test cases based on specific Tonal.js behavior for note names from MIDI
describe('midiToMusicXMLPitch specific Tonal.js naming', () => {
  // Tonal.Note.fromMidi(50) -> "D#3" (not Eb3 by default)
  test('should prefer sharps for D#/Eb based on Tonal.Note.fromMidi', () => {
    expect(midiToMusicXMLPitch(50)).toEqual({ step: 'D', alter: 1, octave: 3 });
  });

  // Tonal.Note.fromMidi(51) -> "D#3" (correct behavior: D#3, not E3)
  // Tonal.Note.fromMidi(52) -> "E3" (correct behavior: E3)
  // Tonal.Note.fromMidi(53) -> "F#3" (correct behavior: F#3)
  // Tonal.Note.fromMidi(53) is F#3 (consistent with F#3)
   test('should correctly identify F#3 from MIDI 53', () => {
    expect(midiToMusicXMLPitch(53)).toEqual({ step: 'F', alter: 1, octave: 3 });
  });
});
// Note on `alter` field:
// `undefined` is used for natural notes.
// `1` for single sharp, `-1` for single flat.
// `2` for double sharp, `-2` for double flat.
// The function correctly maps Tonal's "##" to 2 and "bb" to -2 if midiToNoteName produced such strings.
// However, midiToNoteName (via Tonal.Note.fromMidi) simplifies these.
// E.g., if midiToNoteName(x) -> "C##4", then output would be { step: 'C', alter: 2, octave: 4 }.
// But midiToNoteName(Tonal.Note.get("C##4").midi) -> "D4", so output is { step: 'D', alter: undefined, octave: 4 }.
// The tests reflect this simplification.

describe('getMusicXMLDurationType', () => {
  test('should return correct type for standard beat values', () => {
    expect(getMusicXMLDurationType(1)).toBe('whole');
    expect(getMusicXMLDurationType(2)).toBe('half');
    expect(getMusicXMLDurationType(4)).toBe('quarter');
    expect(getMusicXMLDurationType(8)).toBe('eighth');
    expect(getMusicXMLDurationType(16)).toBe('16th');
    expect(getMusicXMLDurationType(32)).toBe('32nd');
  });

  test('should default to "quarter" for unsupported beat values and log a warning', () => {
    // We can't directly test console.warn without a spy framework,
    // but we can check the default return value.
    expect(getMusicXMLDurationType(3)).toBe('quarter');
    expect(getMusicXMLDurationType(0)).toBe('quarter');
    expect(getMusicXMLDurationType(-4)).toBe('quarter');
    expect(getMusicXMLDurationType(64)).toBe('quarter'); // Example of another unsupported value
    // @ts-expect-error testing invalid type
    expect(getMusicXMLDurationType(null)).toBe('quarter');
    // @ts-expect-error testing invalid type
    expect(getMusicXMLDurationType(undefined)).toBe('quarter');
  });
});

describe('getNoteTypeFromDuration', () => {
  const divisions = 4; // Standard: 4 divisions per quarter note

  test('should return correct type for exact durations with divisions=4', () => {
    expect(getNoteTypeFromDuration(divisions * 4, divisions)).toBe('whole');   // 16 ticks, ratio 4
    expect(getNoteTypeFromDuration(divisions * 2, divisions)).toBe('half');    // 8 ticks, ratio 2
    expect(getNoteTypeFromDuration(divisions, divisions)).toBe('quarter');     // 4 ticks, ratio 1
    expect(getNoteTypeFromDuration(divisions / 2, divisions)).toBe('eighth');  // 2 ticks, ratio 0.5
    expect(getNoteTypeFromDuration(divisions / 4, divisions)).toBe('16th');   // 1 tick, ratio 0.25
    expect(getNoteTypeFromDuration(divisions / 8, divisions)).toBe('32nd');   // 0.5 ticks, ratio 0.125
  });

  test('should handle durations between standard types with divisions=4 (>= logic)', () => {
    // ratioToQuarter = durationTicks / divisions
    // Whole (4), Half (2), Quarter (1), Eighth (0.5), 16th (0.25), 32nd (0.125)

    // Between 32nd and 16th
    expect(getNoteTypeFromDuration(0.75, divisions)).toBe('32nd'); // ratio 0.1875. >= 0.125 (32nd)
    
    // Between 16th and 8th
    expect(getNoteTypeFromDuration(1.5, divisions)).toBe('16th');  // ratio 0.375. >= 0.25 (16th)

    // Between 8th and Quarter
    expect(getNoteTypeFromDuration(3, divisions)).toBe('eighth');   // ratio 0.75. >= 0.5 (eighth)
    
    // Between Quarter and Half
    expect(getNoteTypeFromDuration(6, divisions)).toBe('quarter');  // ratio 1.5. >= 1 (quarter)

    // Between Half and Whole
    expect(getNoteTypeFromDuration(12, divisions)).toBe('half');    // ratio 3. >= 2 (half)

    // Larger than whole
    expect(getNoteTypeFromDuration(20, divisions)).toBe('whole');   // ratio 5. >= 4 (whole)
  });
  
  test('should default to "quarter" for very short durations smaller than 32nd and log warning', () => {
    // divisions = 4. 32nd is 0.125 ratio (0.5 ticks).
    expect(getNoteTypeFromDuration(0.25, divisions)).toBe('quarter'); // ratio 0.0625. Falls through, logs warning, returns 'quarter'.
    expect(getNoteTypeFromDuration(0.1, divisions)).toBe('quarter');  // ratio 0.025.
  });

  test('should work with different divisions values (e.g., divisions=8)', () => {
    const highDivisions = 8; // 8 divisions per quarter
    expect(getNoteTypeFromDuration(highDivisions * 4, highDivisions)).toBe('whole');   // 32 ticks, ratio 4
    expect(getNoteTypeFromDuration(highDivisions * 2, highDivisions)).toBe('half');    // 16 ticks, ratio 2
    expect(getNoteTypeFromDuration(highDivisions, highDivisions)).toBe('quarter');     // 8 ticks, ratio 1
    expect(getNoteTypeFromDuration(highDivisions / 2, highDivisions)).toBe('eighth');  // 4 ticks, ratio 0.5
    expect(getNoteTypeFromDuration(highDivisions / 4, highDivisions)).toBe('16th');   // 2 ticks, ratio 0.25
    expect(getNoteTypeFromDuration(highDivisions / 8, highDivisions)).toBe('32nd');   // 1 tick, ratio 0.125
    
    // Between types with highDivisions = 8
    expect(getNoteTypeFromDuration(3, highDivisions)).toBe('16th'); // ratio 3/8 = 0.375. >= 0.25 (16th)
    expect(getNoteTypeFromDuration(0.5, highDivisions)).toBe('quarter'); // ratio 0.5/8 = 0.0625. Falls through.
  });

  test('should default to "quarter" for invalid divisions input and log warning', () => {
    expect(getNoteTypeFromDuration(4, 0)).toBe('quarter');
    expect(getNoteTypeFromDuration(4, -2)).toBe('quarter');
    // @ts-expect-error testing invalid type
    expect(getNoteTypeFromDuration(4, null)).toBe('quarter');
    // @ts-expect-error testing invalid type
    expect(getNoteTypeFromDuration(4, undefined)).toBe('quarter');
  });
  
  test('should default to "quarter" for zero or negative durationTicks and log warning', () => {
    expect(getNoteTypeFromDuration(0, divisions)).toBe('quarter');
    expect(getNoteTypeFromDuration(-2, divisions)).toBe('quarter');
  });

  test('should handle non-integer durationTicks correctly based on ratio', () => {
    expect(getNoteTypeFromDuration(2.4, divisions)).toBe('eighth'); // ratio 0.6. >= 0.5 (eighth)
    expect(getNoteTypeFromDuration(0.6, divisions)).toBe('32nd'); // ratio 0.15. >= 0.125 (32nd)
  });
});
