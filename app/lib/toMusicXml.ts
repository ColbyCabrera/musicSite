// src/toMusicXml.ts

// TODO: Consider moving these interfaces to types.ts if they are used externally or for broader consistency.

/**
 * Represents a musical note with its pitch and rhythm.
 * Used as input for generating MusicXML.
 */
interface NoteObject {
  /** The scientific pitch notation of the note (e.g., "C4", "F#5", "Bb3"). Optional. */
  note?: string;
  /**
   * A numerical representation of the note's rhythm/duration.
   * For example, 1 for whole, 2 for half, 4 for quarter, 8 for eighth, 16 for sixteenth.
   * Optional, can be null.
   */
  rhythm?: number | null;
}

/**
 * Holds information about a specific rhythmic value in MusicXML context.
 */
interface RhythmInfo {
  /** The MusicXML note type string (e.g., "quarter", "half", "eighth"). */
  type: string;
  /** The duration of the note in MusicXML divisions (ticks). */
  duration: number;
  /** The duration of the note in terms of beats within the measure (e.g., 1.0 for a quarter note in 4/4 time). */
  beats: number;
}

/**
 * Represents the constituent parts of a musical pitch for MusicXML.
 */
interface PitchInfo {
  /** The note's letter name (A, B, C, D, E, F, G). */
  step: string;
  /**
   * The alteration of the note:
   * - -2: double flat
   * - -1: flat
   * -  0: natural (often omitted in MusicXML if no accidental is displayed)
   * -  1: sharp
   * -  2: double sharp
   */
  alter: number;
  /** The octave number as a string (e.g., "4" for the octave containing middle C). */
  octave: string;
}

/**
 * Parses a note string in scientific pitch notation (e.g., "C#4", "Bb3")
 * into its fundamental components: step (letter), alteration (accidental), and octave.
 *
 * @param {string} noteStr - The note string to parse.
 * @returns {PitchInfo | null} A `PitchInfo` object containing the parsed components,
 *                             or `null` if the note string is invalid or cannot be parsed.
 */
function parseNote(noteStr: string): PitchInfo | null {
  // Regex to capture: 1=letter, 2=accidental (optional), 3=octave
  const match = noteStr.match(/([A-Ga-g])([#b]?)(\d+)/);
  if (match) {
    const step = match[1].toUpperCase();
    const alterStr = match[2];
    const octave = match[3];
    let alter = 0;
    if (alterStr === '#') {
      alter = 1;
    } else if (alterStr === 'b') {
      alter = -1;
    }
    return { step, alter, octave };
  }
  console.warn(`Could not parse note string: ${noteStr}`);
  return null; // Return null if parsing fails
}

// --- Shared Constants and Mappings for MusicXML Generation ---

/** Default number of divisions per quarter note in MusicXML. Higher values allow for finer rhythmic precision. */
const divisions: number = 4;
/** Default number of beats per measure, assuming 4/4 time for calculations if not otherwise specified. */
const beatsPerMeasure: number = 4.0;
/** Default beat type (denominator of time signature), assuming 4/4 time. */
const beatType: number = 4;
/** Small tolerance value used for floating-point comparisons, e.g., when checking if a measure is full. */
const tolerance: number = 1e-6;

/**
 * Maps numerical rhythm representations (e.g., 4 for quarter) to MusicXML note types,
 * durations in divisions, and duration in beats.
 * This map assumes a fixed value for `divisions` (currently 4). If `divisions` changes,
 * the `duration` values here must be updated accordingly.
 * @readonly
 */
const rhythmMap = new Map<number, RhythmInfo>([
  // Assuming divisions = 4 (meaning quarter note = 4 divisions)
  [1, { type: 'whole', duration: divisions * 4, beats: 4.0 }],    // Whole note = 16 divisions
  [2, { type: 'half', duration: divisions * 2, beats: 2.0 }],     // Half note = 8 divisions
  [4, { type: 'quarter', duration: divisions * 1, beats: 1.0 }],   // Quarter note = 4 divisions
  [8, { type: 'eighth', duration: divisions / 2, beats: 0.5 }],    // Eighth note = 2 divisions
  [16, { type: '16th', duration: divisions / 4, beats: 0.25 }],   // Sixteenth note = 1 division
  // TODO: Consider adding 32nd notes (divisions / 8, beats: 0.125) if needed
]);

/**
 * Defines the structure for the input score data, containing separate arrays
 * of `NoteObject` for melody and accompaniment parts.
 */
interface ScoreData {
  /** An array of `NoteObject` representing the melody line. */
  melody: NoteObject[];
  /** An array of `NoteObject` representing the accompaniment part. */
  accompaniment: NoteObject[];
}

/**
 * Generates the MusicXML string for a single musical part (e.g., melody or accompaniment).
 * This includes measure definitions, attributes (clef, time signature, key signature for the first measure),
 * and note/rest elements.
 *
 * @param {NoteObject[]} notes - An array of `NoteObject` instances representing the musical content of this part.
 * @param {string} partId - A unique identifier for this part (e.g., "P1", "P2"), used in the `<part>` element's `id` attribute.
 * @param {('G' | 'F')} clefSign - The clef sign to use for this part ('G' for treble, 'F' for bass).
 * @param {number} clefLine - The staff line number on which the clef is centered (e.g., 2 for G-clef, 4 for F-clef).
 * @returns {string} A string containing the complete MusicXML for the `<part>` element and its contents.
 */
function generatePartXML(
  notes: NoteObject[],
  partId: string,
  clefSign: 'G' | 'F',
  clefLine: number,
): string {
  let partXml = `  <part id="${partId}">\n`; // Start of the <part> element
  let measureNumber: number = 1; // MusicXML measures are typically 1-indexed
  let currentBeatInMeasure: number = 0.0;
  let isFirstMeasure: boolean = true;

  // Function to start a new measure *within this part*
  const startNewMeasure = () => {
    partXml += `    <measure number="${measureNumber}">\n`;
    if (isFirstMeasure) {
      partXml += `      <attributes>\n`;
      partXml += `        <divisions>${divisions}</divisions>\n`;
      partXml += `        <key>\n`;
      partXml += `          <fifths>0</fifths>\n`; // C Major / A Minor
      partXml += `          <mode>major</mode>\n`;
      partXml += `        </key>\n`;
      partXml += `        <time>\n`;
      partXml += `          <beats>${Math.floor(beatsPerMeasure)}</beats>\n`;
      partXml += `          <beat-type>${beatType}</beat-type>\n`;
      partXml += `        </time>\n`;
      partXml += `        <clef>\n`;
      partXml += `          <sign>${clefSign}</sign>\n`;
      partXml += `          <line>${clefLine}</line>\n`;
      partXml += `        </clef>\n`;
      partXml += `      </attributes>\n`;
      isFirstMeasure = false;
    }
  };

  // Start the first measure for this part
  startNewMeasure();

  // Process each note in this part's array
  for (const noteObj of notes) {
    const noteStr = noteObj.note;
    const rhythmVal = noteObj.rhythm;

    // --- Validate data ---
    if (!noteStr || typeof rhythmVal !== 'number') {
      console.warn(
        `Skipping invalid note object in part ${partId}: ${JSON.stringify(noteObj)}`,
      );
      continue;
    }

    const rhythmInfo = rhythmMap.get(rhythmVal);
    if (!rhythmInfo || !Number.isInteger(rhythmInfo.duration)) {
      console.warn(
        `Skipping note with unrecognized/invalid rhythm ${rhythmVal} in part ${partId}: ${JSON.stringify(noteObj)}`,
      );
      continue;
    }

    const pitchInfo = parseNote(noteStr);
    if (!pitchInfo) {
      console.warn(
        `Skipping note with unparseable pitch ${noteStr} in part ${partId}: ${JSON.stringify(noteObj)}`,
      );
      continue;
    }

    // --- Check if a new measure is needed ---
    // Important: This calculation is independent for each part
    if (currentBeatInMeasure + rhythmInfo.beats > beatsPerMeasure + tolerance) {
      // Potentially add rest to fill measure if needed - complex, skipping for now
      console.warn(
        `Note ${noteStr} (${rhythmInfo.type}) in part ${partId} exceeds measure ${measureNumber} bounds. Starting new measure.`,
      );
      partXml += `    </measure>\n`; // Close current measure
      measureNumber++;
      currentBeatInMeasure = 0.0;
      startNewMeasure();
    }

    // --- Add the note element ---
    partXml += `      <note>\n`;
    partXml += `        <pitch>\n`;
    partXml += `          <step>${pitchInfo.step}</step>\n`;
    if (pitchInfo.alter !== 0) {
      partXml += `          <alter>${pitchInfo.alter}</alter>\n`;
    }
    partXml += `          <octave>${pitchInfo.octave}</octave>\n`;
    partXml += `        </pitch>\n`;
    partXml += `        <duration>${rhythmInfo.duration}</duration>\n`;
    partXml += `        <type>${rhythmInfo.type}</type>\n`;
    // Basic accidental display
    if (pitchInfo.alter !== 0) {
      const accType = pitchInfo.alter > 0 ? 'sharp' : 'flat';
      partXml += `        <accidental>${accType}</accidental>\n`;
    }
    partXml += `      </note>\n`;

    // Update beat count in the current measure *for this part*
    currentBeatInMeasure += rhythmInfo.beats;

    // Handle measure completion
    if (Math.abs(currentBeatInMeasure - beatsPerMeasure) < tolerance) {
      partXml += `    </measure>\n`; // Close current measure
      measureNumber++;
      currentBeatInMeasure = 0.0;
      // Check if it's the last note before starting a new measure tag
      if (noteObj !== notes[notes.length - 1]) {
        startNewMeasure(); // Start next measure only if more notes exist
      }
    }
  } // End of loop through notes for this part

  // --- Close final measure if necessary ---
  if (!partXml.trim().endsWith('</measure>')) {
    // Check if the current measure actually has content before closing it
    // A simple check: Does the string contain <note> after the last <measure number=...> ?
    const lastMeasureStartIndex = partXml.lastIndexOf(
      `<measure number="${measureNumber}">`,
    );
    if (
      lastMeasureStartIndex > -1 &&
      partXml.indexOf('<note>', lastMeasureStartIndex) > -1
    ) {
      partXml += `    </measure>\n`;
    } else if (lastMeasureStartIndex > -1 && isFirstMeasure) {
      // If it was the *very first* measure and it's empty, keep it (it has attributes)
      // but maybe add a full measure rest? For simplicity, just close it.
      partXml += `    </measure>\n`;
    } else if (lastMeasureStartIndex > -1) {
      // If an empty measure was started but it's not the first one, potentially remove it?
      // Safest for now is to just close it.
      partXml += `    </measure>\n`;
    }
  }

  partXml += `  </part>\n`; // Close the part
  return partXml;
}

/**
 * Converts a score object containing melody and accompaniment arrays
 * into a MusicXML string with two parts.
 *
 * @param scoreData An object with 'melody' and 'accompaniment' NoteObject arrays.
 * @param title The title to embed in the MusicXML score. Defaults to "Generated Score".
 * @returns A string containing the MusicXML representation of the score.
 */
export function scoreToMusicXML(
  scoreData: ScoreData,
  title: string = 'Generated Score',
): string {
  // --- Start building the MusicXML string ---
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
      </score-part>
    <score-part id="P2">
      <part-name>Accompaniment</part-name>
      </score-part>
  </part-list>
`; // End of part-list

  // --- Generate XML for each part ---
  const melodyPartXML = generatePartXML(scoreData.melody, 'P1', 'G', 2); // Treble Clef for Melody
  const accompanimentPartXML = generatePartXML(
    scoreData.accompaniment,
    'P2',
    'F',
    4,
  ); // Bass Clef for Accompaniment

  xml += melodyPartXML;
  xml += accompanimentPartXML;

  // --- Close final element ---
  xml += `</score-partwise>\n`;

  return xml;
}
