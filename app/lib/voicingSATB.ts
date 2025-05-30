// src/voicingSATB.ts
import * as Tonal from 'tonal';
import {
  VOICE_RANGES,
  VOICE_SPACING_LIMIT_SATB,
  DEFAULT_OCTAVE,
} from './constants';
import { findClosestNote } from './voicingUtils';
import { GenerationError } from './errors'; // Added import
import { midiToNoteName } from './harmonyUtils'; // Used only for console logs

/**
 * Assigns a MIDI note for the Bass voice in an SATB (Soprano, Alto, Tenor, Bass) context.
 * This function prioritizes placing the correct bass note for chord inversions. If the chord
 * is in root position or if the required inverted bass note is unavailable, it aims to place
 * the chord root in the bass. It also considers voice leading smoothness from the previous bass note.
 *
 * @param {number | null} requiredBassPc - The pitch class (0-11) of the bass note required by the chord's inversion.
 *                                         If `null`, the chord is assumed to be in root position, or no specific
 *                                         inversion is mandated, so the chord root is preferred.
 * @param {number} chordRootMidi - The MIDI note number of the current chord's root. This is used as a
 *                                 primary target if `requiredBassPc` is `null` or if the inverted bass note is not found.
 * @param {number[]} chordNotesPool - An array of all available MIDI notes (across multiple octaves) that belong to the current chord.
 *                                    These notes are candidates for the bass voice.
 * @param {number | null} previousBassMidi - The MIDI note of the Bass voice from the previous musical event.
 *                                           Used to encourage smooth voice leading.
 * @param {number} smoothness - A numerical preference (0-10) for smooth voice leading. Higher values
 *                              more strongly favor smaller melodic intervals from `previousBassMidi`.
 * @returns {number | null} The chosen MIDI note number for the Bass voice, or `null` if no suitable
 *                          note can be found within the defined bass range and chord constraints.
 */
export function assignBassNoteSATB(
  requiredBassPc: number | null,
  chordRootMidi: number,
  chordNotesPool: number[],
  previousBassMidi: number | null,
  smoothness: number,
): number | null {
  const [minRange, maxRange] = VOICE_RANGES.bass; // Get defined MIDI range for bass
  const allowedBassNotes = chordNotesPool
    .filter((n) => n >= minRange && n <= maxRange)
    .sort((a, b) => a - b); // Ensure sorted

  if (allowedBassNotes.length === 0) {
    console.warn('[WARN] SATB: No valid bass notes found in range.');
    return null;
  }

  let bassCandidates: number[] = [];
  const targetMidi =
    previousBassMidi !== null ? previousBassMidi - 1 : chordRootMidi - 12; // Target slightly below previous or octave below root

  // --- Prioritize Required Bass Note for Inversion ---
  if (requiredBassPc !== null) {
    bassCandidates = allowedBassNotes.filter((n) => n % 12 === requiredBassPc);
    if (bassCandidates.length > 0) {
      // Found the required note in range
      return findClosestNote(
        targetMidi,
        bassCandidates,
        previousBassMidi,
        smoothness,
        9, // Leap threshold for bass
      );
    } else {
      // Required bass note PC not found in range! Fall back to root position logic.
      console.warn(
        `[WARN] SATB Bass: Required inversion PC ${requiredBassPc} not found in bass range [${minRange}-${maxRange}]. Reverting to root preference.`,
      );
      // Continue to root position logic below
    }
  }

  // --- Root Position Preference (or fallback from failed inversion) ---
  const rootNotePc = chordRootMidi % 12;
  const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);

  if (rootOptions.length > 0) {
    bassCandidates = rootOptions;
  } else {
    // Root note itself is not available, choose lowest available chord tone as fallback
    const fifthPc = (rootNotePc + 7) % 12; // Try fifth
    const fifthOptions = allowedBassNotes.filter((n) => n % 12 === fifthPc);
    if (fifthOptions.length > 0) {
      console.info(`[INFO] SATB Bass: Root PC ${rootNotePc} not in range. Using 5th.`);
      bassCandidates = fifthOptions;
    } else {
      console.warn(
        `[WARN] SATB Bass: Root PC ${rootNotePc} and 5th PC ${fifthPc} not in range. Using lowest available.`,
      );
      bassCandidates = allowedBassNotes; // Use any allowed note if root/5th unavailable
      // Return the absolute lowest note available in this emergency case
      return bassCandidates[0];
    }
  }

  return findClosestNote(
    targetMidi,
    bassCandidates,
    previousBassMidi,
    smoothness,
    9,
  );
}

/**
 * Assigns MIDI notes for the Alto and Tenor voices in an SATB context.
 * This function considers the already assigned Soprano and Bass notes and aims to complete
 * the chord voicing according to common practice doubling rules (e.g., prioritize doubling
 * the root, then the fifth, then the third; avoid doubling the leading tone).
 * It also factors in voice ranges, spacing between voices, and voice leading smoothness.
 *
 * @param {number[]} chordPcs - An array of unique pitch classes (0-11) present in the current chord,
 *                              typically derived from the root position of the chord.
 * @param {number[]} fullChordNotePool - An array of all available MIDI notes for the current chord across multiple octaves.
 * @param {number | null} previousTenorMidi - The MIDI note of the Tenor voice from the previous event.
 * @param {number | null} previousAltoMidi - The MIDI note of the Alto voice from the previous event.
 * @param {number | null} sopranoNoteMidi - The MIDI note already assigned to the Soprano voice for the current event.
 * @param {number | null} bassNoteMidi - The MIDI note already assigned to the Bass voice for the current event (this could be an inverted bass note).
 * @param {number} smoothness - A preference (0-10) for smooth voice leading for Alto and Tenor.
 * @param {Tonal.Key.Key} keyDetails - An object containing details about the current musical key (tonic, type, scale),
 *                                     used primarily for identifying the leading tone to avoid doubling it.
 * @returns {{ tenorNoteMidi: number | null; altoNoteMidi: number | null }} An object containing the chosen MIDI notes
 *          for the Tenor and Alto voices. Either can be `null` if no suitable note is found.
 */
export function assignInnerVoicesSATB(
  chordPcs: number[],
  fullChordNotePool: number[],
  previousTenorMidi: number | null,
  previousAltoMidi: number | null,
  sopranoNoteMidi: number | null,
  bassNoteMidi: number | null,
  smoothness: number,
  keyDetails: Tonal.Key.Key, // Used for identifying leading tone etc.
): { tenorNoteMidi: number | null; altoNoteMidi: number | null } {
  if (sopranoNoteMidi === null || bassNoteMidi === null) {
    // console.warn('SATB: Cannot assign inner voices without valid soprano and bass notes.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  // --- Doubling Logic ---
  // Use the *actual* chosen bass and soprano notes to see what's covered
  let currentVoicingPcs = new Set<number>([
    bassNoteMidi % 12,
    sopranoNoteMidi % 12,
  ]);
  // We need to fill the remaining chordPcs (from the root position definition)
  let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
  let pcsToDouble: number[] = [];
  const voicesToFill = 2; // Alto and Tenor

  // Determine root, third, fifth, leading tone PCs for doubling rules
  // This needs the root position chord information
  const chordRootPc = chordPcs[0]; // Assuming root position input
  const thirdPcIndex = chordPcs.findIndex(
    (pc, i) =>
      i > 0 &&
      (pc - chordRootPc + 12) % 12 > 0 &&
      (pc - chordRootPc + 12) % 12 < 7,
  );
  const thirdPc = thirdPcIndex !== -1 ? chordPcs[thirdPcIndex] : undefined;
  const fifthPcIndex = chordPcs.findIndex(
    (pc, i) => i > 0 && (pc - chordRootPc + 12) % 12 === 7,
  );
  const fifthPc = fifthPcIndex !== -1 ? chordPcs[fifthPcIndex] : undefined;

  // Leading tone determination requires key context
  const leadingToneMidiGuess = Tonal.Note.midi(
    Tonal.transpose(keyDetails.tonic + DEFAULT_OCTAVE, 'M7') ?? '',
  );
  const leadingTonePc =
    leadingToneMidiGuess !== null ? leadingToneMidiGuess % 12 : -1;

  // Decide which pitch classes to double if needed
  if (neededPcs.length < voicesToFill) {
    const numDoublingsNeeded = voicesToFill - neededPcs.length;
    // Doubling Priorities: Root > 5th > 3rd. Avoid doubling LT.
    const potentialDoubles: number[] = [];
    if (chordRootPc !== leadingTonePc) potentialDoubles.push(chordRootPc);
    if (fifthPc !== undefined && fifthPc !== leadingTonePc)
      potentialDoubles.push(fifthPc);
    if (thirdPc !== undefined && thirdPc !== leadingTonePc)
      potentialDoubles.push(thirdPc);

    // Add available chord tones already present in S/B if needed and allowed
    if (
      bassNoteMidi % 12 !== leadingTonePc &&
      !potentialDoubles.includes(bassNoteMidi % 12)
    )
      potentialDoubles.push(bassNoteMidi % 12);
    if (
      sopranoNoteMidi % 12 !== leadingTonePc &&
      !potentialDoubles.includes(sopranoNoteMidi % 12)
    )
      potentialDoubles.push(sopranoNoteMidi % 12);

    for (const pc of potentialDoubles) {
      if (pcsToDouble.length < numDoublingsNeeded) {
        pcsToDouble.push(pc);
      }
    }
    // Fallback doubling if preferred are not enough (e.g., LT is root/3rd/5th)
    while (pcsToDouble.length < numDoublingsNeeded) {
      const fallbackPc =
        chordPcs.find(
          (pc) => pc !== leadingTonePc && !pcsToDouble.includes(pc),
        ) ?? // Then any chord tone not LT
        chordRootPc; // Absolute fallback: root
      if (fallbackPc !== undefined) {
        pcsToDouble.push(fallbackPc);
        console.warn(`[WARN] SATB: Emergency doubling PC ${fallbackPc}`);
      } else {
        throw new GenerationError('SATB: Cannot find any PC to double for inner voices!');
      }
      if (pcsToDouble.length > 5) break; // Safety
    }
  }

  // Combine needed PCs and doubled PCs for the inner voices
  let targetInnerPcs = [...neededPcs, ...pcsToDouble];

  // Ensure we have exactly two target PCs
  if (targetInnerPcs.length < 2) {
    // console.warn(`SATB: Only ${targetInnerPcs.length} target PCs for inner voices. Adding fallback.`);
    const fallbackPc =
      chordRootPc !== -1 && chordRootPc !== leadingTonePc // Prefer root if not LT
        ? chordRootPc
        : (chordPcs.find((pc) => pc !== leadingTonePc) ?? chordPcs[0]); // Any chord tone not LT, or first chordPcs as last resort

    if (fallbackPc !== undefined && !targetInnerPcs.includes(fallbackPc)) {
      targetInnerPcs.push(fallbackPc);
    }
    // If still not enough (e.g. only one unique PC in chord and it's LT), duplicate what we have or root.
    if (targetInnerPcs.length === 0 && fallbackPc !== undefined) targetInnerPcs.push(fallbackPc); // Ensure at least one
    while (targetInnerPcs.length < 2 && targetInnerPcs.length > 0) {
      targetInnerPcs.push(targetInnerPcs[0]); // Duplicate if only one
    }
    if (targetInnerPcs.length === 0) { // Absolute fallback if chordPcs was empty or only had LT
      // console.error('SATB: No target PCs for inner voices even after fallback. Assigning chord root.');
      targetInnerPcs = [chordRootPc, chordRootPc]; // Should be extremely rare
    }
  }
   // Ensure exactly 2 target PCs, preferring originally needed notes over doubled ones if there was an excess.
  if (targetInnerPcs.length > 2) {
    targetInnerPcs = neededPcs.concat(pcsToDouble).slice(0, 2); 
    // This ensures that if `neededPcs` had 0 or 1 element, it takes those first,
    // then fills the rest from `pcsToDouble` up to a total of 2.
  }


  // Determine which PC goes to Alto and which to Tenor.
  // Simple approach: assign randomly or based on previous notes proximity?
  // Let's try assigning based on proximity to previous notes or range centers
  const pc1 = targetInnerPcs[0];
  const pc2 = targetInnerPcs[1];

  const altoTargetMidi =
    previousAltoMidi ?? (sopranoNoteMidi + bassNoteMidi) / 2;
  const tenorTargetMidiEst =
    previousTenorMidi ?? (altoTargetMidi + bassNoteMidi) / 2;

  // This simple assignment strategy attempts to maintain pitch class if possible,
  // or assigns based on a crude proximity/balance estimation.
  // More sophisticated assignment could consider voice leading more directly here.
  let altoTargetPc: number;
  let tenorTargetPc: number;

  // Estimate target midis for Alto and Tenor based on previous notes or S/B midpoint.
  const altoApproxTargetMidi = previousAltoMidi ?? (sopranoNoteMidi + bassNoteMidi) / 2;
  const tenorApproxTargetMidi = previousTenorMidi ?? (altoApproxTargetMidi + bassNoteMidi) / 2;

  // Assign target PCs to Alto and Tenor based on which PC is "closer" to their previous pitch or estimated target.
  // This is a heuristic and might not always yield optimal voice leading for PCs.
  const distPc1ToAltoTarget = Math.abs(Tonal.Note.chroma(Tonal.Note.fromMidi(altoApproxTargetMidi)) - pc1);
  const distPc2ToAltoTarget = Math.abs(Tonal.Note.chroma(Tonal.Note.fromMidi(altoApproxTargetMidi)) - pc2);
  const distPc1ToTenorTarget = Math.abs(Tonal.Note.chroma(Tonal.Note.fromMidi(tenorApproxTargetMidi)) - pc1);
  const distPc2ToTenorTarget = Math.abs(Tonal.Note.chroma(Tonal.Note.fromMidi(tenorApproxTargetMidi)) - pc2);

  if ( (distPc1ToAltoTarget + distPc2ToTenorTarget) <= (distPc2ToAltoTarget + distPc1ToTenorTarget) ) {
    altoTargetPc = pc1;
    tenorTargetPc = pc2;
  } else {
    altoTargetPc = pc2;
    tenorTargetPc = pc1;
  }

  // --- Filter available notes from the pool by Range and Spacing constraints ---
  const [altoMin, altoMax] = VOICE_RANGES.alto;
  const [tenorMin, tenorMax] = VOICE_RANGES.tenor;

  // Alto notes must be between Bass and Soprano, and within S-A spacing
  let allowedAltoNotes = fullChordNotePool
    .filter(
      (n) =>
        n >= altoMin &&
        n <= altoMax &&
        n < sopranoNoteMidi && // Below Soprano
        n > bassNoteMidi && // Above Bass
        sopranoNoteMidi - n <= VOICE_SPACING_LIMIT_SATB.soprano_alto, // S-A spacing
    )
    .sort((a, b) => a - b);

  // Tenor notes must be between Bass and (potential) Alto, and within A-T and T-B spacing
  let allowedTenorNotesBase = fullChordNotePool
    .filter(
      (n) =>
        n >= tenorMin &&
        n <= tenorMax &&
        n > bassNoteMidi && // Above Bass
        n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass, // T-B spacing
    )
    .sort((a, b) => a - b);

  // --- Assign Voices Iteratively (Try Alto then Tenor) ---
  let altoNoteMidi: number | null = null;
  let tenorNoteMidi: number | null = null;

  // Find Alto Note
  let altoOptionsToUse = allowedAltoNotes.filter(
    (n) => n % 12 === altoTargetPc,
  );
  if (altoOptionsToUse.length === 0) {
    console.info(
      `[INFO] SATB Alto: Target PC ${altoTargetPc} not available. Trying any allowed note.`,
    );
    altoOptionsToUse = allowedAltoNotes; // Use any allowed note if target PC not available
  }

  if (altoOptionsToUse.length === 0) {
    console.warn(
      `[WARN] SATB: No valid notes for Alto (Target PC: ${altoTargetPc}) meeting constraints. Relaxing S-A spacing.`,
    );
    // Relax S-A spacing constraint
    altoOptionsToUse = fullChordNotePool
      .filter(
        (n) =>
          n >= altoMin &&
          n <= altoMax &&
          n < sopranoNoteMidi &&
          n > bassNoteMidi,
      )
      .filter((n) => n % 12 === altoTargetPc); // Try target PC first
    if (altoOptionsToUse.length === 0) {
      altoOptionsToUse = fullChordNotePool.filter(
        (n) =>
          n >= altoMin &&
          n <= altoMax &&
          n < sopranoNoteMidi &&
          n > bassNoteMidi,
      );
    }

    if (altoOptionsToUse.length === 0) {
      throw new GenerationError('SATB: Still no Alto notes even after relaxing S-A spacing. Cannot assign Alto.');
    }
  }

  altoNoteMidi = findClosestNote(
    altoTargetMidi, // Use refined target
    altoOptionsToUse,
    previousAltoMidi,
    smoothness,
  );

  if (altoNoteMidi === null) {
    // Emergency fallback: pick middle note from candidates
    altoNoteMidi = altoOptionsToUse[Math.floor(altoOptionsToUse.length / 2)] ?? null;
    if (altoNoteMidi === null) {
        throw new GenerationError('SATB: Failed to select an Alto note from candidates, and fallback also failed.');
    }
    console.warn('[WARN] SATB: findClosestNote returned null for Alto, used emergency fallback.'); 
  }

  // Find Tenor Note (must be below chosen Alto and respect A-T spacing)
  let allowedTenorNotes = allowedTenorNotesBase.filter(
    (n) =>
      n < altoNoteMidi! && // Below chosen Alto
      altoNoteMidi! - n <= VOICE_SPACING_LIMIT_SATB.alto_tenor, // A-T spacing
  );

  let tenorOptionsToUse = allowedTenorNotes.filter(
    (n) => n % 12 === tenorTargetPc,
  );
  if (tenorOptionsToUse.length === 0) {
    console.info(
      `[INFO] SATB Tenor: Target PC ${tenorTargetPc} not available. Trying any allowed note.`,
    );
    tenorOptionsToUse = allowedTenorNotes; // Use any allowed note if target PC not available
  }

  if (tenorOptionsToUse.length === 0) {
    console.warn(
      `[WARN] SATB: No valid notes for Tenor (Target PC: ${tenorTargetPc}) below Alto ${midiToNoteName(altoNoteMidi)}. Relaxing A-T spacing.`,
    );
    // Relax A-T spacing, just ensure below Alto
    allowedTenorNotes = allowedTenorNotesBase.filter((n) => n < altoNoteMidi!);
    tenorOptionsToUse = allowedTenorNotes.filter(
      (n) => n % 12 === tenorTargetPc,
    );
    if (tenorOptionsToUse.length === 0) tenorOptionsToUse = allowedTenorNotes;

    if (tenorOptionsToUse.length === 0) {
      // If altoNoteMidi is null here, it means the previous block also failed critically.
      // However, the logic implies altoNoteMidi should be set if we reach here.
      const altoNoteName = altoNoteMidi !== null ? midiToNoteName(altoNoteMidi) : 'unknown';
      throw new GenerationError(`SATB: Still no Tenor notes below Alto ${altoNoteName} even after relaxing A-T spacing. Cannot assign Tenor.`);
    }
  }

  const tenorTargetMidi =
    previousTenorMidi !== null
      ? previousTenorMidi
      : (altoNoteMidi! + bassNoteMidi) / 2; // Refine target based on actual alto
  tenorNoteMidi = findClosestNote(
    tenorTargetMidi,
    tenorOptionsToUse,
    previousTenorMidi,
    smoothness,
  );

  if (tenorNoteMidi === null) {
    // Emergency fallback: pick highest note from candidates
    tenorNoteMidi = tenorOptionsToUse[tenorOptionsToUse.length - 1] ?? null;
    if (tenorNoteMidi === null) {
        throw new GenerationError('SATB: Failed to select a Tenor note from candidates, and fallback also failed.');
    }
    console.warn('[WARN] SATB: findClosestNote returned null for Tenor, used emergency fallback.'); 
  }

  // Final Check: Ensure Tenor is strictly below Alto
  if (tenorNoteMidi !== null && altoNoteMidi !== null && tenorNoteMidi >= altoNoteMidi) {
    const tenorName = midiToNoteName(tenorNoteMidi);
    const altoName = midiToNoteName(altoNoteMidi);
    // Try finding the next lowest valid tenor note
    const lowerTenorOptions = tenorOptionsToUse.filter(
      // Filter for notes strictly lower than the current tenorNoteMidi, which has been identified as crossing or unison with alto.
      (n) => n < tenorNoteMidi!, 
    );
    if (lowerTenorOptions.length > 0) {
      const newTenorMidi = findClosestNote(
        tenorTargetMidi, // Keep original target
        lowerTenorOptions,
        previousTenorMidi,
        smoothness,
      );
      if (newTenorMidi !== null && newTenorMidi < altoNoteMidi) {
        console.warn(`[WARN] SATB: Corrected Tenor ${tenorName} to ${midiToNoteName(newTenorMidi)} to be below Alto ${altoName}.`);
        tenorNoteMidi = newTenorMidi;
      } else {
        throw new GenerationError(`SATB INTERNAL ERROR: Tenor ${tenorName} was >= Alto ${altoName}. Attempt to find lower tenor failed or still invalid. New tenor: ${newTenorMidi ? midiToNoteName(newTenorMidi) : 'null'}.`);
      }
    } else {
      throw new GenerationError(`SATB INTERNAL ERROR: Tenor ${tenorName} was >= Alto ${altoName}. No lower tenor options available.`);
    }
  }

  return { tenorNoteMidi, altoNoteMidi };
}
