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
  Barline, // Keep Barline for intermediate lines
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
    .addKeySignature(keySignature)
    // *** Tell the stave to draw a double bar at its end ***
    .setEndBarType(Barline.type.END);

  const staveBass = new Stave(staveX, staveBassY, width)
    .addClef("bass")
    .addTimeSignature(timeSignature)
    .addKeySignature(keySignature)
    // *** Tell the stave to draw a double bar at its end ***
    .setEndBarType(Barline.type.END);

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
  // Ensure SINGLE_RIGHT connector remains removed
  console.log("Connectors drawn.");
}

function _processMusicDataToVexNotes(musicData, key) {
  // ... (implementation remains the same as previous correct version) ...
  const vexNotesByVoice = { soprano: [], alto: [], tenor: [], bass: [] };
  const beams = [];
  const currentVexKeySignature = new KeySignature(key);
  Object.keys(musicData).forEach((voiceName) => {
    /* ... loop ... */ const clef =
      voiceName === "soprano" || voiceName === "alto" ? "treble" : "bass";
    let notesForCurrentBeam = [];
    musicData[voiceName].forEach((noteData, index) => {
      /* ... validation ... */ const noteProps = {
        keys: [noteData.vexKey],
        duration: noteData.duration.replace(/\./g, ""),
        clef: clef,
        auto_stem: true,
      };
      if (noteData.isRest) {
        noteProps.keys = ["b/4"];
        noteProps.duration += "r";
      }
      const staveNote = new StaveNote(noteProps);
      /* ... accidental logic ... */ if (
        !noteData.isRest &&
        noteData.midi !== null
      ) {
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
      /* ... dot logic ... */ const dotCount = (
        noteData.duration.match(/\./g) || []
      ).length;
      for (let d = 0; d < dotCount; d++) {
        if (staveNote.addDotToAll) staveNote.addDotToAll();
        else if (Dot) staveNote.addModifier(new Dot(), d);
      }
      vexNotesByVoice[voiceName].push(staveNote);
      /* ... beaming logic ... */ const isBeamable =
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

function _createAndFormatVexVoices(
  vexNotesByVoice,
  staveTreble,
  staveBass,
  timeSignature,
  justifiableWidth
) {
  // ... (implementation remains the same as previous correct version) ...
  const [num_beats, beat_value] = timeSignature.split("/").map(Number);
  const allVexVoices = [];
  const trebleVoices = [];
  const bassVoices = [];
  Object.keys(vexNotesByVoice).forEach((voiceName) => {
    const notes = vexNotesByVoice[voiceName];
    if (notes.length === 0) {
      return;
    }
    const voice = new Voice({
      num_beats: num_beats,
      beat_value: beat_value,
    }).setStrict(false);
    voice.addTickables(notes);
    if (voiceName === "soprano" || voiceName === "alto") {
      trebleVoices.push(voice);
    } else {
      bassVoices.push(voice);
    }
    allVexVoices.push(voice);
  });
  if (allVexVoices.length === 0) {
    throw new Error("No voices could be created.");
  }
  console.log(
    `${allVexVoices.length} VexFlow Voices created (${trebleVoices.length} treble, ${bassVoices.length} bass).`
  );
  const formatter = new Formatter();
  if (trebleVoices.length > 0) {
    formatter
      .joinVoices(trebleVoices)
      .format(trebleVoices, justifiableWidth, { stave: staveTreble });
    console.log(`Formatted ${trebleVoices.length} treble voice(s).`);
  }
  if (bassVoices.length > 0) {
    formatter
      .joinVoices(bassVoices)
      .format(bassVoices, justifiableWidth, { stave: staveBass });
    console.log(`Formatted ${bassVoices.length} bass voice(s).`);
  }
  return allVexVoices;
}

function _drawVoicesAndBeams(context, voices, beams) {
  // ... (implementation remains the same as previous correct version) ...
  voices.forEach((voice) => {
    const stave =
      typeof voice.getStave === "function" ? voice.getStave() : undefined;
    if (stave) {
      voice.draw(context, stave);
    } else {
      console.warn(
        "Could not retrieve stave for voice. Drawing without context."
      );
      voice.draw(context);
    }
  });
  console.log("Voices drawn.");
  beams.forEach((beam) => {
    beam.setContext(context).draw();
  });
  console.log(`${beams.length} beams drawn.`);
}

/**
 * Draws intermediate bar lines between measures using direct context drawing.
 * Does NOT draw the final bar line (handled by Stave).
 * @param {Vex.Flow.SVGContext} context - The rendering context.
 * @param {Vex.Flow.Stave} staveTop - The top stave (treble).
 * @param {Vex.Flow.Stave} staveBottom - The bottom stave (bass).
 * @param {number} numMeasures - Total number of measures.
 */
function _drawMeasureBarLines(context, staveTop, staveBottom, numMeasures) {
  if (numMeasures <= 1) {
    // No intermediate lines needed for 1 measure
    return;
  }
  console.log("Drawing intermediate measure bar lines...");

  const noteAreaStartX = staveTop.getNoteStartX();
  // Use getX() + getWidth() for end coordinate; getNoteEndX might vary too much
  const noteAreaEndX = staveTop.getX() + staveTop.getWidth();
  const noteAreaWidth = noteAreaEndX - noteAreaStartX;

  if (noteAreaWidth <= 0) {
    console.warn("Cannot draw bar lines: Invalid note area width.");
    return;
  }
  const measureWidth = noteAreaWidth / numMeasures;

  // Get Y coordinates for drawing lines across both staves
  const topY = staveTop.getYForLine(0); // Top line of treble stave
  const bottomY = staveBottom.getYForLine(4); // Bottom line of bass stave
  // console.log(`Calculated Y Range for bars: ${topY.toFixed(1)} to ${bottomY.toFixed(1)}`); // Optional log

  for (let i = 1; i < numMeasures; i++) {
    const barX = noteAreaStartX + i * measureWidth;
    // console.log(`Drawing bar line ${i} at X: ${barX.toFixed(1)}`); // Optional log

    // --- Direct Context Drawing ---
    context.save(); // Save context state before drawing
    context.beginPath();
    context.moveTo(barX, topY); // Start at top stave's top line
    context.lineTo(barX, bottomY); // End at bottom stave's bottom line
    context.setStrokeStyle("black"); // Ensure color is set
    context.setLineWidth(1); // Standard bar line width
    context.stroke();
    context.restore(); // Restore context state
  }
  console.log("Finished drawing intermediate bar lines.");
}

export function displayMusic(
  outputContainer,
  musicData,
  key,
  meter,
  numMeasures
) {
  if (!musicData || !musicData.soprano || musicData.soprano.length === 0) {
    /*...*/ return;
  }
  if (!outputContainer) {
    /*...*/
  }
  if (typeof Vex === "undefined" || !Vex.Flow) {
    /*...*/
  }

  console.log("Starting VexFlow rendering...");
  outputContainer.innerHTML = "";

  try {
    const staveWidthPerMeasure = 600;
    const staveWidth = Math.max(150, numMeasures * staveWidthPerMeasure);
    const rendererWidth = staveWidth + 60; // Add padding
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

    // Create staves - setEndBarType handles the final bar line
    const { staveTreble, staveBass } = _createAndDrawStaves(
      context,
      staveWidth,
      key,
      timeSignature
    );

    // Draw brace and start connector ONLY
    _drawConnectors(context, staveTreble, staveBass);

    const { vexNotesByVoice, beams } = _processMusicDataToVexNotes(
      musicData,
      key
    );

    // Calculate justifiable width (area for notes)
    const startPadding = staveTreble.getNoteStartX() - staveTreble.getX();
    // End padding: Consider the width of the final bar line VexFlow might add
    const endPadding = 15; // Slightly more padding
    const justifiableWidth = Math.max(
      100,
      staveWidth - startPadding - endPadding
    );

    const formattedVoices = _createAndFormatVexVoices(
      vexNotesByVoice,
      staveTreble,
      staveBass,
      timeSignature,
      justifiableWidth
    );

    // Draw the notes and beams
    _drawVoicesAndBeams(context, formattedVoices, beams);

    // Draw *intermediate* bar lines if needed
    _drawMeasureBarLines(context, staveTreble, staveBass, numMeasures);

    console.log("VexFlow rendering finished successfully.");
  } catch (error) {
    console.error("Error during VexFlow rendering:", error);
    throw error; // Rethrow
  }
}
