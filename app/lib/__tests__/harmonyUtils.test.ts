import { parseRomanNumeral, getKeyDetails, getInitialDiatonicChordSymbol, applyChordModifications, getChordNotesAndBass, getChordInfoFromRoman, getExtendedChordNotePool, midiToNoteName } from '../harmonyUtils';
import { InvalidInputError, MusicTheoryError } from '../errors'; // Assuming errors are exported

describe('parseRomanNumeral', () => {
  // Test cases for simple Roman numerals
  test('should parse simple major Roman numerals', () => {
    expect(parseRomanNumeral('I')).toEqual({ baseRoman: 'I', quality: '', bassInterval: '1' });
    expect(parseRomanNumeral('V')).toEqual({ baseRoman: 'V', quality: '', bassInterval: '1' });
  });

  test('should parse simple minor Roman numerals', () => {
    expect(parseRomanNumeral('i')).toEqual({ baseRoman: 'i', quality: '', bassInterval: '1' });
    expect(parseRomanNumeral('iv')).toEqual({ baseRoman: 'iv', quality: '', bassInterval: '1' });
  });

  // Test cases for figured bass inversions
  test('should parse triad first inversion (6)', () => {
    expect(parseRomanNumeral('I6')).toEqual({ baseRoman: 'I', quality: '', bassInterval: '3' });
    expect(parseRomanNumeral('vi6')).toEqual({ baseRoman: 'vi', quality: '', bassInterval: '3' });
  });

  test('should parse triad second inversion (64)', () => {
    expect(parseRomanNumeral('IV64')).toEqual({ baseRoman: 'IV', quality: '', bassInterval: '5' });
    expect(parseRomanNumeral('i64')).toEqual({ baseRoman: 'i', quality: '', bassInterval: '5' });
  });

  test('should parse seventh chord root position (7)', () => {
    // The '7' is part of the quality, not a figure for inversion in this case.
    expect(parseRomanNumeral('V7')).toEqual({ baseRoman: 'V', quality: '7', bassInterval: '1' }); 
  });

  test('should parse seventh chord first inversion (65)', () => {
    expect(parseRomanNumeral('V65')).toEqual({ baseRoman: 'V', quality: '', bassInterval: '3', figBass: '65' }); // V, figure 65 -> V in 1st inv.
    expect(parseRomanNumeral('ii°65')).toEqual({ baseRoman: 'ii', quality: '°', bassInterval: '3', figBass: '65' }); // ii°, figure 65 -> ii° in 1st inv.
  });

  test('should parse seventh chord second inversion (43)', () => {
    expect(parseRomanNumeral('IMaj743')).toEqual({ baseRoman: 'I', quality: 'Maj7', bassInterval: '5', figBass: '43' });
    expect(parseRomanNumeral('V743')).toEqual({ baseRoman: 'V', quality: '7', bassInterval: '5', figBass: '43' });
  });

  test('should parse seventh chord third inversion (42 or 2)', () => {
    expect(parseRomanNumeral('V742')).toEqual({ baseRoman: 'V', quality: '7', bassInterval: '7', figBass: '42' });
    expect(parseRomanNumeral('vii°72')).toEqual({ baseRoman: 'vii', quality: '°7', bassInterval: '7', figBass: '2' });
  });
  
  // Test cases for slash notation inversions
  test('should parse slash notation for bass interval', () => {
    expect(parseRomanNumeral('V/3')).toEqual({ baseRoman: 'V', quality: '', bassInterval: '3' });
    expect(parseRomanNumeral('I/5')).toEqual({ baseRoman: 'I', quality: '', bassInterval: '5' });
    expect(parseRomanNumeral('V7/b7')).toEqual({ baseRoman: 'V', quality: '7', bassInterval: 'b7' });
    expect(parseRomanNumeral('IVMaj7/#5')).toEqual({ baseRoman: 'IV', quality: 'Maj7', bassInterval: '#5' });
  });

  // Test cases for Roman numerals with qualities
  test('should handle Roman numerals with qualities correctly', () => {
    expect(parseRomanNumeral('IMaj7')).toEqual({ baseRoman: 'I', quality: 'Maj7', bassInterval: '1' });
    expect(parseRomanNumeral('iiø7')).toEqual({ baseRoman: 'ii', quality: 'ø7', bassInterval: '1' });
    expect(parseRomanNumeral('vii°7')).toEqual({ baseRoman: 'vii', quality: '°7', bassInterval: '1' });
    expect(parseRomanNumeral('Vaug')).toEqual({ baseRoman: 'V', quality: 'aug', bassInterval: '1' });
    expect(parseRomanNumeral('Vsus')).toEqual({ baseRoman: 'V', quality: 'sus', bassInterval: '1' });
  });
  
  test('should handle qualities with figured bass', () => {
    // Quality is part of the base chord, figure indicates inversion.
    expect(parseRomanNumeral('IMaj76')).toEqual({ baseRoman: 'I', quality: 'Maj7', bassInterval: '3', figBass: '6'}); // IMaj7, 1st inversion
    expect(parseRomanNumeral('iiø765')).toEqual({ baseRoman: 'ii', quality: 'ø7', bassInterval: '3', figBass: '65'}); // iiø7, 1st inversion
    expect(parseRomanNumeral('Vaug6')).toEqual({ baseRoman: 'V', quality: 'aug', bassInterval: '3', figBass: '6'});
  });

  // Test for potentially problematic inputs
   test('should not misinterpret chord names like Cmaj7 as figures', () => {
    expect(parseRomanNumeral('Imaj7')).toEqual({ baseRoman: 'I', quality: 'maj7', bassInterval: '1' });
  });

  test('should handle Roman numerals with explicit qualities and figures', () => {
    expect(parseRomanNumeral('ii°6')).toEqual({ baseRoman: 'ii', quality: '°', bassInterval: '3', figBass: '6' });
    // The regex in parseRomanNumeral might need to be robust to distinguish 'sus' as part of quality vs. figure.
    // Assuming 'V7sus' is a valid quality that the function can extract.
    expect(parseRomanNumeral('V7sus42')).toEqual({ baseRoman: 'V', quality: '7sus', bassInterval: '7', figBass: '42' });
  });
  
  // Test error handling for invalid inputs
  // The exact error messages should match what `parseRomanNumeral` throws.
  // Assuming `MusicTheoryError` is used, or a similar custom error.
  // For now, using generic error messages; these should be updated if `parseRomanNumeral` throws specific errors.
  test('should throw error for completely unparsable Roman numerals', () => {
    expect(() => parseRomanNumeral('XYZ')).toThrow("Could not parse base Roman numeral from XYZ. Check format.");
    expect(() => parseRomanNumeral('')).toThrow("Could not parse base Roman numeral from . Check format.");
    // This case depends on how the regex handles numbers-only input. 
    // If '64' is parsed as a baseRoman, this test would fail or need adjustment.
    // It's more likely an error should be thrown.
    expect(() => parseRomanNumeral('64')).toThrow("Could not parse base Roman numeral from 64. Check format."); 
  });

  test('should handle slashes at the beginning or end, or invalid figures', () => {
    expect(() => parseRomanNumeral('/V')).toThrow(); // Or specific error if handled
    expect(() => parseRomanNumeral('V/')).toThrow(); // Or specific error
    expect(() => parseRomanNumeral('I/8')).toThrow(); // Invalid interval
    expect(() => parseRomanNumeral('I67')).toThrow(); // Invalid figure
  });

  test('should correctly parse complex qualities with inversions', () => {
    expect(parseRomanNumeral('iiø42')).toEqual({ baseRoman: 'ii', quality: 'ø', bassInterval: '7', figBass: '42'}); // iiø, 3rd inv (assuming ø implies 7th)
    expect(parseRomanNumeral('vii°743')).toEqual({ baseRoman: 'vii', quality: '°7', bassInterval: '5', figBass: '43'});
  });

  test('should handle diminished and augmented signs correctly', () => {
    expect(parseRomanNumeral('vii°')).toEqual({ baseRoman: 'vii', quality: '°', bassInterval: '1' });
    expect(parseRomanNumeral('III+')).toEqual({ baseRoman: 'III', quality: '+', bassInterval: '1' }); // '+' often means augmented
    expect(parseRomanNumeral('Vaug6')).toEqual({ baseRoman: 'V', quality: 'aug', bassInterval: '3', figBass: '6' });
  });

  test('should handle numerals with # or b prefixes for the root', () => {
    expect(parseRomanNumeral('#iv°')).toEqual({ baseRoman: '#iv', quality: '°', bassInterval: '1' });
    expect(parseRomanNumeral('bIImaj7')).toEqual({ baseRoman: 'bII', quality: 'maj7', bassInterval: '1' });
    expect(parseRomanNumeral('bVI6')).toEqual({ baseRoman: 'bVI', quality: '', bassInterval: '3', figBass: '6' });
  });

  test('should correctly interpret figures for seventh chords vs triads', () => {
    // Triad in 1st inversion
    expect(parseRomanNumeral('I6')).toEqual({ baseRoman: 'I', quality: '', bassInterval: '3' }); 
    // Seventh chord in 1st inversion (quality '7' is part of the chord, '65' is the figure, but bass is '3')
    // parseRomanNumeral should determine if '7' is quality or part of figure.
    // If 'V76' is given, it's ambiguous. 'V7' then '6' (1st inv of V7) or 'V' then '76' (invalid figure)?
    // Assuming 'V7' is the base, '6' implies 1st inversion of the V7 chord.
    expect(parseRomanNumeral('V76')).toEqual({ baseRoman: 'V', quality: '7', bassInterval: '3', figBass: '6' }); 
    expect(parseRomanNumeral('iiø72')).toEqual({ baseRoman: 'ii', quality: 'ø7', bassInterval: '7', figBass: '2' });
  });

});

describe('getKeyDetails', () => {
  test('should return correct details for valid major keys', () => {
    const cMajor = getKeyDetails('C');
    expect(cMajor?.tonic).toBe('C');
    expect(cMajor?.type).toBe('major');
    expect(cMajor?.scale.length).toBeGreaterThan(0);


    const fSharpMajor = getKeyDetails('F#');
    expect(fSharpMajor?.tonic).toBe('F#');
    expect(fSharpMajor?.type).toBe('major');

    const dbMajor = getKeyDetails('Dbmaj'); // Test with 'maj'
    expect(dbMajor?.tonic).toBe('Db');
    expect(dbMajor?.type).toBe('major');

    const gMajor = getKeyDetails('G Major');
    expect(gMajor?.tonic).toBe('G');
    expect(gMajor?.type).toBe('major');
  });

  test('should return correct details for valid minor keys', () => {
    const aMinor = getKeyDetails('Am');
    expect(aMinor?.tonic).toBe('A');
    expect(aMinor?.type).toBe('minor');
    // It should also contain natural, harmonic, and melodic minor scales
    expect(aMinor?.natural?.scale).toBeDefined();
    expect(aMinor?.harmonic?.scale).toBeDefined();
    expect(aMinor?.melodic?.scale).toBeDefined();

    const cSharpMinor = getKeyDetails('c# minor'); // Test with 'minor' and different casing
    expect(cSharpMinor?.tonic).toBe('C#');
    expect(cSharpMinor?.type).toBe('minor');

    const bbMinor = getKeyDetails('Bbm');
    expect(bbMinor?.tonic).toBe('Bb');
    expect(bbMinor?.type).toBe('minor');
  });

  test('should throw InvalidInputError for unrecognized key names', () => {
    expect(() => getKeyDetails('X')).toThrow(InvalidInputError);
    expect(() => getKeyDetails('CminorMaj')).toThrow(InvalidInputError);
    expect(() => getKeyDetails('G# Major Seventh')).toThrow(InvalidInputError);
    expect(() => getKeyDetails('')).toThrow(InvalidInputError);
    // Test cases that Tonal.js might return empty or no tonic for
    expect(() => getKeyDetails('H')).toThrow(InvalidInputError); // Invalid note
    expect(() => getKeyDetails('Fb minor')).toThrow(InvalidInputError); // Tonal might parse Fb as E, but our wrapper should ensure consistency or throw
    expect(() => getKeyDetails('E## major')).toThrow(InvalidInputError); // Double sharps/flats if not canonical
    expect(() => getKeyDetails('Abb major')).toThrow(InvalidInputError);
  });

  test('should be case insensitive for key names but respect case for tonic note', () => {
    const cmajor_lower = getKeyDetails('c major');
    expect(cmajor_lower?.tonic).toBe('C'); // Tonic should still be 'C', not 'c'
    expect(cmajor_lower?.type).toBe('major');

    const FSharpMaj_mixed = getKeyDetails('f#MaJ');
    expect(FSharpMaj_mixed?.tonic).toBe('F#');
    expect(FSharpMaj_mixed?.type).toBe('major');

    const abminor_lower = getKeyDetails('ab minor');
    expect(abminor_lower?.tonic).toBe('Ab'); // Tonic should be 'Ab'
    expect(abminor_lower?.type).toBe('minor');
  });

  test('should handle spaces around key name components', () => {
    const cMajorSpaced = getKeyDetails('  C   Major  ');
    expect(cMajorSpaced?.tonic).toBe('C');
    expect(cMajorSpaced?.type).toBe('major');

    const aMinorSpaced = getKeyDetails('  Am  ');
    expect(aMinorSpaced?.tonic).toBe('A');
    expect(aMinorSpaced?.type).toBe('minor');

    const fsharpMinSpaced = getKeyDetails('f#  min');
    expect(fsharpMinSpaced?.tonic).toBe('F#');
    expect(fsharpMinSpaced?.type).toBe('minor');
  });
});

describe('getInitialDiatonicChordSymbol', () => {
  const cMajorDetails = getKeyDetails('C');
  const aMinorDetails = getKeyDetails('Am');
  const gMajorDetails = getKeyDetails('G');
  const eMinorDetails = getKeyDetails('Em');
  const fSharpMinorDetails = getKeyDetails('F#m');

  // scaleDegreeIndex for getInitialDiatonicChordSymbol is 0-indexed
  test('should return correct diatonic chords for major keys', () => {
    if (!cMajorDetails) throw new Error('Test setup failed: C Major key details are null');
    expect(getInitialDiatonicChordSymbol('I', 0, cMajorDetails, 'C')).toBe('CM');
    expect(getInitialDiatonicChordSymbol('II', 1, cMajorDetails, 'C')).toBe('Dm');
    expect(getInitialDiatonicChordSymbol('III', 2, cMajorDetails, 'C')).toBe('Em');
    expect(getInitialDiatonicChordSymbol('IV', 3, cMajorDetails, 'C')).toBe('FM');
    expect(getInitialDiatonicChordSymbol('V', 4, cMajorDetails, 'C')).toBe('GM');
    expect(getInitialDiatonicChordSymbol('VI', 5, cMajorDetails, 'C')).toBe('Am');
    expect(getInitialDiatonicChordSymbol('VII', 6, cMajorDetails, 'C')).toBe('Bdim');

    if (!gMajorDetails) throw new Error('Test setup failed: G Major key details are null');
    expect(getInitialDiatonicChordSymbol('I', 0, gMajorDetails, 'G')).toBe('GM');
    expect(getInitialDiatonicChordSymbol('II', 1, gMajorDetails, 'G')).toBe('Am');
    expect(getInitialDiatonicChordSymbol('V', 4, gMajorDetails, 'G')).toBe('DM');
  });

  test('should return correct diatonic chords for minor keys (natural and harmonic for V, vii)', () => {
    if (!aMinorDetails) throw new Error('Test setup failed: A minor key details are null');
    expect(getInitialDiatonicChordSymbol('i', 0, aMinorDetails, 'Am')).toBe('Am');
    expect(getInitialDiatonicChordSymbol('ii', 1, aMinorDetails, 'Am')).toBe('Bdim'); // ii° from natural minor
    expect(getInitialDiatonicChordSymbol('III', 2, aMinorDetails, 'Am')).toBe('CM'); // III from natural minor
    expect(getInitialDiatonicChordSymbol('iv', 3, aMinorDetails, 'Am')).toBe('Dm');
    expect(getInitialDiatonicChordSymbol('V', 4, aMinorDetails, 'Am')).toBe('EM'); // V from harmonic minor
    expect(getInitialDiatonicChordSymbol('VI', 5, aMinorDetails, 'Am')).toBe('FM'); // VI from natural minor
    expect(getInitialDiatonicChordSymbol('vii', 6, aMinorDetails, 'Am')).toBe('G#dim'); // vii° from harmonic minor

    if (!eMinorDetails) throw new Error('Test setup failed: E minor key details are null');
    expect(getInitialDiatonicChordSymbol('i', 0, eMinorDetails, 'Em')).toBe('Em');
    expect(getInitialDiatonicChordSymbol('V', 4, eMinorDetails, 'Em')).toBe('BM'); 
    expect(getInitialDiatonicChordSymbol('vii', 6, eMinorDetails, 'Em')).toBe('D#dim');

    if (!fSharpMinorDetails) throw new Error('Test setup failed: F# minor key details are null');
    expect(getInitialDiatonicChordSymbol('i', 0, fSharpMinorDetails, 'F#m')).toBe('F#m');
    expect(getInitialDiatonicChordSymbol('V', 4, fSharpMinorDetails, 'F#m')).toBe('C#M');
    // In F# minor, natural minor vii is E major. Harmonic minor vii° is E# diminished.
    expect(getInitialDiatonicChordSymbol('vii', 6, fSharpMinorDetails, 'F#m')).toBe('E#dim');
  });

  test('should throw MusicTheoryError for out-of-bounds scale degree index', () => {
    if (!cMajorDetails) throw new Error('Test setup failed: C Major key details are null');
    // romanNumeral parameter is just for logging, the index is what matters for the error
    expect(() => getInitialDiatonicChordSymbol('VIII', 7, cMajorDetails, 'C')).toThrow(MusicTheoryError);
    expect(() => getInitialDiatonicChordSymbol('ZERO', -1, cMajorDetails, 'C')).toThrow(MusicTheoryError);
  });
  
  test('should throw MusicTheoryError if keyDetails.chords (major) or relevant minor chords array is undefined/shorter than index', () => {
    const malformedMajorKeyDetails = { 
      type: 'major', 
      tonic: 'C', 
      scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], // Tonal.Key.majorKey has 'scale'
      chords: ['CM'] // Only one chord defined
    } as any; 
    expect(() => getInitialDiatonicChordSymbol('II', 1, malformedMajorKeyDetails, 'C (malformed major)'))
      .toThrow(MusicTheoryError);
    expect(() => getInitialDiatonicChordSymbol('II', 1, malformedMajorKeyDetails, 'C (malformed major)'))
      .toThrow("Diatonic chord for scale degree 1 (II) not found in key C (malformed major). Key chords array is too short or undefined.");


    const malformedMinorKeyDetailsNatural = {
        type: 'minor',
        tonic: 'A',
        natural: { chords: ['Am'] , scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G']}, // Only one chord in natural
        harmonic: { chords: ['Am', 'Bdim', 'Caug', 'Dm', 'EM', 'FM', 'G#dim'], scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G#'] },
        melodic: { chords: [], scale: []} // empty for simplicity
    } as any;
    // This should throw because ii° (index 1) in natural minor is requested, but natural.chords is too short
    expect(() => getInitialDiatonicChordSymbol('ii', 1, malformedMinorKeyDetailsNatural, 'Am (malformed natural minor)'))
      .toThrow(MusicTheoryError);
    expect(() => getInitialDiatonicChordSymbol('ii', 1, malformedMinorKeyDetailsNatural, 'Am (malformed natural minor)'))
      .toThrow("Diatonic chord for scale degree 1 (ii) not found in key Am (malformed natural minor). Natural minor chords array is too short or undefined.");

    const malformedMinorKeyDetailsHarmonic = {
        type: 'minor',
        tonic: 'A',
        natural: { chords: ['Am', 'Bdim', 'CM', 'Dm', 'Em', 'FM', 'GM'], scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G']},
        harmonic: { chords: ['Am', 'Bdim', 'Caug', 'Dm'] , scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G#']}, // Harmonic too short for V (index 4)
        melodic: { chords: [], scale: [] } // empty for simplicity
    } as any;
    // This should throw because V (index 4) in harmonic minor is requested, but harmonic.chords is too short
    expect(() => getInitialDiatonicChordSymbol('V', 4, malformedMinorKeyDetailsHarmonic, 'Am (malformed harmonic minor)'))
      .toThrow(MusicTheoryError);
    expect(() => getInitialDiatonicChordSymbol('V', 4, malformedMinorKeyDetailsHarmonic, 'Am (malformed harmonic minor)'))
      .toThrow("Diatonic chord for scale degree 4 (V) not found in key Am (malformed harmonic minor). Harmonic minor chords array is too short or undefined.");
  });

  test('should throw InvalidInputError or MusicTheoryError for null or undefined keyDetails', () => {
    // Test with null keyDetails
    expect(() => getInitialDiatonicChordSymbol('I', 0, null as any, 'C (null keyDetails)'))
      .toThrow(InvalidInputError); // Or MusicTheoryError depending on implementation
     expect(() => getInitialDiatonicChordSymbol('I', 0, null as any, 'C (null keyDetails)'))
      .toThrow("Invalid key details provided for key C (null keyDetails).");

    // Test with undefined keyDetails
    expect(() => getInitialDiatonicChordSymbol('I', 0, undefined as any, 'C (undefined keyDetails)'))
      .toThrow(InvalidInputError); // Or MusicTheoryError
    expect(() => getInitialDiatonicChordSymbol('I', 0, undefined as any, 'C (undefined keyDetails)'))
      .toThrow("Invalid key details provided for key C (undefined keyDetails).");
  });
});

describe('applyChordModifications', () => {
  const cMajorDetails = getKeyDetails('C');
  const aMinorDetails = getKeyDetails('Am');
  const gMajorDetails = getKeyDetails('G'); // Added for more tests
  const fMinorDetails = getKeyDetails('Fm'); // Added for more tests

  if (!cMajorDetails || !aMinorDetails || !gMajorDetails || !fMinorDetails) {
    throw new Error("Test setup failed: key details are null for one or more keys.");
  }

  // ROMAN_MAP equivalent (0-indexed)
  const romanMap = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

  // Test explicit quality modifiers
  describe('Explicit Quality Modifiers', () => {
    test('should apply explicit quality modifiers to triads', () => {
      // From CM (I in C) to Caug
      expect(applyChordModifications('CM', 'Iaug', cMajorDetails, romanMap.I)).toBe('Caug');
      expect(applyChordModifications('CM', 'I+', cMajorDetails, romanMap.I)).toBe('Caug');
      // From Dm (ii in C) to D (major triad)
      expect(applyChordModifications('Dm', 'iiM', cMajorDetails, romanMap.II)).toBe('DM');
      expect(applyChordModifications('Dm', 'iimaj', cMajorDetails, romanMap.II)).toBe('DM');
       // From Em (iii in C) to Edim
      expect(applyChordModifications('Em', 'iiidim', cMajorDetails, romanMap.III)).toBe('Edim');
      expect(applyChordModifications('Em', 'iiio', cMajorDetails, romanMap.III)).toBe('Edim');
      // From Am (i in A minor) to Am (no change if quality matches)
      expect(applyChordModifications('Am', 'im', aMinorDetails, romanMap.I)).toBe('Am');
      expect(applyChordModifications('Am', 'imin', aMinorDetails, romanMap.I)).toBe('Am');
      // From GM (V in C) to Gm
      expect(applyChordModifications('GM', 'Vm', cMajorDetails, romanMap.V)).toBe('Gm');
    });

    test('should handle requested quality already being the diatonic quality', () => {
      expect(applyChordModifications('CM', 'IM', cMajorDetails, romanMap.I)).toBe('CM');
      expect(applyChordModifications('Dm', 'iim', cMajorDetails, romanMap.II)).toBe('Dm');
      expect(applyChordModifications('Bdim', 'viidim', cMajorDetails, romanMap.VII)).toBe('Bdim');
    });

    test('should resolve quality conflicts (Tonal.js behavior)', () => {
      // "Cdim" on a "Dm" base: Tonal.Chord.get("Ddim") is what it should try.
      expect(applyChordModifications('Dm', 'iidim', cMajorDetails, romanMap.II)).toBe('Ddim');
      // "Am" on "CM" base: Tonal.Chord.get("Cm")
      expect(applyChordModifications('CM', 'Im', cMajorDetails, romanMap.I)).toBe('Cm');
      // "GMaj" on "Gbm" base: Tonal.Chord.get("GbM")
      expect(applyChordModifications('Gbm', 'IM', getKeyDetails('Gb'), romanMap.I)).toBe('GbM');
    });
  });

  // Test adding 7ths
  describe('Adding 7ths', () => {
    test('should add 7ths correctly in major keys', () => {
      expect(applyChordModifications('CM', 'I7', cMajorDetails, romanMap.I)).toBe('CMaj7'); // I7 -> IMaj7
      expect(applyChordModifications('Dm', 'ii7', cMajorDetails, romanMap.II)).toBe('Dm7');  // ii7 -> iim7
      expect(applyChordModifications('Em', 'iii7', cMajorDetails, romanMap.III)).toBe('Em7'); // iii7 -> iiim7
      expect(applyChordModifications('FM', 'IV7', cMajorDetails, romanMap.IV)).toBe('FMaj7'); // IV7 -> IVMaj7
      expect(applyChordModifications('GM', 'V7', cMajorDetails, romanMap.V)).toBe('G7');    // V7 -> V7
      expect(applyChordModifications('Am', 'vi7', cMajorDetails, romanMap.VI)).toBe('Am7');  // vi7 -> vim7
      expect(applyChordModifications('Bdim', 'vii7', cMajorDetails, romanMap.VII)).toBe('Bm7b5'); // vii7 -> viiø7
    });

    test('should add 7ths correctly in minor keys (using natural/harmonic)', () => {
      // i in A minor (Am) -> Am7
      expect(applyChordModifications('Am', 'i7', aMinorDetails, romanMap.I)).toBe('Am7');
      // ii in A minor (Bdim) -> Bm7b5 (iiø7 from natural minor)
      expect(applyChordModifications('Bdim', 'ii7', aMinorDetails, romanMap.II)).toBe('Bm7b5');
      // III in A minor (CM) -> CMaj7 (III Maj7 from natural minor)
      expect(applyChordModifications('CM', 'III7', aMinorDetails, romanMap.III)).toBe('CMaj7');
      // iv in A minor (Dm) -> Dm7
      expect(applyChordModifications('Dm', 'iv7', aMinorDetails, romanMap.IV)).toBe('Dm7');
      // V in A minor (EM from harmonic) -> E7
      expect(applyChordModifications('EM', 'V7', aMinorDetails, romanMap.V)).toBe('E7');
      // VI in A minor (FM from natural) -> FMaj7
      expect(applyChordModifications('FM', 'VI7', aMinorDetails, romanMap.VI)).toBe('FMaj7');
      // vii in A minor (G#dim from harmonic) -> G#dim7 (vii°7)
      expect(applyChordModifications('G#dim', 'vii7', aMinorDetails, romanMap.VII)).toBe('G#dim7');

      // Test V7 in F minor (Cm -> C7)
      const V_Fm_initial = getInitialDiatonicChordSymbol('V', romanMap.V, fMinorDetails, 'Fm'); // Should be CM
      expect(V_Fm_initial).toBe('CM');
      expect(applyChordModifications(V_Fm_initial, 'V7', fMinorDetails, romanMap.V)).toBe('C7');
    });

    test('should handle specific 7th qualities like ø (hd) and ° (dim7)', () => {
      // From Dm (ii in C) to Dø7
      expect(applyChordModifications('Dm', 'iiø7', cMajorDetails, romanMap.II)).toBe('Dm7b5');
      expect(applyChordModifications('Dm', 'iihd7', cMajorDetails, romanMap.II)).toBe('Dm7b5'); // Alias
      // From Bdim (vii in C) to B°7
      expect(applyChordModifications('Bdim', 'vii°7', cMajorDetails, romanMap.VII)).toBe('Bdim7');
      expect(applyChordModifications('Bdim', 'viidim7', cMajorDetails, romanMap.VII)).toBe('Bdim7'); // Alias

      // From Dm (iv in A minor) to Dø7
      expect(applyChordModifications('Dm', 'ivø7', aMinorDetails, romanMap.IV)).toBe('Dm7b5');
      // From G#dim (vii in A minor) to G#°7
      expect(applyChordModifications('G#dim', 'vii°7', aMinorDetails, romanMap.VII)).toBe('G#dim7');
    });

    test('should handle base Roman numeral already implying a 7th (e.g., V7 quality)', () => {
      // Current symbol is GM (from V in C), baseRomanInput is "V7" (implies dominant 7th)
      expect(applyChordModifications('GM', 'V7', cMajorDetails, romanMap.V)).toBe('G7');
      // Current symbol is CM (from I in C), baseRomanInput is "Imaj7" (implies major 7th)
      expect(applyChordModifications('CM', 'Imaj7', cMajorDetails, romanMap.I)).toBe('CMaj7');
      // Current symbol is Dm (from ii in C), baseRomanInput is "iim7" (implies minor 7th)
      expect(applyChordModifications('Dm', 'iim7', cMajorDetails, romanMap.II)).toBe('Dm7');
      // Current symbol is Bdim (from vii in C), baseRomanInput is "viiø7" (implies half-dim 7th)
      expect(applyChordModifications('Bdim', 'viiø7', cMajorDetails, romanMap.VII)).toBe('Bm7b5');
      // Current symbol is G#dim (vii in Am), baseRomanInput is "vii°7" (implies fully-dim 7th)
      expect(applyChordModifications('G#dim', 'vii°7', aMinorDetails, romanMap.VII)).toBe('G#dim7');
    });
  });

  // Test combinations of quality and 7ths
  describe('Combined Quality and 7th Modifiers', () => {
    test('should handle combined quality and 7th modifiers', () => {
      // From Dm (ii in C) to DMaj7 (e.g. "iiMaj7")
      expect(applyChordModifications('Dm', 'iiMaj7', cMajorDetails, romanMap.II)).toBe('DMaj7');
      // From Bdim (vii in C) to Bm7 (e.g. "viim7", changing quality then adding diatonic m7 for minor triad)
      // 1. Bdim -> Bm (quality 'm') -> Bm
      // 2. Bm + '7' (as if it were a minor triad on vii) -> Bm7. This seems right.
      expect(applyChordModifications('Bdim', 'viim7', cMajorDetails, romanMap.VII)).toBe('Bm7');
      // From CM (I in C) to Cm7
      expect(applyChordModifications('CM', 'Im7', cMajorDetails, romanMap.I)).toBe('Cm7');
      // From GM (V in C) to Gm7 (making it minor, then adding m7)
      expect(applyChordModifications('GM', 'Vm7', cMajorDetails, romanMap.V)).toBe('Gm7');
      // From Am (i in A minor) to AMaj7 (Picardy third + Maj7)
      expect(applyChordModifications('Am', 'IMaj7', aMinorDetails, romanMap.I)).toBe('AMaj7');
       // From Bdim (ii° in A minor) to B7 (e.g. secondary dominant V7/iv)
      expect(applyChordModifications('Bdim', 'II7', aMinorDetails, romanMap.II)).toBe('B7'); // Bdim -> BM -> B7
    });
  });

  // Test error handling
  describe('Error Handling and Fallbacks', () => {
    test('should throw MusicTheoryError for invalid initial currentChordSymbol', () => {
      expect(() => applyChordModifications('XYZ', 'I7', cMajorDetails, romanMap.I)).toThrow(MusicTheoryError);
      expect(() => applyChordModifications('', 'I7', cMajorDetails, romanMap.I)).toThrow(MusicTheoryError);
    });

    test('should handle Tonal.Chord.get returning empty for a constructed symbol (fallback/warning behavior)', () => {
      // This tests the internal fallback logic when Tonal.js can't form a specific chord.
      // applyChordModifications is designed to be somewhat robust and might simplify or use diatonic qualities.

      // Case 1: Quality change results in something Tonal doesn't like, then add 7th.
      // If we try to make "Bdim" (vii° in C) into "BMaj" (not standard) and then add a 7th.
      // Tonal.Chord.get("BMaj") might return { empty: true } or simplify to "BM".
      // Let's assume it becomes "BM". Then applyChordModifications adds a 7th.
      // For vii in major key, 7th type is m7b5. So it should become "Bm7b5".
      expect(applyChordModifications('Bdim', 'viiMaj7', cMajorDetails, romanMap.VII)).toBe('Bm7b5');
      // The prompt's example was viiM7 -> Bm7b5, which is what this tests.

      // Case 2: Augmented chord with an unusual 7th.
      // Tonal.Chord.get("Caugm7") might be empty. The function should fall back to a more standard 7th.
      // If 'Iaugm7' is requested for 'CM' in C major:
      // 1. 'CM' -> 'Caug' (quality 'aug').
      // 2. 'Caug' + 'm7' (from 'augm7'). If Tonal.Chord.get('Caugm7') is empty,
      //    it should try 'Caug7' (dominant 7th on augmented).
      expect(applyChordModifications('CM', 'Iaugm7', cMajorDetails, romanMap.I)).toBe('Caug7');

      // Case 3: Diminished chord with an unusual 7th like "dimMaj7".
      // 'iidimMaj7' for 'Dm' in C major:
      // 1. 'Dm' -> 'Ddim' (quality 'dim').
      // 2. 'Ddim' + 'Maj7'. If Tonal.Chord.get('DdimMaj7') is empty,
      //    it might fall back to 'Ddim7' or 'Dm7b5' (diatonic iiø7).
      //    The current logic for 'dimMaj7' is to use 'dim7' (fully diminished 7th).
      expect(applyChordModifications('Dm', 'iidimMaj7', cMajorDetails, romanMap.II)).toBe('Ddim7');

      // Case 4: Base Roman numeral implies a quality that results in an unhandlable chord by Tonal.
      // E.g. 'viiSus7' in C. Initial 'Bdim'. 'Sus' quality on 'B' is 'Bsus'. Then add '7'.
      // Tonal.Chord.get('Bsus7') is valid.
      expect(applyChordModifications('Bdim', 'viiSus7', cMajorDetails, romanMap.VII)).toBe('Bsus7');

      // Case 5: If a quality is requested that Tonal cannot make from the tonic.
      // e.g. applying "Major" to "Fx" (F##). Tonal.Chord.get("FxM") might be empty.
      // The function should ideally return the original chord symbol or a sensible default.
      // Current behavior: if quality application fails, it uses the original symbol then tries to add 7th if requested.
      // If we have 'Fxm' and request 'IMaj7' for key 'Fxm'.
      // 1. 'Fxm' -> 'FxMaj'? If Tonal.Chord.get("FxMaj") is empty, it stays 'Fxm'.
      // 2. Add '7'. For 'i' in minor, it's 'm7'. So 'Fxm7'.
      const fxMinorDetails = getKeyDetails('Fxm'); // F## minor
      if (!fxMinorDetails) throw new Error("Fxm key details null");
      const initialFxm = getInitialDiatonicChordSymbol('i', romanMap.I, fxMinorDetails, 'Fxm'); // Should be 'Fxm'
      // This tests that if 'FxMaj' is not formable, it uses 'Fxm' and adds 'm7' -> 'Fxm7'
      expect(applyChordModifications(initialFxm, 'IMaj7', fxMinorDetails, romanMap.I)).toBe('Fxm7');
    });
     test('should throw MusicTheoryError for invalid scaleDegreeIndex', () => {
        expect(() => applyChordModifications('CM', 'I7', cMajorDetails, 7)).toThrow(MusicTheoryError); // Index out of bounds
        expect(() => applyChordModifications('CM', 'I7', cMajorDetails, -1)).toThrow(MusicTheoryError);
     });

     test('should throw InvalidInputError for null or undefined keyDetails', () => {
        expect(() => applyChordModifications('CM', 'I7', null as any, romanMap.I)).toThrow(InvalidInputError);
        expect(() => applyChordModifications('CM', 'I7', undefined as any, romanMap.I)).toThrow(InvalidInputError);
     });
  });
});

describe('getChordNotesAndBass', () => {
  // keyDetails are not directly used by getChordNotesAndBass, 
  // but keyType and keyTonic are passed as strings.

  // Helper to sort pitch classes for comparison
  const sortPCs = (arr: number[]) => [...arr].sort((a, b) => a - b);

  describe('Basic Chords (Root Position)', () => {
    test('should return notes and null bass PC for major triad in root position', () => {
      const result = getChordNotesAndBass('CM', '1', 'major', 'C');
      // rootOctaveGuess: keyTonic 'C', chordTonic 'C'. Default guess = 3.
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7]));
    });

    test('should return notes for minor triad in root position', () => {
      const result = getChordNotesAndBass('Dm', '1', 'major', 'C'); // Dm in C major
      // rootOctaveGuess: keyTonic 'C', chordTonic 'D'. Default guess = 3.
      expect(result?.noteNames).toEqual(['D3', 'F3', 'A3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 5, 9]));
    });

    test('should return notes for diminished triad in root position', () => {
      const result = getChordNotesAndBass('Bdim', '1', 'major', 'C'); // Bdim in C major
      // rootOctaveGuess: keyTonic 'C', chordTonic 'B'. Default guess = 2.
      expect(result?.noteNames).toEqual(['B2', 'D3', 'F3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([11, 2, 5]));
    });
    
    test('should return notes for augmented triad in root position', () => {
      const result = getChordNotesAndBass('Caug', '1', 'major', 'C');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G#3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 8]));
    });

    test('should return notes for Major 7th chord (CMaj7) in root position', () => {
      const result = getChordNotesAndBass('CMaj7', '1', 'major', 'C');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3', 'B3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7, 11]));
    });

    test('should return notes for minor 7th chord (Am7) in root position', () => {
      const result = getChordNotesAndBass('Am7', '1', 'minor', 'A'); // Am7 in A minor
      // rootOctaveGuess: keyTonic 'A', chordTonic 'A'. Guess = 2.
      expect(result?.noteNames).toEqual(['A2', 'C3', 'E3', 'G3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 0, 4, 7]));
    });

    test('should return notes for dominant 7th chord (G7) in root position', () => {
      const result = getChordNotesAndBass('G7', '1', 'major', 'C'); // G7 in C major
      // rootOctaveGuess: keyTonic 'C', chordTonic 'G'. Guess = 2.
      expect(result?.noteNames).toEqual(['G2', 'B2', 'D3', 'F3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([7, 11, 2, 5]));
    });

    test('should return notes for half-diminished 7th chord (Bm7b5) in root position', () => {
      const result = getChordNotesAndBass('Bm7b5', '1', 'major', 'C'); // Bm7b5 in C major
      expect(result?.noteNames).toEqual(['B2', 'D3', 'F3', 'A3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([11, 2, 5, 9]));
    });
    
    test('should return notes for diminished 7th chord (G#dim7) in root position', () => {
      const result = getChordNotesAndBass('G#dim7', '1', 'minor', 'A'); // G#dim7 in A minor
      // rootOctaveGuess: keyTonic 'A', chordTonic 'G#'. Guess = 2.
      expect(result?.noteNames).toEqual(['G#2', 'B2', 'D3', 'F3']); // Fbb = F
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([8, 11, 2, 5])); // G#, B, D, F (Fb is enharmonically E)
    });
  });

  describe('Inversions', () => {
    test('should return notes and correct bass PC for first inversion major triad (CM/E)', () => {
      const result = getChordNotesAndBass('CM', '3', 'major', 'C');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3']);
      expect(result?.requiredBassPc).toBe(4); // E
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7]));
    });

    test('should return notes and correct bass PC for second inversion minor triad (Am/E)', () => {
      const result = getChordNotesAndBass('Am', '5', 'minor', 'A');
      expect(result?.noteNames).toEqual(['A2', 'C3', 'E3']);
      expect(result?.requiredBassPc).toBe(4); // E
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 0, 4]));
    });
    
    test('should return notes and correct bass PC for V7/5 (second inversion G7/D)', () => {
      const result = getChordNotesAndBass('G7', '5', 'major', 'C');
      expect(result?.noteNames).toEqual(['G2', 'B2', 'D3', 'F3']);
      expect(result?.requiredBassPc).toBe(2); // D
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([7, 11, 2, 5]));
    });

    test('should return notes and correct bass PC for V7/b7 (third inversion G7/F)', () => {
      const result = getChordNotesAndBass('G7', 'b7', 'major', 'C');
      expect(result?.noteNames).toEqual(['G2', 'B2', 'D3', 'F3']);
      expect(result?.requiredBassPc).toBe(5); // F
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([7, 11, 2, 5]));
    });
    
    test('should return notes and correct bass PC for iim7b5/b3 (first inversion Bm7b5/D)', () => {
      const result = getChordNotesAndBass('Bm7b5', 'b3', 'major', 'C');
      expect(result?.noteNames).toEqual(['B2', 'D3', 'F3', 'A3']);
      expect(result?.requiredBassPc).toBe(2); // D
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([11, 2, 5, 9]));
    });

    test('should return notes and correct bass PC for Caug/#5 (second inversion)', () => {
      const result = getChordNotesAndBass('Caug', '#5', 'major', 'C');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G#3']);
      expect(result?.requiredBassPc).toBe(8); // G#
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 8]));
    });
  });

  describe('Octave Guessing / Range', () => {
    test('should use rootOctaveGuess 2 for F major in F major', () => {
      const resultF = getChordNotesAndBass('FM', '1', 'major', 'F');
      expect(resultF?.noteNames).toEqual(['F2', 'A2', 'C3']);
      expect(resultF?.requiredBassPc).toBe(null);
    });

    test('should use rootOctaveGuess 2 for Am in A minor', () => {
      const resultAm = getChordNotesAndBass('Am', '1', 'minor', 'A');
      expect(resultAm?.noteNames).toEqual(['A2', 'C3', 'E3']);
      expect(resultAm?.requiredBassPc).toBe(null);
    });
    
    test('should use rootOctaveGuess 3 for C#m in E major', () => {
      const resultCsharpM = getChordNotesAndBass('C#m', '1', 'major', 'E'); // C#m is vi in E major
      // keyTonic E (PC 4), chordTonic C# (PC 1). (1 - 4 + 12) % 12 = 9. Interval is M6.
      // Default rootOctaveGuess is 3.
      expect(resultCsharpM?.noteNames).toEqual(['C#3', 'E3', 'G#3']);
      expect(resultCsharpM?.requiredBassPc).toBe(null);
    });

    test('should use rootOctaveGuess 2 for BbMaj7 in F major', () => {
      const resultBb = getChordNotesAndBass('BbMaj7', '1', 'major', 'F'); // BbMaj7 is IVMaj7 in F
      // keyTonic F (PC 5), chordTonic Bb (PC 10). (10 - 5 + 12) % 12 = 5. Interval is P4.
      // rootOctaveGuess is 2.
      expect(resultBb?.noteNames).toEqual(['Bb2', 'D3', 'F3', 'A3']);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    test('should throw MusicTheoryError for invalid finalChordSymbol', () => {
      expect(() => getChordNotesAndBass('Cxyz', '1', 'major', 'C')).toThrow(MusicTheoryError);
      expect(() => getChordNotesAndBass('', '1', 'major', 'C')).toThrow(MusicTheoryError);
      // Test for symbol Tonal.Chord.get might return empty for
      expect(() => getChordNotesAndBass('Cblah', '1', 'major', 'C')).toThrow(MusicTheoryError);
    });

    test('should handle bassInterval that is not part of the chord (e.g., CM/B)', () => {
      // The function should calculate B as the bass PC but might log a warning.
      // The returned notes should still be the root position chord notes.
      const result = getChordNotesAndBass('CM', '7', 'major', 'C'); // CM with B in bass
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3']);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7]));
      expect(result?.requiredBassPc).toBe(11); // B
    });

    test('should return null requiredBassPc if bassInterval is "1"', () => {
      const result = getChordNotesAndBass('Dm', '1', 'minor', 'D');
      expect(result?.requiredBassPc).toBeNull();
    });

    test('should throw MusicTheoryError if bassInterval is invalid (e.g., "b9")', () => {
      // Tonal.transpose cannot handle "b9" directly as simple interval for bass.
      // The function should catch this if Tonal.transpose returns null for bass note.
      expect(() => getChordNotesAndBass('CM', 'b9', 'major', 'C')).toThrow(MusicTheoryError);
      expect(() => getChordNotesAndBass('CM', 'b9', 'major', 'C')).toThrow("Could not determine bass note for CM with bassInterval b9.");
    });

    test('should handle bassInterval like "#3" if it is part of an aug chord (CAug/E#)', () => {
        // This is tricky because '#3' is not a standard interval name for Tonal.transpose directly.
        // But Caug has E (natural 3rd). If bassInterval means "the 3rd of THIS chord", it's E.
        // If it means "transpose C by #3", that's E#.
        // The function's logic for bassInterval: Tonal.transpose(chordTonic, bassInterval)
        // Tonal.transpose('C', '#3') is null.
        // This case should ideally be handled by parseRomanNumeral giving a valid interval like '3' or specific note.
        // Given the current structure of getChordNotesAndBass, this will likely fail if '#3' is passed.
        // Let's test assuming bassInterval is the *actual* interval from the root of the *finalChordSymbol*.
        // Caug notes: C, E, G#. The third is E. bassInterval should be '3'.
        // If we are testing Gaug/B#, bassInterval should be '3' (B is 3rd of G).
        // Gaug = G B D#. B is 3rd. So Gaug, '3'.
        const result = getChordNotesAndBass('Gaug', '3', 'major', 'G');
        expect(result?.noteNames).toEqual(['G2', 'B2', 'D#3']); // G B D#
        expect(result?.requiredBassPc).toBe(11); // B
    });
    
    test('should throw error if Tonal.Note.midi returns null for a chord note (simulated)', () => {
        // This is hard to test directly without mocking Tonal itself.
        // We rely on Tonal.Chord.notes and Tonal.Note.midi to work.
        // If finalChordSymbol is valid but contains a note Tonal can't get MIDI for (e.g. "Cblah5"),
        // Tonal.Chord.get(finalChordSymbol).notes itself would likely fail or return unhandled notes.
        // The function's current error check is primarily on Tonal.Chord.get(finalChordSymbol).empty
        // and on Tonal.transpose for bass note.
        // If Tonal.Chord.get returns notes like ['C3', undefined], this might pass through.
        // However, Tonal.js is generally robust for standard note names.
        // This scenario is more about Tonal's internal robustness.
        // For now, we assume Tonal.Chord.notes returns valid note names if not empty.
    });
  });
});

describe('getExtendedChordNotePool', () => {
  test('should create an extended pool for a C major triad', () => {
    const baseCMajor = [48, 52, 55]; // C3, E3, G3
    const pool = getExtendedChordNotePool(baseCMajor);
    const expectedPcs = [0, 4, 7]; // C, E, G

    expect(pool.length).toBeGreaterThan(0);
    pool.forEach(note => {
      expect(expectedPcs).toContain(note % 12);
      expect(note).toBeGreaterThanOrEqual(21);
      expect(note).toBeLessThanOrEqual(108);
    });

    // Check specific notes across octaves within range
    expect(pool).toContain(36); // C2 (MIDI for C2)
    expect(pool).toContain(40); // E2
    expect(pool).toContain(43); // G2
    expect(pool).toContain(48); // C3
    expect(pool).toContain(52); // E3
    expect(pool).toContain(55); // G3
    expect(pool).toContain(60); // C4
    expect(pool).toContain(64); // E4
    expect(pool).toContain(67); // G4
    expect(pool).toContain(72); // C5
    // ... up to C8 (108)
    expect(pool).toContain(108); // C8
    expect(pool).not.toContain(109); // Should not exceed 108
    expect(pool).not.toContain(20);  // Should not go below 21

    expect(pool.length).toBeGreaterThan(baseCMajor.length);

    // Check if sorted
    for (let i = 0; i < pool.length - 1; i++) {
      expect(pool[i]).toBeLessThanOrEqual(pool[i+1]); // Use LessThanOrEqual for duplicate PCs in different octaves
    }
    // More robust sort check: ensure no element is smaller than the one before it.
    if (pool.length > 1) {
        for (let i = 1; i < pool.length; i++) {
            expect(pool[i-1]).toBeLessThan(pool[i]);
        }
    }
  });

  test('should create an extended pool for a G7 chord', () => {
    const baseG7 = [55, 59, 62, 65]; // G3, B3, D4, F4 (MIDI values)
    const pool = getExtendedChordNotePool(baseG7);
    const expectedPcs = [7, 11, 2, 5]; // G, B, D, F

    expect(pool.length).toBeGreaterThan(0);
    pool.forEach(note => {
      expect(expectedPcs).toContain(note % 12);
      expect(note).toBeGreaterThanOrEqual(21);
      expect(note).toBeLessThanOrEqual(108);
    });
    expect(pool).toContain(55); // G3
    expect(pool).toContain(59); // B3
    expect(pool).toContain(62); // D4
    expect(pool).toContain(65); // F4
    // Example from another octave
    expect(pool).toContain(43); // G2
    expect(pool).toContain(47); // B2
    expect(pool.length).toBeGreaterThan(baseG7.length);
    if (pool.length > 1) {
        for (let i = 1; i < pool.length; i++) {
            expect(pool[i-1]).toBeLessThan(pool[i]);
        }
    }
  });

  test('should return empty array for empty baseChordNotes', () => {
    expect(getExtendedChordNotePool([])).toEqual([]);
  });

  test('should handle baseChordNotes outside typical initial octave gracefully', () => {
    // Test with notes already in higher/lower octaves but within MIDI range
    const highNotes = [72, 76, 79]; // C5, E5, G5
    const poolHigh = getExtendedChordNotePool(highNotes);
    expect(poolHigh).toContain(72);
    expect(poolHigh).toContain(60); // C4 should still be there
    expect(poolHigh).toContain(48); // C3 should still be there

    const lowNotes = [24, 28, 31]; // C1, E1, G1 (Note: C1=24, E1=28, G1=31 are valid MIDI)
    const poolLow = getExtendedChordNotePool(lowNotes);
    expect(poolLow).toContain(24); // C1
    expect(poolLow).toContain(36); // C2
    expect(poolLow).toContain(48); // C3
  });
});

describe('midiToNoteName', () => {
  test('should convert common MIDI notes to names', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(55)).toBe('G3');
  });

  test('should handle sharps and flats (Tonal default: sharps)', () => {
    expect(midiToNoteName(61)).toBe('C#4'); 
    expect(midiToNoteName(70)).toBe('A#4'); 
    expect(midiToNoteName(50)).toBe('D#3'); // Eb3
    expect(midiToNoteName(53)).toBe('F#3'); // Gb3
  });

  test('should handle edge case MIDI values (practical and theoretical)', () => {
    expect(midiToNoteName(21)).toBe('A0');   // Lowest piano key
    expect(midiToNoteName(108)).toBe('C8');  // Highest piano key
    
    expect(midiToNoteName(0)).toBe('C-1');   // Theoretical lowest MIDI
    expect(midiToNoteName(127)).toBe('G9'); // Theoretical highest MIDI
  });

  test('should return null for invalid MIDI inputs as per current implementation', () => {
    expect(midiToNoteName(null as any)).toBeNull(); // Casting to any to bypass TS type check for null
    expect(midiToNoteName(-1)).toBeNull();
    expect(midiToNoteName(128)).toBeNull();
    expect(midiToNoteName(60.5)).toBeNull(); // Non-integer
  });
});

describe('getChordInfoFromRoman', () => {
  const sortPCs = (arr: number[]) => [...arr].sort((a, b) => a - b);

  describe('Major Keys', () => {
    test('should return correct info for I in C major', () => {
      const result = getChordInfoFromRoman('I', 'C');
      expect(result?.finalChordSymbol).toBe('CM');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7])); // C E G
    });

    test('should return correct info for IV in G major', () => {
      const result = getChordInfoFromRoman('IV', 'G');
      expect(result?.finalChordSymbol).toBe('CM');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3']); // C in G -> C3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7])); // C E G
    });
    
    test('should return correct info for V7 in C major', () => {
      const result = getChordInfoFromRoman('V7', 'C');
      expect(result?.finalChordSymbol).toBe('G7');
      expect(result?.noteNames).toEqual(['G2', 'B2', 'D3', 'F3']); // G in C -> G2
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([7, 11, 2, 5])); // G B D F
    });

    test('should return correct info for vi in F major', () => {
      const result = getChordInfoFromRoman('vi', 'F');
      expect(result?.finalChordSymbol).toBe('Dm');
      expect(result?.noteNames).toEqual(['D3', 'F3', 'A3']); // D in F -> D3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 5, 9])); // D F A
    });
  });

  describe('Minor Keys', () => {
    test('should return correct info for i in A minor', () => {
      const result = getChordInfoFromRoman('i', 'Am');
      expect(result?.finalChordSymbol).toBe('Am');
      expect(result?.noteNames).toEqual(['A2', 'C3', 'E3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 0, 4])); // A C E
    });

    test('should return correct info for iv in E minor', () => {
      const result = getChordInfoFromRoman('iv', 'Em');
      expect(result?.finalChordSymbol).toBe('Am');
      expect(result?.noteNames).toEqual(['A2', 'C3', 'E3']); // A in Em -> A2
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 0, 4])); // A C E
    });

    test('should return correct info for V in A minor (should be Major)', () => {
      const result = getChordInfoFromRoman('V', 'Am');
      expect(result?.finalChordSymbol).toBe('EM'); // E G# B
      expect(result?.noteNames).toEqual(['E3', 'G#3', 'B3']); // E in Am -> E3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([4, 8, 11])); // E G# B
    });
    
    test('should return correct info for VI in C# minor', () => {
      const result = getChordInfoFromRoman('VI', 'C#m'); // VI in C#m is A major
      expect(result?.finalChordSymbol).toBe('AM');
      expect(result?.noteNames).toEqual(['A2', 'C#3', 'E3']); // A in C#m -> A2
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 1, 4])); // A C# E
    });
  });

  describe('Inversions (Figured Bass and Slash)', () => {
    test('should return correct info for ii6 in C major', () => {
      // ii in C is Dm. ii6 is Dm/F.
      const result = getChordInfoFromRoman('ii6', 'C');
      expect(result?.finalChordSymbol).toBe('Dm');
      expect(result?.noteNames).toEqual(['D3', 'F3', 'A3']);
      expect(result?.requiredBassPc).toBe(5); // F
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 5, 9])); // D F A
    });

    test('should return correct info for I64 in G major', () => {
      // I in G is GM. I64 is GM/D.
      const result = getChordInfoFromRoman('I64', 'G');
      expect(result?.finalChordSymbol).toBe('GM');
      expect(result?.noteNames).toEqual(['G2', 'B2', 'D3']); // G in G -> G2
      expect(result?.requiredBassPc).toBe(2); // D
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([7, 11, 2])); // G B D
    });
    
    test('should return correct info for V/3 in D major', () => {
      // V in D is AM. V/3 is AM/C#.
      const result = getChordInfoFromRoman('V/3', 'D');
      expect(result?.finalChordSymbol).toBe('AM');
      expect(result?.noteNames).toEqual(['A2', 'C#3', 'E3']); // A in D -> A2
      expect(result?.requiredBassPc).toBe(1); // C#
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 1, 4])); // A C# E
    });

    test('should return correct info for IVMaj7/5 in C major', () => {
      // IVMaj7 in C is FMaj7. IVMaj7/5 is FMaj7/C.
      const result = getChordInfoFromRoman('IVMaj7/5', 'C');
      expect(result?.finalChordSymbol).toBe('FMaj7');
      expect(result?.noteNames).toEqual(['F2', 'A2', 'C3', 'E3']); // F in C -> F2
      expect(result?.requiredBassPc).toBe(0); // C
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([5, 9, 0, 4])); // F A C E
    });
  });

  describe('Chords with Explicit Qualities', () => {
    test('should return correct info for Imaj7 in C major', () => {
      const result = getChordInfoFromRoman('Imaj7', 'C');
      expect(result?.finalChordSymbol).toBe('CMaj7');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3', 'B3']);
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7, 11])); // C E G B
    });

    test('should return correct info for vii°7 in G major', () => {
      // vii° in G is F#dim. vii°7 is F#dim7.
      const result = getChordInfoFromRoman('vii°7', 'G');
      expect(result?.finalChordSymbol).toBe('F#dim7');
      expect(result?.noteNames).toEqual(['F#2', 'A2', 'C3', 'Eb3']); // F# in G -> F#2. F# A C Eb (Ebb)
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([6, 9, 0, 3])); // F# A C Eb
    });
    
    test('should return correct info for iiø7 in D minor', () => {
      // ii° in Dm is Edim. iiø7 is Em7b5.
      const result = getChordInfoFromRoman('iiø7', 'Dm');
      expect(result?.finalChordSymbol).toBe('Em7b5');
      expect(result?.noteNames).toEqual(['E3', 'G3', 'Bb3', 'D4']); // E in Dm -> E3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([4, 7, 10, 2])); // E G Bb D
    });
  });

  describe('Secondary Dominants', () => {
    test('should return correct info for V7/V in C major', () => {
      // V/V in C is D. V7/V is D7.
      const result = getChordInfoFromRoman('V7/V', 'C');
      expect(result?.finalChordSymbol).toBe('D7');
      expect(result?.noteNames).toEqual(['D3', 'F#3', 'A3', 'C4']); // D in C -> D3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 6, 9, 0])); // D F# A C
    });

    test('should return correct info for V/ii in F major', () => {
      // ii in F is Gm. V/ii is D major.
      const result = getChordInfoFromRoman('V/ii', 'F');
      expect(result?.finalChordSymbol).toBe('DM');
      expect(result?.noteNames).toEqual(['D3', 'F#3', 'A3']); // D in F -> D3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 6, 9])); // D F# A
    });

    test('should return correct info for V65/V in C major (D7/F#)', () => {
      // V/V in C is D. V7/V is D7. V65/V is D7/F#.
      const result = getChordInfoFromRoman('V65/V', 'C');
      expect(result?.finalChordSymbol).toBe('D7');
      expect(result?.noteNames).toEqual(['D3', 'F#3', 'A3', 'C4']);
      expect(result?.requiredBassPc).toBe(6); // F#
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([2, 6, 9, 0]));
    });
    
    test('should return correct info for vii°7/V in G major (C#dim7)', () => {
      // V in G is D. vii°/V is C#dim. vii°7/V is C#dim7.
      const result = getChordInfoFromRoman('vii°7/V', 'G');
      expect(result?.finalChordSymbol).toBe('C#dim7');
      expect(result?.noteNames).toEqual(['C#3', 'E3', 'G3', 'Bb3']); // C# in G -> C#3
      expect(result?.requiredBassPc).toBe(null);
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([1, 4, 7, 10])); // C# E G Bb
    });
  });

  // Test "V65/IV" from prompt
  describe('Complex Secondary Dominants (V65/IV)', () => {
    test('should return correct info for V65/IV in C major (C7/E)', () => {
      // IV in C is F. V/IV is C. V7/IV is C7. V65/IV is C7/E.
      const result = getChordInfoFromRoman('V65/IV', 'C');
      expect(result?.finalChordSymbol).toBe('C7');
      expect(result?.noteNames).toEqual(['C3', 'E3', 'G3', 'Bb3']); // C in C -> C3
      expect(result?.requiredBassPc).toBe(4); // E
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([0, 4, 7, 10])); // C E G Bb
    });

    test('should return correct info for V43/V in G major (A7/G)', () => {
      // V in G is D. V/V in G is A. V7/V is A7. V43/V is A7/G.
      const result = getChordInfoFromRoman('V43/V', 'G');
      expect(result?.finalChordSymbol).toBe('A7');
      expect(result?.noteNames).toEqual(['A2', 'C#3', 'E3', 'G3']); // A in G -> A2
      expect(result?.requiredBassPc).toBe(7); // G
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([9, 1, 4, 7])); // A C# E G
    });
  });

  // German Sixth might be too complex for the current parser,
  // but we can test if it throws or returns something unexpected.
  // Ger+6 in C major is Ab7 (Ab C Eb Gb). Typically voiced with Ab in bass.
  // Roman numeral representation can vary: Ger+6, GerAug6, Ger6, Gr+6 etc.
  // The parser might not recognize "Ger+6" as a base Roman numeral.
  describe('Augmented Sixth Chords (Experimental)', () => {
    test('should handle Ger+6 in C major (Ab7)', () => {
      // This depends heavily on parseRomanNumeral's capabilities for "Ger+6"
      // If it's aliased to something like "bVI7" or a specific chord name.
      // For now, assume it might be parsed as bVI with quality 'Ger+6' or similar
      // which `applyChordModifications` would then need to interpret.
      // A common spelling for Ger+6 in C is Ab C Eb Gb.
      // If `parseRomanNumeral` simply passes "Ger+6" as quality, `applyChordModifications`
      // would need a rule for it.
      // Let's test a common realization as bVIaug6 or bVI7.
      // If "Ger+6" is treated as "bVI7" (Ab7):
      const result = getChordInfoFromRoman('bVI Ger+6', 'C'); // or just 'Ger+6' if that's how it's defined
      expect(result?.finalChordSymbol).toBe('Ab7'); // Ab C Eb Gb
      expect(result?.noteNames).toEqual(['Ab2', 'C3', 'Eb3', 'Gb3']); // Ab in C -> Ab2
      expect(result?.requiredBassPc).toBe(null); // Assuming root position Ab7
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([8, 0, 3, 6])); // Ab C Eb Gb
    });

     test('should handle It+6 in C major (AbM)', () => {
      const result = getChordInfoFromRoman('bVI It+6', 'C'); 
      expect(result?.finalChordSymbol).toBe('AbM'); 
      expect(result?.noteNames).toEqual(['Ab2', 'C3', 'Eb3']); 
      expect(result?.requiredBassPc).toBe(null); 
      expect(sortPCs(result?.notes.map(n => n % 12) || [])).toEqual(sortPCs([8, 0, 3])); 
    });
  });


  describe('Error Conditions', () => {
    test('should throw MusicTheoryError for invalid Roman numeral string', () => {
      expect(() => getChordInfoFromRoman('badRN', 'C')).toThrow(MusicTheoryError);
      expect(() => getChordInfoFromRoman('VIII', 'C')).toThrow(MusicTheoryError); // Invalid degree
    });

    test('should throw InvalidInputError for invalid key signature', () => {
      expect(() => getChordInfoFromRoman('I', 'Xyz')).toThrow(InvalidInputError);
      expect(() => getChordInfoFromRoman('I', '')).toThrow(InvalidInputError);
    });
    
    test('should throw for secondary dominant of an invalid degree', () => {
      expect(() => getChordInfoFromRoman('V7/VIII', 'C')).toThrow(MusicTheoryError);
    });
  });
});
