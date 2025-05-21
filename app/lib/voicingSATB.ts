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

/**
 * Determines the target pitch classes for the Alto and Tenor voices.
 * @param chordPcs Root position chord pitch classes.
 * @param bassNoteMidi MIDI note of the chosen bass.
 * @param sopranoNoteMidi MIDI note of the chosen soprano.
 * @param keyDetails Key information for identifying leading tone.
 * @param previousAltoMidi MIDI note of the alto in the previous chord.
 * @param previousTenorMidi MIDI note of the tenor in the previous chord.
 * @returns Object with altoTargetPc and tenorTargetPc, or null if targets can't be determined.
 */
function _determineTargetInnerVoicePcs(
  chordPcs: number[],
  bassNoteMidi: number,
  sopranoNoteMidi: number,
  keyDetails: Tonal.Key.Key,
  previousAltoMidi: number | null,
  previousTenorMidi: number | null,
): { altoTargetPc: number; tenorTargetPc: number } | null {
  let currentVoicingPcs = new Set<number>([
    bassNoteMidi % 12,
    sopranoNoteMidi % 12,
  ]);
  let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
  let pcsToDouble: number[] = [];
  const voicesToFill = 2;

  const chordRootPc = chordPcs[0];
  const thirdPcIndex = chordPcs.findIndex(
    (pc, i) => i > 0 && (pc - chordRootPc + 12) % 12 > 0 && (pc - chordRootPc + 12) % 12 < 7,
  );
  const thirdPc = thirdPcIndex !== -1 ? chordPcs[thirdPcIndex] : undefined;
  const fifthPcIndex = chordPcs.findIndex(
    (pc, i) => i > 0 && (pc - chordRootPc + 12) % 12 === 7,
  );
  const fifthPc = fifthPcIndex !== -1 ? chordPcs[fifthPcIndex] : undefined;

  const leadingToneMidiGuess = Tonal.Note.midi(
    Tonal.transpose(keyDetails.tonic + DEFAULT_OCTAVE, 'M7') ?? '',
  );
  const leadingTonePc = leadingToneMidiGuess !== null ? leadingToneMidiGuess % 12 : -1;

  if (neededPcs.length < voicesToFill) {
    const numDoublingsNeeded = voicesToFill - neededPcs.length;
    const potentialDoubles: number[] = [];
    if (chordRootPc !== leadingTonePc) potentialDoubles.push(chordRootPc);
    if (fifthPc !== undefined && fifthPc !== leadingTonePc) potentialDoubles.push(fifthPc);
    if (thirdPc !== undefined && thirdPc !== leadingTonePc) potentialDoubles.push(thirdPc);

    if (bassNoteMidi % 12 !== leadingTonePc && !potentialDoubles.includes(bassNoteMidi % 12))
      potentialDoubles.push(bassNoteMidi % 12);
    if (sopranoNoteMidi % 12 !== leadingTonePc && !potentialDoubles.includes(sopranoNoteMidi % 12))
      potentialDoubles.push(sopranoNoteMidi % 12);

    for (const pc of potentialDoubles) {
      if (pcsToDouble.length < numDoublingsNeeded) pcsToDouble.push(pc);
    }
    while (pcsToDouble.length < numDoublingsNeeded) {
      const fallbackPc =
        chordPcs.find((pc) => pc !== leadingTonePc && !pcsToDouble.includes(pc)) ?? chordRootPc;
      if (fallbackPc !== undefined) {
        pcsToDouble.push(fallbackPc);
      } else {
        console.error('SATB: Cannot find any PC to double for inner voices!');
        return null;
      }
      if (pcsToDouble.length > 5) break; // Safety
    }
  }

  let targetInnerPcs = [...neededPcs, ...pcsToDouble];

  if (targetInnerPcs.length < 2) {
    const fallbackPc =
      chordRootPc !== -1 && chordRootPc !== leadingTonePc
        ? chordRootPc
        : (chordPcs.find((pc) => pc !== leadingTonePc) ?? chordPcs[0]);
    if (fallbackPc !== undefined && !targetInnerPcs.includes(fallbackPc)) targetInnerPcs.push(fallbackPc);
    if (targetInnerPcs.length < 2 && targetInnerPcs.length > 0) targetInnerPcs.push(targetInnerPcs[0]);
    else if (targetInnerPcs.length === 0) {
      console.error('SATB: No target PCs for inner voices. Assigning root.');
      if (chordRootPc === undefined) return null; // Cannot proceed if chordRootPc is undefined
      targetInnerPcs = [chordRootPc, chordRootPc];
    }
  }
  if (targetInnerPcs.length > 2) {
    targetInnerPcs = neededPcs.concat(pcsToDouble).slice(0, 2);
  }
   if (targetInnerPcs.length < 2) { // Final safety
    console.error(`SATB: Could not determine two target PCs. Got: ${targetInnerPcs}`);
    return null;
  }


  const pc1 = targetInnerPcs[0];
  const pc2 = targetInnerPcs[1];
  let altoTargetPc: number;
  let tenorTargetPc: number;

  const dist1Alto = previousAltoMidi !== null ? Math.min(Math.abs(pc1 - (previousAltoMidi % 12)), 12 - Math.abs(pc1 - (previousAltoMidi % 12))) : 6;
  const dist2Alto = previousAltoMidi !== null ? Math.min(Math.abs(pc2 - (previousAltoMidi % 12)), 12 - Math.abs(pc2 - (previousAltoMidi % 12))) : 6;
  const dist1Tenor = previousTenorMidi !== null ? Math.min(Math.abs(pc1 - (previousTenorMidi % 12)), 12 - Math.abs(pc1 - (previousTenorMidi % 12))) : 6;
  const dist2Tenor = previousTenorMidi !== null ? Math.min(Math.abs(pc2 - (previousTenorMidi % 12)), 12 - Math.abs(pc2 - (previousTenorMidi % 12))) : 6;

  if (dist1Alto + dist2Tenor <= dist2Alto + dist1Tenor) {
    altoTargetPc = pc1;
    tenorTargetPc = pc2;
  } else {
    altoTargetPc = pc2;
    tenorTargetPc = pc1;
  }
  return { altoTargetPc, tenorTargetPc };
}

/**
 * Assigns a single inner voice (Alto or Tenor) based on target PC, range, and constraints.
 * @param voiceName Name of the voice ("Alto" or "Tenor") for logging.
 * @param targetPc The target pitch class for this voice.
 * @param referenceMidi The MIDI note to aim for (e.g., from previous note or range center).
 * @param previousNoteMidi MIDI of this voice in the previous chord.
 * @param minRange Minimum MIDI note for this voice's range.
 * @param maxRange Maximum MIDI note for this voice's range.
 * @param fullChordNotePool All available MIDI notes for the current chord.
 * @param smoothness Smoothness preference (0-10).
 * @param constraintChecks Array of functions that take a MIDI note and return true if valid.
 * @param allowAnyPcIfTargetFails If true, will use any allowed note if targetPc yields no options.
 * @returns The chosen MIDI note or null.
 */
function _assignSingleInnerVoice(
  voiceName: 'Alto' | 'Tenor',
  targetPc: number,
  referenceMidi: number,
  previousNoteMidi: number | null,
  minRange: number,
  maxRange: number,
  fullChordNotePool: number[],
  smoothness: number,
  constraintChecks: ((noteMidi: number) => boolean)[],
  allowAnyPcIfTargetFails: boolean = true,
): number | null {
  let candidateNotes = fullChordNotePool.filter(
    (n) =>
      n >= minRange &&
      n <= maxRange &&
      constraintChecks.every((check) => check(n)),
  );

  if (candidateNotes.length === 0) {
    console.warn(`SATB ${voiceName}: No notes in range satisfy all constraints initially.`);
    // Option: could try relaxing constraints here, but for now, we'll let it fail if strict.
    // If we were to relax, we might remove one constraint at a time.
    return null;
  }

  let optionsForTargetPc = candidateNotes.filter((n) => n % 12 === targetPc);

  if (optionsForTargetPc.length === 0) {
    if (allowAnyPcIfTargetFails) {
      console.log(`SATB ${voiceName}: Target PC ${targetPc} not available within constraints. Trying any allowed note from remaining ${candidateNotes.length} candidates.`);
      optionsForTargetPc = candidateNotes; // Use any note that met constraints
    } else {
      console.log(`SATB ${voiceName}: Target PC ${targetPc} not available. Strict PC matching required, cannot assign.`);
      return null;
    }
  }

  if (optionsForTargetPc.length === 0) {
    console.warn(`SATB ${voiceName}: No suitable notes found even after considering any PC.`);
    return null;
  }

  let chosenMidi = findClosestNote(
    referenceMidi,
    optionsForTargetPc,
    previousNoteMidi,
    smoothness,
  );

  if (chosenMidi === null && optionsForTargetPc.length > 0) {
    console.error(`SATB ${voiceName}: findClosestNote returned null from ${optionsForTargetPc.length} candidates. Emergency: picking middle.`);
    chosenMidi = optionsForTargetPc[Math.floor(optionsForTargetPc.length / 2)];
  }

  return chosenMidi;
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
    console.warn('SATB: Cannot assign inner voices without valid soprano and bass.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  const targetPcs = _determineTargetInnerVoicePcs(
    chordPcs,
    bassNoteMidi,
    sopranoNoteMidi,
    keyDetails,
    previousAltoMidi,
    previousTenorMidi,
  );

  if (!targetPcs) {
    console.error('SATB: Could not determine target PCs for inner voices.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }
  const { altoTargetPc, tenorTargetPc } = targetPcs;

  const [altoMin, altoMax] = VOICE_RANGES.alto;
  const [tenorMin, tenorMax] = VOICE_RANGES.tenor;

  // --- Assign Alto ---
  const altoReferenceMidi = previousAltoMidi ?? (sopranoNoteMidi + bassNoteMidi) / 2;
  const altoConstraintChecks: ((noteMidi: number) => boolean)[] = [
    (n) => n < sopranoNoteMidi, // Below Soprano
    (n) => n > bassNoteMidi,   // Above Bass
    (n) => sopranoNoteMidi - n <= VOICE_SPACING_LIMIT_SATB.soprano_alto, // S-A spacing
  ];
  
  // Attempt with strict constraints first for Alto
  let altoNoteMidi = _assignSingleInnerVoice(
    'Alto',
    altoTargetPc,
    altoReferenceMidi,
    previousAltoMidi,
    altoMin, altoMax,
    fullChordNotePool,
    smoothness,
    altoConstraintChecks,
    false, // Initially, do not allow any PC if target fails for Alto
  );

  // If strict fails, try relaxing S-A spacing for Alto
  if (altoNoteMidi === null) {
    console.warn(`SATB Alto: Strict assignment failed. Relaxing S-A spacing constraint for Alto.`);
    const relaxedAltoConstraintChecks: ((noteMidi: number) => boolean)[] = [
        (n) => n < sopranoNoteMidi,
        (n) => n > bassNoteMidi,
    ];
    altoNoteMidi = _assignSingleInnerVoice(
        'Alto',
        altoTargetPc,
        altoReferenceMidi,
        previousAltoMidi,
        altoMin, altoMax,
        fullChordNotePool,
        smoothness,
        relaxedAltoConstraintChecks,
        true, // Now allow any PC if target fails with relaxed constraints
    );
  }


  if (altoNoteMidi === null) {
    console.error('SATB: Alto assignment failed even after relaxing S-A spacing.');
    return { tenorNoteMidi: null, altoNoteMidi: null };
  }

  // --- Assign Tenor ---
  const tenorReferenceMidi = previousTenorMidi ?? (altoNoteMidi + bassNoteMidi) / 2;
  const tenorConstraintChecks: ((noteMidi: number) => boolean)[] = [
    (n) => n < altoNoteMidi!, // Below chosen Alto
    (n) => n > bassNoteMidi,  // Above Bass
    (n) => altoNoteMidi! - n <= VOICE_SPACING_LIMIT_SATB.alto_tenor, // A-T spacing
    (n) => n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass,   // T-B spacing
  ];

  let tenorNoteMidi = _assignSingleInnerVoice(
    'Tenor',
    tenorTargetPc,
    tenorReferenceMidi,
    previousTenorMidi,
    tenorMin, tenorMax,
    fullChordNotePool,
    smoothness,
    tenorConstraintChecks,
    false, // Initially, do not allow any PC if target fails for Tenor
  );
  
  // If strict fails for Tenor, try relaxing A-T spacing
  if (tenorNoteMidi === null) {
      console.warn(`SATB Tenor: Strict assignment failed. Relaxing A-T spacing constraint for Tenor.`);
      const relaxedTenorConstraintChecks: ((noteMidi: number) => boolean)[] = [
          (n) => n < altoNoteMidi!,
          (n) => n > bassNoteMidi,
          (n) => n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass,
      ];
      tenorNoteMidi = _assignSingleInnerVoice(
          'Tenor',
          tenorTargetPc,
          tenorReferenceMidi,
          previousTenorMidi,
          tenorMin, tenorMax,
          fullChordNotePool,
          smoothness,
          relaxedTenorConstraintChecks,
          true, // Now allow any PC
      );
  }
  
  // Final check to ensure tenor is below alto, even after relaxations
  if (tenorNoteMidi !== null && tenorNoteMidi >= altoNoteMidi) {
      console.error(`SATB Tenor: Tenor ${midiToNoteName(tenorNoteMidi)} ended up >= Alto ${midiToNoteName(altoNoteMidi)}. Invalidating tenor.`);
      // Attempt to pick the next best option from the last set of candidates for tenor, strictly below alto
      const lastTenorCandidates = fullChordNotePool.filter(n => 
        n >= tenorMin && n <= tenorMax &&
        n < altoNoteMidi! && // Strictly below current alto
        n > bassNoteMidi && 
        n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass // Keep T-B
      );
      
      const tenorOptionsToUse = lastTenorCandidates.filter(n => n % 12 === tenorTargetPc).length > 0 
          ? lastTenorCandidates.filter(n => n % 12 === tenorTargetPc) 
          : lastTenorCandidates;

      if (tenorOptionsToUse.length > 0) {
          tenorNoteMidi = findClosestNote(
              tenorReferenceMidi,
              tenorOptionsToUse.filter(n => n < altoNoteMidi!), // Ensure it's from options strictly below new alto
              previousTenorMidi,
              smoothness
          );
           if (tenorNoteMidi !==null && tenorNoteMidi >= altoNoteMidi) tenorNoteMidi = null; // Final check
      } else {
          tenorNoteMidi = null;
      }
       if (tenorNoteMidi === null) {
         console.error(`SATB Tenor: Could not re-assign tenor below alto. Tenor remains null.`);
       }
  }


  return { tenorNoteMidi, altoNoteMidi };
}
