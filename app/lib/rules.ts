// src/rules.ts
import {
    PreviousNotesSATB,
    PreviousNotesMelodyAccompaniment,
    PreviousNotes,
    GenerationStyle, // Import GenerationStyle for use in checkVoiceLeadingRules
} from './types';
import {
    VOICE_SPACING_LIMIT_SATB,
    MELODY_ACCOMPANIMENT_SPACING_LIMIT,
} from './constants';
import { midiToNoteName } from './harmonyUtils';

/**
 * Checks for parallel perfect fifths and octaves between two voices moving from a previous
 * set of notes to a current set. It only flags parallels if both voices move in the
 * same direction and maintain the same interval (P5 or P8).
 *
 * This is a helper function primarily used by `checkVoiceLeadingRules`.
 *
 * @param {number | null} voice1Prev - The MIDI note of the first voice in the previous chord/event.
 * @param {number | null} voice1Curr - The MIDI note of the first voice in the current chord/event.
 * @param {number | null} voice2Prev - The MIDI note of the second voice in the previous chord/event.
 * @param {number | null} voice2Curr - The MIDI note of the second voice in the current chord/event.
 * @param {string} part1Name - The name of the first voice/part (e.g., "Soprano", "Melody").
 * @param {string} part2Name - The name of the second voice/part (e.g., "Alto", "Bass(Acc)").
 * @param {string} loc - A location string (e.g., "M1:B1") for logging where the potential parallel occurred.
 */
function checkParallels(
    voice1Prev: number | null,
    voice1Curr: number | null,
    voice2Prev: number | null,
    voice2Curr: number | null,
    part1Name: string,
    part2Name: string,
    loc: string,
): void {
    // Ensure all notes are present to check for parallels
    if ([voice1Prev, voice1Curr, voice2Prev, voice2Curr].some(n => n === null)) {
        return;
    }

    // Non-null assertion operator (!) is safe here due to the check above.
    const v1p = voice1Prev!; 
    const v1c = voice1Curr!;
    const v2p = voice2Prev!;
    const v2c = voice2Curr!;

    // Skip if notes are identical (no motion)
    if (v1p === v1c && v2p === v2c) return;

    // Check for similar motion (optional, but common rule)
    const v1Direction = Math.sign(v1c - v1p);
    const v2Direction = Math.sign(v2c - v2p);
    // Determine direction of movement for each voice.
    const v1Direction = Math.sign(v1c - v1p);
    const v2Direction = Math.sign(v2c - v2p);

    // Classic parallel motion requires both voices to move in the same direction.
    // If either voice is static (direction 0) or they move in contrary/oblique motion,
    // it's not considered parallel motion for P5s/P8s in the traditional sense.
    if (v1Direction === 0 || v2Direction === 0 || v1Direction !== v2Direction) {
        return;
    }

    // Calculate the interval in semitones for previous and current notes.
    const intervalPrevSemi = Math.abs(v1p - v2p);
    const intervalCurrSemi = Math.abs(v1c - v2c);

    // Check if the interval remained the same and is a perfect 5th or octave.
    if (intervalPrevSemi === intervalCurrSemi) {
        const isPerfectFifth = intervalPrevSemi % 12 === 7; // 7 semitones = P5
        const isPerfectOctaveOrUnison = intervalPrevSemi % 12 === 0; // 0 semitones = P1/P8/P15...

        if (isPerfectFifth) {
            console.warn(
                `VOICE LEADING: Parallel 5th between ${part1Name} and ${part2Name} at ${loc}. ` +
                `Prev: ${midiToNoteName(v1p)} (${v1p})-${midiToNoteName(v2p)} (${v2p}), ` +
                `Curr: ${midiToNoteName(v1c)} (${v1c})-${midiToNoteName(v2c)} (${v2c}).`
            );
        } else if (isPerfectOctaveOrUnison && intervalPrevSemi > 0) { // intervalPrevSemi > 0 excludes parallel unisons if not desired.
            console.warn(
                `VOICE LEADING: Parallel Octave between ${part1Name} and ${part2Name} at ${loc}. ` +
                `Prev: ${midiToNoteName(v1p)} (${v1p})-${midiToNoteName(v2p)} (${v2p}), ` +
                `Curr: ${midiToNoteName(v1c)} (${v1c})-${midiToNoteName(v2c)} (${v2c}).`
            );
        }
    }
    // TODO: Could potentially add checks for hidden/direct octaves/fifths if more advanced rules are needed.
}


/**
 * Checks various voice leading rules based on the specified generation style (SATB or MelodyAccompaniment).
 * This includes checks for voice crossing, spacing between voices, and parallel motion (fifths and octaves).
 * Warnings are logged to the console if rule violations are detected. The strictness of these checks
 * can be controlled by the `strictness` parameter.
 *
 * @param {PreviousNotes} currentNotes - An object containing the MIDI notes of all voices/parts for the current musical event.
 * @param {PreviousNotes | null} previousNotes - An object containing the MIDI notes from the immediately preceding event.
 *                                            If `null` (e.g., for the very first event), parallel motion checks are skipped.
 * @param {GenerationStyle} style - The musical style being generated ('SATB' or 'MelodyAccompaniment'),
 *                                  which determines which set of rules to apply.
 * @param {number} measureIndex - The 0-based index of the current measure, used for logging.
 * @param {number} beatIndex - The 0-based index of the current beat or event within the measure, used for logging.
 * @param {number} strictness - A value from 0 to 10 indicating the strictness of rule enforcement.
 *                              Higher values enable more checks or more stringent limits.
 *                              If `strictness` is 1 or less, most checks are skipped.
 */
export function checkVoiceLeadingRules(
    currentNotes: PreviousNotes,
    previousNotes: PreviousNotes | null,
    style: GenerationStyle,
    measureIndex: number,
    beatIndex: number,
    strictness: number,
): void {
    // Skip all checks if strictness is very low or if there's no previous context.
    if (strictness <= 1 || previousNotes === null) {
        return;
    }

    const loc = `M${measureIndex + 1}:B${beatIndex + 1}`; // Location string for log messages

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