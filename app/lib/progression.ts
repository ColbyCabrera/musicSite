// src/progression.ts
import * as Tonal from 'tonal';

/**
 * Generates a simple chord progression based on tonal harmony tendencies.
 * @param key - The key signature (e.g., "C", "Gm").
 * @param numMeasures - The desired number of measures (and chords).
 * @param harmonicComplexity - A value (0-10) influencing chord choices.
 * @returns An array of Roman numeral chord symbols.
 */
export function generateChordProgression(
    key: string,
    numMeasures: number,
    harmonicComplexity: number, // 0-10
): string[] {
     if (numMeasures <= 0) return [];

     harmonicComplexity = Math.max(0, Math.min(10, harmonicComplexity));

     let keyDetails = Tonal.Key.majorKey(key) ?? Tonal.Key.minorKey(key);

     if (!keyDetails) {
         console.error(`Invalid key "${key}". Defaulting to "C".`);
         return key === 'C' ? ['I'] : generateChordProgression('C', numMeasures, harmonicComplexity); // Prevent infinite loop
     }

     const isMajor = keyDetails.type === 'major';
     // Define common Roman numerals
     const tonicRoman = isMajor ? 'I' : 'i';
     const dominantRoman = 'V';
     const dominant7Roman = 'V7';
     const subdominantRoman = isMajor ? 'IV' : 'iv';
     const supertonicRoman = isMajor ? 'ii' : 'ii°';
     const mediantRoman = isMajor ? 'iii' : 'III'; // Using natural minor III for simplicity, could be III+ in harmonic
     const submediantRoman = isMajor ? 'vi' : 'VI';
     const leadingToneRoman = isMajor ? 'vii°' : 'vii°'; // Common vii° for both (from harmonic minor)

     // Chord pools based on complexity
     const primaryChords = [tonicRoman, subdominantRoman, dominantRoman];
     const secondaryChords = [submediantRoman, supertonicRoman];
     const complexChords = [mediantRoman, leadingToneRoman];

     let allowedChords = [...primaryChords];
     if (harmonicComplexity >= 3) allowedChords.push(...secondaryChords);
     if (harmonicComplexity >= 6) allowedChords.push(...complexChords);

    // Add V7 based on complexity
    if (harmonicComplexity >= 4) {
         if (allowedChords.includes(dominantRoman)) {
             allowedChords = allowedChords.map(c => c === dominantRoman ? dominant7Roman : c);
         } else if (!allowedChords.includes(dominant7Roman)) {
             allowedChords.push(dominant7Roman);
         }
     }
     // Add vii°7 based on complexity
     if (harmonicComplexity >= 8 && allowedChords.includes(leadingToneRoman)) {
         allowedChords = allowedChords.map(c => c === leadingToneRoman ? 'vii°7' : c);
     }

     allowedChords = Array.from(new Set(allowedChords));
     if (allowedChords.length === 0) allowedChords = [tonicRoman];

     let progression: string[] = [tonicRoman];
     let prevChord = tonicRoman;
     const MAX_ATTEMPTS_PER_CHORD = 10;

    // Generate Intermediate Chords
     for (let i = 1; i < numMeasures - 1; i++) {
         let nextChord: string | undefined = undefined;
         let attempts = 0;

        do {
            let candidates = [...allowedChords];
             if (candidates.length > 1) { // Avoid repeats if possible
                 candidates = candidates.filter(c => c !== prevChord);
             }
             if (candidates.length === 0) candidates = [prevChord];

            // --- Basic Functional Tendencies ---
             const prevIsDominant = [dominantRoman, dominant7Roman, leadingToneRoman, 'vii°7'].includes(prevChord);
             const prevIsSubdominant = [subdominantRoman, supertonicRoman].includes(prevChord);
             const prevIsTonicSubstitute = [submediantRoman].includes(prevChord);

            let preferredTargets: string[] = [];
            if (prevIsDominant) preferredTargets = [tonicRoman, submediantRoman]; // D -> T or deceptive
            else if (prevIsSubdominant) preferredTargets = [dominantRoman, dominant7Roman, tonicRoman, submediantRoman]; // S -> D or T or deceptive-like
            else if (prevIsTonicSubstitute) preferredTargets = [subdominantRoman, supertonicRoman, dominantRoman, dominant7Roman]; // vi -> S or D
            else preferredTargets = allowedChords.filter(c => c !== tonicRoman); // T -> anywhere else

             const targetedCandidates = candidates.filter(c => preferredTargets.includes(c));
             let finalCandidates = candidates; // Start with non-repeated options

             if (targetedCandidates.length > 0) {
                 // Bias towards preferred targets
                 const useTargetProb = 0.6 + harmonicComplexity * 0.03;
                 if (Math.random() < useTargetProb) {
                     finalCandidates = targetedCandidates;
                 } else {
                     // Allow non-targeted occasionally
                      const nonTargeted = candidates.filter(c => !preferredTargets.includes(c));
                      if (nonTargeted.length > 0 && Math.random() < 0.3) {
                          finalCandidates = nonTargeted;
                      }
                 }
             }

             // Ensure we have *some* candidates if filtering removed everything
             if (finalCandidates.length === 0) finalCandidates = candidates.length > 0 ? candidates : [prevChord];


             nextChord = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
             attempts++;
         } while (attempts < MAX_ATTEMPTS_PER_CHORD && nextChord === undefined);

         if (nextChord === undefined) { // Fallback if loop failed
             console.warn(`Progression: Could not determine next chord. Choosing random allowed.`);
             nextChord = allowedChords[Math.floor(Math.random() * allowedChords.length)];
         }

        progression.push(nextChord);
        prevChord = nextChord;
    }

     // --- Cadence ---
     if (numMeasures > 1) {
         const penultimateOptions = [dominant7Roman, dominantRoman].filter(c => allowedChords.includes(c));
         let penultimateChord = penultimateOptions.length > 0 ? penultimateOptions[0] : null;

         if (!penultimateChord) { // Try Plagal if V not allowed
             const plagalOption = [subdominantRoman].find(c => allowedChords.includes(c));
             if (plagalOption) penultimateChord = plagalOption;
         }
         if (!penultimateChord) penultimateChord = tonicRoman; // Fallback to Tonic

        if (numMeasures === 2) {
            progression[0] = penultimateChord === tonicRoman ? progression[0] : penultimateChord; // Avoid T-T if possible
             progression[1] = tonicRoman;
         } else { // numMeasures > 2
            progression[numMeasures - 2] = penultimateChord;
            progression[numMeasures - 1] = tonicRoman;
         }
     } else if (numMeasures === 1) {
         progression[0] = tonicRoman;
     }

    console.log(`Generated Progression (${key}, complexity ${harmonicComplexity}): ${progression.join(' | ')}`);
    return progression;
}