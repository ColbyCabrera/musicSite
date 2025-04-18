// js/generation.js
// Description: Core logic for generating chord progressions and voice leading.

import {
  VOICE_RANGES,
  VOICE_SPACING_LIMIT,
  VOICE_ORDER,
  DEFAULT_OCTAVE,
} from "./config.js";
import {
  getChordNotesFromRoman,
  getExtendedChordNotePool,
  midiToNoteName,
  midiToVexflowKey,
} from "./tonal-helpers.js";

// --- Internal Helper Functions (Not Exported) ---

/**
 * Selects the "best" MIDI note from allowed notes based on target, previous note, and smoothness.
 * (Copied from original, kept internal to this module)
 * @returns {number | null} The chosen MIDI note.
 */
function findClosestNote(
  targetMidi,
  allowedNotes,
  previousNoteMidi,
  smoothnessPref,
  avoidLeapThreshold = Tonal.Interval.semitones("P5")
) {
  // ... (Keep the full implementation of findClosestNote here) ...
  if (!allowedNotes || allowedNotes.length === 0) {
    return previousNoteMidi ?? targetMidi ?? null;
  }
  if (allowedNotes.length === 1) {
    return allowedNotes[0];
  }

  let bestNote = allowedNotes[0];
  let minScore = Infinity;

  allowedNotes.forEach((note) => {
    let score = Math.abs(note - targetMidi);
    if (previousNoteMidi !== null) {
      const interval = Math.abs(note - previousNoteMidi);
      const smoothnessWeight = smoothnessPref / 10.0;
      if (interval === 0) {
        score *= 0.1 * (1.1 - smoothnessWeight);
      } else if (interval <= 2) {
        score *= 0.5 * (1.1 - smoothnessWeight);
      } else if (interval <= avoidLeapThreshold) {
        score *=
          1.0 + (interval / avoidLeapThreshold) * (smoothnessWeight * 0.5);
      } else {
        score *= 1.5 + (interval / 12.0) * smoothnessWeight;
      }
    }
    if (score < minScore) {
      minScore = score;
      bestNote = note;
    }
  });

  if (
    previousNoteMidi !== null &&
    Math.abs(bestNote - previousNoteMidi) > avoidLeapThreshold
  ) {
    const stepNotes = allowedNotes.filter(
      (n) => Math.abs(n - previousNoteMidi) <= 2
    );
    if (stepNotes.length > 0) {
      let bestStepNote = stepNotes[0];
      let minStepTargetScore = Math.abs(bestStepNote - targetMidi);
      stepNotes.forEach((stepNote) => {
        let stepTargetScore = Math.abs(stepNote - targetMidi);
        if (stepTargetScore < minStepTargetScore) {
          minStepTargetScore = stepTargetScore;
          bestStepNote = stepNote;
        }
      });
      const LEAP_PREFERENCE_FACTOR = 2.0;
      if (minStepTargetScore < minScore * LEAP_PREFERENCE_FACTOR) {
        bestNote = bestStepNote;
      }
    }
  }
  return bestNote;
}

/**
 * Assigns a MIDI note for the Bass voice.
 * (Copied from original, kept internal)
 * @returns {number} The chosen MIDI note for the Bass.
 */
function assignBassNote(
  chordRootMidi,
  chordNotesPool,
  previousBassMidi,
  smoothness
) {
  // ... (Keep the full implementation of assignBassNote here) ...
  let allowedBassNotes = chordNotesPool.filter(
    (n) => n >= VOICE_RANGES.bass[0] && n <= VOICE_RANGES.bass[1]
  );
  if (allowedBassNotes.length === 0) {
    console.warn("No valid bass notes found in range. Using fallback.");
    return previousBassMidi ?? VOICE_RANGES.bass[0];
  }
  const rootNotePc = chordRootMidi % 12;
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);
  if (rootOptions.length > 0) {
    const targetMidi = previousBassMidi ?? chordRootMidi - 12;
    return findClosestNote(
      targetMidi,
      rootOptions,
      previousBassMidi,
      smoothness
    );
  } else {
    console.log(
      `Root note (${Tonal.Note.pitchClass(
        Tonal.Note.fromMidi(chordRootMidi)
      )}) not available in bass range.`
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
 * Assigns a MIDI note for the Soprano voice.
 * (Copied from original, kept internal)
 * @returns {number} The chosen MIDI note for the Soprano.
 */
function assignSopranoNote(
  fullChordNotePool,
  previousSopranoMidi,
  previousAltoMidi,
  smoothness
) {
  // ... (Keep the full implementation of assignSopranoNote here) ...
  let allowedSopranoNotes = fullChordNotePool.filter(
    (n) => n >= VOICE_RANGES.soprano[0] && n <= VOICE_RANGES.soprano[1]
  );
  if (allowedSopranoNotes.length === 0) {
    console.warn("No valid soprano notes found in range. Using fallback.");
    return previousSopranoMidi ?? VOICE_RANGES.soprano[1];
  }
  const targetMidi = previousSopranoMidi
    ? previousSopranoMidi + Math.floor(Math.random() * 5) + 1
    : VOICE_RANGES.soprano[0] + 5;
  return findClosestNote(
    targetMidi,
    allowedSopranoNotes,
    previousSopranoMidi,
    smoothness
  );
}

/**
 * Assigns MIDI notes for the Alto and Tenor voices.
 * (Copied from original, kept internal)
 * @returns {{tenorNoteMidi: number, altoNoteMidi: number}} The chosen MIDI notes.
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
  // ... (Keep the full implementation of assignInnerVoices here) ...
  let allowedAltoNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.alto[0] &&
      n <= VOICE_RANGES.alto[1] &&
      n < sopranoNoteMidi &&
      n > bassNoteMidi &&
      Math.abs(sopranoNoteMidi - n) <= VOICE_SPACING_LIMIT.soprano_alto
  );
  let allowedTenorNotes = fullChordNotePool.filter(
    (n) =>
      n >= VOICE_RANGES.tenor[0] &&
      n <= VOICE_RANGES.tenor[1] &&
      n < sopranoNoteMidi &&
      n > bassNoteMidi &&
      Math.abs(n - bassNoteMidi) <= VOICE_SPACING_LIMIT.tenor_bass
  );

  // Alto
  let altoNoteMidi = null;
  let altoTargetMidi = previousAltoMidi
    ? previousAltoMidi + (Math.random() > 0.5 ? 1 : -1)
    : (sopranoNoteMidi + bassNoteMidi) / 2;
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
  if (altoNoteMidi === null) {
    if (allowedAltoNotes.length === 0) {
      console.warn("No valid notes for Alto. Using fallback.");
      altoNoteMidi =
        previousAltoMidi ?? Math.max(VOICE_RANGES.alto[0], bassNoteMidi + 1);
    } else {
      altoNoteMidi = findClosestNote(
        altoTargetMidi,
        allowedAltoNotes,
        previousAltoMidi,
        smoothness
      );
    }
  }

  // Tenor
  allowedTenorNotes = allowedTenorNotes.filter(
    (n) =>
      n < altoNoteMidi &&
      Math.abs(altoNoteMidi - n) <= VOICE_SPACING_LIMIT.alto_tenor
  );
  let tenorNoteMidi = null;
  let tenorTargetMidi = previousTenorMidi
    ? previousTenorMidi + (Math.random() > 0.5 ? 1 : -1)
    : (altoNoteMidi + bassNoteMidi) / 2;
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
  if (tenorNoteMidi === null) {
    if (allowedTenorNotes.length === 0) {
      console.warn("No valid notes for Tenor below Alto. Using fallback.");
      tenorNoteMidi =
        previousTenorMidi ?? Math.max(VOICE_RANGES.tenor[0], bassNoteMidi + 1);
      if (tenorNoteMidi >= altoNoteMidi) {
        tenorNoteMidi = altoNoteMidi - 1;
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

  // Final check
  if (tenorNoteMidi >= altoNoteMidi) {
    console.warn(
      `Tenor (${midiToNoteName(tenorNoteMidi)}) >= Alto (${midiToNoteName(
        altoNoteMidi
      )}). Correcting.`
    );
    const lowerTenorOptions = allowedTenorNotes.filter((n) => n < altoNoteMidi);
    if (lowerTenorOptions.length > 0) {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi,
        lowerTenorOptions,
        previousTenorMidi,
        smoothness
      );
    } else {
      tenorNoteMidi =
        altoNoteMidi -
        (Tonal.Note.semitones(midiToNoteName(altoNoteMidi) % 12) % 2 === 0
          ? 2
          : 1);
      tenorNoteMidi = Math.max(
        tenorNoteMidi,
        bassNoteMidi + 1,
        VOICE_RANGES.tenor[0]
      );
      console.warn(`Forcing Tenor to ${midiToNoteName(tenorNoteMidi)}.`);
    }
  }
  return { tenorNoteMidi, altoNoteMidi };
}

/**
 * Checks for parallel 5ths and octaves between two voices.
 * (Copied from original, kept internal)
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
  // ... (Keep the full implementation of checkParallels here) ...
  if (
    voice1Prev === null ||
    voice2Prev === null ||
    voice1Curr === null ||
    voice2Curr === null
  )
    return;

  const note1PrevName = midiToNoteName(voice1Prev);
  const note1CurrName = midiToNoteName(voice1Curr);
  const note2PrevName = midiToNoteName(voice2Prev);
  const note2CurrName = midiToNoteName(voice2Curr);

  if (!note1PrevName || !note1CurrName || !note2PrevName || !note2CurrName)
    return;

  const intervalPrev = Tonal.Interval.distance(note2PrevName, note1PrevName);
  const intervalCurr = Tonal.Interval.distance(note2CurrName, note1CurrName);
  const simplePrev = Tonal.Interval.simplify(intervalPrev);
  const simpleCurr = Tonal.Interval.simplify(intervalCurr);
  const numPrev = Tonal.Interval.num(simplePrev);
  const numCurr = Tonal.Interval.num(simpleCurr);
  const voice1Moved = voice1Prev !== voice1Curr;
  const voice2Moved = voice2Prev !== voice2Curr;

  if (voice1Moved && voice2Moved) {
    const loc = `M${measure + 1}:B${beat + 1}`;
    if (
      numPrev === 5 &&
      numCurr === 5 &&
      simplePrev === "P5" &&
      simpleCurr === "P5"
    ) {
      console.warn(
        `PARALLEL 5th (${part1Name}/${part2Name}) at ${loc}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`
      );
    } else if (
      (numPrev === 8 || numPrev === 1) &&
      (numCurr === 8 || numCurr === 1) &&
      simplePrev.startsWith("P") &&
      simpleCurr.startsWith("P")
    ) {
      console.warn(
        `PARALLEL Octave/Unison (${part1Name}/${part2Name}) at ${loc}. Prev: ${note1PrevName}-${note2PrevName}, Curr: ${note1CurrName}-${note2CurrName}`
      );
    }
  }
}

/**
 * Performs voice leading checks (crossing, spacing, parallels).
 * (Copied from original, kept internal)
 */
function checkVoiceLeadingRules(currentNotes, previousNotes, measure, beat) {
  // ... (Keep the full implementation of checkVoiceLeadingRules here) ...
  const { soprano, alto, tenor, bass } = currentNotes;
  const prev = previousNotes;
  const loc = `M${measure + 1}:B${beat + 1}`;

  // Crossing
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

  // Spacing
  if (Math.abs(soprano - alto) > VOICE_SPACING_LIMIT.soprano_alto)
    console.warn(`Spacing > P8 between Soprano/Alto at ${loc}`);
  if (Math.abs(alto - tenor) > VOICE_SPACING_LIMIT.alto_tenor)
    console.warn(`Spacing > P8 between Alto/Tenor at ${loc}`);
  if (Math.abs(tenor - bass) > VOICE_SPACING_LIMIT.tenor_bass)
    console.warn(`Spacing > P12 between Tenor/Bass at ${loc}`);

  // Parallels
  if (prev && prev.soprano !== null) {
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

// --- Exported Functions ---

/**
 * Generates a simple chord progression based on tonal harmony tendencies.
 * @param {string} key - The key signature (e.g., "C", "Gm").
 * @param {number} numMeasures - The desired number of measures (and chords).
 * @param {number} harmonicComplexity - A value (0-10) influencing chord choices.
 * @returns {string[]} An array of Roman numeral chord symbols.
 */
export function generateChordProgression(key, numMeasures, harmonicComplexity) {
  // ... (Keep the full implementation of generateChordProgression here) ...
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) {
    console.error(`Invalid key: "${key}". Falling back.`);
    return ["I"];
  }
  const isMajor = keyDetails.type === "major";
  const tonicRoman = isMajor ? "I" : "i";
  const dominantRoman = "V";
  const dominant7Roman = "V7";
  const subdominantRoman = isMajor ? "IV" : "iv";
  const supertonicRoman = isMajor ? "ii" : "ii°";
  const mediantRoman = isMajor ? "iii" : "III";
  const submediantRoman = isMajor ? "vi" : "VI";
  const leadingToneRoman = "vii°";

  const primaryChords = [tonicRoman, subdominantRoman, dominantRoman];
  const secondaryChords = [submediantRoman, supertonicRoman];
  const complexChords = [mediantRoman, leadingToneRoman];

  let allowedChords = [...primaryChords];
  if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
  if (harmonicComplexity >= 7) allowedChords.push(...complexChords);
  if (harmonicComplexity >= 5) {
    if (allowedChords.includes(dominantRoman)) {
      allowedChords = allowedChords.map((c) =>
        c === dominantRoman ? dominant7Roman : c
      );
    } else if (!allowedChords.includes(dominant7Roman)) {
      allowedChords.push(dominant7Roman);
    }
  }
  allowedChords = [...new Set(allowedChords)];

  let progression = [tonicRoman];
  let prevChord = tonicRoman;
  for (let i = 1; i < numMeasures - 1; i++) {
    let nextChord;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    do {
      let candidates = allowedChords;
      if ([subdominantRoman, supertonicRoman].includes(prevChord)) {
        const dominantCandidates = allowedChords.filter((c) =>
          [dominantRoman, dominant7Roman, leadingToneRoman].includes(c)
        );
        if (dominantCandidates.length > 0) candidates = dominantCandidates;
      } else if ([dominantRoman, dominant7Roman].includes(prevChord)) {
        const tonicResolutionCandidates = allowedChords.filter((c) =>
          [tonicRoman, submediantRoman].includes(c)
        );
        if (tonicResolutionCandidates.length > 0)
          candidates = tonicResolutionCandidates;
      } else if (prevChord === submediantRoman) {
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
      }
      if (candidates.length === 0) candidates = allowedChords;
      nextChord = candidates[Math.floor(Math.random() * candidates.length)];
      attempts++;
    } while (
      nextChord === prevChord &&
      allowedChords.length > 1 &&
      attempts < MAX_ATTEMPTS
    );
    progression.push(nextChord);
    prevChord = nextChord;
  }

  const preCadenceChord = allowedChords.includes(dominant7Roman)
    ? dominant7Roman
    : dominantRoman;
  if (numMeasures > 2) {
    if (allowedChords.includes(preCadenceChord)) {
      progression[numMeasures - 2] = preCadenceChord;
    } else if (allowedChords.includes(dominantRoman)) {
      progression[numMeasures - 2] = dominantRoman;
    }
    progression[numMeasures - 1] = tonicRoman;
  } else if (numMeasures === 2) {
    progression[1] = tonicRoman;
  }

  console.log(
    `Generated Progression (${key}, complexity ${harmonicComplexity}):`,
    progression.join(" - ")
  );
  return progression;
}

/**
 * Main function to generate the four-part voice data.
 * @param {string[]} chordProgression - Array of Roman numeral chord symbols.
 * @param {string} key - The key signature (e.g., "C", "Gm").
 * @param {string} meter - The time signature (e.g., "4/4").
 * @param {number} numMeasures - The number of measures to generate.
 * @param {{melodicSmoothness: number, dissonanceStrictness: number}} generationSettings - Generation parameters.
 * @returns {object} A data structure containing arrays of note objects for each voice.
 * @throws {Error} If the key or meter is invalid.
 */
export function generateVoices(
  chordProgression,
  key,
  meter,
  numMeasures,
  generationSettings
) {
  const { melodicSmoothness, dissonanceStrictness } = generationSettings;
  const keyDetails = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!keyDetails) throw new Error("Invalid key: " + key);
  const keyTonic = keyDetails.tonic;
  const leadingToneMidiPc =
    (Tonal.Note.midi(keyTonic + DEFAULT_OCTAVE) +
      Tonal.Interval.semitones("M7")) %
    12;

  const [meterBeats, beatValue] = meter.split("/").map(Number);
  if (![2, 4, 8, 16].includes(beatValue))
    throw new Error("Unsupported beat value: " + meter);

  // Determine the VexFlow duration string for a *single beat* in this meter
  const beatDurationStr = { 1: "w", 2: "h", 4: "q", 8: "8" }[beatValue] || "q";
  const restDurationStr = beatDurationStr + "r"; // Rest duration for one beat

  let voicesData = { soprano: [], alto: [], tenor: [], bass: [] };
  // Keep track of the MIDI notes from the *end* of the previous measure
  let previousMeasureLastNotesMidi = {
    soprano: null,
    alto: null,
    tenor: null,
    bass: null,
  };

  // --- Loop Through Measures ---
  for (let i = 0; i < numMeasures; i++) {
    console.log(`--- Generating Measure ${i + 1} ---`);
    const roman = chordProgression[i];
    const baseChordNotes = getChordNotesFromRoman(roman, key);

    // --- Handle Chord Errors ---
    if (baseChordNotes.length === 0) {
      console.error(
        `Skipping measure ${
          i + 1
        }: Chord error "${roman}" in ${key}. Adding rests.`
      );
      // Add rests for *each beat* of the measure
      for (let beat = 0; beat < meterBeats; beat++) {
        VOICE_ORDER.forEach((voiceName) => {
          voicesData[voiceName].push({
            midi: null,
            duration: restDurationStr,
            vexKey: "b/4",
            isRest: true,
          });
        });
      }
      // Reset previous notes as context is lost
      previousMeasureLastNotesMidi = {
        soprano: null,
        alto: null,
        tenor: null,
        bass: null,
      };
      continue; // Move to the next measure
    }

    // --- Prepare Chord Data (once per measure) ---
    const chordRootMidi = baseChordNotes[0];
    const chordRootPc = chordRootMidi % 12;
    const chordPcs = baseChordNotes.map((n) => n % 12);
    const isLeadingToneChord = roman.toLowerCase().includes("vii");
    const fullChordNotePool = getExtendedChordNotePool(baseChordNotes);

    // --- Assign Note Voicing (once per measure) ---
    // Decide the specific notes for S,A,T,B for this chord, based on the end of the *previous* measure.
    const bassNoteMidi = assignBassNote(
      chordRootMidi,
      fullChordNotePool,
      previousMeasureLastNotesMidi.bass,
      melodicSmoothness
    );
    const sopranoNoteMidi = assignSopranoNote(
      fullChordNotePool,
      previousMeasureLastNotesMidi.soprano,
      previousMeasureLastNotesMidi.alto,
      melodicSmoothness
    );

    // Determine Inner Voice PCs based on Soprano/Bass choices
    let currentVoicingPcs = new Set();
    if (bassNoteMidi !== null) currentVoicingPcs.add(bassNoteMidi % 12);
    if (sopranoNoteMidi !== null) currentVoicingPcs.add(sopranoNoteMidi % 12);
    let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
    let pcsToDouble = [];
    const voicesToFill = 2;
    // --- (Keep the same Doubling Logic here as before) ---
    if (neededPcs.length < voicesToFill) {
      const numDoublingsNeeded = voicesToFill - neededPcs.length;
      const canDoubleRoot = chordRootPc !== leadingToneMidiPc;
      if (canDoubleRoot && !currentVoicingPcs.has(chordRootPc)) {
        pcsToDouble.push(chordRootPc);
      }
      const fifthPcMidi =
        Tonal.Note.midi(
          Tonal.Note.transpose(Tonal.Note.fromMidi(chordRootMidi), "P5")
        ) % 12;
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        chordPcs.includes(fifthPcMidi) &&
        fifthPcMidi !== leadingToneMidiPc &&
        !currentVoicingPcs.has(fifthPcMidi) &&
        !neededPcs.includes(fifthPcMidi)
      ) {
        pcsToDouble.push(fifthPcMidi);
      }
      const thirdPc = chordPcs.find(
        (pc) => pc !== chordRootPc && pc !== fifthPcMidi
      );
      if (
        pcsToDouble.length < numDoublingsNeeded &&
        thirdPc !== undefined &&
        thirdPc !== leadingToneMidiPc &&
        !currentVoicingPcs.has(thirdPc) &&
        !neededPcs.includes(thirdPc)
      ) {
        pcsToDouble.push(thirdPc);
      }
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
          pcsToDouble.push(thirdPc);
        } else {
          pcsToDouble.push(chordRootPc);
        }
        if (pcsToDouble.length > voicesToFill * 2) break; // Safety break
      }
    }
    let targetInnerPcs = [...neededPcs, ...pcsToDouble].slice(0, voicesToFill);
    while (targetInnerPcs.length < voicesToFill) {
      // Fallback fill
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
        targetInnerPcs.push(chordRootPc);
      } // Default add root again
    }
    const tenorTargetPc = targetInnerPcs[0];
    const altoTargetPc = targetInnerPcs[1];

    const { tenorNoteMidi, altoNoteMidi } = assignInnerVoices(
      tenorTargetPc,
      altoTargetPc,
      fullChordNotePool,
      previousMeasureLastNotesMidi.tenor, // Use previous measure's notes for smoothness
      previousMeasureLastNotesMidi.alto,
      sopranoNoteMidi, // Pass current soprano/bass for spacing checks
      bassNoteMidi,
      melodicSmoothness
    );

    // Store the complete voicing determined for this measure
    const currentMeasureVoicing = {
      soprano: sopranoNoteMidi,
      alto: altoNoteMidi,
      tenor: tenorNoteMidi,
      bass: bassNoteMidi,
    };
    console.log(` M${i + 1} Voicing:`, {
      S: midiToNoteName(sopranoNoteMidi),
      A: midiToNoteName(altoNoteMidi),
      T: midiToNoteName(tenorNoteMidi),
      B: midiToNoteName(bassNoteMidi),
    });

    // --- Voice Leading Check (Between Measures) ---
    // Check the transition *into* this measure's first beat
    if (dissonanceStrictness > 3) {
      checkVoiceLeadingRules(
        currentMeasureVoicing,
        previousMeasureLastNotesMidi,
        i,
        0
      ); // Check at beat 0
    }

    // --- Add Notes for Each Beat in the Measure ---
    // For simple block chords, repeat the same voicing for each beat.
    for (let beat = 0; beat < meterBeats; beat++) {
      VOICE_ORDER.forEach((voiceName) => {
        const midi = currentMeasureVoicing[voiceName]; // Use the determined note for this voice
        const vexKey = midi !== null ? midiToVexflowKey(midi, key) : null;

        if (midi !== null && vexKey) {
          voicesData[voiceName].push({
            midi: midi,
            duration: beatDurationStr, // Use the duration of a single beat
            vexKey: vexKey,
            isRest: false,
          });
        } else {
          // Add rest for this beat if the measure's voicing failed for this voice
          console.warn(
            `Adding rest for ${voiceName} in M${i + 1}, Beat ${
              beat + 1
            } due to voicing issue.`
          );
          voicesData[voiceName].push({
            midi: null,
            duration: restDurationStr,
            vexKey: "b/4", // Default rest key
            isRest: true,
          });
          currentMeasureVoicing[voiceName] = null; // Mark as null for next step's prevNotes
        }
      });

      // --- Optional: Voice Leading Check (Within Measure) ---
      // If we wanted more complex rhythms *within* the measure, we would:
      // 1. Assign notes potentially differently for each beat.
      // 2. Update an 'previousBeatNotesMidi' state here.
      // 3. Call checkVoiceLeadingRules(currentBeatNotes, previousBeatNotesMidi, i, beat) here.
      // For now, with block chords, intra-measure checks are not needed as notes don't change.
    } // --- End Beat Loop ---

    // Update the state for the *next measure's* voice leading checks
    previousMeasureLastNotesMidi = { ...currentMeasureVoicing };
  } // --- End Measure Loop ---

  console.log("Generated Voices Data final length:", voicesData.soprano.length);
  return voicesData;
}
