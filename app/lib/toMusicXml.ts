interface NoteObject {
  note?: string; // Note name like "C4", "F#5", "Bb3"
  rhythm?: number | null; // Numerical representation (e.g., 4 for quarter)
}

interface RhythmInfo {
  type: string; // MusicXML note type (e.g., "quarter", "half")
  duration: number; // MusicXML duration based on divisions
  beats: number; // Duration in terms of beats (e.g., 1.0 for quarter in 4/4)
}

interface PitchInfo {
  step: string; // Note letter (A-G)
  alter: number; // -1 for flat, 0 for natural, 1 for sharp
  octave: string; // Octave number
}

/**
 * Parses a note string (e.g., "C#4") into its components.
 * @param noteStr The note string to parse.
 * @returns A PitchInfo object or null if parsing fails.
 */
function parseNote(noteStr: string): PitchInfo | null {
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

// --- Constants and Mappings (shared) ---
const divisions: number = 4; // Divisions per quarter note (higher values like 12 or 24 allow for triplets more easily if needed)
const beatsPerMeasure: number = 4.0; // Assuming 4/4 time for measure calculation
const beatType: number = 4; // The 'bottom' number of the time signature
const tolerance: number = 1e-6; // For floating point comparisons

// Map input rhythm value to MusicXML type and duration based on 'divisions'
// Ensure durations are integers if divisions change
const rhythmMap = new Map<number, RhythmInfo>([
  // Assuming divisions = 4, beatType = 4
  [1, { type: 'whole', duration: divisions * 4, beats: 4.0 }],
  [2, { type: 'half', duration: divisions * 2, beats: 2.0 }],
  [4, { type: 'quarter', duration: divisions * 1, beats: 1.0 }],
  [8, { type: 'eighth', duration: divisions / 2, beats: 0.5 }],
  [16, { type: '16th', duration: divisions / 4, beats: 0.25 }],
]);

// --- New Interface for Input Data ---
interface ScoreData {
  melody: NoteObject[];
  accompaniment: NoteObject[];
}

/**
 * Generates the MusicXML for a single part (melody or accompaniment).
 *
 * @param notes The array of NoteObjects for this part.
 * @param partId The unique ID for this part (e.g., "P1", "P2").
 * @param clefSign The clef sign ('G' or 'F').
 * @param clefLine The line number for the clef (e.g., 2 for G, 4 for F).
 * @returns The MusicXML string for the <part> element.
 */
function generatePartXML(
  notes: NoteObject[],
  partId: string,
  clefSign: 'G' | 'F',
  clefLine: number,
): string {
  let partXml = `  <part id="${partId}">\n`;
  let measureNumber: number = 1;
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
