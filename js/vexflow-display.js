// js/vexflow-display.js
// Description: Handles rendering sheet music using VexFlow 5 Factory API.

import { midiToNoteName } from "./tonal-helpers.js";

// Assume VexFlow and Tonal are loaded globally via <script> tags
// Destructure necessary classes from the global VexFlow object
const {
  Accidental,
  Barline,
  Beam,
  Dot,
  Factory, // V5: Main entry point
  Formatter, // Still used internally by Factory/System, but less directly
  KeySignature, // Still useful for accidental logic
  Note, // Base class
  StaveNote,
  BarNote, // V5: Used for barlines
  Fraction, // Useful for duration calculations
  // Renderer, Stave, Voice, System, StaveConnector are primarily managed by Factory
} = VexFlow;

// Helper to convert VexFlow duration string to a numeric value (fraction of a whole note)
function getDurationValue(durationString) {
  // Simplified: handles common cases including dotted notes
  let baseDuration = durationString.replace("r", "").replace(/\./g, ""); // Remove rest marker and dots
  let value = 0;
  switch (baseDuration) {
    case "w":
      value = 1;
      break;
    case "h":
      value = 1 / 2;
      break;
    case "q":
      value = 1 / 4;
      break;
    case "8":
      value = 1 / 8;
      break;
    case "16":
      value = 1 / 16;
      break;
    case "32":
      value = 1 / 32;
      break;
    default:
      console.warn(`Unknown duration base: ${baseDuration}`);
      return 0;
  }
  const dotCount = (durationString.match(/\./g) || []).length;
  let multiplier = 1;
  for (let i = 0; i < dotCount; i++) {
    multiplier += Math.pow(0.5, i + 1);
  }
  return value * multiplier;
}

/**
 * Processes raw music data into VexFlow StaveNote and BarNote objects,
 * inserting barlines automatically.
 * @param {object} musicData - The raw music data {soprano: [...], alto: [...], ...}
 * @param {string} key - The key signature (e.g., 'C', 'Gm')
 * @param {string} meter - The time signature (e.g., '4/4', '3/4')
 * @returns {object} - { soprano: [Vex.Flow.Tickable], alto: [...], ... }
 */
function _processMusicDataToVexTickables(musicData, key, meter) {
 

  const vexTickablesByVoice = { soprano: [], alto: [], tenor: [], bass: [] };

  const currentVexKeySignature = new KeySignature(key);

  const [beatsPerMeasure, beatValue] = meter.split("/").map(Number);
  // Calculate measure duration in terms of whole notes (e.g., 4/4 = 1, 3/4 = 0.75)
  const measureDuration = beatsPerMeasure / beatValue;
  const tickResolution = 4096 // Standard VexFlow ticks per quarter note
  const ticksPerMeasure = new Fraction(beatsPerMeasure, beatValue)
    .multiply(new Fraction(tickResolution * 4))
    .value();

  console.log(
    `Processing data for ${meter} time. Ticks per measure: ${ticksPerMeasure}`
  );

  Object.keys(musicData).forEach((voiceName) => {
    if (!vexTickablesByVoice[voiceName]) return; // Skip if voice doesn't exist in output structure

    const clef =
      voiceName === "soprano" || voiceName === "alto" ? "treble" : "bass";
    let currentMeasureTicks = 0;

    musicData[voiceName].forEach((noteData, index) => {
      // --- Create StaveNote (similar logic to before) ---
 
      const noteProps = {
        keys: noteData.isRest ? ["b/4"] : [noteData.vexKey], // Default rest position
        duration: noteData.duration.replace(/\./g, ""), // Base duration without dots
        clef: clef,
        auto_stem: true, // Let VexFlow handle stem direction initially
      };

      if (noteData.isRest) {
        noteProps.duration += "r";
      }
      console.log(noteProps);
      const staveNote = new StaveNote(noteProps);

      // --- Accidental Logic (same as before) ---
      if (!noteData.isRest && noteData.midi !== null) {
        const noteNamePart = noteData.vexKey.split("/")[0];
        // Use Tonal for robust note parsing and accidental checking
        const tonalNote = Tonal.Note.get(
          Tonal.Note.simplify(noteNamePart + "4")
        ); // Add octave for Tonal parsing robustness

        if (tonalNote.acc && tonalNote.letter) {
          // Check if tonalNote is valid
          const keySigAccidental = currentVexKeySignature.getAccidental(
            tonalNote.letter.toLowerCase()
          );
          let needsExplicitAccidental = false;
          let accidentalType = tonalNote.acc; // #, b, n, ##, bb

          if (!keySigAccidental) {
            // Note is not altered in key signature, needs accidental if it has one
            needsExplicitAccidental = true;
          } else {
            // Note *is* altered in key signature, needs accidental *only if different* or natural
            if (tonalNote.acc !== keySigAccidental.type) {
              needsExplicitAccidental = true;
              // If the note's natural form is needed against the key sig
              if (tonalNote.acc === "" && !tonalNote.step) {
                // Tonal might return acc: '' for natural
                accidentalType = "n";
              }
            }
          }

          // Check for courtesy accidental (natural sign) if note was altered earlier in the measure
          // VexFlow 5's Formatter *might* handle this better automatically, but explicit is safer
          // This simplified example doesn't track intra-measure accidentals explicitly for courtesy.

          if (needsExplicitAccidental && accidentalType) {
            staveNote.addModifier(new Accidental(accidentalType), 0);
          }
        } else if (!tonalNote.letter) {
          console.warn(
            `Could not parse note: ${noteNamePart} using Tonal. Skipping accidental check.`
          );
        }
      }

      // --- Dot Logic (same as before) ---
      const dotCount = (noteData.duration.match(/\./g) || []).length;
      for (let d = 0; d < dotCount; d++) {
        Dot.buildAndAttach([staveNote], { all: true }); // V5 recommended way
      }

      vexTickablesByVoice[voiceName].push(staveNote);

      // --- Measure and Barline Logic ---
      const noteDurationTicks = VexFlow.durationToTicks(noteData.duration); // Use VexFlow's converter
      if (!noteDurationTicks) {
        console.warn(`Could not get ticks for duration: ${noteData.duration}`);
      } else {
        currentMeasureTicks += noteDurationTicks;
      }

      // console.log(`Voice ${voiceName}, Note ${index}: ${noteData.vexKey}, Dur: ${noteData.duration}, Ticks: ${noteDurationTicks}, Measure Ticks: ${currentMeasureTicks}/${ticksPerMeasure}`);

      // Check if the measure is full *or* if this is the very last note
      const isLastNoteOfVoice = index === musicData[voiceName].length - 1;

      // Using a tolerance for floating point comparisons with ticks
      const tolerance = 1; // Allow 1 tick difference
      if (currentMeasureTicks >= ticksPerMeasure - tolerance) {
        const barType = isLastNoteOfVoice
          ? Barline.type.END
          : Barline.type.SINGLE;
        // Add barline *after* the note that completes the measure
        vexTickablesByVoice[voiceName].push(new BarNote(barType));
        // console.log(`--- Added Barline (${barType === Barline.type.END ? 'END' : 'SINGLE'}) to ${voiceName} after note index ${index} ---`);
        currentMeasureTicks = 0; // Reset for the next measure
      } else if (isLastNoteOfVoice && currentMeasureTicks > 0) {
        // If it's the last note but didn't fill the measure (e.g., incomplete final measure)
        // Still add a final bar line.
        vexTickablesByVoice[voiceName].push(new BarNote(Barline.type.END));
        console.log(
          `--- Added END Barline to ${voiceName} at the very end (incomplete measure) ---`
        );
      }
    });
  });

  console.log(
    `Processed ${Object.values(vexTickablesByVoice).reduce(
      (sum, notes) => sum + notes.filter((n) => n instanceof StaveNote).length, // Count only StaveNotes
      0
    )} VexFlow notes and inserted barlines.`
  );
  return vexTickablesByVoice;
}

/**
 * Displays the music using VexFlow 5 Factory API.
 * @param {HTMLElement} outputContainer - The div where the SVG will be rendered.
 * @param {object} musicData - The generated music data for each voice.
 * @param {string} key - The key signature (e.g., 'C', 'G', 'Am').
 * @param {string} meter - The time signature (e.g., '4/4', '3/4').
 * @param {number} numMeasures - The total number of measures generated.
 */
export function displayMusic(
  outputContainer,
  musicData,
  key,
  meter,
  numMeasures
) {
  console.log("HERE!!!");
  if (!musicData || !musicData.soprano || musicData.soprano.length === 0) {
    outputContainer.innerHTML = "No music data to display.";
    console.warn("displayMusic called with empty or invalid musicData.");
    return;
  }
  if (!outputContainer) {
    console.error("Output container not provided for VexFlow.");
    return;
  }
  if (typeof VexFlow === "undefined") {
    console.error("VexFlow library is not loaded.");
    outputContainer.innerHTML = "Error: VexFlow library not found.";
    return;
  }

  console.log("Starting VexFlow 5 rendering...");
  outputContainer.innerHTML = ""; // Clear previous rendering

  try {
    // --- Basic Setup ---
    const factory = new Factory({
      // Ensure the ID matches the div in your HTML
      renderer: {
        elementId: "sheet-music",
        width: numMeasures * 250 + 100,
        height: 300,
      },
    });

    const score = factory.EasyScore();

    console.log("HERE!!!");
    // Process notes and automatically add barlines
    const tickablesByVoice = _processMusicDataToVexTickables(
      musicData,
      key,
      meter
    );

    // Create VexFlow voices from the processed tickables
    const voices = {
      soprano: score
        .voice(tickablesByVoice.soprano, { time: meter })
        .setStrict(false),
      alto: score
        .voice(tickablesByVoice.alto, { time: meter })
        .setStrict(false),
      tenor: score
        .voice(tickablesByVoice.tenor, { time: meter })
        .setStrict(false),
      bass: score
        .voice(tickablesByVoice.bass, { time: meter })
        .setStrict(false),
    };

    // --- Automatic Beaming (Optional but Recommended) ---
    // VexFlow's formatter usually handles beams well when notes are added to voices.
    // If beams are incorrect, you might need manual beam generation:
    /*
     const beams = [
         ...Beam.generateBeams(voices.soprano.getTickables()),
         ...Beam.generateBeams(voices.alto.getTickables()),
         ...Beam.generateBeams(voices.tenor.getTickables()),
         ...Beam.generateBeams(voices.bass.getTickables()),
     ];
     // Factory doesn't have a direct `factory.drawBeams(beams)` method.
     // Beams are typically drawn when voices are drawn if auto-beam generation worked.
     // Manual beam drawing with Factory is less straightforward than v4.
     // Rely on automatic beaming first.
     */
    console.log("Generated voices. Relying on automatic beaming.");

    // --- System and Stave Setup ---
    const system = factory.System({
      // Auto width calculation is usually good, but can be set:
      // width: numMeasures * 250 + 50,
      factory: factory, // Pass factory explicitly if needed by older Vex versions/structure
    });

    // Add Treble Stave with Soprano/Alto
    system
      .addStave({
        voices: [voices.soprano, voices.alto],
      })
      .addClef("treble")
      .addKeySignature(key)
      .addTimeSignature(meter);

    // Add Bass Stave with Tenor/Bass
    system
      .addStave({
        voices: [voices.tenor, voices.bass],
      })
      .addClef("bass")
      .addKeySignature(key)
      .addTimeSignature(meter);

    // Add Connectors (Brace for Grand Staff, Single line at start)
    system.addConnector("brace");
    system.addConnector("singleLeft");
    // system.addConnector("singleRight"); // Typically not needed if END barline is used

    // --- Render ---
    // The factory.draw() command handles drawing all elements managed by the factory/score/system.
    factory.draw();

    console.log("VexFlow 5 rendering finished successfully.");
  } catch (error) {
    console.error("Error during VexFlow 5 rendering:", error);
    outputContainer.innerHTML = `Rendering Error: ${error.message}`;
    // Optionally re-throw or handle more gracefully
    // throw error;
  }
}
