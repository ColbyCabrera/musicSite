// app/lib/musicxmlUtils.test.ts
import {
  midiToMusicXMLPitch,
  getMusicXMLDurationType,
  getNoteTypeFromDuration,
} from './musicxmlUtils'; // Adjust path as necessary
import * as Tonal from 'tonal'; // Used for verifying Tonal.js behavior

describe('musicxmlUtils', () => {
  describe('midiToMusicXMLPitch', () => {
    it('should convert MIDI 60 to C4 natural', () => {
      expect(midiToMusicXMLPitch(60)).toEqual({
        step: 'C',
        octave: 4,
        alter: undefined,
      });
    });

    it('should convert MIDI 61 to C#4 (alter 1)', () => {
      // Tonal.Note.get("C#4") -> { letter: "C", acc: "#" }
      expect(midiToMusicXMLPitch(61)).toEqual({
        step: 'C',
        octave: 4,
        alter: 1,
      });
    });

    it('should convert MIDI 63 to Eb4 (alter -1, step E) or D#4 (alter 1, step D)', () => {
      // Tonal.Note.fromMidi(63) is "Eb4"
      // Tonal.Note.get("Eb4") -> { letter: "E", acc: "b" }
      expect(midiToMusicXMLPitch(63)).toEqual({
        step: 'E', // Tonal simplifies to Eb
        octave: 4,
        alter: -1,
      });
    });
    
    it('should convert MIDI 70 to Bb4 (alter -1, step B)', () => {
        // Tonal.Note.fromMidi(70) is "Bb4"
        // Tonal.Note.get("Bb4") -> { letter: "B", acc: "b" }
        expect(midiToMusicXMLPitch(70)).toEqual({
            step: 'B',
            octave: 4,
            alter: -1,
        });
    });

    it('should convert MIDI 73 to C#5 (alter 1, step C)', () => {
      expect(midiToMusicXMLPitch(73)).toEqual({
        step: 'C',
        octave: 5,
        alter: 1,
      });
    });
    
    it('should convert MIDI 48 to C3 natural', () => {
      expect(midiToMusicXMLPitch(48)).toEqual({
        step: 'C',
        octave: 3,
        alter: undefined,
      });
    });

    it('should handle double sharps (e.g., G##4 / MIDI 68)', () => {
        // Tonal.Note.fromMidi(68) is "G##4"
        // Tonal.Note.get("G##4") -> { letter: "G", acc: "##" }
        expect(midiToMusicXMLPitch(68)).toEqual({
            step: 'G',
            octave: 4,
            alter: 2,
        });
    });

    it('should handle double flats (e.g., Abb4 / MIDI 66)', () => {
        // Tonal.Note.fromMidi(66) is "Abb4"
        // Tonal.Note.get("Abb4") -> { letter: "A", acc: "bb" }
        expect(midiToMusicXMLPitch(66)).toEqual({
            step: 'A',
            octave: 4,
            alter: -2,
        });
    });

    it('should return null for invalid MIDI number (too low)', () => {
      expect(midiToMusicXMLPitch(10)).toBeNull(); // Assuming midiToNoteName handles this
    });

    it('should return null for invalid MIDI number (too high)', () => {
      expect(midiToMusicXMLPitch(128)).toBeNull(); // Assuming midiToNoteName handles this
    });
    
    // Test case where Tonal.Note.get might return incomplete info
    // This is hard to simulate directly if midiToNoteName always provides valid names for valid MIDI
    // but good to be aware of the internal check.
    it('should return null if Tonal.Note.get returns incomplete data (mocking scenario)', () => {
        const originalTonalGet = Tonal.Note.get;
        //@ts-ignore
        Tonal.Note.get = jest.fn(() => ({ empty: true })); // Mock Tonal.Note.get
        expect(midiToMusicXMLPitch(60)).toBeNull();
        //@ts-ignore
        Tonal.Note.get = originalTonalGet; // Restore original
    });
  });

  describe('getNoteTypeFromDuration', () => {
    it('should return "quarter" for durationTicks = 4, divisions = 4', () => {
      expect(getNoteTypeFromDuration(4, 4)).toBe('quarter');
    });

    it('should return "half" for durationTicks = 8, divisions = 4', () => {
      expect(getNoteTypeFromDuration(8, 4)).toBe('half');
    });

    it('should return "eighth" for durationTicks = 2, divisions = 4', () => {
      expect(getNoteTypeFromDuration(2, 4)).toBe('eighth');
    });

    it('should return "16th" for durationTicks = 1, divisions = 4', () => {
      expect(getNoteTypeFromDuration(1, 4)).toBe('16th');
    });

    it('should return "whole" for durationTicks = 16, divisions = 4', () => {
      expect(getNoteTypeFromDuration(16, 4)).toBe('whole');
    });
    
    it('should return "32nd" for durationTicks = 0.5, divisions = 4', () => {
      expect(getNoteTypeFromDuration(0.5, 4)).toBe('32nd');
    });

    // Dotted rhythm equivalent: 1.5 * quarter = 6 ticks if quarter is 4 ticks
    it('should return "quarter" for durationTicks = 6, divisions = 4 (closest for non-exact, or handle if dotted logic added)', () => {
      // Current function does not explicitly handle dotted notes, it finds the largest type that fits.
      // 6/4 = 1.5. It's >= 1 (quarter) but < 2 (half). So, "quarter".
      expect(getNoteTypeFromDuration(6, 4)).toBe('quarter');
    });
    
    it('should return "half" for durationTicks = 12, divisions = 4 (dotted half)', () => {
      // 12/4 = 3. It's >= 2 (half) but < 4 (whole). So, "half".
      expect(getNoteTypeFromDuration(12, 4)).toBe('half');
    });

    it('should return "quarter" for durationTicks = 8, divisions = 8', () => {
      // divisions = 8 means 8th note is the beat, so 8 ticks = 1 quarter note equivalent in MusicXML divisions
      expect(getNoteTypeFromDuration(8, 8)).toBe('quarter');
    });
    
    it('should return "eighth" for durationTicks = 4, divisions = 8', () => {
      expect(getNoteTypeFromDuration(4, 8)).toBe('eighth');
    });

    it('should return "whole" for durationTicks = 32, divisions = 8', () => {
      expect(getNoteTypeFromDuration(32, 8)).toBe('whole');
    });
    
    it('should default to "quarter" and warn for very small, unhandled durations', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(getNoteTypeFromDuration(0.1, 4)).toBe('quarter');
      expect(consoleWarnSpy).toHaveBeenCalledWith("Could not determine note type for duration 0.1 with 4 divisions. Defaulting to 'quarter'.");
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getMusicXMLDurationType', () => {
    it('should return "whole" for beatValue = 1', () => {
      expect(getMusicXMLDurationType(1)).toBe('whole');
    });
    it('should return "half" for beatValue = 2', () => {
      expect(getMusicXMLDurationType(2)).toBe('half');
    });
    it('should return "quarter" for beatValue = 4', () => {
      expect(getMusicXMLDurationType(4)).toBe('quarter');
    });
    it('should return "eighth" for beatValue = 8', () => {
      expect(getMusicXMLDurationType(8)).toBe('eighth');
    });
    it('should return "16th" for beatValue = 16', () => {
      expect(getMusicXMLDurationType(16)).toBe('16th');
    });
    it('should return "32nd" for beatValue = 32', () => {
      expect(getMusicXMLDurationType(32)).toBe('32nd');
    });
    it('should default to "quarter" and warn for unsupported beatValue', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(getMusicXMLDurationType(3)).toBe('quarter');
      expect(consoleWarnSpy).toHaveBeenCalledWith("Unsupported beat value 3, defaulting type to 'quarter'.");
      consoleWarnSpy.mockRestore();
    });
  });
});
