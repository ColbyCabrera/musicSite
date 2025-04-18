// =============================================================================
// Music Generation Application using Tonal.js, VexFlow, and Tone.js
// =============================================================================
// Purpose: Generates, displays, and plays simple four-part chorale-style music
// based on user-defined parameters like key, meter, length, tempo, and
// complexity settings.
//
// Dependencies:
// - VexFlow (vexflow-min.js): For rendering sheet music notation.
// - Tonal.js (tonal.min.js): For music theory calculations (notes, chords, scales, keys).
// - Tone.js (Tone.min.js): For Web Audio API playback.
//
// Ensure libraries are loaded in the HTML *before* this script.
// =============================================================================

// --- VexFlow Setup ---
// Destructure required VexFlow components for easier access.
const {
  Factory, // General factory (less used here now)
  Voice, // Represents a voice/part in VexFlow
  StaveNote, // Represents a single note or rest on a stave
  Formatter, // Formats notes within voices
  Accidental, // Represents accidentals (#, b, n)
  StaveConnector, // Connects staves (brace, single lines)
  Stave, // Represents a musical staff
  KeySignature, // Represents the key signature symbol
  Beam, // Groups notes with beams
  Note, // Basic Note class (less used directly now, Tonal handles more)
  Renderer, // Renders VexFlow elements to SVG/Canvas
} = Vex.Flow;

// --- Tonal.js Check ---
// Verify that the Tonal.js library is loaded and essential modules are available.
if (
  typeof Tonal === "undefined" ||
  !Tonal.Note ||
  !Tonal.Scale ||
  !Tonal.Chord ||
  !Tonal.RomanNumeral ||
  !Tonal.Interval ||
  !Tonal.Key
) {
  console.error(
    "CRITICAL ERROR: Tonal.js library not found or incomplete! Please ensure tonal.min.js is loaded BEFORE this script."
  );
  // Display error to the user and disable functionality.
  const statusDiv = document.getElementById("status");
  if (statusDiv) {
    statusDiv.textContent =
      "CRITICAL ERROR: Tonal.js library missing. Cannot generate music.";
    statusDiv.style.color = "red";
  }
  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn) {
    generateBtn.disabled = true;
  }
  // Prevent further script execution in a real scenario
  // throw new Error("Tonal.js library missing or incomplete.");
} else {
  console.log("Tonal.js library detected successfully.");
}

// =============================================================================
// DOM Element References
// =============================================================================
// Get references to UI elements for interaction.

const generateBtn = document.getElementById("generate-btn");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const outputDiv = document.getElementById("sheet-music"); // Container for VexFlow SVG
const statusDiv = document.getElementById("status"); // Displays messages to the user
const styleSelect = document.getElementById("style"); // Style (currently not heavily used)
const keySelect = document.getElementById("key");
const meterSelect = document.getElementById("meter");
const lengthInput = document.getElementById("length"); // Number of measures
const tempoInput = document.getElementById("tempo");
const harmonicComplexitySlider = document.getElementById("harmonic-complexity");
const melodicSmoothnessSlider = document.getElementById("melodic-smoothness");
const dissonanceStrictnessSlider = document.getElementById(
  "dissonance-strictness"
);

// --- Slider Value Display Updates ---
// Attach input event listeners to range sliders to update their corresponding '*-val' spans.
document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const span = document.getElementById(`${slider.id}-val`);
  if (span) {
    span.textContent = slider.value; // Set initial display value
    slider.oninput = () => (span.textContent = slider.value); // Update on change
  }
});

// =============================================================================
// Constants
// =============================================================================

const MIDI_NOTE_C0 = 12; // MIDI number for C0
const DEFAULT_OCTAVE = 4; // Default octave used for calculations if not specified
const VOICE_ORDER = ["soprano", "alto", "tenor", "bass"]; // Standard SATB order

// Define typical voice ranges in MIDI note numbers.
const VOICE_RANGES = {
  soprano: [Tonal.Note.midi("C4"), Tonal.Note.midi("A5")], // MIDI 60-81
  alto: [Tonal.Note.midi("G3"), Tonal.Note.midi("E5")], // MIDI 55-76
  tenor: [Tonal.Note.midi("C3"), Tonal.Note.midi("G4")], // MIDI 48-67
  bass: [Tonal.Note.midi("E2"), Tonal.Note.midi("C4")], // MIDI 40-60
};

// Define typical maximum spacing between adjacent voices in semitones.
const VOICE_SPACING_LIMIT = {
  soprano_alto: Tonal.Interval.semitones("P8"), // Max octave (12)
  alto_tenor: Tonal.Interval.semitones("P8"), // Max octave (12)
  tenor_bass: Tonal.Interval.semitones("P12"), // Max octave + 5th (19)
};

// =============================================================================
// Global State
// =============================================================================
// Variables holding the current state of the generated music and playback.

/** @type {object | null} Stores the generated music data structure. */
let generatedMusicData = null;

/** @type {number} Stores the current tempo (BPM) from the input. */
let currentTempo = 100;

/** @type {Tone.Part | null} Holds the current Tone.js Part object for playback control. */
let currentPart = null;

/** @type {Tone.PolySynth | null} Holds the Tone.js PolySynth instance. */
let polySynth = null;

// =============================================================================
// Music Theory Helper Functions (using Tonal.js)
// =============================================================================

/**
 * Converts a note name (e.g., "C#4", "Db5") to its corresponding MIDI number.
 * @param {string} noteName - The note name in scientific pitch notation.
 * @returns {number | null} The MIDI number, or null if the note name is invalid.
 */
function noteNameToMidi(noteName) {
  return Tonal.Note.midi(noteName);
}

/**
 * Converts a MIDI number to its note name in scientific pitch notation (e.g., "C#4").
 * Prefers sharps by default for ambiguous notes (like A#/Bb).
 * @param {number} midi - The MIDI number.
 * @param {boolean} [useSharps=true] - Whether to prefer sharp notation over flats.
 * @returns {string | null} The note name, or null if the MIDI number is invalid.
 */
function midiToNoteName(midi, useSharps = true) {
  if (midi === null || midi === undefined) return null;
  // Tonal.Note.fromMidi intelligently handles sharps/flats based on context
  // or defaults to sharps if context is ambiguous.
  return Tonal.Note.fromMidi(midi, { sharps: useSharps });
}

/**
 * Converts a MIDI number to a VexFlow-compatible key string (e.g., "c#/4", "ab/5").
 * It attempts to determine the correct enharmonic spelling based on the provided key signature.
 * @param {number} midi - The MIDI number.
 * @param {string} keyName - The current key signature (e.g., "C", "Eb", "F#m"). Used for enharmonic spelling.
 * @returns {string | null} The VexFlow key string (note/octave), or null if MIDI is invalid.
 */
function midiToVexflowKey(midi, keyName) {
  if (midi === null || midi === undefined) return null;

  const pc = Tonal.Note.pitchClass(Tonal.Note.fromMidi(midi)); // e.g., "C#", "Db"

  // Determine if the key signature prefers sharps or flats.
  const keyInfo = Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
  const preferSharps = keyInfo ? keyInfo.alteration > 0 : pc.includes("#"); // Default to sharp if key invalid or neutral

  // Attempt to find the note's name within the key's scale for better spelling.
  // Use harmonic minor for minor keys as it includes the raised leading tone often needed.
  const scaleName =
    keyName +
    (keyInfo && keyInfo.type === "minor" ? " harmonic minor" : " major");
  const scaleNotes = Tonal.Scale.get(scaleName).notes;

  let noteInScale = null;
  if (scaleNotes && scaleNotes.length > 0) {
    for (const scaleNote of scaleNotes) {
      // Compare pitch classes (modulo 12) to find a match within the scale.
      // Add a default octave for MIDI comparison, as scale notes lack octave info.
      if (Tonal.Note.midi(scaleNote + DEFAULT_OCTAVE) % 12 === midi % 12) {
        noteInScale = Tonal.Note.simplify(scaleNote); // Get note name like "F#", "Bb"
        break;
      }
    }
  }

  let finalNoteName;
  // Use the scale spelling if found and enharmonically correct.
  if (
    noteInScale &&
    (noteInScale === pc || Tonal.Note.enharmonic(noteInScale) === pc)
  ) {
    finalNoteName = noteInScale;
  } else {
    // Otherwise, fall back to the preferred accidental based on the key or default sharp.
    finalNoteName = Tonal.Note.fromMidi(midi, { sharps: preferSharps });
  }

  // Format for VexFlow: lowercase note letter, accidental, slash, octave.
  const noteComponents = Tonal.Note.get(finalNoteName); // Get parts: { letter, acc, oct }
  // VexFlow's octave numbering is one less than scientific pitch notation's.
  const vexOctave = Math.floor(midi / 12) - 1;
  return `${noteComponents.letter.toLowerCase()}${
    noteComponents.acc
  }/${vexOctave}`;
}

/**
 * Calculates the MIDI note numbers for a chord specified by its Roman numeral in a given key.
 * Handles major/minor keys and attempts to add 7ths if specified (e.g., "V7").
 * @param {string} roman - The Roman numeral (e.g., "I", "V7", "ii", "viio", "iv"). Case-insensitive for base numeral.
 * @param {string} keyName - The key context (e.g., "C", "Gm", "F#"). Tonal handles major/minor designation.
 * @returns {number[]} An array of MIDI note numbers for the chord (typically in the 3rd/4th octave range),
 * or an empty array if the Roman numeral or key is invalid or chord cannot be determined.
 */
function getChordNotesFromRoman(roman, keyName) {
  try {
    // Tonal needs the key type (major/minor) implicitly via Tonal.Key functions.
    const keyDetails =
      Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
    if (!keyDetails || !keyDetails.chords || !keyDetails.chordScales) {
      // Check for essential details
      console.warn(
        `Could not get valid key details or chords for key "${keyName}". Roman: "${roman}"`
      );
      return [];
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type; // 'major' or 'minor'

    // Map Roman numerals (I-VII) to array indices (0-6).
    const romanMap = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
    const baseRomanMatch = roman.match(/([iv]+)/i); // Extract I, II, V etc. (case-insensitive)
    if (!baseRomanMatch) {
      console.warn(
        `Could not parse base Roman numeral from "${roman}" in key "${keyName}".`
      );
      return [];
    }
    const baseRomanUpper = baseRomanMatch[1].toUpperCase(); // e.g., "V" from "V7" or "v"
    const scaleDegreeIndex = romanMap[baseRomanUpper];

    if (scaleDegreeIndex === undefined) {
      console.warn(
        `Could not map Roman numeral "${baseRomanUpper}" (from "${roman}") to a scale degree index.`
      );
      return [];
    }

    // Get the diatonic chords directly from Tonal.Key for the specified key.
    // Example: C major -> ["CM", "Dm", "Em", "FM", "GM", "Am", "B°"]
    const diatonicChords = keyDetails.chords;
    if (scaleDegreeIndex >= diatonicChords.length) {
      console.warn(
        `Scale degree index ${scaleDegreeIndex} is out of bounds for diatonic chords in key "${keyName}". Chords: ${diatonicChords}`
      );
      return [];
    }

    let chordSymbol = diatonicChords[scaleDegreeIndex]; // Base diatonic chord symbol (e.g., "GM", "Dm")

    // If the input Roman numeral includes a '7' (e.g., "V7"), attempt to use the 7th chord.
    if (roman.includes("7") && !chordSymbol.includes("7")) {
      const seventhChordSymbol = chordSymbol + "7";
      // Check if Tonal recognizes this constructed 7th chord symbol.
      const chordInfo = Tonal.Chord.get(seventhChordSymbol);
      if (!chordInfo.empty) {
        chordSymbol = seventhChordSymbol; // Use the valid 7th chord symbol.
      } else {
        // Warn if the requested 7th is invalid, but proceed with the diatonic triad/chord.
        console.warn(
          `Input "${roman}" requested a 7th, but "${seventhChordSymbol}" is not a valid Tonal chord symbol in key "${keyName}". Using diatonic chord "${chordSymbol}".`
        );
      }
    }
    // TODO: Could add similar logic for other chord extensions/qualities (e.g., dim, aug) if needed.

    // Get the detailed chord object from Tonal using the final determined symbol.
    const chord = Tonal.Chord.get(chordSymbol);
    if (!chord || chord.empty || !chord.notes || chord.notes.length === 0) {
      console.warn(
        `Could not get valid notes for chord symbol "${chordSymbol}" (derived from Roman "${roman}" in key "${keyName}").`
      );
      return [];
    }

    // Determine a suitable root MIDI note, aiming for octave 3 or 4.
    const rootNote = Tonal.Note.get(chord.tonic); // { letter, acc, oct } - oct might be undefined
    // Estimate MIDI: If root is A or B, start octave 3; otherwise, start octave 4.
    const rootOctaveGuess =
      rootNote.letter === "A" || rootNote.letter === "B" ? 3 : 4;
    const rootMidiGuess = Tonal.Note.midi(
      rootNote.letter + rootNote.acc + rootOctaveGuess
    );

    if (rootMidiGuess === null) {
      console.warn(
        `Could not determine a root MIDI value for chord "${chordSymbol}".`
      );
      return [];
    }
    const rootNoteName = Tonal.Note.fromMidi(rootMidiGuess); // Get the note name for transposition
    if (!rootNoteName) {
      console.warn(
        `Could not get note name from root MIDI ${rootMidiGuess} for chord "${chordSymbol}".`
      );
      return [];
    }

    // Calculate all chord note MIDIs by transposing the root note by the chord's intervals.
    return chord.intervals
      .map((interval) => {
        try {
          // Transpose the determined root note name (e.g., "G4") by the interval (e.g., "3M").
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (!transposedNoteName) {
            console.warn(
              `Tonal.transpose returned null for ${rootNoteName} + ${interval}`
            );
            return null;
          }
          // Convert the resulting note name (e.g., "B4") back to MIDI.
          return Tonal.Note.midi(transposedNoteName);
        } catch (transposeError) {
          console.error(
            `Error during Tonal.transpose(${rootNoteName}, ${interval}):`,
            transposeError
          );
          return null;
        }
      })
      .filter((midi) => midi !== null); // Remove any nulls resulting from errors.
  } catch (error) {
    console.error(
      `Unexpected error getting chord notes for Roman "${roman}" in key "${keyName}":`,
      error
    );
    return []; // Return empty array on any unexpected error.
  }
}

/**
 * Expands a base set of chord MIDI notes across several octaves.
 * @param {number[]} baseChordNotes - An array of MIDI notes representing the core chord (e.g., from `getChordNotesFromRoman`).
 * @param {number} [numOctavesBelow=2] - Number of octaves to extend downwards.
 * @param {number} [numOctavesAbove=3] - Number of octaves to extend upwards.
 * @returns {number[]} A sorted array of unique MIDI notes spanning the specified octave range.
 */
function getExtendedChordNotePool(
  baseChordNotes,
  numOctavesBelow = 2,
  numOctavesAbove = 3
) {
  if (!baseChordNotes || baseChordNotes.length === 0) return [];

  const pool = new Set(); // Use a Set to automatically handle uniqueness.
  for (let i = -numOctavesBelow; i <= numOctavesAbove; i++) {
    baseChordNotes.forEach((note) => {
      if (note !== null) {
        pool.add(note + i * 12); // Add MIDI note shifted by octave offset.
      }
    });
  }
  // Convert Set back to an array and sort numerically.
  return [...pool].sort((a, b) => a - b);
}

// =============================================================================
// Music Generation Logic
// =============================================================================

/**
 * Generates a simple chord progression based on tonal harmony tendencies.
 * Uses probabilities and rules influenced by harmonic complexity setting.
 * @param {string} key - The key signature (e.g., "C", "Gm").
 * @param {number} numMeasures - The desired number of measures (and chords).
 * @param {number} harmonicComplexity - A value (0-10) influencing chord choices. Higher means more complex chords are allowed.
 * @returns {string[]} An array of Roman numeral chord symbols (e.g., ["I", "IV", "V7", "I"]).
 */
function generateChordProgression(key, numMeasures, harmonicComplexity) {
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) {
    console.error(
      `Invalid key provided to generateChordProgression: "${key}". Falling back.`
    );
    return ["I"]; // Fallback for safety
  }

  const isMajor = keyDetails.type === "major";

  // Define Roman numerals based on key type (major/minor).
  // Use major V for dominant function even in minor keys (common practice).
  const tonicRoman = isMajor ? "I" : "i";
  const dominantRoman = "V";
  const dominant7Roman = "V7"; // Explicit V7
  const subdominantRoman = isMajor ? "IV" : "iv";
  const supertonicRoman = isMajor ? "ii" : "ii°"; // Minor key ii is diminished
  const mediantRoman = isMajor ? "iii" : "III"; // Minor key III is major (relative major)
  const submediantRoman = isMajor ? "vi" : "VI"; // Minor key VI is major
  const leadingToneRoman = "vii°"; // Diminished in both major and harmonic/melodic minor

  // Chord pools based on typical function and complexity.
  const primaryChords = [tonicRoman, subdominantRoman, dominantRoman];
  const secondaryChords = [submediantRoman, supertonicRoman]; // Often move to dominant or subdominant
  const complexChords = [mediantRoman, leadingToneRoman]; // Less common, used for color or specific functions

  // Determine the set of allowed chords based on harmonic complexity setting.
  let allowedChords = [...primaryChords];
  if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
  if (harmonicComplexity >= 7) allowedChords.push(...complexChords);

  // Consider adding or substituting V7 based on complexity.
  if (harmonicComplexity >= 5) {
    if (allowedChords.includes(dominantRoman)) {
      // Replace V with V7 if V is present
      allowedChords = allowedChords.map((c) =>
        c === dominantRoman ? dominant7Roman : c
      );
    } else if (!allowedChords.includes(dominant7Roman)) {
      // Add V7 if V wasn't present initially (e.g., complexity < 3 but >= 5)
      allowedChords.push(dominant7Roman);
    }
  }
  // Remove duplicates just in case
  allowedChords = [...new Set(allowedChords)];

  // --- Progression Generation ---
  let progression = [tonicRoman]; // Start on the tonic.
  let prevChord = tonicRoman;

  for (let i = 1; i < numMeasures - 1; i++) {
    // Generate chords up to the penultimate measure.
    let nextChord;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Prevent infinite loops if choices are limited

    do {
      // --- Apply Basic Harmonic Tendencies ---
      let candidates = allowedChords; // Start with all allowed chords

      // If previous chord has subdominant function (IV, ii), strongly prefer dominant function (V, V7, vii°).
      if ([subdominantRoman, supertonicRoman].includes(prevChord)) {
        const dominantCandidates = allowedChords.filter((c) =>
          [dominantRoman, dominant7Roman, leadingToneRoman].includes(c)
        );
        if (dominantCandidates.length > 0) candidates = dominantCandidates;
        // Fallback: if no dominant chords allowed (unlikely), use any allowed chord.
      }
      // If previous chord has dominant function (V, V7), strongly prefer tonic or maybe submediant (deceptive).
      else if ([dominantRoman, dominant7Roman].includes(prevChord)) {
        const tonicResolutionCandidates = allowedChords.filter((c) =>
          [tonicRoman, submediantRoman].includes(c)
        );
        if (tonicResolutionCandidates.length > 0)
          candidates = tonicResolutionCandidates;
        // Fallback: if neither tonic nor submediant allowed, use any allowed chord.
      }
      // If previous chord is submediant (vi or VI), common moves are to ii/IV or V.
      else if (prevChord === submediantRoman) {
        const submediantNextCandidates = allowedChords.filter((c) =>
          [
            supertonicRoman,
            subdominantRoman,
            dominantRoman,
            dominant7Roman,
          ].includes(c)
        );
        if (submediantNextCandidates.length > 0)
          candidates = submediantNextCandidates;
        // Fallback: Use any allowed chord.
      }
      // Add more rules here if needed (e.g., after vii°, usually to I/i).

      // Select a random chord from the filtered candidates.
      if (candidates.length === 0) candidates = allowedChords; // Ensure there's always a choice
      nextChord = candidates[Math.floor(Math.random() * candidates.length)];

      attempts++;
    } while (
      // Try to avoid direct repetition if other options exist.
      nextChord === prevChord &&
      allowedChords.length > 1 &&
      attempts < MAX_ATTEMPTS
    );

    progression.push(nextChord);
    prevChord = nextChord;
  }

  // --- Ensure Final Cadence ---
  // Aim for an authentic cadence (V(7)-I/i) for the last two chords.
  // Plagal (IV-I) could be an alternative for low complexity, but authentic is more standard.
  const preCadenceChord = allowedChords.includes(dominant7Roman)
    ? dominant7Roman
    : dominantRoman;
  if (numMeasures > 2) {
    // Ensure the penultimate chord leads to the tonic. Use V or V7 if allowed.
    if (allowedChords.includes(preCadenceChord)) {
      progression[numMeasures - 2] = preCadenceChord;
    } else if (allowedChords.includes(dominantRoman)) {
      // Fallback to V if V7 not allowed but V is
      progression[numMeasures - 2] = dominantRoman;
    } // else: If neither V nor V7 is allowed, the existing penultimate chord remains.
    progression[numMeasures - 1] = tonicRoman; // End on the tonic.
  } else if (numMeasures === 2) {
    // For 2 measures, ensure it ends on tonic (e.g., I-I, V-I).
    progression[1] = tonicRoman;
  } // For 1 measure, it's already tonicRoman.

  console.log(
    `Generated Progression (${key}, complexity ${harmonicComplexity}):`,
    progression.join(" - ")
  );
  return progression;
}

/**
 * Selects the "best" MIDI note from a list of allowed notes, considering a target MIDI note
 * and a preference for melodic smoothness (smaller intervals).
 * @param {number} targetMidi - The ideal target MIDI note (e.g., based on chord or voice leading).
 * @param {number[]} allowedNotes - An array of available MIDI notes (e.g., chord tones within range).
 * @param {number | null} previousNoteMidi - The MIDI note of the previous note in this voice (for smoothness calculation).
 * @param {number} smoothnessPref - A value (0-10) indicating preference for smaller intervals (0=ignore, 10=strong preference).
 * @param {number} [avoidLeapThreshold=7] - Semitone threshold (Perfect 5th) above which leaps are penalized more heavily, potentially choosing a step instead.
 * @returns {number | null} The chosen MIDI note, or null if allowedNotes is empty.
 */
function findClosestNote(
  targetMidi,
  allowedNotes,
  previousNoteMidi,
  smoothnessPref,
  avoidLeapThreshold = Tonal.Interval.semitones("P5")
) {
  if (!allowedNotes || allowedNotes.length === 0) {
    // console.warn("No allowed notes provided to findClosestNote.");
    // Fallback: return previous note if available, else target, else null.
    return previousNoteMidi ?? targetMidi ?? null;
  }

  if (allowedNotes.length === 1) {
    return allowedNotes[0]; // Only one choice.
  }

  let bestNote = allowedNotes[0];
  let minScore = Infinity;

  // Sort allowed notes numerically to potentially optimize search, though iteration covers all.
  // allowedNotes.sort((a, b) => a - b); // Not strictly necessary as we check all notes.

  allowedNotes.forEach((note) => {
    // Base score: distance from the target MIDI note.
    let score = Math.abs(note - targetMidi);

    // Adjust score based on interval from the previous note, weighted by smoothness preference.
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi); // Interval size in semitones.
      const smoothnessWeight = smoothnessPref / 10.0; // Normalize preference to 0.0 - 1.0.

      // --- Scoring Logic ---
      // Lower scores are better. Adjust base score multiplicatively.
      if (interval === 0) {
        // Common Tone
        score *= 0.1 * (1.1 - smoothnessWeight); // Strongly preferred if smoothness is high.
      } else if (interval <= 2) {
        // Step (Minor/Major 2nd)
        score *= 0.5 * (1.1 - smoothnessWeight); // Preferred if smoothness is high.
      } else if (interval <= avoidLeapThreshold) {
        // Medium Leap (e.g., 3rd, 4th, 5th)
        // Slightly penalized if smoothness is high, proportional to interval size.
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.5); // Weaker penalty than large leaps
      } else {
        // Large Leap (e.g., > P5)
        // More significantly penalized if smoothness is high, proportional to interval size.
        score *= 1.5 + (interval / 12.0) * smoothnessWeight; // Use octave (12) as a reference for penalty scaling.
      }
    }

    // Update best note if current note has a lower score.
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });

  // --- Post-Selection Check: Avoid Large Leaps if Possible ---
  // If the initially chosen 'bestNote' involves a large leap from the previous note,
  // check if a stepwise option exists that isn't significantly worse in terms of target distance.
  if (
    previousNoteMidi !== null &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    // Find allowed notes that are steps (<= 2 semitones) away from the previous note.
    const stepNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi) <= 2
    );

    if (stepNotes.length > 0) {
      // Find the step note that is closest to the *original target MIDI*.
      let bestStepNote = stepNotes[0];
      let minStepTargetScore = Math.abs(bestStepNote - targetMidi);

      stepNotes.forEach((stepNote) => {
        let stepTargetScore = Math.abs(stepNote - targetMidi);
        if (stepTargetScore < minStepTargetScore) {
          minStepTargetScore = stepTargetScore;
          bestStepNote = stepNote;
        }
      });

      // Only choose the step note if its score (distance to target) isn't drastically worse
      // than the score of the leap note originally selected.
      // Threshold: Allow the step if it's no more than, e.g., 2 times farther from the target.
      const LEAP_PREFERENCE_FACTOR = 2.0;
      if (minStepTargetScore < minScore * LEAP_PREFERENCE_FACTOR) {
        // console.log(`Avoiding large leap (${midiToNoteName(previousNoteMidi)} -> ${midiToNoteName(bestNote)}), choosing step ${midiToNoteName(bestStepNote)} instead.`);
        bestNote = bestStepNote; // Override the choice with the smoother step.
      }
    }
  }

  return bestNote;
}

// --- Voice Assignment Helper Functions ---

/**
 * Assigns a suitable MIDI note for the Bass voice for a given chord.
 * Prioritizes the chord root, considers voice range, and uses `findClosestNote` for smoothness.
 * @param {number} chordRootMidi - The MIDI note number of the chord's root.
 * @param {number[]} chordNotesPool - All available MIDI notes for the chord across octaves.
 * @param {number | null} previousBassMidi - The MIDI note of the previous bass note.
 * @param {number} smoothness - Melodic smoothness preference (0-10).
 * @returns {number} The chosen MIDI note for the Bass.
 */
function assignBassNote(
  chordRootMidi,
  chordNotesPool,
  previousBassMidi,
  smoothness
) {
  // Filter notes within the defined Bass voice range.
  let allowedBassNotes = chordNotesPool.filter(
    (n) => n >= VOICE_RANGES.bass[0] && n <= VOICE_RANGES.bass[1]
  );

  if (allowedBassNotes.length === 0) {
    console.warn(
      "No valid bass notes found in range for current chord. Using fallback."
    );
    // Fallback: Use previous note if available, otherwise the bottom of the range.
    return previousBassMidi ?? VOICE_RANGES.bass[0];
  }

  const rootNotePc = chordRootMidi % 12; // Pitch class of the chord root.

  // --- Prioritize Root Note ---
  // Find all occurrences of the root pitch class within the allowed bass notes.
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);

  if (rootOptions.length > 0) {
    // If root notes are available, choose the one closest to the previous bass note.
    // Set the target MIDI for findClosestNote to the previous note (or a guess if none).
    const targetMidi = previousBassMidi ?? chordRootMidi - 12; // Target previous or root below range start.
    return findClosestNote(
      targetMidi,
      rootOptions,
      previousBassMidi,
      smoothness
    );
  } else {
    // --- If Root Not Available ---
    // No root note found in the bass range for this chord.
    // Choose the closest available chord tone (could prioritize 5th later if desired).
    console.log(
      `Root note (${Tonal.Note.pitchClass(
        Tonal.Note.fromMidi(chordRootMidi)
      )}) not available in bass range. Choosing closest available tone.`
    );
    const targetMidi = previousBassMidi ?? chordRootMidi - 12;
    return findClosestNote(
      targetMidi,
      allowedBassNotes,
      previousBassMidi,
      smoothness
    );
  }
}

/**
 * Assigns a suitable MIDI note for the Soprano voice for a given chord.
 * Considers voice range, relationship to previous soprano/alto, and uses `findClosestNote`.
 * @param {number[]} fullChordNotePool - All available MIDI notes for the chord across octaves.
 * @param {number | null} previousSopranoMidi - The MIDI note of the previous soprano note.
 * @param {number | null} previousAltoMidi - The MIDI note of the previous alto note (used for initial range filtering).
 * @param {number} smoothness - Melodic smoothness preference (0-10).
 * @returns {number} The chosen MIDI note for the Soprano.
 */
function assignSopranoNote(
  fullChordNotePool,
  previousSopranoMidi,
  previousAltoMidi,
  smoothness
) {
  // Filter notes within Soprano range and ensure they are above the previous Alto note (basic separation).
  let allowedSopranoNotes = fullChordNotePool.filter(
    (n) => n >= VOICE_RANGES.soprano[0] && n <= VOICE_RANGES.soprano[1] // &&
    // n > (previousAltoMidi ?? VOICE_RANGES.alto[0] - 12) // Initial check, more robust check later
  );

  if (allowedSopranoNotes.length === 0) {
    console.warn(
      "No valid soprano notes found in range for current chord. Using fallback."
    );
    // Fallback: Use previous note or top of the range.
    return previousSopranoMidi ?? VOICE_RANGES.soprano[1];
  }

  // Define a target MIDI for findClosestNote. Aim for some upward movement generally.
  // Target slightly above the previous soprano note, or near the bottom of the range if no previous.
  const targetMidi = previousSopranoMidi
    ? previousSopranoMidi + Math.floor(Math.random() * 5) + 1 // Random step/small leap up
    : VOICE_RANGES.soprano[0] + 5; // Target a 4th above range bottom initially.

  return findClosestNote(
    targetMidi,
    allowedSopranoNotes,
    previousSopranoMidi,
    smoothness
  );
}

/**
 * Assigns suitable MIDI notes for the Alto and Tenor voices.
 * Considers voice ranges, spacing limits, target pitch classes (to complete the chord),
 * and relationship to adjacent voices (Soprano, Bass, and each other).
 * @param {number} tenorTargetNotePc - The desired pitch class for the Tenor note (e.g., chord 3rd or 5th).
 * @param {number} altoTargetNotePc - The desired pitch class for the Alto note.
 * @param {number[]} fullChordNotePool - All available MIDI notes for the chord across octaves.
 * @param {number | null} previousTenorMidi - MIDI note of the previous tenor note.
 * @param {number | null} previousAltoMidi - MIDI note of the previous alto note.
 * @param {number} sopranoNoteMidi - The already chosen MIDI note for the current Soprano.
 * @param {number} bassNoteMidi - The already chosen MIDI note for the current Bass.
 * @param {number} smoothness - Melodic smoothness preference (0-10).
 * @returns {{tenorNoteMidi: number, altoNoteMidi: number}} The chosen MIDI notes for Tenor and Alto.
 */
function assignInnerVoices(
  tenorTargetNotePc,
  altoTargetNotePc,
  fullChordNotePool,
  previousTenorMidi,
  previousAltoMidi,
  sopranoNoteMidi,
  bassNoteMidi,
  smoothness
) {
  // --- Initial Filtering based on Range and Outer Voices ---
  // Potential Alto notes: within range, below current Soprano, above current Bass (allowing overlap with Tenor initially).
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.alto[0] &&
      n <= VOICE_RANGES.alto[1] &&
      n < sopranoNoteMidi && // Must be below Soprano
      n > bassNoteMidi && // Must be above Bass
      Math.abs(sopranoNoteMidi - n) <= VOICE_SPACING_LIMIT.soprano_alto // Check spacing S-A
  );

  // Potential Tenor notes: within range, below current Soprano (allowing overlap with Alto initially), above current Bass.
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.tenor[0] &&
      n <= VOICE_RANGES.tenor[1] &&
      n < sopranoNoteMidi && // Must be below Soprano
      n > bassNoteMidi && // Must be above Bass
      Math.abs(n - bassNoteMidi) <= VOICE_SPACING_LIMIT.tenor_bass // Check spacing T-B
  );

  // --- Alto Assignment ---
  let altoNoteMidi = null;
  // Target MIDI: near previous Alto, or roughly between Soprano and Bass if no previous.
  let altoTargetMidi = previousAltoMidi
    ? previousAltoMidi + (Math.random() > 0.5 ? 1 : -1) // Target step from previous
    : (sopranoNoteMidi + bassNoteMidi) / 2;

  // Try finding the specifically targeted pitch class first.
  const altoTargetPcOptions = allowedAltoNotes.filter(
    (n) => n % 12 === altoTargetNotePc
  );
  if (altoTargetPcOptions.length > 0) {
    altoNoteMidi = findClosestNote(
      altoTargetMidi,
      altoTargetPcOptions,
      previousAltoMidi,
      smoothness
    );
  }

  // If target PC not found or assignment failed, find the overall closest note from allowed options.
  if (altoNoteMidi === null) {
    if (allowedAltoNotes.length === 0) {
      console.warn("No valid notes found for Alto. Using fallback.");
      altoNoteMidi =
        previousAltoMidi ?? Math.max(VOICE_RANGES.alto[0], bassNoteMidi + 1); // Fallback: previous or just above bass
    } else {
      altoNoteMidi = findClosestNote(
        altoTargetMidi,
        allowedAltoNotes,
        previousAltoMidi,
        smoothness
      );
    }
  }

  // --- Tenor Assignment ---
  // Refine Tenor notes: must be below the *chosen* Alto note and respect A-T spacing.
  allowedTenorNotes = allowedTenorNotes.filter(
    (n) =>
      n < altoNoteMidi && // Strictly below chosen Alto
      Math.abs(altoNoteMidi - n) <= VOICE_SPACING_LIMIT.alto_tenor
  );

  let tenorNoteMidi = null;
  // Target MIDI: near previous Tenor, or roughly between chosen Alto and Bass if no previous.
  let tenorTargetMidi = previousTenorMidi
    ? previousTenorMidi + (Math.random() > 0.5 ? 1 : -1) // Target step from previous
    : (altoNoteMidi + bassNoteMidi) / 2;

  // Try finding the specifically targeted pitch class first.
  const tenorTargetPcOptions = allowedTenorNotes.filter(
    (n) => n % 12 === tenorTargetNotePc
  );
  if (tenorTargetPcOptions.length > 0) {
    tenorNoteMidi = findClosestNote(
      tenorTargetMidi,
      tenorTargetPcOptions,
      previousTenorMidi,
      smoothness
    );
  }

  // If target PC not found or assignment failed, find the overall closest note from allowed options.
  if (tenorNoteMidi === null) {
    if (allowedTenorNotes.length === 0) {
      console.warn(
        "No valid notes found for Tenor below chosen Alto. Using fallback."
      );
      // Fallback: previous, or just above bass (might conflict with Alto fallback). Needs careful check.
      tenorNoteMidi =
        previousTenorMidi ?? Math.max(VOICE_RANGES.tenor[0], bassNoteMidi + 1);
      // If fallback Tenor is >= Alto, attempt to lower it further.
      if (tenorNoteMidi >= altoNoteMidi) {
        tenorNoteMidi = altoNoteMidi - 1; // Force below, even if suboptimal range/pool fit.
      }
    } else {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        allowedTenorNotes,
        previousTenorMidi,
        smoothness
      );
    }
  }

  // --- Final Sanity Check: Ensure Tenor < Alto ---
  // This check is important especially if fallbacks were used or if findClosestNote produced an unexpected result.
  if (tenorNoteMidi >= altoNoteMidi) {
    console.warn(
      `Potential Voice Crossing/Overlap after assignment! Tenor (${midiToNoteName(
        tenorNoteMidi
      )}) >= Alto (${midiToNoteName(altoNoteMidi)}). Attempting correction.`
    );
    // Try finding a different tenor note from the allowed pool that IS below the alto.
    const lowerTenorOptions = allowedTenorNotes.filter((n) => n < altoNoteMidi);
    if (lowerTenorOptions.length > 0) {
      // Re-run findClosestNote with only the valid lower options.
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        lowerTenorOptions,
        previousTenorMidi,
        smoothness
      );
      console.log(`Corrected Tenor to: ${midiToNoteName(tenorNoteMidi)}`);
    } else {
      // No other option found. Force Tenor lower as a last resort.
      // This might put it outside the allowed pool or range, but prevents crossing.
      tenorNoteMidi =
        altoNoteMidi -
        (Tonal.Note.semitones(midiToNoteName(altoNoteMidi) % 12) % 2 === 0
          ? 2
          : 1); // Aim for minor/major second below
      console.warn(
        `Could not find alternative Tenor. Forcing Tenor to ${midiToNoteName(
          tenorNoteMidi
        )}.`
      );
      // Check if forced note is still above Bass and within range bounds if possible
      tenorNoteMidi = Math.max(
        tenorNoteMidi,
        bassNoteMidi + 1,
        VOICE_RANGES.tenor[0]
      );
    }
  }

  return { tenorNoteMidi, altoNoteMidi };
}

// --- Voice Leading Rule Checks ---

/**
 * Checks for parallel perfect fifths and octaves between two voices moving from a previous state to a current state.
 * Logs a warning if parallels are detected.
 * @param {number | null} voice1Prev - MIDI note of the first voice in the previous step.
 * @param {number} voice1Curr - MIDI note of the first voice in the current step.
 * @param {number | null} voice2Prev - MIDI note of the second voice in the previous step.
 * @param {number} voice2Curr - MIDI note of the second voice in the current step.
 * @param {string} part1Name - Name of the first voice (e.g., "Soprano").
 * @param {string} part2Name - Name of the second voice (e.g., "Alto").
 * @param {number} measure - The current measure number (0-indexed).
 * @param {number} beat - The current beat number within the measure (0-indexed).
 */
function checkParallels(
  voice1Prev,
  voice1Curr,
  voice2Prev,
  voice2Curr,
  part1Name,
  part2Name,
  measure,
  beat
) {
  // Cannot check parallels on the very first note/chord.
  if (voice1Prev === null || voice2Prev === null) return;

  // Avoid checking if one of the voices has rested or is newly starting.
  if (voice1Curr === null || voice2Curr === null) return;

  // --- Calculate Intervals ---
  // Use Tonal.js to find the interval between the voices in both steps.
  // Tonal.Interval.distance needs note names.
  const note1PrevName = midiToNoteName(voice1Prev);
  const note1CurrName = midiToNoteName(voice1Curr);
  const note2PrevName = midiToNoteName(voice2Prev);
  const note2CurrName = midiToNoteName(voice2Curr);

  // Ensure valid note names before proceeding
  if (!note1PrevName || !note1CurrName || !note2PrevName || !note2CurrName) {
    console.warn(
      `Could not get note names for parallel check at M${measure + 1}:B${
        beat + 1
      }`
    );
    return;
  }

  const intervalPrev = Tonal.Interval.distance(note2PrevName, note1PrevName); // Interval from lower to upper voice
  const intervalCurr = Tonal.Interval.distance(note2CurrName, note1CurrName);

  // --- Simplify and Check Interval Numbers ---
  // Simplify intervals (e.g., "M9" -> "M2", "P15" -> "P8") to check for octaves and fifths.
  const simplePrev = Tonal.Interval.simplify(intervalPrev);
  const simpleCurr = Tonal.Interval.simplify(intervalCurr);
  const numPrev = Tonal.Interval.num(simplePrev); // Get interval number (e.g., 5 for "P5")
  const numCurr = Tonal.Interval.num(simpleCurr);

  // Check for motion: both voices must move.
  const voice1Moved = voice1Prev !== voice1Curr;
  const voice2Moved = voice2Prev !== voice2Curr;

  if (voice1Moved && voice2Moved) {
    // Check for Parallel Perfect Fifths (P5). Tonal num is 5.
    if (
      numPrev === 5 &&
      numCurr === 5 &&
      simplePrev === "P5" &&
      simpleCurr === "P5"
    ) {
      console.warn(
        `PARALLEL 5th (${part1Name}/${part2Name}) at M${measure + 1}:B${
          beat + 1
        }. ` +
          `Prev: ${note1PrevName}-${note2PrevName} (${simplePrev}), Curr: ${note1CurrName}-${note2CurrName} (${simpleCurr})`
      );
    }
    // Check for Parallel Perfect Octaves (P8). Tonal num is 8 (or 1 for unison, simplified).
    else if (
      (numPrev === 8 || numPrev === 1) &&
      (numCurr === 8 || numCurr === 1) &&
      simplePrev.startsWith("P") &&
      simpleCurr.startsWith("P")
    ) {
      console.warn(
        `PARALLEL Octave/Unison (${part1Name}/${part2Name}) at M${
          measure + 1
        }:B${beat + 1}. ` +
          `Prev: ${note1PrevName}-${note2PrevName} (${simplePrev}), Curr: ${note1CurrName}-${note2CurrName} (${simpleCurr})`
      );
    }
  }

  // TODO: Add checks for Direct/Hidden Octaves/Fifths if desired (more complex rules).
  // Involves checking soprano movement (leap?) when outer voices move to P5/P8.
}

/**
 * Performs various voice leading checks for the current set of notes against the previous set.
 * Checks for voice crossing, spacing issues, and parallel motion.
 * @param {{soprano: number, alto: number, tenor: number, bass: number}} currentNotes - MIDI notes for the current step.
 * @param {{soprano: number | null, alto: number | null, tenor: number | null, bass: number | null}} previousNotes - MIDI notes from the previous step.
 * @param {number} measure - Current measure index (0-based).
 * @param {number} beat - Current beat index (0-based).
 */
function checkVoiceLeadingRules(currentNotes, previousNotes, measure, beat) {
  const { soprano, alto, tenor, bass } = currentNotes;
  const prev = previousNotes;

  // Helper for logging location
  const loc = `M${measure + 1}:B${beat + 1}`;

  // --- 1. Voice Crossing (Static Check) ---
  // Check if any upper voice is lower than the voice below it in the current chord.
  if (alto > soprano)
    console.warn(
      `Voice Crossing: Alto (${midiToNoteName(
        alto
      )}) > Soprano (${midiToNoteName(soprano)}) at ${loc}`
    );
  if (tenor > alto)
    console.warn(
      `Voice Crossing: Tenor (${midiToNoteName(
        tenor
      )}) > Alto (${midiToNoteName(alto)}) at ${loc}`
    );
  if (bass > tenor)
    console.warn(
      `Voice Crossing: Bass (${midiToNoteName(bass)}) > Tenor (${midiToNoteName(
        tenor
      )}) at ${loc}`
    );

  // --- 2. Voice Spacing (Static Check) ---
  // Check distance between adjacent voices against defined limits.
  if (Math.abs(soprano - alto) > VOICE_SPACING_LIMIT.soprano_alto)
    console.warn(`Spacing > P8 between Soprano/Alto at ${loc}`);
  if (Math.abs(alto - tenor) > VOICE_SPACING_LIMIT.alto_tenor)
    console.warn(`Spacing > P8 between Alto/Tenor at ${loc}`);
  if (Math.abs(tenor - bass) > VOICE_SPACING_LIMIT.tenor_bass)
    console.warn(`Spacing > P12 between Tenor/Bass at ${loc}`);

  // --- 3. Parallel Motion (Dynamic Check) ---
  // Check all pairs of voices for parallel 5ths and octaves if previous notes exist.
  if (prev && prev.soprano !== null) {
    // Ensure previous state is valid
    checkParallels(
      prev.soprano,
      soprano,
      prev.alto,
      alto,
      "Soprano",
      "Alto",
      measure,
      beat
    );
    checkParallels(
      prev.soprano,
      soprano,
      prev.tenor,
      tenor,
      "Soprano",
      "Tenor",
      measure,
      beat
    );
    checkParallels(
      prev.soprano,
      soprano,
      prev.bass,
      bass,
      "Soprano",
      "Bass",
      measure,
      beat
    );
    checkParallels(
      prev.alto,
      alto,
      prev.tenor,
      tenor,
      "Alto",
      "Tenor",
      measure,
      beat
    );
    checkParallels(
      prev.alto,
      alto,
      prev.bass,
      bass,
      "Alto",
      "Bass",
      measure,
      beat
    );
    checkParallels(
      prev.tenor,
      tenor,
      prev.bass,
      bass,
      "Tenor",
      "Bass",
      measure,
      beat
    );
  }
}

// --- Rhythmic Pattern Helper ---
/**
 * Determines basic rhythmic durations for voices within a measure based on the time signature.
 * @param {number} meterBeats - The number of beats per measure (e.g., 4 for 4/4).
 * @param {number} beatValue - The type of note that gets the beat (e.g., 4 for quarter note).
 * @returns {{upperVoiceDurations: string[], bassDurations: string[]}} Arrays of VexFlow duration strings.
 */
function _determineRhythmicPattern(meterBeats, beatValue) {
  let upperVoiceDurations = [];
  let bassDurations = [];
  const quarterNote = "q";
  const halfNote = "h";
  const dottedHalf = "h.";
  const wholeNote = "w";
  const eighthNote = "8";

  // Define patterns based on common meters. VexFlow durations: 'w', 'h', 'q', '8', '16', etc. Add '.' for dots.
  // Ensure the durations add up to the total number of beats *relative to the beat value*.
  // Example: 3/4 meter = 3 quarter notes. 6/8 meter = 6 eighth notes.
  const ticksPerMeasure = (meterBeats / beatValue) * Vex.Flow.RESOLUTION; // Total ticks based on quarter note resolution

  // Helper to convert VexFlow duration string to ticks
  const durationToTicks = (dur) => Vex.Flow.durationToTicks(dur);

  // Simpler approach: Fill with basic beat unit first
  const baseDuration = beatValue === 8 ? eighthNote : quarterNote; // '8' for x/8, 'q' otherwise
  upperVoiceDurations = Array(meterBeats).fill(baseDuration);
  bassDurations = Array(meterBeals).fill(baseDuration);

  // --- Apply common patterns ---
  // Note: This is simplified. Real chorales have much more rhythmic variety.
  // We will use a very basic block chord rhythm for this generator.
  // All voices get the same duration, matching the beat value.
  const beatDurationStr = { 4: "q", 2: "h", 8: "8" }[beatValue] || "q"; // q, h, or 8
  upperVoiceDurations = Array(meterBeats).fill(beatDurationStr);
  bassDurations = Array(meterBeats).fill(beatDurationStr);

  // --- Example of more complex patterns (kept for reference, but using block chords now) ---
  /*
    if (meterBeats === 4 && beatValue === 4) { // 4/4
        upperVoiceDurations = [quarterNote, quarterNote, quarterNote, quarterNote]; // Block chords on each beat
        bassDurations = [quarterNote, quarterNote, quarterNote, quarterNote];
        // Alternative: bassDurations = [halfNote, halfNote];
    } else if (meterBeats === 3 && beatValue === 4) { // 3/4
        upperVoiceDurations = [quarterNote, quarterNote, quarterNote];
        bassDurations = [quarterNote, quarterNote, quarterNote];
        // Alternative: bassDurations = [dottedHalf]; // Needs careful VexFlow handling if combining with shorter notes
    } else if (meterBeats === 2 && beatValue === 4) { // 2/4
        upperVoiceDurations = [quarterNote, quarterNote];
        bassDurations = [quarterNote, quarterNote];
        // Alternative: bassDurations = [halfNote];
    } else if (meterBeats === 6 && beatValue === 8) { // 6/8
         upperVoiceDurations = [eighthNote, eighthNote, eighthNote, eighthNote, eighthNote, eighthNote];
         bassDurations = [eighthNote, eighthNote, eighthNote, eighthNote, eighthNote, eighthNote];
         // Alternative: bassDurations = ['q.', 'q.']; // Dotted quarters
    }
    else { // Default: fill with the beat unit
        const defaultDur = beatValue === 8 ? eighthNote : quarterNote;
        upperVoiceDurations = Array(meterBeats).fill(defaultDur);
        bassDurations = Array(meterBeats).fill(defaultDur);
    }

    // --- Validate Durations ---
    const sumTicks = (durations) => durations.reduce((sum, d) => sum + (durationToTicks(d) ?? 0), 0);

    if (Math.abs(sumTicks(upperVoiceDurations) - ticksPerMeasure) > 1) { // Allow tiny tolerance
        console.warn(`Generated upper voice durations for ${meterBeats}/${beatValue} do not sum correctly. Defaulting to beat unit.`);
        const defaultDur = beatValue === 8 ? eighthNote : quarterNote;
        upperVoiceDurations = Array(meterBeats).fill(defaultDur);
    }
     if (Math.abs(sumTicks(bassDurations) - ticksPerMeasure) > 1) {
        console.warn(`Generated bass durations for ${meterBeats}/${beatValue} do not sum correctly. Defaulting to beat unit.`);
        const defaultDur = beatValue === 8 ? eighthNote : quarterNote;
        bassDurations = Array(meterBeats).fill(defaultDur);
    }
    */

  return { upperVoiceDurations, bassDurations };
}

/**
 * Main function to generate the four-part voice data based on a chord progression and settings.
 * @param {string[]} chordProgression - Array of Roman numeral chord symbols.
 * @param {string} key - The key signature (e.g., "C", "Gm").
 * @param {string} meter - The time signature (e.g., "4/4", "3/4").
 * @param {number} numMeasures - The number of measures to generate.
 * @param {{harmonicComplexity: number, melodicSmoothness: number, dissonanceStrictness: number}} generationSettings - Object containing generation parameters.
 * @returns {object} A data structure containing arrays of note objects for each voice (soprano, alto, tenor, bass).
 * Each note object: { midi: number|null, duration: string, vexKey: string, isRest: boolean }
 * @throws {Error} If the key or meter is invalid.
 */
function generateVoices(
  chordProgression,
  key,
  meter,
  numMeasures,
  generationSettings
) {
  const { melodicSmoothness, dissonanceStrictness } = generationSettings;

  // --- Validate Inputs and Setup ---
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails)
    throw new Error("Invalid key provided to generateVoices: " + key);
  const keyTonic = keyDetails.tonic;
  // Calculate the MIDI pitch class of the leading tone (Major 7th above tonic). Important for doubling rules.
  const leadingToneMidiPc =
    (Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE) +
      Tonal.Interval.semitones("M7")) %
    12;

  const [meterBeats, beatValue] = meter.split("/").map(Number);
  if (![2, 4, 8, 16].includes(beatValue))
    throw new Error("Unsupported beat value in meter: " + meter);
  const ticksPerBeat = Vex.Flow.RESOLUTION / beatValue; // e.g., 1024 for quarter note in 4/4

  // --- Initialize Data Structures ---
  // Store results here: { soprano: [noteObj, ...], alto: [...], ... }
  let voicesData = { soprano: [], alto: [], tenor: [], bass: [] };
  // Keep track of the MIDI note of the *previous* step for each voice (for voice leading).
  let previousNotesMidi = {
    soprano: null,
    alto: null,
    tenor: null,
    bass: null,
  };

  // --- Determine Rhythmic Pattern (Simplified: Block Chords per Beat) ---
  // For simplicity, assign one chord per measure, held for the measure's duration, using the primary beat unit.
  // A more complex version would iterate through beats within the measure.
  const chordDurationStr = { 1: "w", 2: "h", 4: "q", 8: "8" }[beatValue] || "q"; // Use beat value note type
  // Rests will use the same duration string followed by 'r'
  const restDurationStr = chordDurationStr + "r";

  // --- Loop Through Measures (Each measure gets one chord) ---
  for (let i = 0; i < numMeasures; i++) {
    const roman = chordProgression[i];
    const baseChordNotes = getChordNotesFromRoman(roman, key); // Get MIDI notes for the chord triad/7th.

    // --- Handle Chord Errors ---
    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${
          i + 1
        }: Could not get notes for chord "${roman}" in key "${key}". Adding rests.`
      );
      // Add rests for the duration of the measure for all voices.
      VOICE_ORDER.forEach((voiceName) => {
        voicesData[voiceName].push({
          midi: null,
          duration: restDurationStr, // Rest for one beat unit duration
          vexKey: "b/4", // VexFlow needs a default key for rests
          isRest: true,
        });
      });
      // Reset previous notes as context is lost after a rest measure.
      previousNotesMidi = {
        soprano: null,
        alto: null,
        tenor: null,
        bass: null,
      };
      continue; // Move to the next measure.
    }

    // --- Prepare Chord Data for Voicing ---
    const chordRootMidi = baseChordNotes[0]; // Tonal returns [root, 3rd, 5th, (7th)]
    const chordRootPc = chordRootMidi % 12; // Pitch class of the root
    const chordPcs = baseChordNotes.map((n) => n % 12); // All pitch classes in the chord [0, 4, 7] etc.
    // Check if this chord is a leading tone chord (e.g., vii°). Important for doubling.
    const isLeadingToneChord = roman.toLowerCase().includes("vii");
    // Get the full pool of MIDI notes across octaves for this chord.
    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);

    // --- Assign Notes for the Current Chord (Single Step per Measure) ---
    // This simplified version assigns one note per voice per measure.

    // 1. Assign Bass Note
    const bassNoteMidi = assignBassNote(
      chordRootMidi,
      fullChordNotePool,
      previousNotesMidi.bass,
      melodicSmoothness
    );

    // 2. Assign Soprano Note
    const sopranoNoteMidi = assignSopranoNote(
      fullChordNotePool,
      previousNotesMidi.soprano,
      previousNotesMidi.alto, // Pass previous alto for context
      melodicSmoothness
    );

    // 3. Determine Pitch Classes Needed for Inner Voices (Alto, Tenor)
    let currentVoicingPcs = new Set(); // Track pitch classes already assigned (Bass, Soprano)
    if (bassNoteMidi !== null) currentVoicingPcs.add(bassNoteMidi % 12);
    if (sopranoNoteMidi !== null) currentVoicingPcs.add(sopranoNoteMidi % 12);

    // Find which chord tones are missing from the Bass/Soprano assignment.
    let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
    let pcsToDouble = []; // Which pitch class(es) should be doubled if needed.

    // --- Doubling Logic (for triads, where #voices > #pitch classes) ---
    const voicesToFill = 2; // We need to fill Alto and Tenor.
    if (neededPcs.length < voicesToFill) {
      const numDoublingsNeeded = voicesToFill - neededPcs.length;

      // Prioritize doubling the root, unless it's the leading tone (avoid LT doubles).
      // Also avoid doubling root in LT chords if Bass already has the root (less critical).
      const canDoubleRoot = chordRootPc !== leadingToneMidiPc;
      if (canDoubleRoot && !currentVoicingPcs.has(chordRootPc)) {
        pcsToDouble.push(chordRootPc);
      }

      // If still need doublings, try doubling the 5th (if present and not LT).
      const fifthPc = Tonal.Note.transpose(
        Tonal.Note.fromMidi(chordRootMidi),
        "P5"
      );
      const fifthPcMidi = Tonal.Note.midi(fifthPc) % 12;
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        chordPcs.includes(fifthPcMidi) &&
        fifthPcMidi !== leadingToneMidiPc &&
        !currentVoicingPcs.has(fifthPcMidi) &&
        !neededPcs.includes(fifthPcMidi)
      ) {
        pcsToDouble.push(fifthPcMidi);
      }

      // If still need doublings, try doubling the 3rd (if present and not LT).
      const thirdPc = chordPcs.find(
        (pc) => pc !== chordRootPc && pc !== fifthPcMidi
      ); // Find the remaining PC
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        thirdPc !== undefined &&
        thirdPc !== leadingToneMidiPc &&
        !currentVoicingPcs.has(thirdPc) &&
        !neededPcs.includes(thirdPc)
      ) {
        pcsToDouble.push(thirdPc);
      }

      // Last resort: Fill remaining doublings with the root (even if LT) or 5th if root taken.
      while (pcsToDouble.length < numDoublingsNeeded) {
        if (
          !currentVoicingPcs.has(chordRootPc) &&
          !neededPcs.includes(chordRootPc) &&
          !pcsToDouble.includes(chordRootPc)
        ) {
          pcsToDouble.push(chordRootPc);
        } else if (
          chordPcs.includes(fifthPcMidi) &&
          !currentVoicingPcs.has(fifthPcMidi) &&
          !neededPcs.includes(fifthPcMidi) &&
          !pcsToDouble.includes(fifthPcMidi)
        ) {
          pcsToDouble.push(fifthPcMidi);
        } else if (
          thirdPc !== undefined &&
          !currentVoicingPcs.has(thirdPc) &&
          !neededPcs.includes(thirdPc) &&
          !pcsToDouble.includes(thirdPc)
        ) {
          pcsToDouble.push(thirdPc); // Double third as final option if available
        } else {
          pcsToDouble.push(chordRootPc); // Default to root if all else fails
        }
        // Prevent infinite loop by potentially adding duplicate if logic is flawed
        if (pcsToDouble.length > voicesToFill * 2) break;
      }
    }

    // Combine needed PCs and doubled PCs for the inner voices.
    let targetInnerPcs = [...neededPcs, ...pcsToDouble];

    // Ensure we have exactly two target pitch classes for Alto and Tenor.
    if (targetInnerPcs.length < voicesToFill) {
      console.warn(
        `Could not determine enough inner voice pitch classes for chord ${roman} at M${
          i + 1
        }. ` +
          `ChordPCs: ${chordPcs}, Chosen: ${[
            ...currentVoicingPcs,
          ]}, Needed: ${neededPcs}, Doubled: ${pcsToDouble}. Adding fallback PCs.`
      );
      // Fill remaining slots, prioritizing root, then 5th.
      while (targetInnerPcs.length < voicesToFill) {
        const fifthPcMidi =
          Tonal.Note.midi(
            Tonal.Note.transpose(Tonal.Note.fromMidi(chordRootMidi), "P5")
          ) % 12;
        if (!targetInnerPcs.includes(chordRootPc)) {
          targetInnerPcs.push(chordRootPc);
        } else if (
          chordPcs.includes(fifthPcMidi) &&
          !targetInnerPcs.includes(fifthPcMidi)
        ) {
          targetInnerPcs.push(fifthPcMidi);
        } else {
          targetInnerPcs.push(chordRootPc); // Default add root again
        }
      }
    }
    // If we have too many (e.g., 7th chord didn't need doubling), just take the first two needed/doubled.
    targetInnerPcs = targetInnerPcs.slice(0, voicesToFill);

    // Assign the target PCs to Alto and Tenor (order might influence assignment).
    const tenorTargetPc = targetInnerPcs[0];
    const altoTargetPc = targetInnerPcs[1];

    // 4. Assign Inner Voices (Alto and Tenor)
    const { tenorNoteMidi, altoNoteMidi } = assignInnerVoices(
      tenorTargetPc,
      altoTargetPc,
      fullChordNotePool,
      previousNotesMidi.tenor,
      previousNotesMidi.alto,
      sopranoNoteMidi, // Pass chosen Soprano
      bassNoteMidi, // Pass chosen Bass
      melodicSmoothness
    );

    // 5. Consolidate Notes for This Step
    const currentStepNotes = {
      soprano: sopranoNoteMidi,
      alto: altoNoteMidi,
      tenor: tenorNoteMidi,
      bass: bassNoteMidi,
    };

    // 6. Perform Voice Leading Checks (if strictness setting is met)
    // The beat parameter is 0 here as we treat the measure as one step.
    if (dissonanceStrictness > 3) {
      // Arbitrary threshold for enabling checks
      checkVoiceLeadingRules(currentStepNotes, previousNotesMidi, i, 0);
    }

    // 7. Add Note Data to Results
    // Assign the chosen MIDI note and the determined duration to each voice.
    VOICE_ORDER.forEach((voiceName) => {
      const midi = currentStepNotes[voiceName];
      const vexKey = midi !== null ? midiToVexflowKey(midi, key) : null;

      if (midi !== null && vexKey) {
        voicesData[voiceName].push({
          midi: midi,
          duration: chordDurationStr, // Duration for the whole beat/measure step
          vexKey: vexKey,
          isRest: false,
        });
      } else {
        // Handle cases where a note assignment failed or VexKey is invalid. Add a rest.
        console.warn(
          `Assigning rest for ${voiceName} at M${
            i + 1
          } (MIDI: ${midi}, VexKey: ${vexKey})`
        );
        voicesData[voiceName].push({
          midi: null,
          duration: restDurationStr,
          vexKey: "b/4", // Default rest key
          isRest: true,
        });
        currentStepNotes[voiceName] = null; // Ensure failed notes are null for the next step's `previousNotesMidi`
      }
    });

    // 8. Update Previous Notes State for the next iteration.
    previousNotesMidi = { ...currentStepNotes };
  } // End measure loop

  console.log("Generated Voices Data:", voicesData);
  return voicesData;
}

// =============================================================================
// Display Logic (Using VexFlow)
// =============================================================================

/**
 * Helper function to set up the VexFlow Renderer and rendering Context.
 * @param {HTMLElement} container - The DOM element to render into.
 * @param {number} width - The desired width of the renderer.
 * @param {number} height - The desired height of the renderer.
 * @returns {{renderer: Vex.Flow.Renderer, context: Vex.Flow.SVGContext}}
 * @throws {Error} If renderer or context cannot be created.
 */
function _setupRendererAndContext(container, width, height) {
  container.innerHTML = ""; // Clear previous content
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  if (!renderer) throw new Error("VexFlow Renderer could not be instantiated.");

  renderer.resize(width, height);
  const context = renderer.getContext();
  if (!context)
    throw new Error("Failed to get rendering context from VexFlow Renderer.");

  context.setFont("Arial", 10).setBackgroundFillStyle("#eed"); // Optional styling
  console.log(`Renderer created and resized to ${width}x${height}`);
  return { renderer, context };
}

/**
 * Helper function to create and draw the treble and bass staves.
 * @param {Vex.Flow.SVGContext} context - The VexFlow rendering context.
 * @param {number} width - The width for the staves.
 * @param {string} keySignature - The key signature string (e.g., "C", "Gm").
 * @param {string} timeSignature - The time signature string (e.g., "4/4").
 * @returns {{staveTreble: Vex.Flow.Stave, staveBass: Vex.Flow.Stave}}
 */
function _createAndDrawStaves(context, width, keySignature, timeSignature) {
  const staveX = 10;
  const staveTrebleY = 40;
  const staveBassY = 150; // Adjust spacing as needed

  const staveTreble = new Stave(staveX, staveTrebleY, width)
    .addClef("treble")
    .addTimeSignature(timeSignature)
    .addKeySignature(keySignature); // Add key signature object

  const staveBass = new Stave(staveX, staveBassY, width)
    .addClef("bass")
    .addTimeSignature(timeSignature) // Required by VexFlow 4 formatter context
    .addKeySignature(keySignature);

  staveTreble.setContext(context).draw();
  staveBass.setContext(context).draw();
  console.log("Staves drawn.");
  return { staveTreble, staveBass };
}

/**
 * Helper function to draw stave connectors (brace, lines).
 * @param {Vex.Flow.SVGContext} context - The VexFlow rendering context.
 * @param {Vex.Flow.Stave} staveTop - The top stave (treble).
 * @param {Vex.Flow.Stave} staveBottom - The bottom stave (bass).
 */
function _drawConnectors(context, staveTop, staveBottom) {
  // Brace connector on the left
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.BRACE)
    .setContext(context)
    .draw();
  // Single line connector on the left (start bar line)
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.SINGLE_LEFT)
    .setContext(context)
    .draw();
  // Single line connector on the right (end bar line)
  new StaveConnector(staveTop, staveBottom)
    .setType(StaveConnector.type.SINGLE_RIGHT)
    .setContext(context)
    .draw();
  console.log("Connectors drawn.");
}

/**
 * Processes the generated music data into VexFlow StaveNote objects, handling accidentals and beams.
 * @param {object} musicData - The structured music data from `generateVoices`.
 * @param {string} key - The key signature string (e.g., "C", "Gm"). Used for accidental logic.
 * @returns {{vexNotesByVoice: object, beams: Vex.Flow.Beam[]}} Object containing notes per voice and beam objects.
 */
function _processMusicDataToVexNotes(musicData, key) {
  const vexNotesByVoice = { soprano: [], alto: [], tenor: [], bass: [] };
  const beams = []; // Array to hold all Beam objects across all voices
  const currentVexKeySignature = new KeySignature(key); // Create Vex KeySignature for accidental checks

  Object.keys(musicData).forEach((voiceName) => {
    const voiceNotesData = musicData[voiceName];
    const clef =
      voiceName === "soprano" || voiceName === "alto" ? "treble" : "bass";
    let notesForCurrentBeam = []; // Collect notes for beaming within this voice

    voiceNotesData.forEach((noteData, index) => {
      // Validate essential note data properties
      if (
        !noteData ||
        typeof noteData.duration !== "string" ||
        typeof noteData.vexKey !== "string"
      ) {
        console.warn(
          `Skipping invalid note data at index ${index} in voice ${voiceName}:`,
          noteData
        );
        return; // Skip this malformed note
      }

      // --- Create StaveNote ---
      const noteProps = {
        keys: [noteData.vexKey], // VexFlow needs an array of keys (usually one for single notes)
        duration: noteData.duration.replace(/\./g, ""), // Remove dots for constructor; add later
        clef: clef,
        // Let VexFlow decide stem direction automatically based on pitch and clef.
        // Manual stemming might be needed for complex polyphony on one staff, but not SATB on two staves.
        auto_stem: true, // Use auto_stem: true
        // stem_direction: (clef === 'treble' && noteData.vexKey.endsWith('/4') || noteData.vexKey.endsWith('/5')) ? -1 : 1 // Basic stem direction (optional)
      };
      // Handle rests specifically
      if (noteData.isRest) {
        noteProps.keys = ["b/4"]; // Default pitch for rests in VexFlow
        noteProps.duration += "r"; // Append 'r' for rest duration
      }

      const staveNote = new StaveNote(noteProps);

      // --- Add Accidentals (Only for non-rests) ---
      if (!noteData.isRest && noteData.midi !== null) {
        // Extract note name part (e.g., "c#", "ab") from the VexFlow key ("c#/4").
        const noteNamePart = noteData.vexKey.split("/")[0];
        // Use Tonal.js to parse the note name and get its components.
        const tonalNote = Tonal.Note.get(Tonal.Note.simplify(noteNamePart)); // Gets { letter, acc, ... }

        if (tonalNote.acc) {
          // Check if Tonal identifies an accidental (#, b, ##, bb)
          // Check if the key signature already specifies an accidental for this note letter.
          const keySigAccidental = currentVexKeySignature.getAccidental(
            tonalNote.letter.toLowerCase()
          );

          let needsExplicitAccidental = false;
          let accidentalType = tonalNote.acc; // The accidental from the note itself (#, b)

          if (!keySigAccidental) {
            // Key signature has NO accidental for this letter (e.g., G in C major).
            // If the note HAS an accidental (e.g., G#), it needs to be displayed.
            needsExplicitAccidental = true;
          } else {
            // Key signature HAS an accidental for this letter (e.g., F# in G major).
            // Compare the note's accidental with the key signature's.
            if (tonalNote.acc !== keySigAccidental.type) {
              // Mismatch found. We need *some* explicit accidental.
              needsExplicitAccidental = true;
              // If the note is natural but the key sig has #/b, use 'n'.
              if (tonalNote.acc === "") {
                accidentalType = "n"; // Natural sign needed
              } // Otherwise, use the note's own # or b.
            } // Else: Accidental matches key sig (e.g., F# in G major), no explicit sign needed.
          }

          // Add the required accidental modifier to the VexFlow note.
          // VexFlow needs caution for accidentals within a measure (automatic cancellation logic is complex).
          // For simplicity here, we add based purely on key signature comparison.
          // A more robust solution tracks accidentals applied within the measure.
          if (needsExplicitAccidental) {
            staveNote.addModifier(new Accidental(accidentalType), 0); // Add to the first (only) key index
          }
        }
      } // End if (!noteData.isRest)

      // --- Add Dots ---
      const dotCount = (noteData.duration.match(/\./g) || []).length;
      for (let d = 0; d < dotCount; d++) {
        // Use addDot where appropriate. VexFlow >= 4 uses addModifier(Dot.create({ all: true })) or similar
        if (staveNote.addDotToAll) {
          // VexFlow 3 syntax
          staveNote.addDotToAll();
        } else if (Vex.Flow.Dot) {
          // VexFlow 4+ syntax might need Dot modifier
          // Add Dot modifier (check VexFlow docs for exact VF4+ usage)
          // staveNote.addModifier(new Vex.Flow.Dot(), 0); // Example, verify index and type
        }
      }

      // Add the fully configured StaveNote to the voice's array.
      vexNotesByVoice[voiceName].push(staveNote);

      // --- Beaming Logic ---
      // Collect beamable notes (e.g., 8ths, 16ths) within this voice.
      // Create a Beam object when a non-beamable note or rest is encountered, or at the end of the voice.
      const isBeamable =
        !noteData.isRest &&
        (noteData.duration.includes("8") || noteData.duration.includes("16")); // Extend if needed (32nds etc.)
      if (isBeamable) {
        notesForCurrentBeam.push(staveNote);
      } else {
        // Current note breaks the beam (rest, quarter, half, etc.)
        if (notesForCurrentBeam.length > 1) {
          // Create a beam from the collected notes if there are 2 or more.
          beams.push(new Beam(notesForCurrentBeam));
        }
        notesForCurrentBeam = []; // Reset for the next potential beam group.
      }
    }); // End loop through notes in a voice

    // After processing all notes in the voice, check if the last group needs beaming.
    if (notesForCurrentBeam.length > 1) {
      beams.push(new Beam(notesForCurrentBeam));
    }
  }); // End loop through voices (soprano, alto, etc.)

  console.log(
    `Processed ${Object.values(vexNotesByVoice).reduce(
      (sum, notes) => sum + notes.length,
      0
    )} VexFlow notes and ${beams.length} beams.`
  );
  return { vexNotesByVoice, beams };
}

/**
 * Creates VexFlow Voice objects, adds notes, and formats them using the Formatter.
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

  Object.keys(vexNotesByVoice).forEach((voiceName) => {
    const notes = vexNotesByVoice[voiceName];
    if (notes.length === 0) {
      console.warn(
        `No valid notes found for voice "${voiceName}". Skipping voice creation.`
      );
      return; // Skip if a voice ended up with no notes
    }

    // Create the VexFlow Voice
    const voice = new Voice({
      num_beats: num_beats,
      beat_value: beat_value,
    }).setStrict(false); // Be more tolerant of minor timing discrepancies

    voice.addTickables(notes); // Add the StaveNote objects

    // Associate the voice with the correct stave (important for formatting and drawing)
    const stave =
      voiceName === "soprano" || voiceName === "alto" ? staveTreble : staveBass;
    // In VexFlow 4+, associating stave might happen implicitly or via Formatter, but explicit doesn't hurt.
    // voice.setStave(stave); // Set stave association if required by VexFlow version/approach

    allVexVoices.push(voice);
  });

  if (allVexVoices.length === 0) {
    throw new Error(
      "No voices could be created from the processed notes. Cannot format."
    );
  }
  console.log(`${allVexVoices.length} VexFlow Voices created.`);

  // --- Formatting ---
  const formatter = new Formatter();

  // Group voices by the stave they belong to for formatting.
  const trebleVoices = allVexVoices.filter(
    (v) => v.getTickables()[0]?.getClef() === "treble"
  ); // Check clef of first note
  const bassVoices = allVexVoices.filter(
    (v) => v.getTickables()[0]?.getClef() === "bass"
  );

  // Format voices on the treble stave together.
  if (trebleVoices.length > 0) {
    // associateStave implicitly links voices to stave in VF4 Formatter? Check docs.
    formatter
      .joinVoices(trebleVoices)
      .format(trebleVoices, justifiableWidth, {
        context: staveTreble.getContext(),
        stave: staveTreble,
      });
    console.log(`Formatted ${trebleVoices.length} treble voice(s).`);
  }

  // Format voices on the bass stave together.
  if (bassVoices.length > 0) {
    formatter
      .joinVoices(bassVoices)
      .format(bassVoices, justifiableWidth, {
        context: staveBass.getContext(),
        stave: staveBass,
      });
    console.log(`Formatted ${bassVoices.length} bass voice(s).`);
  }

  return allVexVoices;
}

/**
 * Draws the formatted voices and beams onto the rendering context.
 * @param {Vex.Flow.SVGContext} context - The VexFlow rendering context.
 * @param {Vex.Flow.Voice[]} voices - Array of formatted VexFlow Voice objects.
 * @param {Vex.Flow.Beam[]} beams - Array of VexFlow Beam objects.
 */
function _drawVoicesAndBeams(context, voices, beams) {
  // Draw voices first (notes and stems)
  voices.forEach((voice) => {
    // Pass context and the associated stave to the draw method.
    voice.draw(context, voice.getStave() || undefined); // Pass stave explicitly if needed
  });
  console.log("Voices drawn.");

  // Draw beams last, over the notes and stems.
  beams.forEach((beam) => {
    beam.setContext(context).draw();
  });
  console.log(`${beams.length} beams drawn.`);
}

/**
 * Renders the generated music data onto the page using VexFlow.
 * Orchestrates the steps: setup, stave creation, note processing, formatting, drawing.
 * @param {object} musicData - The structured music data from `generateVoices`.
 * @param {string} key - The key signature (e.g., "C", "Gm").
 * @param {string} meter - The time signature (e.g., "4/4").
 * @param {number} numMeasures - The total number of measures.
 */
function displayMusic(musicData, key, meter, numMeasures) {
  // 1. --- Basic Validation ---
  if (!musicData || !musicData.soprano || musicData.soprano.length === 0) {
    statusDiv.textContent = "No music data generated to display.";
    console.warn("displayMusic called with invalid or empty musicData.");
    outputDiv.innerHTML = "<p>No music data available.</p>";
    return;
  }
  if (!outputDiv) {
    console.error(
      "Fatal Error: Output element '#sheet-music' not found in DOM."
    );
    statusDiv.textContent = "Error: Cannot find where to draw the music.";
    return;
  }
  if (typeof Vex === "undefined" || !Vex.Flow || !Vex.Flow.Renderer) {
    console.error(
      "Fatal Error: Vex.Flow library not loaded. Cannot display music."
    );
    statusDiv.textContent = "Error: VexFlow library issue.";
    return;
  }

  console.log("Starting VexFlow rendering...");
  statusDiv.textContent = "Rendering sheet music...";

  try {
    // 2. --- Setup Renderer and Context ---
    const staveWidthPerMeasure = 80; // Adjust as needed for density
    const staveWidth = Math.max(150, numMeasures * staveWidthPerMeasure); // Calculate total width
    const rendererWidth = staveWidth + 60; // Add padding for clefs, key sig, etc.
    const rendererHeight = 300; // Adjust if more space needed (e.g., ledger lines)
    const { renderer, context } = _setupRendererAndContext(
      outputDiv,
      rendererWidth,
      rendererHeight
    );

    // 3. --- Time Signature and Key Signature ---
    const timeSignature = meter; // Already in "X/Y" format
    console.log(
      `Rendering with Time Signature: ${timeSignature}, Key Signature: ${key}`
    );

    // 4. --- Create and Draw Staves ---
    const { staveTreble, staveBass } = _createAndDrawStaves(
      context,
      staveWidth,
      key,
      timeSignature
    );

    // 5. --- Draw Stave Connectors ---
    _drawConnectors(context, staveTreble, staveBass);

    // 6. --- Process Music Data into VexFlow Notes and Beams ---
    // This step includes handling rests, accidentals, and dots.
    const { vexNotesByVoice, beams } = _processMusicDataToVexNotes(
      musicData,
      key
    );

    // 7. --- Create VexFlow Voices and Format Them ---
    // This calculates the horizontal spacing of the notes.
    const justifiableWidth = Math.max(100, staveWidth - 20); // Width for formatter to use
    const formattedVoices = _createAndFormatVexVoices(
      vexNotesByVoice,
      staveTreble,
      staveBass,
      timeSignature,
      justifiableWidth
    );

    // 8. --- Draw Voices and Beams ---
    // Draws the actual notes, stems, flags, and beams onto the staves.
    _drawVoicesAndBeams(context, formattedVoices, beams);

    // 9. --- Final Status Update ---
    statusDiv.textContent = "Sheet music generated successfully.";
    if (typeof Tone !== "undefined") {
      // Only enable playback if Tone.js is loaded
      playBtn.disabled = false;
      stopBtn.disabled = false;
    }
    console.log("VexFlow rendering finished successfully.");
  } catch (error) {
    // --- Error Handling during Rendering ---
    console.error("Error during VexFlow rendering process:", error);
    statusDiv.textContent = `Error rendering music: ${error.message}`;
    outputDiv.innerHTML = `<p style="color:red;">Error rendering music. Check console for details.<br>${error.stack}</p>`;
    generatedMusicData = null; // Invalidate data if rendering failed
    playBtn.disabled = true;
    stopBtn.disabled = true;
  }
}

// =============================================================================
// Playback Logic (Using Tone.js)
// =============================================================================

/**
 * Converts a VexFlow duration string (e.g., "q", "h.", "8") into seconds,
 * considering the current tempo and Tone.js Transport context.
 * @param {string} vexDur - The VexFlow duration string.
 * @param {number} currentTempoBpm - The current tempo in Beats Per Minute.
 * @param {number} beatValue - The beat unit from the time signature (e.g., 4 for quarter).
 * @returns {number | null} Duration in seconds, or null if conversion fails.
 */
function _vexDurationToToneSeconds(vexDur, currentTempoBpm, beatValue) {
  try {
    // Use Tone.Ticks to convert VexFlow ticks to Tone's internal ticks, then to seconds.
    // This respects the current Transport tempo.
    const ticks = Vex.Flow.durationToTicks(vexDur);
    if (ticks === null) {
      console.warn(`Could not get VexFlow ticks for duration: ${vexDur}`);
      return null;
    }

    // Set Tone.Transport's BPM temporarily if it's not already set (should be set before calling this)
    // Tone.Transport.bpm.value = currentTempoBpm; // Ensure tempo is current

    // Convert VexFlow ticks (based on RESOLUTION/beatValue) to seconds
    const seconds = Tone.Ticks(ticks).toSeconds();

    return seconds;
  } catch (e) {
    console.error(
      `Error converting VexFlow duration "${vexDur}" to Tone seconds:`,
      e
    );
    return null; // Fallback: Indicate failure
  }
}

/**
 * Plays the generated music data using Tone.js PolySynth.
 * Converts the internal music data structure into Tone.js events.
 */
function playGeneratedMusic() {
  if (typeof Tone === "undefined") {
    console.error("Tone.js library not loaded. Playback unavailable.");
    statusDiv.textContent = "Playback unavailable (Tone.js missing).";
    return;
  }
  if (!generatedMusicData) {
    console.warn("No generated music data available to play.");
    statusDiv.textContent = "Generate music first.";
    return;
  }

  // --- Start AudioContext (Required by browsers for Web Audio) ---
  Tone.start()
    .then(() => {
      console.log("AudioContext started by user interaction.");
      statusDiv.textContent = "Preparing playback...";

      // --- Cleanup Previous Playback ---
      stopPlayback(); // Ensure any previous playback is stopped and cleaned up.

      // --- Initialize PolySynth ---
      // Create a PolySynth if it doesn't exist. This allows multiple notes simultaneously.
      if (!polySynth) {
        polySynth = new Tone.PolySynth(Tone.Synth, {
          // --- Optional Synth Configuration ---
          // volume: -8, // Lower volume slightly
          oscillator: { type: "triangle" }, // Softer sound than default sine
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 }, // Adjust ADSR
        }).toDestination(); // Connect the synth to the audio output.
      }

      // --- Convert Music Data to Tone.js Events ---
      const toneEvents = []; // Array to hold events for Tone.Part: { time: seconds, note: "C4", duration: seconds }
      const [meterBeats, beatValue] = meterSelect.value.split("/").map(Number);
      const currentTempoBpm = parseInt(tempoInput.value); // Get current tempo

      // Set Tone.js Transport settings BEFORE calculating durations in seconds.
      Tone.Transport.bpm.value = currentTempoBpm;
      // Tone.Transport.timeSignature = [meterBeats, beatValue]; // Set time sig if needed by duration logic

      let totalDurationTicks = 0; // Track the total length in VexFlow ticks

      // Iterate through each voice (soprano, alto, etc.)
      VOICE_ORDER.forEach((voiceName) => {
        let currentTickTime = 0; // Track time position within the voice in VexFlow ticks.

        generatedMusicData[voiceName].forEach((note) => {
          const noteDurationTicks = Vex.Flow.durationToTicks(note.duration);
          if (noteDurationTicks === null) {
            console.warn(
              `Skipping note in ${voiceName} due to invalid duration: ${note.duration}`
            );
            return; // Skip note if duration is bad
          }

          if (!note.isRest && note.midi !== null) {
            const noteName = midiToNoteName(note.midi); // Convert MIDI to note name (e.g., "C#4")
            if (noteName) {
              // Calculate start time and duration in seconds using the helper function.
              // The start time depends on the accumulated ticks in this voice.
              const startTimeSeconds = Tone.Ticks(currentTickTime).toSeconds();
              const durationSeconds = Tone.Ticks(noteDurationTicks).toSeconds();

              if (
                startTimeSeconds !== null &&
                durationSeconds !== null &&
                durationSeconds > 0
              ) {
                toneEvents.push({
                  time: startTimeSeconds, // Start time in seconds
                  note: noteName, // Note name for Tone.js ("C4", "F#5")
                  duration: durationSeconds, // Duration in seconds
                  velocity: 0.7, // MIDI velocity (0-1), adjust as needed
                });
              } else {
                console.warn(
                  `Failed to calculate time/duration for note: ${noteName} at tick ${currentTickTime}`
                );
              }
            }
          }
          // Advance the time tracker for the next note in this voice.
          currentTickTime += noteDurationTicks;
        }); // End loop through notes in voice

        // Update the total duration needed for the Transport schedule.
        totalDurationTicks = Math.max(totalDurationTicks, currentTickTime);
      }); // End loop through voices

      // Sort events by start time, crucial for Tone.Part.
      toneEvents.sort((a, b) => a.time - b.time);
      console.log(`Prepared ${toneEvents.length} Tone.js events.`);

      if (toneEvents.length === 0) {
        statusDiv.textContent = "Nothing to play (maybe only rests?).";
        return;
      }

      // --- Schedule Events with Tone.Part ---
      // Create a Tone.Part to schedule all the events.
      currentPart = new Tone.Part((time, value) => {
        // This callback function is invoked for each event at the specified 'time'.
        // 'value' is the event object { time, note, duration, velocity }.
        polySynth.triggerAttackRelease(
          value.note,
          value.duration,
          time, // Precise scheduling time
          value.velocity
        );
      }, toneEvents).start(0); // Start the Part immediately when Transport starts.

      // Ensure the part loops indefinitely if needed, or stops appropriately.
      // currentPart.loop = false; // Default is false. Set true for looping.

      // --- Start Playback ---
      Tone.Transport.stop(); // Ensure Transport is stopped before starting.
      Tone.Transport.position = 0; // Reset position to the beginning.
      Tone.Transport.start("+0.1"); // Start the Transport slightly in the future (0.1s).
      statusDiv.textContent = "Playback started...";
      playBtn.disabled = true; // Disable play button while playing
      stopBtn.disabled = false; // Enable stop button

      // --- Schedule Automatic Stop ---
      // Calculate total duration in seconds and schedule Transport.stop.
      const totalPlaybackSeconds = Tone.Ticks(totalDurationTicks).toSeconds();
      Tone.Transport.scheduleOnce(() => {
        console.log("Scheduled stop triggered.");
        stopPlayback(); // Call the cleanup function
        // Only update status if it wasn't manually stopped already.
        if (statusDiv.textContent === "Playback started...") {
          statusDiv.textContent = "Playback finished.";
        }
      }, `+${totalPlaybackSeconds + 0.2}`); // Schedule stop slightly after the last note finishes (+ buffer).
    })
    .catch((e) => {
      console.error("Error starting Tone.js playback:", e);
      statusDiv.textContent =
        "Error starting audio. Please interact with the page first.";
    });
}

/**
 * Stops the Tone.js playback and cleans up resources.
 */
function stopPlayback() {
  if (typeof Tone !== "undefined") {
    console.log("Stopping playback...");
    Tone.Transport.stop(); // Stop the transport immediately.
    Tone.Transport.cancel(0); // Remove all scheduled events from the transport.

    if (currentPart) {
      currentPart.stop(0); // Stop the Part immediately.
      currentPart.dispose(); // Clean up the Part object.
      currentPart = null;
      console.log("Tone.Part stopped and disposed.");
    }

    // Release any notes currently held by the synth.
    if (polySynth) {
      polySynth.releaseAll();
      console.log("PolySynth notes released.");
      // Optional: Dispose synth if not reusing? Generally better to reuse.
      // polySynth.dispose();
      // polySynth = null;
    }

    // Update UI status and button states.
    if (statusDiv.textContent.startsWith("Playback")) {
      // Only update if relevant
      statusDiv.textContent = "Playback stopped.";
    }
    playBtn.disabled = generatedMusicData === null; // Re-enable play only if data exists
    stopBtn.disabled = true; // Disable stop button
  }
}

// =============================================================================
// Event Listeners
// =============================================================================

/**
 * Handles the click event for the 'Generate Music' button.
 * Gathers user inputs, triggers the generation process, and displays the result.
 */
generateBtn.addEventListener("click", () => {
  console.log("Generate button clicked.");
  statusDiv.textContent = "Generating...";
  playBtn.disabled = true;
  stopBtn.disabled = true;
  outputDiv.innerHTML = "<p>Generating...</p>"; // Provide visual feedback
  stopPlayback(); // Stop any ongoing playback before generating new music.

  // --- Gather User Inputs ---
  // const style = styleSelect.value; // Style input (currently unused in core logic)
  const key = keySelect.value;
  const meter = meterSelect.value;
  const numMeasures = parseInt(lengthInput.value);
  currentTempo = parseInt(tempoInput.value); // Update global tempo state
  const generationSettings = {
    harmonicComplexity: parseInt(harmonicComplexitySlider.value),
    melodicSmoothness: parseInt(melodicSmoothnessSlider.value),
    dissonanceStrictness: parseInt(dissonanceStrictnessSlider.value),
  };

  // --- Defer Generation slightly using setTimeout ---
  // This allows the browser's UI thread to update and show the "Generating..." message
  // before potentially blocking with intensive calculations.
  setTimeout(() => {
    try {
      console.log("--- Generation Start ---");
      console.log("Settings:", {
        key,
        meter,
        numMeasures,
        currentTempo,
        generationSettings,
      });

      // 1. Generate Chord Progression
      const progression = generateChordProgression(
        key,
        numMeasures,
        generationSettings.harmonicComplexity
      );
      if (!progression || progression.length === 0) {
        throw new Error(
          "Chord progression generation failed. Check console for details."
        );
      }

      // 2. Generate Voices based on Progression
      // This is the most complex part, involving voice leading.
      generatedMusicData = generateVoices(
        progression,
        key,
        meter,
        numMeasures,
        generationSettings
      );
      if (!generatedMusicData) {
        // Should not happen if generateVoices throws errors, but check anyway
        throw new Error("Voice generation failed unexpectedly.");
      }
      console.log("--- Voice Generation Complete ---");

      // 3. Display the Generated Music using VexFlow
      displayMusic(generatedMusicData, key, meter, numMeasures);
    } catch (error) {
      // --- Handle Errors during Generation or Display ---
      console.error("Error during music generation or display process:", error);
      statusDiv.textContent = `Error: ${error.message}`;
      outputDiv.innerHTML = `<p style="color:red;">Error generating music: ${error.message}<br>Check console for details.</p>`;
      generatedMusicData = null; // Reset data on error
      playBtn.disabled = true;
      stopBtn.disabled = true;
    }
  }, 50); // Small delay (e.g., 50ms) is usually sufficient.
});

// --- Playback Button Listeners ---
playBtn.addEventListener("click", playGeneratedMusic);
stopBtn.addEventListener("click", stopPlayback);

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initializes the application state on page load.
 * Sets default status messages, disables buttons, and checks for library dependencies.
 */
function initialize() {
  console.log("Initializing application...");
  statusDiv.textContent = "Select settings and click 'Generate Music'.";
  playBtn.disabled = true;
  stopBtn.disabled = true;

  let errorFound = false;

  // Check if Tonal.js is loaded (already checked earlier, but good practice)
  if (typeof Tonal === "undefined" || !Tonal.Note) {
    statusDiv.textContent = "CRITICAL ERROR: Tonal.js library not loaded!";
    statusDiv.style.color = "red";
    generateBtn.disabled = true;
    errorFound = true;
    console.error("Initialization Error: Tonal.js missing.");
  }

  // Check if VexFlow is loaded
  if (typeof Vex === "undefined" || !Vex.Flow) {
    statusDiv.textContent = "CRITICAL ERROR: VexFlow library not loaded!";
    statusDiv.style.color = "red";
    generateBtn.disabled = true;
    errorFound = true;
    console.error("Initialization Error: VexFlow missing.");
  }

  // Check if Tone.js is loaded (optional for playback)
  if (typeof Tone === "undefined") {
    console.warn(
      "Tone.js library not loaded. Playback functionality will be disabled."
    );
    // Optionally hide playback buttons if Tone.js is not present.
    playBtn.style.display = "none";
    stopBtn.style.display = "none";
    // Update status only if no critical errors were found earlier.
    if (!errorFound) {
      statusDiv.textContent += " (Playback disabled - Tone.js missing)";
    }
  }

  if (!errorFound) {
    console.log("Initialization complete. Libraries loaded.");
  }
}

// --- Run Initialization ---
// Ensure the DOM is fully loaded before running initialization that interacts with DOM elements.
if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  // `DOMContentLoaded` has already fired
  initialize();
}
