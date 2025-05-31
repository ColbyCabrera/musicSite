import { scoreToMusicXML } from '../toMusicXml'; // Adjust path as necessary
import { ScoreData } from '../toMusicXml'; // Import ScoreData interface

describe('scoreToMusicXML', () => {
  // Helper to check for well-formedness (conceptual)
  const isWellFormedXML = (xmlString: string): boolean => {
    const trimmedXml = xmlString.trim();
    const startsCorrectly = trimmedXml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
    const includesScorePartwise = trimmedXml.includes('<score-partwise version="4.0">');
    const endsCorrectly = trimmedXml.endsWith('</score-partwise>');

    if (!startsCorrectly) console.log("DEBUG: XML does not start correctly. Actual start:", trimmedXml.substring(0, 100));
    if (!includesScorePartwise) console.log("DEBUG: XML does not include score-partwise tag as expected.");
    if (!endsCorrectly) console.log("DEBUG: XML end mismatch. Actual end:", trimmedXml.substring(trimmedXml.length - 50));

    return startsCorrectly && includesScorePartwise && endsCorrectly;
  };

  // --- Test Data ---
  const simpleScoreData: ScoreData = {
    melody: [
      { note: 'C4', rhythm: 4 }, // Quarter
      { note: 'E4', rhythm: 4 }, // Quarter
      { note: 'G4', rhythm: 2 }, // Half
    ],
    accompaniment: [
      { note: 'C3', rhythm: 2 }, // Half
      { note: 'G2', rhythm: 2 }, // Half
    ],
  };

  const complexScoreData: ScoreData = {
    melody: [
      { note: 'D4', rhythm: 4 },
      { note: 'B4', rhythm: 4 },
      { note: 'G4', rhythm: 4 },
      { note: 'A4', rhythm: 4 },
      { note: 'A4', rhythm: 8 },
      { note: 'G4', rhythm: 8 },
    ],
    accompaniment: [
      { note: 'G2', rhythm: 4 },
      { note: 'rest', rhythm: 4 },
      { note: 'D3', rhythm: 4 },
      { note: 'B2', rhythm: 2 },
    ],
  };


  // --- Test Case 1: Simple Score ---
  describe('Simple Score (C Major, 4/4)', () => {
    const key = 'C';
    const time = '4/4';
    const title = 'Simple Test';
    let xmlOutput: string;

    beforeAll(() => {
      xmlOutput = scoreToMusicXML(simpleScoreData, key, time, title);
      // console.log("Simple XML Output for well-formedness check:\n", xmlOutput);
    });

    test('should produce well-formed XML (basic check)', () => {
      expect(isWellFormedXML(xmlOutput)).toBe(true);
    });

    test('should contain correct work title', () => {
      expect(xmlOutput).toContain(`<work-title>${title}</work-title>`);
    });

    test('should contain part P1 (Melody) and P2 (Accompaniment)', () => {
      expect(xmlOutput).toContain('<score-part id="P1">');
      expect(xmlOutput).toContain('<part-name>Melody</part-name>');
      expect(xmlOutput).toContain('<score-part id="P2">');
      expect(xmlOutput).toContain('<part-name>Accompaniment</part-name>');
      expect(xmlOutput).toContain('<part id="P1">');
      expect(xmlOutput).toContain('<part id="P2">');
    });

    test('should have correct key signature (C Major - 0 fifths)', () => {
      expect(xmlOutput).toContain('<fifths>0</fifths>');
      expect(xmlOutput).toContain('<mode>major</mode>');
    });

    test('should have correct time signature (4/4)', () => {
      expect(xmlOutput).toContain('<beats>4</beats>');
      expect(xmlOutput).toContain('<beat-type>4</beat-type>');
    });

    test('should have correct divisions (4 per quarter based on rhythmMap)', () => {
        expect(xmlOutput).toMatch(/<divisions>4<\/divisions>/);
    });

    test('Melody: should contain C4 quarter note', () => {
      expect(xmlOutput).toMatch(/<pitch>\s*<step>C<\/step>\s*<octave>4<\/octave>\s*<\/pitch>\s*<duration>4<\/duration>\s*<type>quarter<\/type>/);
    });

    test('Melody: should contain G4 half note', () => {
      expect(xmlOutput).toMatch(/<pitch>\s*<step>G<\/step>\s*<octave>4<\/octave>\s*<\/pitch>\s*<duration>8<\/duration>\s*<type>half<\/type>/);
    });

    test('Accompaniment: should contain C3 half note', () => {
      expect(xmlOutput).toMatch(/<pitch>\s*<step>C<\/step>\s*<octave>3<\/octave>\s*<\/pitch>\s*<duration>8<\/duration>\s*<type>half<\/type>/);
    });

    test('Melody: should have one measure', () => {
        const melodyPart = xmlOutput.substring(xmlOutput.indexOf('<part id="P1">'), xmlOutput.indexOf('</part>', xmlOutput.indexOf('<part id="P1">')));
        const measureMatches = melodyPart.match(/<measure number="1">/g);
        expect(measureMatches).toHaveLength(1);
        expect(melodyPart).not.toContain('<measure number="2">');
    });
  });

  // --- Test Case 2: Complex Score ---
  describe('Complex Score (G Major, 3/4)', () => {
    const key = 'G';
    const time = '3/4';
    const title = 'Complex Test';
    let xmlOutput: string;

    beforeAll(() => {
      xmlOutput = scoreToMusicXML(complexScoreData, key, time, title);
    });

    test('should produce well-formed XML (basic check)', () => {
      expect(isWellFormedXML(xmlOutput)).toBe(true);
    });

    test('should contain correct work title', () => {
      expect(xmlOutput).toContain(`<work-title>${title}</work-title>`);
    });

    test('should have correct key signature (G Major - 1 fifth)', () => {
      expect(xmlOutput).toContain('<fifths>1</fifths>');
      expect(xmlOutput).toContain('<mode>major</mode>');
    });

    test('should have correct time signature (3/4)', () => {
      expect(xmlOutput).toContain('<beats>3</beats>');
      expect(xmlOutput).toContain('<beat-type>4</beat-type>');
    });

    test('Melody: should contain B4 quarter note in measure 1', () => {
      expect(xmlOutput).toMatch(/<part id="P1">[\s\S]*<measure number="1">[\s\S]*<pitch>\s*<step>B<\/step>\s*<octave>4<\/octave>\s*<\/pitch>\s*<duration>4<\/duration>\s*<type>quarter<\/type>[\s\S]*<\/measure>/);
    });

    test('Melody: should contain A4 quarter note in measure 2', () => {
      expect(xmlOutput).toMatch(/<part id="P1">[\s\S]*<measure number="2">[\s\S]*<pitch>\s*<step>A<\/step>\s*<octave>4<\/octave>\s*<\/pitch>\s*<duration>4<\/duration>\s*<type>quarter<\/type>/);
    });

    test('Melody: should contain G4 eighth note in measure 2', () => {
      expect(xmlOutput).toMatch(/<part id="P1">[\s\S]*<measure number="2">[\s\S]*<pitch>\s*<step>G<\/step>\s*<octave>4<\/octave>\s*<\/pitch>\s*<duration>2<\/duration>\s*<type>eighth<\/type>/);
    });

    test('Accompaniment: should contain a rest for a quarter note in measure 1', () => {
      expect(xmlOutput).toMatch(/<part id="P2">[\s\S]*<measure number="1">[\s\S]*<note>\s*<rest\/>\s*<duration>4<\/duration>\s*<voice>1<\/voice>\s*<staff>1<\/staff>\s*<\/note>[\s\S]*<\/measure>/);
    });

    test('Accompaniment: should contain D3 quarter note in measure 1 (no accidental in G major)', () => {
      const measure1Accomp = xmlOutput.match(/<part id="P2">[\s\S]*<measure number="1">([\s\S]*?)<\/measure>[\s\S]*<\/part>/);
      expect(measure1Accomp).not.toBeNull();
      if (measure1Accomp) {
          const d3NoteRegex = /<note>\s*<pitch>\s*<step>D<\/step>\s*(<alter>0<\/alter>\s*)?<octave>3<\/octave>\s*<\/pitch>\s*<duration>4<\/duration>\s*<type>quarter<\/type>[\s\S]*?<\/note>/;
          expect(measure1Accomp[1]).toMatch(d3NoteRegex);
          const d3NoteMatch = measure1Accomp[1].match(d3NoteRegex);
          expect(d3NoteMatch).not.toBeNull();
          if (d3NoteMatch) {
            expect(d3NoteMatch[0]).not.toContain('<accidental>');
          }
      }
    });

    test('Melody: measure 2 should end with a rest of 1 beat (duration 4)', () => {
        const melodyPart = xmlOutput.substring(xmlOutput.indexOf('<part id="P1">'), xmlOutput.indexOf('</part>', xmlOutput.indexOf('<part id="P1">')));
        const measure2 = melodyPart.substring(melodyPart.indexOf('<measure number="2">'), melodyPart.indexOf('</measure>', melodyPart.indexOf('<measure number="2">')) + '</measure>'.length);
        expect(measure2).toMatch(/<note>\s*<rest\/>\s*<duration>4<\/duration>\s*<voice>1<\/voice>\s*<staff>1<\/staff>\s*<\/note>\s*<\/measure>/);
    });

    test('Accompaniment: measure 2 should end with a rest of 1 beat (duration 4)', () => {
        const accompPart = xmlOutput.substring(xmlOutput.indexOf('<part id="P2">'), xmlOutput.indexOf('</part>', xmlOutput.indexOf('<part id="P2">')));
        const measure2 = accompPart.substring(accompPart.indexOf('<measure number="2">'), accompPart.indexOf('</measure>', accompPart.indexOf('<measure number="2">')) + '</measure>'.length);
        expect(measure2).toMatch(/<note>\s*<rest\/>\s*<duration>4<\/duration>\s*<voice>1<\/voice>\s*<staff>1<\/staff>\s*<\/note>\s*<\/measure>/);
    });
  });
});
