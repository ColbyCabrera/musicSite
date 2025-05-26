'use server';

import { getChordInfoFromRoman } from './harmonyUtils';
import { Interval, Key, Note, Scale } from 'tonal';
import { weightedRandomChoice } from './utils';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { generateRhythm } from './rhythm';
import { ApiError, GenerationError, InvalidInputError, MusicTheoryError } from './errors';


const API_KEY = process.env.GEMINI_API_KEY;

let genAIInstance: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAIInstance) {
    if (!API_KEY) {
      throw new ApiError('GEMINI_API_KEY is not set in environment variables.');
    }
    genAIInstance = new GoogleGenAI({ apiKey: API_KEY });
  }
  return genAIInstance;
}


// returns object with melody and accompaniment
export default async function generateMA(
  progression: string[],
  key: string,
  meter: string,
  rangeConstraints: {
    melody: { min: string; max: string };
    accompaniment: { min: string; max: string };
  },
): Promise<{ melody: Melody; accompaniment: Melody }> {
  const melody = generateMelody(
    progression,
    key,
    meter,
    rangeConstraints.melody.min,
    rangeConstraints.melody.max,
  );
  const accompaniment = generateMelody(
    progression,
    key,
    meter,
    rangeConstraints.accompaniment.min,
    rangeConstraints.accompaniment.max,
  );

  let geminiResponseText: string | undefined;
  try {
    const genAI = getGenAI(); // Initialize or get existing instance
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-preview-0514", // Ensure this model name is current
      // GenerationConfig and SafetySettings can be added here if needed
      // generationConfig: { temperature: 0.7 },
      // safetySettings: [
      //   { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      //   // Add other categories as needed
      // ]
    });
    const result = await model.generateContent({
      contents: [{role: "user", parts: [{
          text: `You are an expert virtual composer specializing in creating sophisticated and stylistically appropriate musical accompaniments.

Your task is to generate a compelling accompaniment for a given melody. The accompaniment should be rhythmically and harmonically engaging, demonstrating a high degree of musical craftsmanship within the provided chord progression.

Key Parameters:

Melody: ${JSON.stringify(melody)} (This is an array of note objects, e.g., [{"note": "C4", "rhythm": 4, "durationBars": 0.5}, {"note": "E4", "rhythm": 4, "durationBars": 0.5}] where rhythm indicates the note value (4 = quarter, 8 = eighth) and durationBars indicates its length in terms of bars or fractions thereof, ensuring clarity for the AI).
Key Signature: ${key}
Meter: ${meter} (e.g., "4/4", "3/4")
Chord Progression: ${progression} (e.g., ["Cmaj7", "Am7", "Dm7", "G7"], ensure chords are clearly defined for each bar or section).
Desired Musical Style/Genre: [Specify Style, e.g., "Baroque counterpoint," "Romantic piano," "Jazz walking bass with comping," "Contemporary pop ballad"]
Desired Mood/Character: [Specify Mood, e.g., "Lyrical and flowing," "Energetic and driving," "Reflective and melancholic," "Playful and light"]
Accompaniment Range Constraints: ${rangeConstraints.accompaniment.min} to ${rangeConstraints.accompaniment.max}.
Accompaniment Generation Guidelines:

Avoid voice crossing.
Don't use the same accompaniment pattern throughout the entire piece.

Harmonic Richness:

Go beyond basic triads. Intelligently incorporate chord extensions (7ths, 9ths, 11ths, 13ths), alterations, and suspensions where stylistically appropriate to the specified styles and ${progression}.
Employ smooth and logical voice leading between chords, minimizing awkward jumps unless stylistically intended (e.g., for dramatic effect in certain styles). Consider contrary and oblique motion against the melody.
Rhythmic Complexity and Interaction:

The accompaniment's rhythm should complement and interact with the melody, not just mirror it or be static.
Utilize a variety of rhythmic figures: syncopation, dotted rhythms, triplets (if appropriate for the meter and style), and varied note durations.
Develop rhythmic motifs in the accompaniment that can be subtly varied and repeated.
Ensure each bar adheres strictly to the ${meter}, with the total number of beats accurately filled.
Textural Variety:

Employ a mix of textures. This can include, but is not limited to:
Block Chords: Used judiciously for emphasis or specific stylistic effects.
Arpeggios: Varied patterns (ascending, descending, mixed, spread across octaves).
Broken Chords: (e.g., Alberti bass if stylistically fitting).
Counter-melodies: Introduce secondary melodic lines in the accompaniment that harmonize with the main melody.
Homophonic vs. Polyphonic elements: Introduce moments of greater independence between voices in the accompaniment.
Vary the density of the accompaniment (number of simultaneous notes) to create dynamic interest and support the melody's phrasing.
Melodic Coherence in Accompaniment:

While supporting the harmony, individual lines within the accompaniment should possess some melodic integrity.
Make use of non-chord tones thoughtfully: passing tones, neighbor tones, appoggiaturas, and escape tones to create smoother lines and add expressive detail. Ensure these resolve correctly according to common practice harmony or the specified style.
Structural Awareness:

The accompaniment should span the same total number of bars as implied by the melody and chord progression.
Consider the overall form. If the melody has distinct sections (verse, chorus), the accompaniment should reflect these changes in character or intensity if appropriate for the musicalStyle.
Output Format:

The accompaniment MUST be an array of note objects. Each object must have a "note" property (e.g., "C#4", "Bb3") and a "rhythm" property (e.g., 4 for quarter, 8 for eighth, 2 for half, 1 for whole, 16 for sixteenth).
Example: [{"note": "C3", "rhythm": 4}, {"note": "E3", "rhythm": 4}, {"note": "G3", "rhythm": 4}, ...]
Return ONLY the JSON array of accompaniment note objects. Do not include any explanatory text or apologies if the task is challenging. Focus on generating the highest quality musical output based on these detailed instructions.`}]}],
    });
    const response = result.response;
    geminiResponseText = response.text();

  } catch (error: unknown) { // Catch unknown to inspect it
    if (error instanceof Error) {
      console.error('Gemini API Error:', error.message);
      throw new ApiError(`Failed to generate accompaniment using Gemini API: ${error.message}`);
    } else {
      console.error('Unknown Gemini API Error:', error);
      throw new ApiError('Failed to generate accompaniment using Gemini API due to an unknown error.');
    }
  }
  
  if (!geminiResponseText) {
    throw new ApiError('Received no text response from Gemini API.');
  }

  // console.log(geminiResponseText); // Log for debugging API response

  try {
    // Attempt to parse the response, assuming it might be wrapped in markdown (```json ... ```)
    const jsonMatch = geminiResponseText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonToParse = jsonMatch ? jsonMatch[1] : geminiResponseText;
    const parsedAccompaniment = JSON.parse(jsonToParse) as Melody;
    
    return {
      melody,
      accompaniment: parsedAccompaniment,
    };
  } catch (parseError: unknown) {
    console.error('Failed to parse Gemini API response as JSON:', geminiResponseText, parseError);
    throw new GenerationError(`Failed to parse accompaniment from API response. Raw response: "${geminiResponseText}"`);
  }
}

type Melody = { note: string; rhythm: number }[];

function generateMelody(
  progression: string[],
  keySignature: string, // Renamed for clarity
  meter: string,
  minRange: string,
  maxRange: string,
): Melody { // Added return type
  const keyDetails = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
  if (!keyDetails || !keyDetails.tonic) {
    throw new InvalidInputError(`Invalid key signature for melody generation: ${keySignature}`);
  }

  const melody: Melody = [];
  // Ensure startingNote is valid, provide a fallback octave if needed
  const tonic = keyDetails.scale[0];
  const startingNoteOctave = Note.get(tonic + '4').oct === undefined ? 4 : Note.get(tonic + '4').oct;
  const startingNote = tonic + (startingNoteOctave ?? 4);


  progression.forEach((chordSymbol, i) => {
    let chordInfo;
    try {
      chordInfo = getChordInfoFromRoman(chordSymbol, keySignature);
    } catch (e) {
      // If a specific chord symbol fails, log and skip trying to use its notes,
      // but continue generating rhythm and diatonic melody for that segment.
      console.warn(`generateMelody: Error processing Roman numeral "${chordSymbol}" for chord-based notes. Error: ${(e as Error).message}. Will use diatonic notes.`);
      chordInfo = null; // Allow generation to proceed with diatonic context
    }

    let rhythm;
    try {
      rhythm = generateRhythm(meter, 3); // Using moderate complexity for melody rhythm
    } catch (e) {
        console.error(`generateMelody: Failed to generate rhythm for meter "${meter}". Error: ${(e as Error).message}`);
        throw new GenerationError(`Failed to generate rhythm for meter "${meter}": ${(e as Error).message}`);
    }
    
    if (i === 0) {
      const firstRhythm = rhythm.shift();
      if (!firstRhythm) {
        throw new GenerationError("Failed to get first rhythm value for starting note.");
      }
      melody.push({ note: startingNote, rhythm: firstRhythm });
    }

    rhythm.forEach((noteLength) => {
      const lastMelodyNote = melody[melody.length - 1]?.note;
      if (!lastMelodyNote) { // Should not happen after first note is added
        throw new GenerationError("Cannot determine last melody note for diatonic context.");
      }
      const lastNoteDetails = Note.get(lastMelodyNote);
      if (lastNoteDetails.empty) {
         throw new MusicTheoryError(`Invalid last note in melody: ${lastMelodyNote}`);
      }


      const diatonicNotes: (string | null)[] = [];
      for (let step = -3; step <= 3; step++) { // Reduced range for more focused choices
        diatonicNotes.push(
          transposeDiatonicallyBySteps(
            lastNoteDetails.name,
            step,
            `${keyDetails.tonic} ${keyDetails.type}`,
          ),
        );
      }
      const validDiatonicNotes = diatonicNotes.filter(n => n !== null) as string[];


      const choices: { item: string[]; weight: number }[] = [
        {
          item: validDiatonicNotes.map(noteName =>
            putInRange(noteName, minRange, maxRange)
          ),
          weight: 1, // Base weight for diatonic movement
        }
      ];

      if (chordInfo && chordInfo.noteNames) {
        choices.push({
          item: chordInfo.noteNames.map(noteName => {
            const noteDetails = Note.get(noteName);
            const lastOctave = lastNoteDetails.oct ?? 4; // Fallback octave
            return putInRange(noteDetails.letter + lastOctave, minRange, maxRange);
          }),
          weight: 2, // Higher weight for chord tones
        });
      }
      
      const possibleNotes = weightedRandomChoice(choices.filter(c => c.item.length > 0));


      // console.log(possibleNotes); // Debugging

      // Handle the case where possibleNotes might be null or empty
      let nextMelodyNote: string;
      if (possibleNotes && possibleNotes.length > 0) {
        nextMelodyNote = getNextNote(melody, key, possibleNotes);
      } else {
        // Fallback strategy if no possible notes were determined (e.g., all weights were zero, or items were empty)
        // Revert to the last note or a simple step from it, or tonic.
        console.warn(`generateMelody: No possible notes from weighted choice for chord ${chord}. Using fallback.`);
        const fallbackLastNote = melody[melody.length -1]?.note ?? (keyObj.scale[0] + '4');
        // Attempt a simple step up or down, or just use the fallbackLastNote
        nextMelodyNote = getStepUp(fallbackLastNote, key) || fallbackLastNote; 
        // Ensure the fallback is also within range (important if lastNote was near boundary)
        nextMelodyNote = putInRange(nextMelodyNote, minRange, maxRange);
      }
      
      melody.push({
        note: nextMelodyNote,
        rhythm: noteLength,
      });
    });
  });

  // console.log('melody', melody); // Debugging
  if (melody.length === 0) {
    // This might happen if the progression is empty and the initial note wasn't added.
    throw new GenerationError("Failed to generate any notes for the melody.");
  }
  return melody;
}


function getNextNote(
  currentMelody: Melody,
  keySignature: string, // Renamed for clarity
  possibleNotes: string[], // Assumed to be non-empty and validated by caller
): string { // Added return type
  if (possibleNotes.length === 0) {
    // Fallback, though caller should ideally handle empty possibleNotes.
    console.warn("getNextNote called with no possible notes. Returning last melody note or tonic.");
    return currentMelody[currentMelody.length - 1]?.note ?? (Key.majorKey(keySignature)?.tonic ?? 'C') + '4';
  }

  const lastNoteName = currentMelody[currentMelody.length - 1].note;
  const lastNoteDetails = Note.get(lastNoteName);
  if (lastNoteDetails.empty) {
    throw new MusicTheoryError(`Invalid last note in getNextNote: ${lastNoteName}`);
  }

  const noteBeforeLastName = currentMelody[currentMelody.length - 2]?.note;

  if (noteBeforeLastName) {
    const noteBeforeLastDetails = Note.get(noteBeforeLastName);
    if (noteBeforeLastDetails.empty) {
        throw new MusicTheoryError(`Invalid note before last in getNextNote: ${noteBeforeLastName}`);
    }
    if (isLeap(lastNoteDetails.name, noteBeforeLastDetails.name)) {
      const direction = getIntervalDirection(noteBeforeLastDetails.name, lastNoteDetails.name);
      // Attempt to step in the opposite direction of the leap
      const nextNote = direction === 'asc'
        ? getStepDown(lastNoteDetails.name, keySignature)
        : getStepUp(lastNoteDetails.name, keySignature);
      // If the counter-step is valid and in possibleNotes, prefer it. Otherwise, random choice.
      if (nextNote && possibleNotes.includes(nextNote)) return nextNote;
    }
  }
  
  // Default to random choice from the provided valid & ranged possible notes
  const randomIndex = Math.floor(Math.random() * possibleNotes.length);
  return possibleNotes[randomIndex];
}


function getIntervalDirection(
  firstNoteName: string, // Renamed for clarity
  secondNoteName: string, // Renamed for clarity
): 'asc' | 'desc' | 'same' { // Added 'same' for completeness
  const firstMidi = Note.midi(firstNoteName);
  const secondMidi = Note.midi(secondNoteName);

  if (firstMidi === null || secondMidi === null) {
    throw new MusicTheoryError(`Invalid note names for getIntervalDirection: ${firstNoteName}, ${secondNoteName}`);
  }

  if (secondMidi > firstMidi) return 'asc';
  if (secondMidi < firstMidi) return 'desc';
  return 'same';
}

function isLeap(firstNoteName: string, secondNoteName: string): boolean { // Renamed parameters
  const interval = Interval.distance(firstNoteName, secondNoteName); // Tonal.Interval can handle note names
  const semitones = Interval.semitones(interval);
  if (semitones === undefined) { // Should not happen with valid note names
    throw new MusicTheoryError(`Could not determine semitones for interval between ${firstNoteName} and ${secondNoteName}`);
  }
  // A leap is typically more than a major second (2 semitones)
  return Math.abs(semitones) > 2;
}

function getStepUp(noteName: string, keySignature: string): string | null { // Renamed parameters, added null return
  const currNoteDetails = Note.get(noteName);
  if (currNoteDetails.empty) {
    throw new MusicTheoryError(`Invalid note for getStepUp: ${noteName}`);
  }

  const keyObj = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
  if (!keyObj || !keyObj.tonic) {
    throw new InvalidInputError(`Invalid key for getStepUp: ${keySignature}`);
  }
  const scale = keyObj.scale;
  const currentPcIndex = scale.indexOf(currNoteDetails.pc);
  if (currentPcIndex === -1) {
    console.warn(`getStepUp: Note ${noteName} (PC: ${currNoteDetails.pc}) not in scale ${keySignature}. Transposing chromatically.`);
    return Note.transpose(noteName, 'm2'); // Fallback to chromatic step if PC not in scale
  }

  const nextPcIndex = (currentPcIndex + 1) % scale.length;
  const nextPc = scale[nextPcIndex];
  
  // Determine octave: if nextPc is lower than currentPc (e.g. B to C), increment octave.
  let octave = currNoteDetails.oct ?? 4; // Fallback octave
  if (Tonal.Note.chroma(nextPc)! < Tonal.Note.chroma(currNoteDetails.pc)!) {
    octave++;
  }
  return nextPc + octave;
}

function getStepDown(noteName: string, keySignature: string): string | null { // Renamed, added null return
  const currNoteDetails = Note.get(noteName);
   if (currNoteDetails.empty) {
    throw new MusicTheoryError(`Invalid note for getStepDown: ${noteName}`);
  }

  const keyObj = Key.majorKey(keySignature) ?? Key.minorKey(keySignature);
   if (!keyObj || !keyObj.tonic) {
    throw new InvalidInputError(`Invalid key for getStepDown: ${keySignature}`);
  }
  const scale = keyObj.scale;
  const currentPcIndex = scale.indexOf(currNoteDetails.pc);

  if (currentPcIndex === -1) {
    console.warn(`getStepDown: Note ${noteName} (PC: ${currNoteDetails.pc}) not in scale ${keySignature}. Transposing chromatically.`);
    return Note.transpose(noteName, '-m2'); // Fallback to chromatic step
  }

  const prevPcIndex = (currentPcIndex - 1 + scale.length) % scale.length;
  const prevPc = scale[prevPcIndex];

  let octave = currNoteDetails.oct ?? 4;
  if (Tonal.Note.chroma(prevPc)! > Tonal.Note.chroma(currNoteDetails.pc)!) {
    octave--;
  }
  return prevPc + octave;
}


/**
 * Transposes a note by a given number of diatonic steps within a specified scale.
 * Assumes the input note's pitch class exists within the scale.
 * Defaults to the C Major scale.
 *
 * @param {string} noteName - The starting note in scientific pitch notation (e.g., "C4", "B3").
 * @param {number} intervalQuantity - The number of diatonic steps to move.
 * Positive for up, negative for down, 0 for no change.
 * e.g., +1 (up a step), -1 (down a step), +2 (up a third), +7 (up an octave).
 * @param {string} [scaleName='C major'] - The name of the scale to use (e.g., "C major", "G harmonic minor").
 * @returns {string|null} The resulting note name (e.g., "D4", "A3", "B4"),
 * or null if the input note or scale is invalid or the note's pitch class isn't in the scale.
 */
function transposeDiatonicallyBySteps(
  noteName: string,
  intervalQuantity: number,
  scaleName = 'C major',
) {
  // Validate interval quantity (integer)
  if (!Number.isInteger(intervalQuantity)) {
    // console.warn // console.error is too strong for a utility function, let caller decide.
    throw new InvalidInputError(`Invalid interval quantity: ${intervalQuantity} (must be an integer)`);
  }

  // Validate and parse the input note
  const startNoteDetails = Note.get(noteName);
  if (startNoteDetails.empty || !startNoteDetails.pc || startNoteDetails.oct === undefined) {
    throw new MusicTheoryError(`Invalid input note for transposition: ${noteName}`);
  }

  // Get the notes of the specified scale
  const scaleDetails = Scale.get(scaleName);
  if (scaleDetails.empty || scaleDetails.notes.length === 0) {
     throw new MusicTheoryError(`Invalid or empty scale for transposition: ${scaleName}`);
  }
  const scaleNotes = scaleDetails.notes;
  const scaleSize = scaleNotes.length;

  // Find the index of the starting note's pitch class in the scale
  const pcIndex = scaleNotes.indexOf(startNoteDetails.pc);
  if (pcIndex === -1) {
    // This might be a common case if a chromatic note is passed with a diatonic scale.
    // Depending on desired behavior, could throw, or try to find closest diatonic.
    // For now, let's consider it an issue if exact PC not found.
    console.warn(`transposeDiatonicallyBySteps: Pitch class ${startNoteDetails.pc} (from note ${noteName}) not found in scale ${scaleName}. Returning null.`);
    return null; 
  }

  // Calculate the target index in the scale notes array
  const targetPcIndex = (pcIndex + intervalQuantity % scaleSize + scaleSize) % scaleSize;
  const targetPc = scaleNotes[targetPcIndex];

  // Calculate the change in octaves
  const octaveChange = Math.floor((pcIndex + intervalQuantity) / scaleSize);
  const targetOctave = startNoteDetails.oct + octaveChange;

  const resultNoteName = targetPc + targetOctave;
  const resultNoteDetails = Note.get(resultNoteName);

  // Validate the result note
  if (resultNoteDetails.empty) {
    // This should be rare if logic is correct, but good to check.
    console.warn(`transposeDiatonicallyBySteps: Constructed an invalid note "${resultNoteName}".`);
    return null;
  }

  return resultNoteName;
}

/**
 * Checks if a given note falls within the specified musical range.
 *
 * @param noteName The note to check (e.g., "C4", "F#5").
 * @param minRangeNote The minimum note of the range (e.g., "C4").
 * @param maxRangeNote The maximum note of the range (e.g., "G5").
 * @returns True if the note is within the range (inclusive), false otherwise or if inputs are invalid.
 */
function isInRange(
  noteName: string,
  minRangeNote: string,
  maxRangeNote: string,
): boolean {
  const noteMidi = Note.midi(noteName);
  const minMidi = Note.midi(minRangeNote);
  const maxMidi = Note.midi(maxRangeNote);

  const noteMidi = Note.midi(noteName);
  const minMidi = Note.midi(minRangeNote);
  const maxMidi = Note.midi(maxRangeNote);

  if (noteMidi === null || minMidi === null || maxMidi === null) {
    // console.warn // Potentially too noisy for a utility; caller might handle.
    // Consider if this should throw InvalidInputError if strictness is required.
    return false; // If any note is invalid, it's not "in range"
  }
  if (minMidi > maxMidi) {
    // console.warn(`isInRange: Min range ${minRangeNote} is higher than max range ${maxRangeNote}.`);
    return false; // Invalid range definition
  }

  return noteMidi >= minMidi && noteMidi <= maxMidi;
}

/**
 * Transposes a note by octaves to fit within a specified musical range.
 * If the note cannot fit even after transposition, it clamps to the nearest boundary (min or max).
 *
 * @param noteName The note to potentially adjust (e.g., "C3", "G6").
 * @param minRangeNote The minimum note of the target range (e.g., "C4").
 * @param maxRangeNote The maximum note of the target range (e.g., "G5").
 * @returns The adjusted note name within the range, or the original note if inputs are invalid.
 */
function putInRange(
  noteName: string,
  minRangeNote: string,
  maxRangeNote: string,
): string {
  const originalMidi = Note.midi(noteName);
  const minMidi = Note.midi(minRangeNote);
  const maxMidi = Note.midi(maxRangeNote);

  // --- Input Validation ---
  if (originalMidi === null || minMidi === null || maxMidi === null) {
    // console.warn(`putInRange: Invalid MIDI for note "${noteName}", min "${minRangeNote}", or max "${maxRangeNote}". Returning original.`);
    // This could throw InvalidInputError if strict behavior is preferred.
    return noteName; 
  }
  if (minMidi > maxMidi) {
    // console.warn(`putInRange: Min range ${minRangeNote} is higher than max range ${maxRangeNote}. Returning original note.`);
    return noteName; 
  }

  // --- Check if already in range ---
  if (originalMidi >= minMidi && originalMidi <= maxMidi) {
    return noteName; // Already in range
  }

  // --- Transpose if out of range ---
  let currentNote = noteName;
  let currentMidi = originalMidi;

  if (currentMidi < minMidi) {
    // Note is too low, transpose up by octaves
    while (currentMidi < minMidi) {
      const nextNote = Note.transpose(currentNote, '8P'); // 8P = Perfect Octave up
      const nextMidi = Note.midi(nextNote);
      if (nextMidi === null) { // Should be very rare with valid octave transposition
        throw new MusicTheoryError(`Error transposing ${currentNote} up by octave in putInRange.`);
      }
      // Check if transposing up *overshot* the max range
      if (nextMidi > maxMidi) {
        // It overshot. Decide whether min or max boundary is closer *musically* (MIDI difference)
        // This case means the note's pitch class might not fit well.
        // Clamp to the closest boundary.
        return minMidi - currentMidi <= nextMidi - maxMidi
          ? minRangeNote
          : maxRangeNote;
        // Alternative: Could return the last valid note *before* overshooting, which is currentNote.
        // return currentNote; // This might be less musically jarring than clamping sometimes. Choose one behavior.
        // Let's stick to clamping for now as requested.
      }
      currentNote = nextNote;
      currentMidi = nextMidi;
      // If it lands exactly in range, we'll exit the loop or the next check will pass.
    }
    // After loop, currentMidi >= minMidi. It might be > maxMidi if the initial overshoot check wasn't triggered (e.g., landed exactly on maxMidi+1).
    // Re-check final position.
    return currentMidi <= maxMidi ? currentNote : maxRangeNote; // Clamp to max if final position is too high
  } else {
    // currentMidi > maxMidi
    // Note is too high, transpose down by octaves
    while (currentMidi > maxMidi) {
      const nextNote = Note.transpose(currentNote, '-8P'); // -8P = Perfect Octave down
      const nextMidi = Note.midi(nextNote);
      if (nextMidi === null) { // Should be very rare
        throw new MusicTheoryError(`Error transposing ${currentNote} down by octave in putInRange.`);
      }
      // Check if transposing down *undershot* the min range
      if (nextMidi < minMidi) {
        // It undershot. Clamp to the closest boundary.
        return currentMidi - maxMidi <= minMidi - nextMidi
          ? maxRangeNote
          : minRangeNote;
        // Alternative: return currentNote; // Return last valid note before undershooting.
      }
      currentNote = nextNote;
      currentMidi = nextMidi;
    }
    // After loop, currentMidi <= maxMidi. Re-check final position.
    return currentMidi >= minMidi ? currentNote : minRangeNote; // Clamp to min if final position is too low
  }
}
