// src/rules.ts
import {
    PreviousNotesSATB,
    PreviousNotesMelodyAccompaniment,
    PreviousNotes,
} from './types';
import {
    VOICE_SPACING_LIMIT_SATB,
    MELODY_ACCOMPANIMENT_SPACING_LIMIT,
} from './constants';
import { midiToNoteName } from './harmonyUtils';

/** Checks for parallel 5ths and octaves between two voices (Helper for SATB/Melody-Bass). */
function checkParallels(
    voice1Prev: number | null,
    voice1Curr: number | null,
    voice2Prev: number | null,
    voice2Curr: number | null,
    part1Name: string,
    part2Name: string,
    loc: string, // Location string (e.g., M1:B1)
): void {
    if ([voice1Prev, voice1Curr, voice2Prev, voice2Curr].some(n => n === null)) return;

    const v1p = voice1Prev!;
    const v1c = voice1Curr!;
    const v2p = voice2Prev!;
    const v2c = voice2Curr!;

    // Skip if notes are identical (no motion)
    if (v1p === v1c && v2p === v2c) return;

    // Check for similar motion (optional, but common rule)
    const v1Direction = Math.sign(v1c - v1p);
    const v2Direction = Math.sign(v2c - v2p);
    // Only check classic parallels if moving in same direction (and not static)
    // if (v1Direction === 0 || v2Direction === 0 || v1Direction !== v2Direction) return;

    // Check all motion for simplicity/strictness here, ignore if no change in interval
    const intervalPrevSemi = Math.abs(v1p - v2p);
    const intervalCurrSemi = Math.abs(v1c - v2c);

    if (intervalPrevSemi === intervalCurrSemi && (v1p !== v1c || v2p !== v2c)) { // Interval is the same, and at least one voice moved
        const isP5 = intervalPrevSemi % 12 === 7;
        const isP8 = intervalPrevSemi % 12 === 0; // Includes P1

        if (isP5) {
            console.warn(
                `PARALLEL 5th (${part1Name}/${part2Name}) at ${loc}. Prev: ${midiToNoteName(v1p)}-${midiToNoteName(v2p)}, Curr: ${midiToNoteName(v1c)}-${midiToNoteName(v2c)}`,
            );
        } else if (isP8 && intervalPrevSemi > 0) { // Report P8, ignore P1 unless desired
             console.warn(
                `PARALLEL Octave (${part1Name}/${part2Name}) at ${loc}. Prev: ${midiToNoteName(v1p)}-${midiToNoteName(v2p)}, Curr: ${midiToNoteName(v1c)}-${midiToNoteName(v2c)}`,
            );
        }
    }
    // Could add checks for hidden/direct octaves/fifths if needed
}


/** Checks voice leading rules based on the generation style. */
export function checkVoiceLeadingRules(
    currentNotes: PreviousNotes,
    previousNotes: PreviousNotes | null, // Allow null for first beat
    style: 'SATB' | 'MelodyAccompaniment',
    measureIndex: number,
    beatIndex: number, // 0-based beat index within measure
    strictness: number, // Dissonance strictness (0-10)
): void {
    if (strictness <= 1 || previousNotes === null) return; // Skip checks if low strictness or first beat

    const loc = `M${measureIndex + 1}:B${beatIndex + 1}`;

    if (style === 'SATB') {
        const current = currentNotes as PreviousNotesSATB;
        const prev = previousNotes as PreviousNotesSATB; // Safe now due to null check above
        const { soprano, alto, tenor, bass } = current;
        const { soprano: pSop, alto: pAlt, tenor: pTen, bass: pBas } = prev;

        if (soprano === null || alto === null || tenor === null || bass === null) return;

        // Voice Crossing
        if (alto > soprano) console.warn(`SATB Crossing: A>S at ${loc}`);
        if (tenor > alto) console.warn(`SATB Crossing: T>A at ${loc}`);
        if (bass > tenor) console.warn(`SATB Crossing: B>T at ${loc}`);

        // Voice Spacing
        if (strictness >= 4) {
            if (soprano - alto > VOICE_SPACING_LIMIT_SATB.soprano_alto) console.warn(`SATB Spacing > P8 S/A at ${loc}`);
            if (alto - tenor > VOICE_SPACING_LIMIT_SATB.alto_tenor) console.warn(`SATB Spacing > P8 A/T at ${loc}`);
        }
        if (strictness >= 6) {
             if (tenor - bass > VOICE_SPACING_LIMIT_SATB.tenor_bass) console.warn(`SATB Spacing > P12 T/B at ${loc}`);
        }

        // Parallel Motion Checks
        if (strictness >= 7) {
            checkParallels(pSop, soprano, pAlt, alto, 'S', 'A', loc);
            checkParallels(pSop, soprano, pTen, tenor, 'S', 'T', loc);
            checkParallels(pSop, soprano, pBas, bass, 'S', 'B', loc);
            checkParallels(pAlt, alto, pTen, tenor, 'A', 'T', loc);
            checkParallels(pAlt, alto, pBas, bass, 'A', 'B', loc);
            checkParallels(pTen, tenor, pBas, bass, 'T', 'B', loc);
        }
    } else { // MelodyAccompaniment Style
        const current = currentNotes as PreviousNotesMelodyAccompaniment;
        const prev = previousNotes as PreviousNotesMelodyAccompaniment;
        const { melody, accompaniment } = current;
        const { melody: pMel, accompaniment: pAcc } = prev;

        if (melody === null || accompaniment.some(n => n === null)) return;

        const highestAccomp = accompaniment[accompaniment.length - 1]!; // Already checked for nulls
        const lowestAccomp = accompaniment[0]!;

        // Voice Crossing (Melody vs Accompaniment)
        if (highestAccomp >= melody) console.warn(`Melody/Acc Crossing: High Accomp >= Melody at ${loc}`);

        // Spacing (Melody vs Accompaniment)
        if (strictness >= 5) {
            if (melody - highestAccomp > MELODY_ACCOMPANIMENT_SPACING_LIMIT) {
                console.warn(`Melody/Acc Spacing > ${MELODY_ACCOMPANIMENT_SPACING_LIMIT} semitones at ${loc}`);
            }
        }

        // Parallel motion between melody and bass (lowest accompaniment)
        if (strictness >= 8) {
            const pLowestAccomp = pAcc[0];
            checkParallels(pMel, melody, pLowestAccomp, lowestAccomp, 'Melody', 'Bass(Acc)', loc);
        }
    }
}