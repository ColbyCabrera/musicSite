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
  
  /**
   * Converts a melody represented as an array of note objects
   * into a MusicXML string.
   *
   * @param melody An array of NoteObjects.
   * @param title The title to embed in the MusicXML score. Defaults to "Generated Melody".
   * @returns A string containing the MusicXML representation of the melody.
   */
  export function melodyToMusicXML(melody: NoteObject[], title: string = "Generated Melody"): string {
  
    // --- MusicXML constants and mappings ---
    const divisions: number = 4; // Divisions per quarter note
    const beatsPerMeasure: number = 4.0; // Assuming 4/4 time for measure calculation
    const tolerance: number = 1e-6; // For floating point comparisons
  
    // Map input rhythm value to MusicXML type and duration based on 'divisions'
    const rhythmMap = new Map<number, RhythmInfo>([
      [1, { type: "whole", duration: divisions * 4, beats: 4.0 }],
      [2, { type: "half", duration: divisions * 2, beats: 2.0 }],
      [4, { type: "quarter", duration: divisions * 1, beats: 1.0 }],
      [8, { type: "eighth", duration: divisions / 2, beats: 0.5 }],
      [16, { type: "16th", duration: divisions / 4, beats: 0.25 }],
      // Add more mappings if needed (e.g., dotted notes, triplets) - ensure duration is integer
    ]);
  
  
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
    </part-list>
    <part id="P1">
  `; // Start Part P1
  
    let measureNumber: number = 1;
    let currentBeatInMeasure: number = 0.0;
    let isFirstMeasure: boolean = true; // Flag to add attributes only once
  
    // Function to start a new measure
    const startNewMeasure = () => {
        xml += `    <measure number="${measureNumber}">\n`;
        if (isFirstMeasure) {
            xml += `      <attributes>\n`;
            xml += `        <divisions>${divisions}</divisions>\n`;
            xml += `        <key>\n`;
            xml += `          <fifths>0</fifths>\n`; // C Major / A Minor
            xml += `          <mode>major</mode>\n`;
            xml += `        </key>\n`;
            xml += `        <time>\n`;
            xml += `          <beats>${Math.floor(beatsPerMeasure)}</beats>\n`; // Assuming x/4
            xml += `          <beat-type>4</beat-type>\n`;
            xml += `        </time>\n`;
            xml += `        <clef>\n`;
            xml += `          <sign>G</sign>\n`; // Treble Clef
            xml += `          <line>2</line>\n`;
            xml += `        </clef>\n`;
            xml += `      </attributes>\n`;
            isFirstMeasure = false;
        }
    };
  
    // Start the first measure
    startNewMeasure();
  
    // --- Process each note ---
    for (const noteObj of melody) {
      const noteStr = noteObj.note;
      const rhythmVal = noteObj.rhythm;
  
      // --- Validate data ---
      if (!noteStr || typeof rhythmVal !== 'number') {
        console.warn(`Skipping invalid note object: ${JSON.stringify(noteObj)}`);
        continue; // Skip this note if essential data is missing or rhythm is not a number
      }
  
      const rhythmInfo = rhythmMap.get(rhythmVal);
      if (!rhythmInfo || !Number.isInteger(rhythmInfo.duration)) { // Ensure duration is valid and an integer
          console.warn(`Skipping note with unrecognized or invalid rhythm value ${rhythmVal}: ${JSON.stringify(noteObj)}`);
          continue; // Skip if rhythm value isn't in our map or duration calculation is invalid
      }
  
      const pitchInfo = parseNote(noteStr);
      if (!pitchInfo) {
           console.warn(`Skipping note with unparseable pitch ${noteStr}: ${JSON.stringify(noteObj)}`);
           continue; // Skip if pitch couldn't be parsed
      }
  
      // --- Check if a new measure is needed ---
      if (currentBeatInMeasure + rhythmInfo.beats > beatsPerMeasure + tolerance) {
        // Close current measure
        xml += `    </measure>\n`;
        // Start new measure
        measureNumber++;
        currentBeatInMeasure = 0.0; // Reset beat count for the new measure
        startNewMeasure(); // Add measure tag and attributes if first measure
      }
  
      // --- Add the note element ---
      xml += `      <note>\n`;
      xml += `        <pitch>\n`;
      xml += `          <step>${pitchInfo.step}</step>\n`;
      if (pitchInfo.alter !== 0) {
        xml += `          <alter>${pitchInfo.alter}</alter>\n`;
      }
      xml += `          <octave>${pitchInfo.octave}</octave>\n`;
      xml += `        </pitch>\n`;
      xml += `        <duration>${rhythmInfo.duration}</duration>\n`; // Duration must be integer
      xml += `        <type>${rhythmInfo.type}</type>\n`;
      // Add <accidental> if the note has an alteration.
      // Basic version: always add if alter exists. More advanced would track key signature and previous accidentals.
      if (pitchInfo.alter !== 0) {
          const accType = pitchInfo.alter > 0 ? 'sharp' : 'flat';
          xml += `        <accidental>${accType}</accidental>\n`;
      }
      xml += `      </note>\n`;
  
      // Update beat count in the current measure
      currentBeatInMeasure += rhythmInfo.beats;
  
      // --- Handle cases where a note perfectly fills the measure ---
      if (Math.abs(currentBeatInMeasure - beatsPerMeasure) < tolerance) {
         // Close current measure
        xml += `    </measure>\n`;
        // Start new measure for the next note (if any)
        measureNumber++;
        currentBeatInMeasure = 0.0;
        startNewMeasure(); // Start the next measure immediately
      }
    } // End of loop through melody notes
  
    // --- Close final elements ---
    // If the last measure wasn't closed by the loop (e.g., last note didn't fill the measure)
    // Check if the current measure tag is still the *last* thing added (meaning it might be empty)
    const lastMeasureTag = `    <measure number="${measureNumber}">\n`;
    const lastMeasureTagWithAttributes = `      </attributes>\n`; // Check if only attributes were added
  
    // If the last thing added was the start of a new measure tag, and nothing followed (or only attributes followed)
    // And we are NOT in the very first measure case (which must have attributes)
    // This logic is tricky; simpler just to ensure the last tag is closed if needed.
    // If the loop finished and the last measure tag is not closed, close it.
    if (!xml.trim().endsWith('</measure>')) {
        // Avoid closing an empty measure tag if it was *just* opened and nothing added
        // A better check: did we add any notes to this measure number? For simplicity now, just close it.
        xml += `    </measure>\n`;
    }
  
  
    xml += `  </part>\n`;
    xml += `</score-partwise>\n`;
  
    return xml;
  }
  
  // --- Example Usage ---
  const melodyData: NoteObject[] = [
      { note: 'C4', rhythm: 4 }, { note: 'E4', rhythm: 4 }, { note: 'C5', rhythm: 4 },
      { note: 'D4', rhythm: 4 }, { note: 'C4', rhythm: 2 }, { note: 'B4', rhythm: 4 },
      { note: 'D4', rhythm: 8 }, { note: 'C4', rhythm: 8 }, { note: 'G4', rhythm: 4 },
      { note: 'E4', rhythm: 2 }, { note: 'D4', rhythm: 4 }, { note: 'E4', rhythm: 4 },
      { note: 'C4', rhythm: 2 }, { note: 'B3', rhythm: 4 }, { note: 'D3', rhythm: 2 },
      { note: 'C3', rhythm: 8 }, { note: 'D3', rhythm: 4 }, { note: 'E2', rhythm: 8 },
      { note: 'D2', rhythm: 4 }, { note: 'G2', rhythm: 4 }, { note: 'C2', rhythm: 4 },
      { note: 'B1', rhythm: 4 }, { note: 'D1', rhythm: 4 }, { note: 'C1', rhythm: 4 },
      { note: 'G1', rhythm: 8 }, { note: 'E2', rhythm: 4 }, { note: 'B2', rhythm: 8 },
      { note: 'G2', rhythm: 4 }, { note: 'F2', rhythm: 4 }, { note: 'G2', rhythm: 4 },
      { note: 'G2', rhythm: null } // Example of incomplete data
  ];
  
  const musicxmlOutput: string = melodyToMusicXML(melodyData, "My Sample Melody TS");
  console.log(musicxmlOutput);
  
  // To use this in a Node.js project or similar:
  // 1. Save the code as a .ts file (e.g., musicxmlGenerator.ts)
  // 2. Compile it: tsc musicxmlGenerator.ts
  // 3. Run the resulting .js file: node musicxmlGenerator.js
  //
  // Or use ts-node to run directly: ts-node musicxmlGenerator.ts
  
  // You can then take the output string and save it to a file (e.g., melody.musicxml)
  // using Node.js's 'fs' module if needed.
  /*
  import * as fs from 'fs';
  fs.writeFileSync("melody_ts.musicxml", musicxmlOutput, 'utf8');
  console.log("MusicXML saved to melody_ts.musicxml");
  */