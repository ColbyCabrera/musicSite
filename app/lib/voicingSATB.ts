// src/voicingSATB.ts
import * as Tonal from 'tonal';
import {
  VOICE_RANGES,
  VOICE_SPACING_LIMIT_SATB,
  DEFAULT_OCTAVE,
} from './constants';
import { findClosestNote } from './voicingUtils';
import { midiToNoteName } from './harmonyUtils';

/**
 * Assigns a MIDI note for the Bass voice (SATB context), prioritizing inversions.
 * @param requiredBassPc - The pitch class (0-11) required for the bass (from inversion), or null for root position preference.
 * @param chordRootMidi - The root MIDI note of the current chord (for grounding if requiredBassPc is null).
 * @param chordNotesPool - All available MIDI notes for the chord across octaves.
 * @param previousBassMidi - MIDI note of this voice in the previous chord/beat.
 * @param smoothness - Smoothness preference (0-10).
 * @returns The chosen MIDI note, or null if no suitable note.
 */
export function assignBassNoteSATB(
  requiredBassPc: number | null,
  chordRootMidi: number, // Still useful as a fallback target
  chordNotesPool: number[],
  previousBassMidi: number | null,
  smoothness: number,
): number | null {
  const [minRange, maxRange] = VOICE_RANGES.bass;
  const allowedBassNotes = chordNotesPool
    .filter((n) => n >= minRange && n <= maxRange)
    .sort((a, b) => a - b); // Ensure sorted

  if (allowedBassNotes.length === 0) {
    console.warn('SATB: No valid bass notes found in range.');
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
        `SATB Bass: Required inversion PC ${requiredBassPc} not found in bass range [${minRange}-${maxRange}]. Reverting to root preference.`,
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
      console.log(`SATB Bass: Root PC ${rootNotePc} not in range. Using 5th.`);
      bassCandidates = fifthOptions;
    } else {
      console.warn(
        `SATB Bass: Root PC ${rootNotePc} and 5th PC ${fifthPc} not in range. Using lowest available.`,
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

// --- assignInnerVoicesSATB (No changes needed directly for inversion, relies on bass output) ---
/** Assigns MIDI notes for the Alto and Tenor voices (SATB context). */
export function assignInnerVoicesSATB(
  chordPcs: number[], // Root position chord pitch classes
  fullChordNotePool: number[],
  previousTenorMidi: number | null,
  previousAltoMidi: number | null,
  sopranoNoteMidi: number | null,
  bassNoteMidi: number | null, // This is the *actual* chosen bass note (could be inverted)
  smoothness: number,
  keyDetails: Tonal.Key.Key,
): { tenorNoteMidi: number | null; altoNoteMidi: number | null } {
  if (sopranoNoteMidi === null || bassNoteMidi === null) {
    console.warn(
      'SATB: Cannot assign inner voices without valid soprano and bass.',
    );
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
        console.warn(`SATB: Emergency doubling PC ${fallbackPc}`);
      } else {
        console.error('SATB: Cannot find any PC to double!');
        break;
      }
      if (pcsToDouble.length > 5) break; // Safety
    }
  }

  // Combine needed PCs and doubled PCs for the inner voices
  let targetInnerPcs = [...neededPcs, ...pcsToDouble];

  // Ensure we have exactly two target PCs
  if (targetInnerPcs.length < 2) {
    console.warn(
      `SATB: Only ${targetInnerPcs.length} target PCs for inner voices. Adding fallback.`,
    );
    const fallbackPc =
      chordRootPc !== -1 && chordRootPc !== leadingTonePc
        ? chordRootPc
        : (chordPcs.find((pc) => pc !== leadingTonePc) ?? chordPcs[0]);
    if (fallbackPc !== undefined && !targetInnerPcs.includes(fallbackPc))
      targetInnerPcs.push(fallbackPc);
    // If still not enough, just duplicate the first one (ugly, but avoids crash)
    if (targetInnerPcs.length < 2 && targetInnerPcs.length > 0)
      targetInnerPcs.push(targetInnerPcs[0]);
    else if (targetInnerPcs.length === 0) {
      // Catastrophe
      console.error('SATB: No target PCs for inner voices. Assigning root.');
      targetInnerPcs = [chordRootPc, chordRootPc];
    }
  }
  // Ensure exactly 2, preferring needed notes over doubled ones if > 2
  if (targetInnerPcs.length > 2) {
    targetInnerPcs = neededPcs.concat(pcsToDouble).slice(0, 2);
  }

  // Determine which PC goes to Alto and which to Tenor
  // Simple approach: assign randomly or based on previous notes proximity?
  // Let's try assigning based on proximity to previous notes or range centers
  const pc1 = targetInnerPcs[0];
  const pc2 = targetInnerPcs[1];

  const altoTargetMidi =
    previousAltoMidi ?? (sopranoNoteMidi + bassNoteMidi) / 2;
  const tenorTargetMidiEst =
    previousTenorMidi ?? (altoTargetMidi + bassNoteMidi) / 2;

  // Crude assignment: closer PC to previous alto goes to alto?
  let altoTargetPc: number;
  let tenorTargetPc: number;

  const dist1Alto =
    previousAltoMidi !== null
      ? Math.min(
          Math.abs(pc1 - (previousAltoMidi % 12)),
          12 - Math.abs(pc1 - (previousAltoMidi % 12)),
        )
      : 6;
  const dist2Alto =
    previousAltoMidi !== null
      ? Math.min(
          Math.abs(pc2 - (previousAltoMidi % 12)),
          12 - Math.abs(pc2 - (previousAltoMidi % 12)),
        )
      : 6;
  const dist1Tenor =
    previousTenorMidi !== null
      ? Math.min(
          Math.abs(pc1 - (previousTenorMidi % 12)),
          12 - Math.abs(pc1 - (previousTenorMidi % 12)),
        )
      : 6;
  const dist2Tenor =
    previousTenorMidi !== null
      ? Math.min(
          Math.abs(pc2 - (previousTenorMidi % 12)),
          12 - Math.abs(pc2 - (previousTenorMidi % 12)),
        )
      : 6;

  // Assign to minimize total distance? (dist1Alto + dist2Tenor) vs (dist2Alto + dist1Tenor)
  if (dist1Alto + dist2Tenor <= dist2Alto + dist1Tenor) {
    altoTargetPc = pc1;
    tenorTargetPc = pc2;
  } else {
    altoTargetPc = pc2;
    tenorTargetPc = pc1;
  }

  // --- Filter Notes by Range and Spacing ---
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
    console.log(
      `SATB Alto: Target PC ${altoTargetPc} not available. Trying any allowed note.`,
    );
    altoOptionsToUse = allowedAltoNotes; // Use any allowed note if target PC not available
  }

  if (altoOptionsToUse.length === 0) {
    console.warn(
      `SATB: No valid notes for Alto (Target PC: ${altoTargetPc}) meeting constraints. Relaxing S-A spacing.`,
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
      console.error(
        'SATB: Still no Alto notes even after relaxing S-A. Cannot assign.',
      );
      return { tenorNoteMidi: null, altoNoteMidi: null };
    }
  }

  altoNoteMidi = findClosestNote(
    altoTargetMidi, // Use refined target
    altoOptionsToUse,
    previousAltoMidi,
    smoothness,
  );

  if (altoNoteMidi === null) {
    console.error('SATB: Failed to select an Alto note from candidates.');
    // Emergency fallback: pick middle note from candidates
    altoNoteMidi =
      altoOptionsToUse[Math.floor(altoOptionsToUse.length / 2)] ?? null;
    if (altoNoteMidi === null)
      return { tenorNoteMidi: null, altoNoteMidi: null }; // Give up if still null
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
    console.log(
      `SATB Tenor: Target PC ${tenorTargetPc} not available. Trying any allowed note.`,
    );
    tenorOptionsToUse = allowedTenorNotes; // Use any allowed note if target PC not available
  }

  if (tenorOptionsToUse.length === 0) {
    console.warn(
      `SATB: No valid notes for Tenor (Target PC: ${tenorTargetPc}) below Alto ${midiToNoteName(altoNoteMidi)}. Relaxing A-T spacing.`,
    );
    // Relax A-T spacing, just ensure below Alto
    allowedTenorNotes = allowedTenorNotesBase.filter((n) => n < altoNoteMidi!);
    tenorOptionsToUse = allowedTenorNotes.filter(
      (n) => n % 12 === tenorTargetPc,
    );
    if (tenorOptionsToUse.length === 0) tenorOptionsToUse = allowedTenorNotes;

    if (tenorOptionsToUse.length === 0) {
      console.error(
        `SATB: Still no Tenor notes below Alto ${midiToNoteName(altoNoteMidi)} even after relaxing A-T. Cannot assign Tenor.`,
      );
      // Return the valid Alto note found
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
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
    console.error('SATB: Failed to select a Tenor note from candidates.');
    // Emergency fallback: pick highest note from candidates
    tenorNoteMidi = tenorOptionsToUse[tenorOptionsToUse.length - 1] ?? null;
    if (tenorNoteMidi === null)
      return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi }; // Give up Tenor
  }

  // Final Check: Ensure Tenor is strictly below Alto
  if (tenorNoteMidi >= altoNoteMidi) {
    console.error(
      `SATB INTERNAL ERROR: Tenor ${midiToNoteName(tenorNoteMidi)} >= Alto ${midiToNoteName(altoNoteMidi)}. Invalidating Tenor. Trying lower tenor.`,
    );
    // Try finding the next lowest valid tenor note
    const lowerTenorOptions = tenorOptionsToUse.filter(
      (n) => n < tenorNoteMidi!,
    );
    if (lowerTenorOptions.length > 0) {
      tenorNoteMidi = findClosestNote(
        tenorTargetMidi, // Keep original target
        lowerTenorOptions,
        previousTenorMidi,
        smoothness,
      );
      if (tenorNoteMidi === null || tenorNoteMidi >= altoNoteMidi) {
        // If still fails or null
        console.error(
          `SATB: Could not find suitable lower tenor. Tenor assignment failed.`,
        );
        tenorNoteMidi = null;
      }
    } else {
      console.error(
        `SATB: No lower tenor options available. Tenor assignment failed.`,
      );
      tenorNoteMidi = null;
    }
  }

  return { tenorNoteMidi, altoNoteMidi };
}
