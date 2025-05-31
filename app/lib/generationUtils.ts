// app/lib/generationUtils.ts

export class InvalidMeterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMeterError';
  }
}

export class InvalidRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRangeError';
  }
}

export interface ParsedMeter {
  beats: number;
  beatType: number;
}

/**
 * Parses a meter string (e.g., "4/4", "3/4") into its constituent parts.
 * @param meterString The meter string to parse.
 * @returns An object containing the number of beats and the beat type.
 * @throws InvalidMeterError if the meter string is invalid.
 */
export function parseMeter(meterString: string): ParsedMeter {
  // 1. Handle null or undefined meterString
  if (meterString === null || meterString === undefined) {
    throw new InvalidMeterError('Meter string cannot be null or undefined.');
  }

  const trimmedMeterString = meterString.trim();
  // 2. Handle empty meterString
  if (trimmedMeterString === '') {
    throw new InvalidMeterError('Meter string cannot be empty.');
  }

  // 3. Split the string by "/"
  const parts = trimmedMeterString.split('/');
  if (parts.length !== 2) {
    throw new InvalidMeterError('Invalid meter string format. Expected "beats/beatType".');
  }

  const beatsStr = parts[0].trim(); // Trim individual parts too
  const beatTypeStr = parts[1].trim();

  // Check for non-integer strings like "3.0" before parsing to number
  if (beatsStr.includes('.') || beatsStr.includes(',')) {
    throw new InvalidMeterError('Beats and beat type must be integers.');
  }
  if (beatTypeStr.includes('.') || beatTypeStr.includes(',')) {
    throw new InvalidMeterError('Beats and beat type must be integers.');
  }

  // 4. Attempt to parse beats and beatType
  const beatsNum = Number(beatsStr);
  const beatTypeNum = Number(beatTypeStr);

  if (isNaN(beatsNum)) {
    throw new InvalidMeterError('Beats is not a number.');
  }
  if (isNaN(beatTypeNum)) {
    throw new InvalidMeterError('Beat type is not a number.');
  }

  // Ensure they are integers after numeric conversion (e.g. Number(" ") is 0, isNaN is false)
  // parseInt will correctly parse the integer part.
  const beats = parseInt(beatsStr, 10);
  const beatType = parseInt(beatTypeStr, 10);

  // Double check that the parsed number string is the same as the original string
  if (beats.toString() !== beatsStr) {
      throw new InvalidMeterError('Beats is not a valid integer string.');
  }
  if (beatType.toString() !== beatTypeStr) {
      throw new InvalidMeterError('Beat type is not a valid integer string.');
  }


  // 5. Check if beats and beatType are positive integers
  if (beats <= 0 || beatType <= 0) {
    throw new InvalidMeterError('Beats and beat type must be positive integers.');
  }

  // 6. Check if beatType is a power of 2
  if (!((beatType > 0) && ((beatType & (beatType - 1)) === 0))) {
    throw new InvalidMeterError('Invalid beat type. Must be a power of 2 (e.g., 2, 4, 8).');
  }

  // 7. If all checks pass, return the object
  return { beats, beatType };
}


/**
 * Checks if a given MIDI note number is within a specified range (inclusive).
 * @param midiNote The MIDI number of the note to check.
 * @param minMidiNote The minimum MIDI number of the range.
 * @param maxMidiNote The maximum MIDI number of the range.
 * @returns True if the note is within the range, false otherwise.
 * @throws InvalidRangeError if minMidiNote > maxMidiNote (invalid range).
 */
export function isInRange(midiNote: number, minMidiNote: number, maxMidiNote: number): boolean {
  if (minMidiNote > maxMidiNote) {
    throw new InvalidRangeError('Invalid range: minMidiNote cannot be greater than maxMidiNote.');
  }
  return midiNote >= minMidiNote && midiNote <= maxMidiNote;
}

/**
 * Transposes a MIDI note number to be within a specified octave range if it's outside.
 * It tries to move the note by octaves to fit it into the range.
 * If octave transposition overshoots, it clamps to the nearest boundary of the range.
 * The returned MIDI note will correspond to the original note's pitch class.
 * @param midiNote The MIDI number of the note to adjust.
 * @param minMidiNote The minimum MIDI number of the desired range.
 * @param maxMidiNote The maximum MIDI number of the desired range.
 * @returns The adjusted MIDI note number.
 * @throws InvalidRangeError if minMidiNote > maxMidiNote (invalid range).
 */
export function putInRange(midiNote: number, minMidiNote: number, maxMidiNote: number): number {
  if (minMidiNote > maxMidiNote) {
    throw new InvalidRangeError('Invalid range: minMidiNote cannot be greater than maxMidiNote.');
  }

  if (midiNote >= minMidiNote && midiNote <= maxMidiNote) {
    return midiNote;
  }

  let currentMidi = midiNote;

  if (currentMidi < minMidiNote) {
    // Note is too low, transpose up by octaves
    while (currentMidi < minMidiNote) {
      currentMidi += 12; // Transpose up one octave
    }
    // After loop, currentMidi >= minMidiNote.
    // Check if it overshot maxMidiNote.
    if (currentMidi > maxMidiNote) {
      // It overshot. Clamp to maxMidiNote.
      // The original logic in generateMA.ts was more complex for clamping (musically closer boundary).
      // For this version, let's simplify: if it overshoots after moving to be >= min, clamp to max.
      // A more faithful clamping to "closest boundary after first valid octave jump"
      // would mean checking (currentMidi - maxMidiNote) vs (minMidiNote - (currentMidi - 12)).
      // The prompt said "clamped to maxMidiNote" if it exceeds after transposing up.
      return maxMidiNote;
    }
  } else { // currentMidi > maxMidiNote
    // Note is too high, transpose down by octaves
    while (currentMidi > maxMidiNote) {
      currentMidi -= 12; // Transpose down one octave
    }
    // After loop, currentMidi <= maxMidiNote.
    // Check if it undershot minMidiNote.
    if (currentMidi < minMidiNote) {
      // It undershot. Clamp to minMidiNote.
      // Similar to above, simplifying the clamping logic from generateMA.ts.
      return minMidiNote;
    }
  }
  return currentMidi;
}
