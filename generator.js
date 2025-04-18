// --- VexFlow Setup ---
const {
  Factory,
  Voice,
  StaveNote,
  Formatter,
  Accidental,
  StaveConnector,
  Stave,
  KeySignature, // Import KeySignature
  Note, // Import Note for easier checking
  Renderer, // Import Renderer
} = Vex.Flow;

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
    "Tonal.js library not found or incomplete! Please ensure tonal.min.js is loaded BEFORE this script."
  );
  // Optionally disable UI elements or show an error message
  // You might want to throw an error here or disable the generate button
  // to prevent the rest of the script from running incorrectly.
  document.getElementById("status").textContent =
    "CRITICAL ERROR: Tonal.js library missing. Please check console.";
  document.getElementById("status").style.color = "red";
  document.getElementById("generate-btn").disabled = true;
} else {
  console.log("Tonal.js library detected successfully."); // Good place for a confirmation log
}

// --- DOM Elements ---
const generateBtn = document.getElementById("generate-btn");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const outputDiv = document.getElementById("sheet-music");
const statusDiv = document.getElementById("status");
const styleSelect = document.getElementById("style"); // Style not heavily used yet
const keySelect = document.getElementById("key");
const meterSelect = document.getElementById("meter");
const lengthInput = document.getElementById("length");
const tempoInput = document.getElementById("tempo");
const harmonicComplexitySlider = document.getElementById("harmonic-complexity");
const melodicSmoothnessSlider = document.getElementById("melodic-smoothness");
const dissonanceStrictnessSlider = document.getElementById(
  "dissonance-strictness"
);

// Value display updates
document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const span = document.getElementById(`${slider.id}-val`);
  if (span) {
    span.textContent = slider.value; // Initial display
    slider.oninput = () => (span.textContent = slider.value);
  }
});

// --- Constants ---
const MIDI_NOTE_C0 = 12;
const DEFAULT_OCTAVE = 4;
const VOICE_RANGES = {
  soprano: [Tonal.Note.midi("C4"), Tonal.Note.midi("A5")], // 60-81
  alto: [Tonal.Note.midi("G3"), Tonal.Note.midi("E5")], // 55-76
  tenor: [Tonal.Note.midi("C3"), Tonal.Note.midi("G4")], // 48-67
  bass: [Tonal.Note.midi("E2"), Tonal.Note.midi("C4")], // 40-60
};
const VOICE_SPACING_LIMIT = {
  soprano_alto: Tonal.Interval.semitones("P8"), // Max octave between S-A
  alto_tenor: Tonal.Interval.semitones("P8"), // Max octave between A-T
  tenor_bass: Tonal.Interval.semitones("P12"), // Max octave + 5th between T-B
};
const VOICE_ORDER = ["soprano", "alto", "tenor", "bass"]; // For iteration

// --- Global State ---
let generatedMusicData = null;
let currentTempo = 100;
let currentKeySignature = null; // Store Vex.Flow.KeySignature object

// --- Music Theory Helpers (using Tonal.js) ---

/**
 * Gets the MIDI note number from a note name (e.g., "C#4").
 * @param {string} noteName - e.g., "C4", "Db5"
 * @returns {number | null} MIDI number or null if invalid.
 */
function noteNameToMidi(noteName) {
  return Tonal.Note.midi(noteName);
}

/**
 * Gets the note name in scientific pitch notation (e.g., "C#4") from a MIDI number.
 * Prefers sharps by default.
 * @param {number} midi - MIDI number.
 * @param {boolean} [useSharps=true] - Whether to prefer sharps or flats.
 * @returns {string | null} Note name or null.
 */
function midiToNoteName(midi, useSharps = true) {
  if (midi === null || midi === undefined) return null;
  // Tonal.Note.fromMidi defaults to sharps if pitch class is ambiguous
  // For specific flat preference:
  if (!useSharps) {
    const alt = Tonal.Note.fromMidi(midi, { sharps: false });
    if (alt.includes("b")) return alt; // Only return flat name if it naturally contains 'b'
  }
  return Tonal.Note.fromMidi(midi); // Default or sharp preference
}

/**
 * Gets the VexFlow note key string (e.g., "c#/4") from a MIDI number.
 * Attempts to use the correct enharmonic based on the current key signature.
 * @param {number} midi - MIDI number.
 * @param {string} keyName - The current key (e.g., "C", "Eb", "F#m").
 * @returns {string | null} VexFlow key string or null.
 */
function midiToVexflowKey(midi, keyName) {
  if (midi === null || midi === undefined) return null;

  const pc = Tonal.Note.pitchClass(Tonal.Note.fromMidi(midi)); // e.g., C#, Db

  // Get the preferred alteration (sharps/flats) for the key
  const keyInfo = Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
  const accidentals =
    keyInfo.alteration > 0 ? "#" : keyInfo.alteration < 0 ? "b" : "";
  const preferSharps = accidentals === "#";

  // Try to find the note within the key's scale for correct naming
  const scaleNotes = Tonal.Scale.get(
    keyName + (keyInfo.type === "major" ? " major" : " harmonic minor")
  ).notes;
  let noteInScale = null;
  for (const scaleNote of scaleNotes) {
    if (Tonal.Note.midi(scaleNote + DEFAULT_OCTAVE) % 12 === midi % 12) {
      noteInScale = Tonal.Note.simplify(scaleNote); // Remove octave info, keep accidental if needed
      break;
    }
  }

  let finalNoteName;
  if (
    noteInScale &&
    (noteInScale === pc || Tonal.Note.enharmonic(noteInScale) === pc)
  ) {
    // Found the note name within the scale's context
    finalNoteName = noteInScale;
  } else {
    // Note is chromatic or key analysis failed, use preferred accidental
    finalNoteName = Tonal.Note.fromMidi(midi, { sharps: preferSharps });
  }

  // Format for VexFlow (lowercase note, accidental, /, octave)
  const name = Tonal.Note.get(finalNoteName); // Get components
  const vexOctave = Math.floor(midi / 12) - 1; // VexFlow octave convention
  return `${name.letter.toLowerCase()}${name.acc}/${vexOctave}`;
}

/**
 * Gets MIDI notes for a chord based on its Roman numeral name in a given key.
 * @param {string} roman - e.g., "I", "V7", "ii", "viio"
 * @param {string} keyName - e.g., "C", "Gm"
 * @returns {number[]} Array of MIDI notes in the chord (approx root octave 3/4), or empty array.
 */
function getChordNotesFromRoman(roman, keyName) {
  try {
    // Tonal needs key with type (e.g., "C major", "G minor")
    const keyDetails =
      Tonal.Key.majorKey(keyName) || Tonal.Key.minorKey(keyName);
    if (!keyDetails || !keyDetails.chords) {
      console.warn(`Could not get key details or chords for key "${keyName}"`);
      return [];
    }
    const tonic = keyDetails.tonic;
    const keyType = keyDetails.type; // 'major' or 'minor'

    const romanMap = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
    const baseRomanMatch = roman.match(/([iv]+)/i); // Extract I, II, V etc. (case-insensitive)

    if (!baseRomanMatch) {
      console.warn(`Could not parse base numeral from "${roman}"`);
      return [];
    }
    const baseRomanUpper = baseRomanMatch[1].toUpperCase();
    const index = romanMap[baseRomanUpper];

    if (index === undefined) {
      console.warn(
        `Could not map Roman numeral "<span class="math-inline">\{baseRomanUpper\}" derived from "</span>{roman}" to an index.`
      );
      return [];
    }

    // Use the chords array directly from Tonal.Key which respects key type (major/minor)
    const diatonicChords = keyDetails.chords; // e.g., ["CM", "Dm", "Em", "FM", "GM", "Am", "B°"] for C major
    if (index >= diatonicChords.length) {
      console.warn(
        `Index <span class="math-inline">\{index\} out of bounds for diatonic chords in key "</span>{keyName}". Chords: ${diatonicChords}`
      );
      return [];
    }

    let chordSymbol = diatonicChords[index]; // e.g., "CM", "Dm", "G", "Am7b5" etc.

    // Check if the input specifically asked for a 7th chord (like "V7")
    // and if the diatonic chord symbol doesn't already include it.
    if (roman.includes("7") && !chordSymbol.includes("7")) {
      const seventhChordSymbol = chordSymbol + "7";
      // Check if this constructed 7th chord is valid in Tonal.js
      if (!Tonal.Chord.get(seventhChordSymbol).empty) {
        chordSymbol = seventhChordSymbol; // Use the 7th version
        // console.log(`Using constructed 7th chord: ${chordSymbol} for input ${roman}`);
      } else {
        // Warn if requested 7th is invalid, but proceed with the base diatonic triad/chord
        console.warn(
          `Input ${roman} requested 7th, but ${seventhChordSymbol} is not a valid Tonal chord. Using ${chordSymbol}.`
        );
      }
    }
    // --- END FIX ---

    // Now get the chord object using the determined symbol
    const chord = Tonal.Chord.get(chordSymbol);
    if (!chord || chord.empty || !chord.notes) {
      console.warn(
        `Could not get valid notes for chord symbol "${chordSymbol}" derived from Roman ${roman} in ${keyName}`
      );
      return [];
    }

    // Find a reasonable root MIDI note (around octave 3 or 4)
    // (Keep your existing logic here for calculating MIDI notes based on 'chord' object)
    const rootNote = Tonal.Note.get(chord.tonic);
    const rootMidiGuess = Tonal.Note.midi(
      rootNote.letter +
        rootNote.acc +
        (rootNote.letter === "A" || rootNote.letter === "B" ? "3" : "4")
    );

    if (rootMidiGuess === null) {
      console.warn(`Could not determine root MIDI for chord ${chordSymbol}.`);
      return [];
    }

    const rootNoteName = Tonal.Note.fromMidi(rootMidiGuess);
    if (!rootNoteName) {
      console.warn(
        `Could not convert root MIDI ${rootMidiGuess} back to note name for chord ${chordSymbol}.`
      );
      return [];
    }

    // Calculate chord notes based on this root MIDI
    return chord.intervals
      .map((interval) => {
        // 'interval' is a string like "1P", "3M", "5P"
        try {
          // Use Tonal.transpose(noteName, intervalName)
          const transposedNoteName = Tonal.transpose(rootNoteName, interval);
          if (!transposedNoteName) {
            // Handle cases where transposition might fail (though less likely with valid inputs)
            console.warn(
              `Transposition returned invalid result for ${rootNoteName} + ${interval}`
            );
            return null;
          }
          // Convert the resulting note name back to MIDI
          return Tonal.Note.midi(transposedNoteName);
        } catch (transposeError) {
          // Add a try-catch for safety during transposition
          console.error(
            `Error during Tonal.transpose(${rootNoteName}, ${interval}):`,
            transposeError
          );
          return null;
        }
      })
      .filter((midi) => midi !== null); // Filter out any nulls from failed transpositions
  } catch (error) {
    // Log the specific error that occurred within this function
    console.error(
      `Error getting chord notes for ${roman} in ${keyName}:`,
      error
    );
    return []; // Return empty on any error
  }
}

/**
 * Gets a pool of MIDI notes for a chord across multiple octaves.
 * @param {number[]} baseChordNotes - MIDI notes from getChordNotesFromRoman.
 * @param {number} numOctavesBelow - How many octaves below the base.
 * @param {number} numOctavesAbove - How many octaves above the base.
 * @returns {number[]} Sorted array of unique MIDI notes.
 */
function getExtendedChordNotePool(
  baseChordNotes,
  numOctavesBelow = 2,
  numOctavesAbove = 3
) {
  if (!baseChordNotes || baseChordNotes.length === 0) return [];
  let pool = new Set();
  for (let i = -numOctavesBelow; i <= numOctavesAbove; i++) {
    baseChordNotes.forEach((note) => {
      if (note !== null) {
        pool.add(note + i * 12);
      }
    });
  }
  return [...pool].sort((a, b) => a - b);
}

// --- Generation Logic ---

/**
 * Generates a simple chord progression based on classical tendencies.
 */
function generateChordProgression(key, numMeasures, harmonicComplexity) {
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) {
    console.error("Invalid key:", key);
    return ["I"]; // Fallback
  }
  const isMajor = keyDetails.type === "major";
  const tonicRoman = isMajor ? "I" : "i";
  const dominantRoman = "V"; // Use major V even in minor for classical cadences
  const subdominantRoman = isMajor ? "IV" : "iv";
  const relativeMinorMajor = isMajor ? "vi" : "VI"; // vi or VI
  const supertonicRoman = isMajor ? "ii" : "ii°"; // ii or ii° (or iim7b5)
  const mediantRoman = isMajor ? "iii" : "III"; // iii or III(+)
  const submediantRoman = isMajor ? "vi" : "VI"; // vi or VI
  const leadingToneRoman = isMajor ? "vii°" : "vii°"; // vii° (diminished)

  let progression = [tonicRoman];

  // Define chord pools based on complexity (0-10)
  let primary = [tonicRoman, subdominantRoman, dominantRoman];
  let secondary = [relativeMinorMajor, supertonicRoman];
  // Treat III/iii and vii as more complex/less frequent
  let complex = [mediantRoman, leadingToneRoman];

  let allowedChords = [...primary];
  if (harmonicComplexity >= 3) allowedChords.push(...secondary);
  if (harmonicComplexity >= 7) allowedChords.push(...complex);
  // Consider adding V7 based on complexity
  if (harmonicComplexity >= 5 && !allowedChords.includes("V7")) {
    allowedChords = allowedChords.map((c) => (c === "V" ? "V7" : c)); // Replace V with V7
    if (!allowedChords.includes("V7")) allowedChords.push("V7"); // Add if V wasn't there
  }

  // Simple probabilistic generation
  let prevChord = tonicRoman;
  for (let i = 1; i < numMeasures - 1; i++) {
    let nextChord;
    let attempts = 0;
    do {
      // Basic tendencies: IV/ii -> V, V -> I/vi, vi -> ii/IV
      let candidates = allowedChords;
      if (["IV", "iv", "ii", "ii°"].includes(prevChord)) {
        // Strongly prefer dominant after subdominant function
        candidates = allowedChords.filter((c) =>
          ["V", "V7", "vii°"].includes(c)
        );
        if (candidates.length === 0) candidates = [dominantRoman]; // Fallback
      } else if (["V", "V7"].includes(prevChord)) {
        // Strongly prefer tonic after dominant (deceptive cadence less likely here)
        candidates = allowedChords.filter((c) =>
          [tonicRoman, relativeMinorMajor].includes(c)
        );
        if (candidates.length === 0) candidates = [tonicRoman]; // Fallback
      } else if (prevChord === relativeMinorMajor) {
        candidates = allowedChords.filter((c) =>
          [supertonicRoman, subdominantRoman, dominantRoman].includes(c)
        );
        if (candidates.length === 0) candidates = allowedChords;
      }

      // Select randomly from candidates, avoid direct repetition if possible
      nextChord = candidates[Math.floor(Math.random() * candidates.length)];
      attempts++;
    } while (
      nextChord === prevChord &&
      allowedChords.length > 1 &&
      attempts < 5
    ); // Limit attempts

    progression.push(nextChord);
    prevChord = nextChord;
  }

  // Ensure final cadence (Authentic: V(7)-I or Plagal: IV-I if complexity low?)
  const preCadenceChord = ["V", "V7"].includes(
    dominantRoman + (harmonicComplexity >= 5 ? "7" : "")
  )
    ? dominantRoman + (harmonicComplexity >= 5 ? "7" : "")
    : dominantRoman; // Choose V or V7
  if (numMeasures > 2) {
    progression[numMeasures - 2] = preCadenceChord;
    progression[numMeasures - 1] = tonicRoman;
  } else if (numMeasures === 2) {
    progression[1] = tonicRoman; // Just ensure ending on tonic
  }

  console.log(
    `Generated Progression (${key}, complexity ${harmonicComplexity}):`,
    progression
  );
  return progression;
}

/**
 * Finds the best note from allowedNotes based on target MIDI and smoothness preference.
 */
function findClosestNote(
  targetMidi,
  allowedNotes,
  previousNoteMidi,
  smoothnessPref,
  avoidLeapThreshold = Tonal.Interval.semitones("P5")
) {
  if (!allowedNotes || allowedNotes.length === 0) {
    // console.warn("No allowed notes provided to findClosestNote, returning previous or target.");
    return previousNoteMidi ?? targetMidi ?? null; // Fallback
  }

  let bestNote = allowedNotes[0];
  let minScore = Infinity;

  // Sort allowed notes to potentially find closest easier
  allowedNotes.sort((a, b) => a - b);

  allowedNotes.forEach((note) => {
    let score = Math.abs(note - targetMidi); // Base distance to target

    // Factor in previous note for smoothness (0-10)
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);
      const smoothnessWeight = smoothnessPref / 10.0; // 0.0 to 1.0

      if (interval === 0) {
        // Common Tone
        score *= 0.1 * (1.1 - smoothnessWeight); // Highly preferred if smoothness is high
      } else if (interval <= 2) {
        // Step (minor/Major 2nd)
        score *= 0.5 * (1.1 - smoothnessWeight); // Preferred
      } else if (interval <= 7 && interval > 2) {
        // Medium Leap (up to P5)
        score *= 1.0 + (interval / 7.0) * (1.0 - smoothnessWeight); // Slightly penalized if smoothness high
      } else {
        // Large Leap
        score *= 1.5 + (interval / 12.0) * (1.0 - smoothnessWeight); // Penalized more if smoothness high
      }
    }

    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });

  // Last check: if bestNote involves a large leap from previous, try to find a smaller step if possible
  if (
    previousNoteMidi !== null &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    const closerNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi) <= 2
    ); // Steps
    if (closerNotes.length > 0) {
      // Find the closest step note to the *original target*
      let bestStepNote = closerNotes[0];
      let minStepScore = Math.abs(bestStepNote - targetMidi);
      closerNotes.forEach((stepNote) => {
        let stepScore = Math.abs(stepNote - targetMidi);
        if (stepScore < minStepScore) {
          minStepScore = stepScore;
          bestStepNote = stepNote;
        }
      });
      // Only choose the step if its score isn't drastically worse than the leap's score
      if (minStepScore < minScore * 2) {
        // Allow step if it's not more than twice as far from target
        // console.log(`Avoiding large leap (${midiToNoteName(previousNoteMidi)} -> ${midiToNoteName(bestNote)}), choosing step ${midiToNoteName(bestStepNote)} instead.`);
        bestNote = bestStepNote;
      }
    }
  }

  return bestNote;
}

// --- Voice Assignment Helpers ---

function assignBassNote(
  chordRootMidi,
  chordNotesPool,
  previousBassMidi,
  smoothness
) {
  let allowedBassNotes = chordNotesPool.filter(
    (n) => n >= VOICE_RANGES.bass[0] && n <= VOICE_RANGES.bass[1]
  );
  // Prefer root note in the bass
  const rootNotePc = chordRootMidi % 12;
  const bassTargets = [
    chordRootMidi - 12, // Root below
    chordRootMidi, // Root in octave
    chordRootMidi + 12, // Root above
  ].filter((n) => n >= VOICE_RANGES.bass[0] && n <= VOICE_RANGES.bass[1]);

  let bassNoteMidi = null;
  if (allowedBassNotes.length === 0) {
    console.warn(
      "No valid bass notes found in range. Using previous or default."
    );
    return previousBassMidi ?? VOICE_RANGES.bass[0]; // Fallback
  }

  // Try to find root note first
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);
  if (rootOptions.length > 0) {
    // Find the root note closest to the previous bass note
    bassNoteMidi = findClosestNote(
      previousBassMidi ?? bassTargets[0] ?? rootOptions[0],
      rootOptions,
      previousBassMidi,
      smoothness
    );
  } else {
    // If no root note available in range, find the closest available chord tone
    // (Could prioritize 5th later)
    bassNoteMidi = findClosestNote(
      previousBassMidi ?? chordRootMidi - 12,
      allowedBassNotes,
      previousBassMidi,
      smoothness
    );
  }

  return bassNoteMidi;
}

function assignSopranoNote(
  fullChordNotePool,
  previousSopranoMidi,
  previousAltoMidi,
  smoothness
) {
  let allowedSopranoNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.soprano[0] &&
      n <= VOICE_RANGES.soprano[1] &&
      n > (previousAltoMidi ?? VOICE_RANGES.alto[0] - 12) // Ensure above previous alto
  );
  if (allowedSopranoNotes.length === 0) {
    console.warn(
      "No valid soprano notes found in range. Using previous or default."
    );
    return previousSopranoMidi ?? VOICE_RANGES.soprano[1]; // Fallback
  }

  // Target roughly a 3rd to a 6th above the previous soprano for some movement
  const targetMidi = previousSopranoMidi
    ? previousSopranoMidi + Math.floor(Math.random() * 6) + 2
    : VOICE_RANGES.soprano[0] + 7;

  return findClosestNote(
    targetMidi,
    allowedSopranoNotes,
    previousSopranoMidi,
    smoothness
  );
}

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
  // Filter potential notes for Alto based on range and position below Soprano/above previous Tenor
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.alto[0] &&
      n <= VOICE_RANGES.alto[1] &&
      n < sopranoNoteMidi &&
      n > (previousTenorMidi ?? VOICE_RANGES.tenor[0] - 12) &&
      Math.abs(sopranoNoteMidi - n) <= VOICE_SPACING_LIMIT.soprano_alto // Check spacing S-A
  );

  // Filter potential notes for Tenor based on range and position below previous Alto/above Bass
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.tenor[0] &&
      n <= VOICE_RANGES.tenor[1] &&
      n > bassNoteMidi &&
      n < (previousAltoMidi ?? VOICE_RANGES.alto[1] + 12) &&
      Math.abs(bassNoteMidi - n) <= VOICE_SPACING_LIMIT.tenor_bass // Check spacing T-B (less strict)
  );

  // --- Alto Assignment ---
  let altoNoteMidi = null;
  let altoTargetMidi = previousAltoMidi
    ? previousAltoMidi + (Math.random() > 0.5 ? 1 : -1)
    : (sopranoNoteMidi + bassNoteMidi) / 2; // Target near previous or midpoint

  // Try to find the target pitch class first
  const altoTargetOptions = allowedAltoNotes.filter(
    (n) => n % 12 === altoTargetNotePc
  );
  if (altoTargetOptions.length > 0) {
    altoNoteMidi = findClosestNote(
      altoTargetMidi,
      altoTargetOptions,
      previousAltoMidi,
      smoothness
    );
  }
  // If target PC not found or no options, find the generally closest note
  if (altoNoteMidi === null) {
    if (allowedAltoNotes.length === 0) {
      console.warn("No valid notes for Alto found. Using previous or default.");
      altoNoteMidi = previousAltoMidi ?? VOICE_RANGES.alto[0];
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
  // Now filter Tenor notes again to ensure they are below the *chosen* Alto note
  allowedTenorNotes = allowedTenorNotes.filter(
    (n) =>
      n < altoNoteMidi &&
      Math.abs(altoNoteMidi - n) <= VOICE_SPACING_LIMIT.alto_tenor
  );

  let tenorNoteMidi = null;
  let tenorTargetMidi = previousTenorMidi
    ? previousTenorMidi + (Math.random() > 0.5 ? 1 : -1)
    : (altoNoteMidi + bassNoteMidi) / 2;

  // Try to find the target pitch class first
  const tenorTargetOptions = allowedTenorNotes.filter(
    (n) => n % 12 === tenorTargetNotePc
  );
  if (tenorTargetOptions.length > 0) {
    tenorNoteMidi = findClosestNote(
      tenorTargetMidi,
      tenorTargetOptions,
      previousTenorMidi,
      smoothness
    );
  }
  // If target PC not found or no options, find the generally closest note
  if (tenorNoteMidi === null) {
    if (allowedTenorNotes.length === 0) {
      console.warn(
        "No valid notes for Tenor found. Using previous or default."
      );
      tenorNoteMidi = previousTenorMidi ?? VOICE_RANGES.tenor[0];
    } else {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        allowedTenorNotes,
        previousTenorMidi,
        smoothness
      );
    }
  }

  // Final check: Ensure Tenor is still below Alto after selection
  if (tenorNoteMidi >= altoNoteMidi) {
    console.warn(
      `Voice Crossing! Tenor (${midiToNoteName(
        tenorNoteMidi
      )}) >= Alto (${midiToNoteName(altoNoteMidi)}). Trying to lower Tenor.`
    );
    // Try finding a lower tenor note from the allowed pool
    const lowerTenorOptions = allowedTenorNotes.filter((n) => n < altoNoteMidi);
    if (lowerTenorOptions.length > 0) {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        lowerTenorOptions,
        previousTenorMidi,
        smoothness
      );
    } else {
      console.warn("Could not resolve Tenor/Alto crossing.");
      // In a real system, might backtrack or adjust Alto here.
      // For simplicity, we might just accept it or force tenor lower even if not ideal.
      tenorNoteMidi = Math.min(tenorNoteMidi, altoNoteMidi - 1); // Force it lower (might be outside range/pool now)
    }
  }

  return { tenorNoteMidi, altoNoteMidi };
}

// --- Voice Leading Checks ---

/**
 * Checks for parallel 5ths and octaves between two voice parts for the current step.
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
  if (voice1Prev === null || voice2Prev === null) return; // Cannot check first note

  const intervalPrev = Tonal.Interval.distance(
    Tonal.Note.fromMidi(voice1Prev),
    Tonal.Note.fromMidi(voice2Prev)
  );
  const intervalCurr = Tonal.Interval.distance(
    Tonal.Note.fromMidi(voice1Curr),
    Tonal.Note.fromMidi(voice2Curr)
  );

  const simplePrev = Tonal.Interval.simplify(intervalPrev);
  const simpleCurr = Tonal.Interval.simplify(intervalCurr);
  const numPrev = Tonal.Interval.num(simplePrev);
  const numCurr = Tonal.Interval.num(simpleCurr);

  if (
    numPrev === 5 &&
    numCurr === 5 &&
    voice1Prev !== voice1Curr &&
    voice2Prev !== voice2Curr
  ) {
    console.warn(
      `Parallel 5th (${part1Name}/${part2Name}) at M${measure + 1}:B${
        beat + 1
      }. Prev: ${midiToNoteName(voice1Prev)}-${midiToNoteName(
        voice2Prev
      )}, Curr: ${midiToNoteName(voice1Curr)}-${midiToNoteName(voice2Curr)}`
    );
  } else if (
    numPrev === 8 &&
    numCurr === 8 &&
    voice1Prev !== voice1Curr &&
    voice2Prev !== voice2Curr
  ) {
    console.warn(
      `Parallel Octave (${part1Name}/${part2Name}) at M${measure + 1}:B${
        beat + 1
      }. Prev: ${midiToNoteName(voice1Prev)}-${midiToNoteName(
        voice2Prev
      )}, Curr: ${midiToNoteName(voice1Curr)}-${midiToNoteName(voice2Curr)}`
    );
  }
  // Add Direct/Hidden 5ths/Octaves check (more complex) if needed
}

function checkVoiceLeadingRules(currentNotes, previousNotes, measure, beat) {
  const { soprano, alto, tenor, bass } = currentNotes;
  const prev = previousNotes;

  // 1. Voice Crossing (current state)
  if (alto > soprano)
    console.warn(
      `Voice Crossing: Alto (${midiToNoteName(
        alto
      )}) > Soprano (${midiToNoteName(soprano)}) at M${measure + 1}:B${
        beat + 1
      }`
    );
  if (tenor > alto)
    console.warn(
      `Voice Crossing: Tenor (${midiToNoteName(
        tenor
      )}) > Alto (${midiToNoteName(alto)}) at M${measure + 1}:B${beat + 1}`
    );
  if (bass > tenor)
    console.warn(
      `Voice Crossing: Bass (${midiToNoteName(bass)}) > Tenor (${midiToNoteName(
        tenor
      )}) at M${measure + 1}:B${beat + 1}`
    );

  // 2. Spacing (current state)
  if (Math.abs(soprano - alto) > VOICE_SPACING_LIMIT.soprano_alto)
    console.warn(
      `Spacing > P8 between Soprano/Alto at M${measure + 1}:B${beat + 1}`
    );
  if (Math.abs(alto - tenor) > VOICE_SPACING_LIMIT.alto_tenor)
    console.warn(
      `Spacing > P8 between Alto/Tenor at M${measure + 1}:B${beat + 1}`
    );
  if (Math.abs(tenor - bass) > VOICE_SPACING_LIMIT.tenor_bass)
    console.warn(
      `Spacing > P12 between Tenor/Bass at M${measure + 1}:B${beat + 1}`
    );

  // 3. Parallels (movement from previous state)
  if (prev.soprano !== null) {
    // Ensure previous state exists
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

// --- Main Generation Function ---

function generateVoices(chordProgression, key, meter, numMeasures, difficulty) {
  const { harmonicComplexity, melodicSmoothness, dissonanceStrictness } =
    difficulty;
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) throw new Error("Invalid key provided: " + key);
  const keyTonic = keyDetails.tonic;
  const keyType = keyDetails.type;
  const leadingToneMidiPc =
    (Tonal.Note.midi(keyTonic) + Tonal.Interval.semitones("M7")) % 12; // Major 7th above tonic MIDI PC

  const [meterBeats, beatValue] = meter.split("/").map(Number); // e.g., [4, 4]
  if (![4, 8, 16].includes(beatValue))
    throw new Error("Unsupported beat value in meter: " + meter);

  // Initialize voices data structure
  // Store { midi: number, duration: string ('q', 'h', 'w', '8'), vexKey: string, isRest: boolean }
  let voicesData = { soprano: [], alto: [], tenor: [], bass: [] };
  let previousNotesMidi = {
    soprano: null,
    alto: null,
    tenor: null,
    bass: null,
  };

  let currentBeatInMeasure = 0;
  let currentTime = 0; // Abstract time, maybe beats

  for (let i = 0; i < numMeasures; i++) {
    const roman = chordProgression[i];
    const baseChordNotes = getChordNotesFromRoman(roman, key); // Get base MIDI notes

    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${i + 1} due to chord error for ${roman} in ${key}.`
      );
      // Add rests for this measure? Or repeat previous chord? Add rests for now.
      for (let b = 0; b < meterBeats; b++) {
        const restDuration = beatValue === 8 ? "8" : "q"; // Adapt rest based on beat unit
        Object.keys(voicesData).forEach((voiceName) => {
          voicesData[voiceName].push({
            midi: null,
            duration: restDuration + "r",
            vexKey: "b/4",
            isRest: true,
          });
        });
        previousNotesMidi = {
          soprano: null,
          alto: null,
          tenor: null,
          bass: null,
        }; // Reset previous notes after rests
      }
      continue;
    }

    const chordRootMidi = baseChordNotes[0]; // The first note is the root
    const chordRootPc = chordRootMidi % 12;
    const chordPcs = baseChordNotes.map((n) => n % 12); // Pitch classes in the chord [0, 4, 7] etc.
    const isLeadingToneChord =
      chordPcs.includes(leadingToneMidiPc) &&
      roman.toLowerCase().includes("vii"); // Basic check

    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes); // MIDI notes across octaves

    // --- Generate notes for the current measure ---
    // Simple rhythmic pattern: Bass often holds longer, upper voices move more.
    // Example for 4/4: Bass: h, h | Sop/Alt/Ten: h, q, q
    // Example for 3/4: Bass: h, q | Sop/Alt/Ten: q, q, q (or h, q)
    // Example for 2/4: Bass: h    | Sop/Alt/Ten: q, q
    let beatDurations = [];
    if (meterBeats === 4) beatDurations = ["h", "q", "q"];
    else if (meterBeats === 3) beatDurations = ["q", "q", "q"]; // Or ['h', 'q']
    else if (meterBeats === 2) beatDurations = ["q", "q"];
    else beatDurations = Array(meterBeats).fill("q"); // Default to quarters

    // Bass rhythm often simpler
    let bassBeatDurations = [];
    if (meterBeats === 4) bassBeatDurations = ["h", "h"];
    else if (meterBeats === 3) bassBeatDurations = ["h.", "q"];
    // Dotted half (or h, q) - VF needs '.' for dotted
    else if (meterBeats === 2) bassBeatDurations = ["h"];
    else bassBeatDurations = Array(meterBeats).fill("q");

    // Check if durations add up, basic correction if not
    const sumDur = (durations) =>
      durations.reduce(
        (sum, d) =>
          sum + Vex.Flow.durationToTicks(d) / Vex.Flow.durationToTicks("q"),
        0
      );
    if (Math.abs(sumDur(beatDurations) - meterBeats) > 0.01)
      beatDurations = Array(meterBeats).fill("q");
    if (Math.abs(sumDur(bassBeatDurations) - meterBeats) > 0.01)
      bassBeatDurations = Array(meterBeats).fill("q");

    let currentMeasureNotes = { soprano: [], alto: [], tenor: [], bass: [] }; // Temp store for this measure
    let currentBeat = 0;

    while (currentBeat < meterBeats) {
      // --- Determine Duration for this step ---
      let currentDuration = "q"; // Default if pattern fails
      let currentBassDuration = "q";

      // Find duration from pattern based on current beat
      let tempBeatSum = 0;
      for (const dur of beatDurations) {
        if (Math.abs(tempBeatSum - currentBeat) < 0.01) {
          currentDuration = dur;
          break;
        }
        tempBeatSum += sumDur([dur]);
      }
      tempBeatSum = 0;
      for (const dur of bassBeatDurations) {
        if (Math.abs(tempBeatSum - currentBeat) < 0.01) {
          currentBassDuration = dur;
          break;
        }
        tempBeatSum += sumDur([dur]);
      }

      const durationInBeats = sumDur([currentDuration]);
      const bassDurationInBeats = sumDur([currentBassDuration]);

      // --- Assign Notes ---
      // 1. Bass Note
      const bassNoteMidi = assignBassNote(
        chordRootMidi,
        fullChordNotePool,
        previousNotesMidi.bass,
        melodicSmoothness
      );

      // 2. Soprano Note
      const sopranoNoteMidi = assignSopranoNote(
        fullChordNotePool,
        previousNotesMidi.soprano,
        previousNotesMidi.alto,
        melodicSmoothness
      );

      // 3. Inner Voices - Determine needed notes
      let notesChosenPcs = new Set([bassNoteMidi % 12, sopranoNoteMidi % 12]);
      let neededPcs = chordPcs.filter((pc) => !notesChosenPcs.has(pc));
      let pcsToDouble = [];

      // If chord has < 4 distinct pitch classes (triads), determine doubling
      if (chordPcs.length < 4) {
        if (neededPcs.length < 2) {
          // Try doubling root, unless it's leading tone or bass already has it AND it's a LT chord
          const shouldDoubleRoot =
            chordRootPc !== leadingToneMidiPc &&
            !(bassNoteMidi % 12 === chordRootPc && isLeadingToneChord);
          if (shouldDoubleRoot && !notesChosenPcs.has(chordRootPc)) {
            pcsToDouble.push(chordRootPc);
          } else {
            // Try doubling 5th if available and not LT
            const fifthPc = (chordRootPc + 7) % 12;
            if (
              chordPcs.includes(fifthPc) &&
              fifthPc !== leadingToneMidiPc &&
              !notesChosenPcs.has(fifthPc)
            ) {
              pcsToDouble.push(fifthPc);
            } else {
              // Fallback: double root even if LT, or double third (if available and not LT)
              const thirdPc = chordPcs.find(
                (pc) => pc !== chordRootPc && pc !== fifthPc
              );
              if (!notesChosenPcs.has(chordRootPc)) {
                pcsToDouble.push(chordRootPc);
              } else if (
                thirdPc !== undefined &&
                thirdPc !== leadingToneMidiPc &&
                !notesChosenPcs.has(thirdPc)
              ) {
                pcsToDouble.push(thirdPc);
              } else if (
                fifthPc !== undefined &&
                !notesChosenPcs.has(fifthPc)
              ) {
                // Double 5th as last resort
                pcsToDouble.push(fifthPc);
              }
            }
          }
        }
        // If still need more notes (e.g., only root/5th chosen for triad)
        if (neededPcs.length + pcsToDouble.length < 2) {
          // Add another doubling candidate (maybe the other remaining note?)
          let remainingPc = chordPcs.find(
            (pc) => !notesChosenPcs.has(pc) && !pcsToDouble.includes(pc)
          );
          if (remainingPc !== undefined) pcsToDouble.push(remainingPc);
          else pcsToDouble.push(chordRootPc); // Default double root again
        }
      }

      let targetInnerPcs = [...neededPcs, ...pcsToDouble];
      if (targetInnerPcs.length < 2) {
        console.warn(
          `Could not determine enough inner voice pitch classes for chord ${roman} at M${
            i + 1
          }:B${currentBeat + 1}. Needed: ${chordPcs}, Chosen: ${[
            ...notesChosenPcs,
          ]}, Target: ${targetInnerPcs}`
        );
        // Fill with root/fifth if possible
        while (targetInnerPcs.length < 2)
          targetInnerPcs.push(
            chordPcs.includes((chordRootPc + 7) % 12)
              ? (chordRootPc + 7) % 12
              : chordRootPc
          );
      }
      // Prioritize specific pitch classes for Tenor/Alto
      const tenorTargetPc = targetInnerPcs[0];
      const altoTargetPc = targetInnerPcs[1 % targetInnerPcs.length]; // Use second element, wrap if only one needed/doubled

      // Assign Alto and Tenor
      const { tenorNoteMidi, altoNoteMidi } = assignInnerVoices(
        tenorTargetPc,
        altoTargetPc,
        fullChordNotePool,
        previousNotesMidi.tenor,
        previousNotesMidi.alto,
        sopranoNoteMidi,
        bassNoteMidi,
        melodicSmoothness
      );

      // 4. Store notes for this beat/duration
      const currentStepNotes = {
        soprano: sopranoNoteMidi,
        alto: altoNoteMidi,
        tenor: tenorNoteMidi,
        bass: bassNoteMidi,
      };

      // 5. Perform Voice Leading Checks (if strictness is high enough - currently always checks)
      if (dissonanceStrictness > 3) {
        // Arbitrary threshold
        checkVoiceLeadingRules(
          currentStepNotes,
          previousNotesMidi,
          i,
          currentBeat
        );
      }

      // 6. Add note data to the measure's temp store
      Object.keys(voicesData).forEach((voiceName) => {
        const midi = currentStepNotes[voiceName];
        const duration =
          voiceName === "bass" ? currentBassDuration : currentDuration;
        const vexKey = midiToVexflowKey(midi, key);
        if (vexKey) {
          // Only add if valid VexFlow key generated
          currentMeasureNotes[voiceName].push({
            midi: midi,
            duration: duration,
            vexKey: vexKey,
            isRest: false,
          });
        } else {
          console.warn(
            `Failed to get VexFlow key for MIDI ${midi} in key ${key}. Adding rest instead for ${voiceName} at M${
              i + 1
            }:B${currentBeat + 1}.`
          );
          currentMeasureNotes[voiceName].push({
            midi: null,
            duration: duration + "r",
            vexKey: "b/4",
            isRest: true,
          });
        }
      });

      // 7. Update previous notes (only need the last one before the *next* beat)
      previousNotesMidi = { ...currentStepNotes };

      // 8. Advance beat counter
      currentBeat += durationInBeats; // Assume upper voices dictate the main beat advance for simplicity

      // If bass note is longer, add placeholders/ties for subsequent beats it covers
      if (bassDurationInBeats > durationInBeats && currentBeat < meterBeats) {
        // This logic is complex with VexFlow ties. For now, we'll let the display logic handle drawing longer notes.
        // The `generateVoices` focuses on providing the correct note start times and durations.
      }
    } // End beat loop for measure

    // Add the notes from the completed measure to the main data structure
    Object.keys(voicesData).forEach((voiceName) => {
      voicesData[voiceName].push(...currentMeasureNotes[voiceName]);
    });
  } // End measure loop

  console.log("Generated Voices Data:", voicesData);
  return voicesData;
}

// --- Display Logic (Using VexFlow) ---

/**
 * Renders the generated music data onto the canvas using VexFlow.
 * @param {object} musicData - The structured music data object with voices (soprano, alto, tenor, bass).
 * @param {string} key - The key signature (e.g., "C", "Gm", "F#").
 * @param {string} meter - The time signature (e.g., "4/4", "3/4").
 * @param {number} numMeasures - The number of measures.
 */
function displayMusic(musicData, key, meter, numMeasures) {
  // 1. --- Basic Validation and Setup ---
  if (!musicData || !musicData.soprano || musicData.soprano.length === 0) {
    statusDiv.textContent = "No music data generated to display.";
    console.warn("displayMusic called with invalid or empty musicData");
    outputDiv.innerHTML = "<p>No music data available.</p>"; // Clear and show message
    return;
  }

  const outputDiv = document.getElementById("sheet-music");
  if (!outputDiv) {
    console.error(
      "Fatal Error: Output element '#sheet-music' not found in DOM."
    );
    statusDiv.textContent = "Error: Cannot find where to draw the music.";
    return;
  }
  outputDiv.innerHTML = ""; // Clear previous content

  // Ensure VexFlow is loaded (basic check)
  if (typeof Vex === "undefined" || !Vex.Flow || !Vex.Flow.Renderer) {
    console.error(
      "Fatal Error: Vex.Flow or Vex.Flow.Renderer not found. Check library loading order."
    );
    statusDiv.textContent = "Error: VexFlow library not loaded correctly.";
    return;
  }

  console.log("Starting VexFlow rendering...");

  try {
    // 2. --- Renderer and Context Creation ---
    const renderer = new Renderer(outputDiv, Renderer.Backends.SVG);
    if (!renderer) {
      throw new Error("VexFlow Renderer could not be instantiated.");
    }

    const staveWidth = Math.max(150, numMeasures * 180); // Ensure minimum width, adjust multiplier as needed
    const rendererWidth = staveWidth + 50; // Add padding
    const rendererHeight = 350;
    renderer.resize(rendererWidth, rendererHeight);
    console.log(
      `Renderer created and resized to ${rendererWidth}x${rendererHeight}`
    );

    const context = renderer.getContext();
    if (!context) {
      // This is the critical check for the previous error
      throw new Error(
        "Failed to get rendering context from VexFlow Renderer. The renderer might not have initialized correctly."
      );
    }
    console.log("Rendering context obtained successfully.");

    // Apply context styling (safe now)
    context.setFont("Arial", 10).setBackgroundFillStyle("#eed");

    // 3. --- Time Signature and Key Signature Setup ---
    const [num_beats, beat_value] = meter.split("/").map(Number);
    const timeSignature = `${num_beats}/${beat_value}`;
    // Store the VexFlow KeySignature object for checking accidentals later
    // Ensure 'key' is in a format VexFlow understands (e.g., "C", "Gm"). Tonal.js names usually work.
    const currentVexKeySignature = new KeySignature(key);
    console.log(`Time Signature: ${timeSignature}, Key Signature: ${key}`);

    // 4. --- Stave Creation and Initial Drawing ---
    const staveTreble = new Stave(10, 40, staveWidth) // x, y, width
      .addClef("treble")
      .addTimeSignature(timeSignature) // Add time sig to first stave
      .addKeySignature(key);

    const staveBass = new Stave(10, 150, staveWidth)
      .addClef("bass")
      .addTimeSignature(timeSignature) // Add time sig also required by VexFlow 4 for formatting context
      .addKeySignature(key);

    // Draw staves first to establish the layout base
    staveTreble.setContext(context).draw();
    staveBass.setContext(context).draw();
    console.log("Staves drawn.");

    // 5. --- Stave Connectors ---
    new StaveConnector(staveTreble, staveBass)
      .setType(StaveConnector.type.BRACE)
      .setContext(context)
      .draw();
    new StaveConnector(staveTreble, staveBass)
      .setType(StaveConnector.type.SINGLE_LEFT)
      .setContext(context)
      .draw();
    new StaveConnector(staveTreble, staveBass)
      .setType(StaveConnector.type.SINGLE_RIGHT)
      .setContext(context)
      .draw();
    console.log("Connectors drawn.");

    // 6. --- Process Music Data into VexFlow Notes and Beams ---
    const vexNotesByVoice = { soprano: [], alto: [], tenor: [], bass: [] };
    const beams = []; // Array to hold all Beam objects

    Object.keys(musicData).forEach((voiceName) => {
      const voiceNotesData = musicData[voiceName];
      const clef =
        voiceName === "soprano" || voiceName === "alto" ? "treble" : "bass";
      let currentVoiceBeams = []; // Notes for the current beam group in this voice

      voiceNotesData.forEach((noteData, index) => {
        // Basic validation of note data structure
        if (
          !noteData ||
          typeof noteData.duration !== "string" ||
          typeof noteData.vexKey !== "string"
        ) {
          console.warn(
            "Skipping invalid note data:",
            noteData,
            "in voice",
            voiceName,
            "at index",
            index
          );
          return; // Skip this invalid note
        }

        // Properties for StaveNote constructor
        const noteProps = {
          keys: [noteData.vexKey], // VexFlow expects an array of keys
          duration: noteData.duration.replace(".", ""), // Remove dots for constructor, add later
          clef: clef,
          auto_stem: true, // Let VexFlow decide stem direction
        };

        // Create the StaveNote object
        const staveNote = new StaveNote(noteProps);

        // Add accidentals IF necessary (checking against the key signature)
        if (!noteData.isRest) {
          const noteName = noteData.vexKey.split("/")[0]; // e.g., "c#", "ab"
          const noteDetails = Tonal.Note.get(Tonal.Note.simplify(noteName)); // Use Tonal to analyze

          if (noteDetails.acc) {
            // Check if Tonal identifies an accidental ('', '#', 'b')
            let needsAccidental = false;
            const keySpecAccidental = currentVexKeySignature.getAccidental(
              noteDetails.letter.toLowerCase()
            );

            if (!keySpecAccidental) {
              // Key signature has no accidental for this letter, so we need one if the note has one
              needsAccidental = true;
            } else {
              // Key sig has an accidental. Does it match the note's?
              if (noteDetails.acc !== keySpecAccidental.type) {
                // Mismatch (e.g., key has F#, note is F natural; or key has Bb, note is B#)
                // If the note is natural, add a natural sign. Otherwise, add the note's specific sharp/flat.
                needsAccidental = true; // We always need *some* sign (natural, sharp, or flat)
                if (noteDetails.alt === 0 && noteDetails.acc === "") {
                  // Check if Tonal parsed it as natural explicitly
                  staveNote.addModifier(new Accidental("n"), 0);
                  needsAccidental = false; // Natural sign added, don't add sharp/flat below
                }
              } // else: Key signature accidental matches the note's accidental, so no explicit sign needed.
            }

            if (needsAccidental) {
              staveNote.addModifier(new Accidental(noteDetails.acc), 0);
            }
          }

          // Add dots if the original duration string included them
          const dotCount = (noteData.duration.match(/\./g) || []).length;
          for (let d = 0; d < dotCount; d++) {
            staveNote.addDotToAll(); // Add dots after creating the note
          }
        } // end if (!noteData.isRest)

        // Add the processed StaveNote to the voice array
        vexNotesByVoice[voiceName].push(staveNote);

        // --- Beaming Logic (Example: Beam 8th notes, break on quarter or longer) ---
        const isBeamableDuration =
          noteData.duration.includes("8") || noteData.duration.includes("16"); // Add more as needed
        if (!noteData.isRest && isBeamableDuration) {
          currentVoiceBeams.push(staveNote);
        } else {
          // Current note is not beamable (rest or longer duration), end the previous beam group
          if (currentVoiceBeams.length > 1) {
            beams.push(new Beam(currentVoiceBeams)); // Create Beam from collected notes
          }
          currentVoiceBeams = []; // Reset for the next potential beam group
        }
      }); // End loop through notes in a voice

      // After processing all notes in a voice, check if there's a pending beam group
      if (currentVoiceBeams.length > 1) {
        beams.push(new Beam(currentVoiceBeams));
      }
    }); // End loop through voices
    console.log("Processed notes into VexFlow objects.");

    // 7. --- Create VexFlow Voices and Associate with Staves ---
    const vfSystemVoices = []; // All voices for formatting
    Object.keys(vexNotesByVoice).forEach((voiceName) => {
      const notes = vexNotesByVoice[voiceName];
      if (notes.length === 0) {
        console.warn(
          `No valid notes generated for voice: ${voiceName}. Skipping voice creation.`
        );
        return; // Skip creating voice if no notes
      }

      const voice = new Voice({
        num_beats: num_beats,
        beat_value: beat_value,
      }).setStrict(false); // strict:false is more tolerant
      voice.addTickables(notes);

      // Associate voice with the correct stave AFTER adding tickables
      const stave =
        voiceName === "soprano" || voiceName === "alto"
          ? staveTreble
          : staveBass;
      voice.setStave(stave);

      vfSystemVoices.push(voice);
    });
    console.log(`${vfSystemVoices.length} VexFlow Voices created.`);

    if (vfSystemVoices.length === 0) {
      throw new Error("No voices could be created from the processed notes.");
    }

    // 8. --- Formatting ---
    // Group voices by stave for formatting
    const trebleVoices = vfSystemVoices.filter(
      (v) => v.getStave() === staveTreble
    );
    const bassVoices = vfSystemVoices.filter((v) => v.getStave() === staveBass);

    const formatter = new Formatter();

    // Calculate justifiable width (can be less than stave width initially)
    // Subtract a small amount for padding, adjust as needed.
    // Make sure justifiableWidth is positive.
    const justifiableWidth = Math.max(100, staveWidth - 20);

    if (trebleVoices.length > 0) {
      console.log(`Formatting ${trebleVoices.length} treble voice(s)...`);
      // Join voices sharing the stave, then format them together
      // The format call calculates note positions.
      formatter.joinVoices(trebleVoices).format(trebleVoices, justifiableWidth);
      console.log(`Treble voices formatting calculation complete.`);
    } else {
      console.warn("No voices found for treble stave formatting.");
    }

    if (bassVoices.length > 0) {
      console.log(`Formatting ${bassVoices.length} bass voice(s)...`);
      // Join voices sharing the stave, then format them together
      formatter.joinVoices(bassVoices).format(bassVoices, justifiableWidth);
      console.log(`Bass voices formatting calculation complete.`);
    } else {
      console.warn("No voices found for bass stave formatting.");
    }

    // 9. --- Drawing Voices and Beams ---
    console.log("Drawing elements...");
    // Voices must be drawn *after* formatting
    vfSystemVoices.forEach((voice) => {
      voice.draw(
        context /* Stave already associated, passing here optional in VF4 */
      );
    });
    console.log("Voices drawn.");

    // Beams are drawn last, over the notes
    beams.forEach((beam) => {
      beam.setContext(context).draw();
    });
    console.log(`${beams.length} beams drawn.`);

    // 10. --- Final Status Update ---
    statusDiv.textContent = "Sheet music generated successfully.";
    if (typeof Tone !== "undefined") {
      playBtn.disabled = false;
      stopBtn.disabled = false;
    }
    console.log("VexFlow rendering finished successfully.");
  } catch (error) {
    // --- Error Handling ---
    console.error("Error during VexFlow rendering process:", error);
    statusDiv.textContent = `Error rendering music: ${error.message}`;
    outputDiv.innerHTML = `<p style="color:red;">Error rendering music. Check console for details.</p>`; // Display error message
    generatedMusicData = null; // Prevent playback if rendering failed
    playBtn.disabled = true;
    stopBtn.disabled = true;
    currentKeySignature = null; // Reset VexFlow key signature object
  }
}

// --- Playback Logic (Using Tone.js) ---
let currentPart = null; // Store the Tone.Part
let polySynth = null; // Store synth

function playGeneratedMusic() {
  if (typeof Tone === "undefined" || !generatedMusicData) {
    console.error("Tone.js not loaded or no music data.");
    statusDiv.textContent = "Playback unavailable.";
    return;
  }

  // Ensure AudioContext is started by user gesture
  Tone.start()
    .then(() => {
      console.log("AudioContext started");

      // Cleanup previous playback
      stopPlayback(); // Use the stop function for cleanup

      // Create PolySynth (if not already created or if settings changed)
      // Using PolySynth allows multiple notes at once, simpler than 4 synths
      if (!polySynth) {
        polySynth = new Tone.PolySynth(Tone.Synth, {
          // volume: -8, // Adjust volume if needed
          // oscillator: { type: 'triangle' },
          // envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5 }
        }).toDestination();
      }

      // Convert MusicData to Tone.js Part format
      const toneEvents = [];
      const [beatsPerMeasure, beatUnit] = meterSelect.value
        .split("/")
        .map(Number);
      // Map VexFlow duration to Tone.js notation time
      const durationMap = { w: "1n", h: "2n", q: "4n", 8: "8n", 16: "16n" };
      const getToneDuration = (vexDur) => {
        let baseDur = vexDur.replace(/r|\./g, ""); // Remove 'r' and dots
        let toneDur = durationMap[baseDur] || "4n"; // Default to quarter
        if (vexDur.includes(".")) {
          // Tone.js doesn't directly support dotted notation in duration strings like '4n.'
          // We need to calculate the duration in seconds or transport time.
          // For simplicity here, we'll approximate or ignore dots for playback,
          // but a better way is using Transport time calculations.
          // Or use Tone.Time to calculate duration: Tone.Time(toneDur).valueOf() * 1.5
          // Let's use Transport time.
          return (
            Tone.Time(toneDur).valueOf() *
            (1 + (vexDur.match(/\./g) || []).length * 0.5)
          );
        }
        return toneDur;
      };

      let totalTicks = 0;
      const ticksPerBeat = Vex.Flow.RESOLUTION / beatUnit; // e.g., 4096 / 4 = 1024 ticks per quarter note

      Object.keys(generatedMusicData).forEach((voiceName) => {
        let currentTick = 0;
        generatedMusicData[voiceName].forEach((note) => {
          if (!note.isRest && note.midi) {
            const startTimeTicks = currentTick;
            // Calculate VexFlow duration in ticks
            const durationTicks = Vex.Flow.durationToTicks(note.duration);
            if (durationTicks === null) {
              console.warn(
                `Could not get ticks for duration ${note.duration}, skipping note in playback.`
              );
              return;
            }

            const startTimeSeconds = Tone.Ticks(startTimeTicks).toSeconds(); // Convert start tick to seconds
            const durationSeconds = Tone.Ticks(durationTicks).toSeconds(); // Convert duration ticks to seconds

            const noteName = midiToNoteName(note.midi);
            if (noteName) {
              toneEvents.push({
                time: startTimeSeconds,
                note: noteName,
                duration: durationSeconds,
                velocity: 0.7, // Adjust velocity? Maybe based on voice?
              });
            }
          }
          // Advance time for the next note in this voice
          const noteTicks = Vex.Flow.durationToTicks(note.duration);
          if (noteTicks !== null) {
            currentTick += noteTicks;
          }
        });
        totalTicks = Math.max(totalTicks, currentTick); // Keep track of longest voice
      });

      // Sort events by time just in case
      toneEvents.sort((a, b) => a.time - b.time);

      console.log("Tone Events:", toneEvents);
      if (toneEvents.length === 0) {
        statusDiv.textContent = "Nothing to play.";
        return;
      }

      // Create a Tone.Part
      currentPart = new Tone.Part((time, value) => {
        polySynth.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity
        );
      }, toneEvents).start(0);

      // Set Transport settings
      Tone.Transport.bpm.value = currentTempo;
      Tone.Transport.timeSignature = beatsPerMeasure;

      // Start the transport
      Tone.Transport.stop(); // Ensure stopped before starting
      Tone.Transport.position = 0;
      Tone.Transport.start("+0.1"); // Start slightly ahead
      statusDiv.textContent = "Playback started...";

      // Stop playback automatically when the longest part duration is over
      const totalDurationSeconds = Tone.Ticks(totalTicks).toSeconds();
      Tone.Transport.scheduleOnce(() => {
        stopPlayback(); // Call the cleanup function
        if (statusDiv.textContent === "Playback started...") {
          // Avoid message if manually stopped
          statusDiv.textContent = "Playback finished.";
        }
      }, `+${totalDurationSeconds + 0.5}`); // Add a small buffer
    })
    .catch((e) => {
      console.error("Error starting Tone.js:", e);
      statusDiv.textContent =
        "Error starting audio. Please interact with the page first.";
    });
}

function stopPlayback() {
  if (typeof Tone !== "undefined") {
    Tone.Transport.stop();
    Tone.Transport.cancel(0); // Remove scheduled events
    if (currentPart) {
      currentPart.stop(0); // Ensure part stops immediately
      currentPart.dispose(); // Clean up the part
      currentPart = null;
    }
    // Don't dispose the synth here if we want to reuse it
    // if (polySynth) {
    //     polySynth.releaseAll(); // Stop any hanging notes
    // }
    if (statusDiv.textContent.startsWith("Playback")) {
      // Only update status if playback was active
      statusDiv.textContent = "Playback stopped.";
    }
    playBtn.disabled = generatedMusicData === null; // Re-enable play if possible
  }
}

// --- Event Listener ---
generateBtn.addEventListener("click", () => {
  statusDiv.textContent = "Generating...";
  playBtn.disabled = true;
  stopBtn.disabled = true;
  outputDiv.innerHTML = "<p>Generating...</p>"; // Clear output and show status
  stopPlayback(); // Stop current playback if any

  // Get user inputs
  const style = styleSelect.value; // Currently unused
  const key = keySelect.value;
  const meter = meterSelect.value;
  const numMeasures = parseInt(lengthInput.value);
  currentTempo = parseInt(tempoInput.value); // Update global tempo
  const difficulty = {
    harmonicComplexity: parseInt(harmonicComplexitySlider.value),
    melodicSmoothness: parseInt(melodicSmoothnessSlider.value),
    dissonanceStrictness: parseInt(dissonanceStrictnessSlider.value),
  };

  // Use setTimeout to allow the UI to update (especially "Generating..." message)
  setTimeout(() => {
    try {
      console.log("--- Generation Start ---");
      console.log("Settings:", {
        key,
        meter,
        numMeasures,
        currentTempo,
        difficulty,
      });

      // 1. Generate Chord Progression
      const progression = generateChordProgression(
        key,
        numMeasures,
        difficulty.harmonicComplexity
      );
      if (!progression || progression.length === 0)
        throw new Error("Chord progression generation failed.");

      // 2. Generate Voices
      generatedMusicData = generateVoices(
        progression,
        key,
        meter,
        numMeasures,
        difficulty
      );
      if (!generatedMusicData) throw new Error("Voice generation failed.");

      console.log("--- Generation Complete ---");

      // 3. Display using VexFlow
      displayMusic(generatedMusicData, key, meter, numMeasures);
    } catch (error) {
      console.error("Error during music generation process:", error);
      statusDiv.textContent = `Error: ${error.message}`;
      outputDiv.innerHTML = `<p style="color:red;">Error generating music: ${error.message}</p>`; // Show error
      generatedMusicData = null; // Reset data on error
      playBtn.disabled = true;
      stopBtn.disabled = true;
      currentKeySignature = null;
    }
  }, 50); // Small delay (50ms) seems sufficient for UI update
});

// Playback Button Listeners
playBtn.addEventListener("click", playGeneratedMusic);
stopBtn.addEventListener("click", stopPlayback);

// --- Initial Setup ---
function initialize() {
  statusDiv.textContent = "Select settings and click 'Generate Music'.";
  playBtn.disabled = true;
  stopBtn.disabled = true;

  // Check if Tonal is loaded
  if (typeof Tonal === "undefined" || !Tonal.Note) {
    statusDiv.textContent = "Error: Tonal.js library not loaded!";
    statusDiv.style.color = "red";
    generateBtn.disabled = true;
  }
  // Check if VexFlow is loaded
  if (typeof Vex === "undefined" || !Vex.Flow) {
    statusDiv.textContent = "Error: VexFlow library not loaded!";
    statusDiv.style.color = "red";
    generateBtn.disabled = true;
  }
  // Check if Tone.js is loaded (optional for playback)
  if (typeof Tone === "undefined") {
    console.warn("Tone.js not loaded. Playback will be disabled.");
    playBtn.style.display = "none"; // Hide playback buttons if Tone not present
    stopBtn.style.display = "none";
  }
}

initialize(); // Run initial setup
