// js/vexflow-display.js
// Description: Handles rendering sheet music using VexFlow.

import { midiToNoteName } from "./tonal-helpers.js";

// Assume VexFlow and Tonal are loaded globally
const {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Accidental,
  KeySignature,
  Beam,
  Voice,
  StaveConnector,
  Dot,
} = Vex.Flow;

// --- Internal Helper Functions ---

function _setupRendererAndContext(container, width, height) {
  container.innerHTML = "";
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  if (!renderer) throw new Error("VexFlow Renderer could not be instantiated.");
  renderer.resize(width, height);
  const context = renderer.getContext();
  if (!context)
    throw new Error("Failed to get rendering context from VexFlow Renderer.");
  context.setFont("Arial", 10).setBackgroundFillStyle("#eed");
  console.log(`Renderer created and resized to ${width}x${height}`);
  return { renderer, context };
}

function _createAndDrawStaves(context, width, keySignature, timeSignature) {
  const staveX = 10;
  const staveTrebleY = 40;
  const staveBassY = 150;
  const staveTreble = new Stave(staveX, staveTrebleY, width)
    .addClef("treble")
    .addTimeSignature(timeSignature)
    .addKeySignature(keySignature);
  const staveBass = new Stave(staveX, staveBassY, width)
    .addClef("bass")
    .addTimeSignature(timeSignature)
    .addKeySignature(keySignature);
  staveTreble.setContext(context).draw();
  staveBass.setContext(context).draw();
  console.log("Staves drawn.");
  return { staveTreble, staveBass };
}

function _drawConnectors(context, staveTop, staveBottom) {
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.BRACE)
    .setContext(context)
    .draw();
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.SINGLE_LEFT)
    .setContext(context)
    .draw();
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.SINGLE_RIGHT)
    .setContext(context)
    .draw();
  console.log("Connectors drawn.");
}

function _processMusicDataToVexNotes(musicData, key) {
  // This function remains largely the same, ensuring 'clef' is passed in props
  const vexNotesByVoice = { soprano: [], alto: [], tenor: [], bass: [] };
  const beams = [];
  const currentVexKeySignature = new KeySignature(key);

  Object.keys(musicData).forEach((voiceName) => {
    const voiceNotesData = musicData[voiceName];
    const clef =
      voiceName === "soprano" || voiceName === "alto" ? "treble" : "bass"; // Determine clef by name
    let notesForCurrentBeam = [];

    voiceNotesData.forEach((noteData, index) => {
      if (
        !noteData ||
        typeof noteData.duration !== "string" ||
        typeof noteData.vexKey !== "string"
      ) {
        console.warn(
          `Skipping invalid note data at index ${index} in voice ${voiceName}:`,
          noteData
        );
        return;
      }
      const noteProps = {
        keys: [noteData.vexKey],
        duration: noteData.duration.replace(/\./g, ""),
        clef: clef, // Pass clef context here!
        auto_stem: true,
      };
      if (noteData.isRest) {
        noteProps.keys = ["b/4"]; // VexFlow convention for rest pitch
        noteProps.duration += "r";
      }
      const staveNote = new StaveNote(noteProps);

      // Add accidentals if needed (logic remains the same)
      if (!noteData.isRest && noteData.midi !== null) {
        const noteNamePart = noteData.vexKey.split("/")[0];
        const tonalNote = Tonal.Note.get(Tonal.Note.simplify(noteNamePart));
        if (tonalNote.acc) {
          const keySigAccidental = currentVexKeySignature.getAccidental(
            tonalNote.letter.toLowerCase()
          );
          let needsExplicitAccidental = false;
          let accidentalType = tonalNote.acc;
          if (!keySigAccidental) {
            needsExplicitAccidental = true;
          } else {
            if (tonalNote.acc !== keySigAccidental.type) {
              needsExplicitAccidental = true;
              if (tonalNote.acc === "") {
                accidentalType = "n";
              }
            }
          }
          if (needsExplicitAccidental) {
            staveNote.addModifier(new Accidental(accidentalType), 0);
          }
        }
      }
      // Add dots if needed (logic remains the same)
      const dotCount = (noteData.duration.match(/\./g) || []).length;
      for (let d = 0; d < dotCount; d++) {
        // Use addDot where appropriate based on VexFlow version
        if (staveNote.addDotToAll) staveNote.addDotToAll(); // VF3
        // else if (Dot && typeof Dot.create === 'function') staveNote.addModifier(Dot.create({ all: true }), 0); // VF4+ example
        else if (Dot) staveNote.addModifier(new Dot(), d); // Might need index? Check docs. Simpler fallback.
      }
      vexNotesByVoice[voiceName].push(staveNote);

      // Beaming logic remains the same
      const isBeamable =
        !noteData.isRest &&
        (noteData.duration.includes("8") || noteData.duration.includes("16"));
      if (isBeamable) {
        notesForCurrentBeam.push(staveNote);
      } else {
        if (notesForCurrentBeam.length > 1) {
          beams.push(new Beam(notesForCurrentBeam));
        }
        notesForCurrentBeam = [];
      }
    });
    if (notesForCurrentBeam.length > 1) {
      beams.push(new Beam(notesForCurrentBeam));
    }
  });
  console.log(
    `Processed ${Object.values(vexNotesByVoice).reduce(
      (sum, notes) => sum + notes.length,
      0
    )} VexFlow notes and ${beams.length} beams.`
  );
  return { vexNotesByVoice, beams };
}

/**
 * Creates VexFlow Voice objects, associates them with staves, and formats them.
 * MODIFIED to correctly group voices.
 * @param {object} vexNotesByVoice - Processed VexFlow notes grouped by voice name.
 * @param {Vex.Flow.Stave} staveTreble - The treble clef stave.
 * @param {Vex.Flow.Stave} staveBass - The bass clef stave.
 * @param {string} timeSignature - The time signature string (e.g., "4/4").
 * @param {number} justifiableWidth - The width available for note formatting.
 * @returns {Vex.Flow.Voice[]} An array of formatted VexFlow Voice objects.
 * @throws {Error} If no voices could be created.
 */
function _createAndFormatVexVoices(
  vexNotesByVoice,
  staveTreble,
  staveBass,
  timeSignature,
  justifiableWidth
) {
  const [num_beats, beat_value] = timeSignature.split("/").map(Number);
  const allVexVoices = [];
  // Store voices intended for each stave
  const trebleVoices = [];
  const bassVoices = [];

  Object.keys(vexNotesByVoice).forEach((voiceName) => {
    const notes = vexNotesByVoice[voiceName];
    if (notes.length === 0) {
      return;
    } // Skip empty voices

    const voice = new Voice({
      num_beats: num_beats,
      beat_value: beat_value,
    }).setStrict(false);
    voice.addTickables(notes);

    // *** Group voices logically based on name ***
    if (voiceName === "soprano" || voiceName === "alto") {
      trebleVoices.push(voice);
      // Optionally try setting stave here if needed by formatter/drawer
      // if (typeof voice.setStave === 'function') voice.setStave(staveTreble);
    } else {
      // tenor or bass
      bassVoices.push(voice);
      // if (typeof voice.setStave === 'function') voice.setStave(staveBass);
    }
    allVexVoices.push(voice); // Keep track of all voices if needed later
  });

  if (allVexVoices.length === 0) {
    throw new Error("No voices could be created.");
  }
  console.log(
    `${allVexVoices.length} VexFlow Voices created (${trebleVoices.length} treble, ${bassVoices.length} bass).`
  );

  // --- Formatting ---
  const formatter = new Formatter();

  // Format voices on the treble stave together.
  if (trebleVoices.length > 0) {
    // Pass the target stave in the options (VexFlow >= 4 standard)
    formatter
      .joinVoices(trebleVoices)
      .format(trebleVoices, justifiableWidth, { stave: staveTreble });
    console.log(`Formatted ${trebleVoices.length} treble voice(s).`);
  }

  // Format voices on the bass stave together.
  if (bassVoices.length > 0) {
    formatter
      .joinVoices(bassVoices)
      .format(bassVoices, justifiableWidth, { stave: staveBass });
    console.log(`Formatted ${bassVoices.length} bass voice(s).`);
  }

  // The formatter should internally associate the voices with the staves passed in the options.
  return allVexVoices; // Return all voices; drawing logic will use getStave()
}

/**
 * Draws the formatted voices and beams onto the rendering context.
 * RELIES on voice.getStave() working after formatting.
 * @param {Vex.Flow.SVGContext} context - The VexFlow rendering context.
 * @param {Vex.Flow.Voice[]} voices - Array of formatted VexFlow Voice objects.
 * @param {Vex.Flow.Beam[]} beams - Array of VexFlow Beam objects.
 */
function _drawVoicesAndBeams(context, voices, beams) {
  voices.forEach((voice) => {
    const stave =
      typeof voice.getStave === "function" ? voice.getStave() : undefined;
    if (stave) {
      // Draw voice associated with its stave (determined by formatter)
      voice.draw(context, stave);
    } else {
      console.warn(
        "Could not retrieve stave associated with voice after formatting. Drawing without stave context."
      );
      voice.draw(context); // Attempt to draw anyway, might be misplaced
    }
  });
  console.log("Voices drawn.");

  beams.forEach((beam) => {
    beam.setContext(context).draw();
  });
  console.log(`${beams.length} beams drawn.`);
}

// --- Exported Function --- (No changes needed here)

export function displayMusic(
  outputContainer,
  musicData,
  key,
  meter,
  numMeasures
) {
  if (!musicData || !musicData.soprano || musicData.soprano.length === 0) {
    console.warn("displayMusic: No music data provided.");
    outputContainer.innerHTML = "<p>No music data available.</p>";
    return;
  }
  if (!outputContainer) {
    throw new Error("displayMusic: Output container element not provided.");
  }
  if (typeof Vex === "undefined" || !Vex.Flow) {
    throw new Error("displayMusic: VexFlow library not loaded.");
  }

  console.log("Starting VexFlow rendering...");
  outputContainer.innerHTML = ""; // Clear container

  try {
    const staveWidthPerMeasure = 80;
    const staveWidth = Math.max(150, numMeasures * staveWidthPerMeasure);
    const rendererWidth = staveWidth + 60;
    const rendererHeight = 300;
    const { context } = _setupRendererAndContext(
      outputContainer,
      rendererWidth,
      rendererHeight
    );

    const timeSignature = meter;
    console.log(
      `Rendering with Time Signature: ${timeSignature}, Key Signature: ${key}`
    );

    const { staveTreble, staveBass } = _createAndDrawStaves(
      context,
      staveWidth,
      key,
      timeSignature
    );
    _drawConnectors(context, staveTreble, staveBass);

    const { vexNotesByVoice, beams } = _processMusicDataToVexNotes(
      musicData,
      key
    );

    // *** FIX: Calculate justifiableWidth BEFORE using it ***
    const justifiableWidth = Math.max(100, staveWidth - 20); // Define it here

    // Now call _createAndFormatVexVoices with the defined variable
    const formattedVoices = _createAndFormatVexVoices(
      vexNotesByVoice,
      staveTreble,
      staveBass,
      timeSignature,
      justifiableWidth
    );

    // Call _drawVoicesAndBeams
    _drawVoicesAndBeams(context, formattedVoices, beams);

    console.log("VexFlow rendering finished successfully.");
  } catch (error) {
    console.error("Error during VexFlow rendering:", error);
    // Rethrow so main.js catches it and updates UI
    throw error;
  }
}
