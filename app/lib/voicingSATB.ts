// src/voicingSATB.ts
import * as Tonal from 'tonal';
import { VOICE_RANGES, VOICE_SPACING_LIMIT_SATB, DEFAULT_OCTAVE } from './constants';
import { findClosestNote } from './voicingUtils';
import { midiToNoteName } from './harmonyUtils';

/** Assigns a MIDI note for the Bass voice (SATB context). */
export function assignBassNoteSATB(
    chordRootMidi: number,
    chordNotesPool: number[],
    previousBassMidi: number | null,
    smoothness: number,
): number | null {
    const [minRange, maxRange] = VOICE_RANGES.bass;
    const allowedBassNotes = chordNotesPool.filter(
        (n) => n >= minRange && n <= maxRange,
    ).sort((a, b) => a - b); // Sort here

    if (allowedBassNotes.length === 0) {
        console.warn('SATB: No valid bass notes found in range.');
        return null;
    }

    const rootNotePc = chordRootMidi % 12;
    const rootOptions = allowedBassNotes.filter((n) => n % 12 === rootNotePc);
    const targetMidi = previousBassMidi !== null ? previousBassMidi - 1 : chordRootMidi;

    if (rootOptions.length > 0) {
        return findClosestNote(targetMidi, rootOptions, previousBassMidi, smoothness, 9);
    } else {
        const noteName = midiToNoteName(chordRootMidi);
        const pc = noteName ? Tonal.Note.pitchClass(noteName) : 'N/A';
        console.log(`SATB: Root note PC (${pc}) not available in bass range. Choosing best alternative.`);
        return findClosestNote(targetMidi, allowedBassNotes, previousBassMidi, smoothness, 9);
    }
}

/** Assigns MIDI notes for the Alto and Tenor voices (SATB context). */
export function assignInnerVoicesSATB(
    chordPcs: number[],
    fullChordNotePool: number[],
    previousTenorMidi: number | null,
    previousAltoMidi: number | null,
    sopranoNoteMidi: number | null,
    bassNoteMidi: number | null,
    smoothness: number,
    keyDetails: Tonal.Key.Key, // Assuming Key type from Tonal
): { tenorNoteMidi: number | null; altoNoteMidi: number | null } {
     if (sopranoNoteMidi === null || bassNoteMidi === null) {
        console.warn('SATB: Cannot assign inner voices without valid soprano and bass.');
        return { tenorNoteMidi: null, altoNoteMidi: null };
    }

    // --- Doubling Logic ---
    let currentVoicingPcs = new Set<number>([bassNoteMidi % 12, sopranoNoteMidi % 12]);
    let neededPcs = chordPcs.filter((pc) => !currentVoicingPcs.has(pc));
    let pcsToDouble: number[] = [];
    const voicesToFill = 2;

    const chordRootMidiGuess = Tonal.Note.midi(keyDetails.tonic + DEFAULT_OCTAVE);
    const chordRootPc = chordRootMidiGuess !== null ? chordRootMidiGuess % 12 : -1;
    const leadingToneMidiGuess = Tonal.Note.midi(Tonal.transpose(keyDetails.tonic + DEFAULT_OCTAVE, 'M7') ?? '');
    const leadingTonePc = leadingToneMidiGuess !== null ? leadingToneMidiGuess % 12 : -1;

    if (neededPcs.length < voicesToFill) {
        const numDoublingsNeeded = voicesToFill - neededPcs.length;
        const potentialDoubles: number[] = [];
        // 1. Root (if not LT)
        if (chordRootPc !== -1 && chordRootPc !== leadingTonePc) potentialDoubles.push(chordRootPc);
        // 2. Fifth (if not LT)
        const fifthMidi = Tonal.Note.midi(Tonal.transpose(keyDetails.tonic + DEFAULT_OCTAVE, 'P5') ?? '');
        const fifthPc = fifthMidi !== null ? fifthMidi % 12 : -1;
        if (fifthPc !== -1 && fifthPc !== leadingTonePc && chordPcs.includes(fifthPc)) potentialDoubles.push(fifthPc);
        // 3. Third (if not LT)
        const thirdPc = chordPcs.find(pc => pc !== chordRootPc && pc !== fifthPc);
        if (thirdPc !== undefined && thirdPc !== leadingTonePc) potentialDoubles.push(thirdPc);

        for (const pc of potentialDoubles) {
            if (pcsToDouble.length < numDoublingsNeeded && !neededPcs.includes(pc) && !pcsToDouble.includes(pc)) {
                 pcsToDouble.push(pc);
            }
        }
        // Fallback doubling
        while (pcsToDouble.length < numDoublingsNeeded) {
             const fallbackPc = potentialDoubles.find(pc => !pcsToDouble.includes(pc)) // Try unused preferred doubles first
                                ?? chordPcs.find(pc => pc !== leadingTonePc && !pcsToDouble.includes(pc)) // Then any chord tone not LT
                                ?? chordRootPc; // Absolute fallback: root
             if (fallbackPc !== -1) {
                 pcsToDouble.push(fallbackPc);
                 console.warn(`SATB: Emergency doubling PC ${fallbackPc}`);
             } else {
                  console.error('SATB: Cannot find any PC to double!'); break;
             }
              if(pcsToDouble.length > 5) break; // Safety
        }
    }

    let targetInnerPcs = [...neededPcs, ...pcsToDouble];
     if (targetInnerPcs.length < 2) {
         console.warn(`SATB: Only ${targetInnerPcs.length} target PCs for inner voices. Adding fallback.`);
         const fallbackPc = chordRootPc !== -1 && chordRootPc !== leadingTonePc ? chordRootPc : chordPcs.find(pc => pc !== leadingTonePc) ?? chordPcs[0];
         if (fallbackPc !== undefined && !targetInnerPcs.includes(fallbackPc)) targetInnerPcs.push(fallbackPc);
         if (targetInnerPcs.length < 2 && chordPcs[0] !== undefined) targetInnerPcs.push(chordPcs[0]); // Absolute fallback
     }
    targetInnerPcs = targetInnerPcs.slice(0, 2);

    const altoTargetPc = targetInnerPcs[0];
    const tenorTargetPc = targetInnerPcs[1];

    // --- Filter Notes by Range and Spacing ---
    const [altoMin, altoMax] = VOICE_RANGES.alto;
    const [tenorMin, tenorMax] = VOICE_RANGES.tenor;

    let allowedAltoNotes = fullChordNotePool.filter(n =>
        n >= altoMin && n <= altoMax && n < sopranoNoteMidi && n > bassNoteMidi &&
        (sopranoNoteMidi - n <= VOICE_SPACING_LIMIT_SATB.soprano_alto)
    ).sort((a,b)=> a-b);

    let allowedTenorNotesBase = fullChordNotePool.filter(n =>
        n >= tenorMin && n <= tenorMax && n > bassNoteMidi &&
        (n - bassNoteMidi <= VOICE_SPACING_LIMIT_SATB.tenor_bass)
    ).sort((a,b)=> a-b);


    // --- Assign Voices ---
    let altoNoteMidi: number | null = null;
    let tenorNoteMidi: number | null = null;

    const altoTargetMidi = previousAltoMidi !== null ? previousAltoMidi : (sopranoNoteMidi + bassNoteMidi) / 2;
    const tenorTargetMidiEst = previousTenorMidi !== null ? previousTenorMidi : (altoTargetMidi + bassNoteMidi) / 2;


    // Try assigning Alto first
     let altoOptionsToUse = allowedAltoNotes.filter(n => n % 12 === altoTargetPc);
     if (altoOptionsToUse.length === 0) altoOptionsToUse = allowedAltoNotes; // Use any if target PC not available

     if (altoOptionsToUse.length === 0) {
         console.warn(`SATB: No valid notes for Alto (Target PC: ${altoTargetPc}) meeting constraints. Relaxing S-A.`);
          altoOptionsToUse = fullChordNotePool.filter(n => n >= altoMin && n <= altoMax && n < sopranoNoteMidi && n > bassNoteMidi).sort((a,b)=> a-b);
          if (altoOptionsToUse.length === 0) { console.error('SATB: Still no Alto notes. Cannot assign.'); return { tenorNoteMidi: null, altoNoteMidi: null }; }
     }

     altoNoteMidi = findClosestNote(altoTargetMidi, altoOptionsToUse, previousAltoMidi, smoothness);

     if (altoNoteMidi === null) {
         console.error('SATB: Failed to select an Alto note.');
         altoNoteMidi = altoOptionsToUse[Math.floor(altoOptionsToUse.length / 2)] ?? null; // Fallback pick
         if (altoNoteMidi === null) return { tenorNoteMidi: null, altoNoteMidi: null };
     }

    // Now Assign Tenor, constrained by chosen Alto
    let allowedTenorNotes = allowedTenorNotesBase.filter(n =>
        n < altoNoteMidi! &&
        (altoNoteMidi! - n <= VOICE_SPACING_LIMIT_SATB.alto_tenor)
    );

    let tenorOptionsToUse = allowedTenorNotes.filter(n => n % 12 === tenorTargetPc);
     if (tenorOptionsToUse.length === 0) tenorOptionsToUse = allowedTenorNotes;

    if (tenorOptionsToUse.length === 0) {
         console.warn(`SATB: No valid notes for Tenor (Target PC: ${tenorTargetPc}) below Alto ${midiToNoteName(altoNoteMidi)}. Relaxing A-T.`);
         tenorOptionsToUse = allowedTenorNotesBase.filter(n => n < altoNoteMidi!); // Just filter by being below alto
          if (tenorOptionsToUse.length === 0) {
             console.error(`SATB: Still no Tenor notes below Alto ${midiToNoteName(altoNoteMidi)}. Cannot assign Tenor.`);
             return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi }; // Return valid Alto
         }
     }

    const tenorTargetMidi = previousTenorMidi !== null ? previousTenorMidi : (altoNoteMidi! + bassNoteMidi) / 2; // Refine target
    tenorNoteMidi = findClosestNote(tenorTargetMidi, tenorOptionsToUse, previousTenorMidi, smoothness);

     if (tenorNoteMidi === null) {
        console.error('SATB: Failed to select a Tenor note.');
        tenorNoteMidi = tenorOptionsToUse[tenorOptionsToUse.length - 1] ?? null; // Fallback pick highest valid
        if (tenorNoteMidi === null) return { tenorNoteMidi: null, altoNoteMidi: altoNoteMidi };
    }

    // Final check
     if (tenorNoteMidi >= altoNoteMidi) {
         console.error(`SATB INTERNAL ERROR: Tenor ${midiToNoteName(tenorNoteMidi)} >= Alto ${midiToNoteName(altoNoteMidi)}. Invalidating Tenor.`);
         tenorNoteMidi = null;
     }

    return { tenorNoteMidi, altoNoteMidi };
}