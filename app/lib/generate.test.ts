// app/lib/generate.test.ts
import {
  // generateVoices, // Top-level orchestrator, harder to unit test in detail here
  // These are not exported, so we test their effects through generateMusicalData or generateVoices
  // initializeGenerationParameters,
  // initializePreviousNotes,
  // getRhythmicPattern, // Not exported
  // generateNotesForEvent, // Not exported
  // createStaffEvents, // Not exported
  // generateRestEventsForDuration, // Not exported
  // _generateMeasureData, // Not exported
  // generateMusicalData, // This is the main internal function we can test
  // createMusicXMLString, // XML string generation, better for integration/snapshot testing
  // _addMeasureToXML, // Not exported
  // _addXMLAttributes, // Not exported
  // _addXMLHarmony, // Not exported
  // addMusicalEventsToXML, // Not exported
  // getFifths, // Not exported
} from './generate'; // Adjust path as necessary
// For testing purposes, we might need to indirectly test private functions
// or consider exporting them if they are complex enough for direct unit tests.
// For now, let's focus on what's testable via exported functions or by effect.
// We'll assume generateMusicalData is the primary target for internal logic testing.
// If getRhythmicPattern and generateNotesForEvent were exported, they'd be tested directly.
// Since they are not, we test their behavior through generateMusicalData.

// Due to the refactoring, many functions previously tested directly might now be private.
// We will test the public generateVoices and infer behavior of internal functions.
// Or, for more focused unit tests, we would need to export those helper functions.
// For this exercise, let's assume we can test generateMusicalData if it were exported.
// Since it's not, we'll test generateVoices and make assertions about the generated data
// that would reflect the behavior of the internal helpers.

import { generateVoices } from './generate'; // Assuming this is the main public API
import {
  GenerationSettings,
  KeyDetails,
  TimingInfo,
  PreviousNotesSATB,
  PreviousNotesMelodyAccompaniment,
  MusicalEvent,
  GeneratedPieceData,
  MeasureData,
} from './types';
import * as Tonal from 'tonal';
import { midiToNoteName } from './harmonyUtils';

// Mocking checkVoiceLeadingRules as it's complex and not the focus here
jest.mock('./rules', () => ({
  checkVoiceLeadingRules: jest.fn(),
}));


describe('generate.ts', () => {
  // Helper to create KeyDetails
  const getKeyDetails = (keySignature: string): KeyDetails => {
    const details = Tonal.Key.majorKey(keySignature) ?? Tonal.Key.minorKey(keySignature);
    if (!details) throw new Error(`Test setup: Invalid key ${keySignature}`);
    return details;
  };

  // Helper to create TimingInfo
  const getTimingInfo = (meter: string, divisions: number = 4): TimingInfo => {
    const meterMatch = meter.match(/^(\d+)\/(\d+)$/);
    if (!meterMatch) throw new Error(`Test setup: Invalid meter ${meter}`);
    const [, beatsStr, beatValueStr] = meterMatch;
    const meterBeats = parseInt(beatsStr, 10);
    const beatValue = parseInt(beatValueStr, 10);
    const beatDurationTicks = divisions * (4 / beatValue);
    const measureDurationTicks = meterBeats * beatDurationTicks;
    return {
      meterBeats,
      beatValue,
      divisions,
      beatDurationTicks,
      measureDurationTicks,
      defaultNoteType: 'quarter', // Placeholder, actual calculation is internal
    };
  };
  
  // Because getRhythmicPattern is not exported, we can't test it directly.
  // We would test its effects via generateMusicalData or generateVoices.
  // Same for generateNotesForEvent.
  // The tests below will focus on generateVoices and inspect the resulting MusicXML string
  // for characteristics that imply the correct behavior of internal functions.

  describe('generateVoices (integration test for internal logic)', () => {
    const defaultSettingsSATB: GenerationSettings = {
      generationStyle: 'SATB',
      melodicSmoothness: 5,
      rhythmicComplexity: 3,
      numAccompanimentVoices: 3, // Not used by SATB but part of type
      dissonanceStrictness: 'Strict',
    };

    const defaultSettingsMelodyAccomp: GenerationSettings = {
      generationStyle: 'MelodyAccompaniment',
      melodicSmoothness: 7,
      rhythmicComplexity: 5,
      numAccompanimentVoices: 3,
      dissonanceStrictness: 'Moderate',
    };

    // Helper to parse MusicXML (very basic)
    const parseMusicXML = (xmlString: string) => {
        const measures: any[] = [];
        const measureRegex = /<measure number="(\d+)">([\s\S]*?)<\/measure>/g;
        let match;
        while ((match = measureRegex.exec(xmlString)) !== null) {
            const notesAndRestsRegex = /<(note|rest)>[\s\S]*?<\/(note|rest)>/g;
            const events = [];
            let eventMatch;
            while((eventMatch = notesAndRestsRegex.exec(match[2])) !== null) {
                const durationRegex = /<duration>(\d+)<\/duration>/;
                const typeRegex = /<type>(.*?)<\/type>/;
                const stepRegex = /<step>([A-G])<\/step>/;
                const alterRegex = /<alter>([0-9\-])<\/alter>/;
                const octaveRegex = /<octave>(\d)<\/octave>/;
                const staffRegex = /<staff>(\d)<\/staff>/;
                const voiceRegex = /<voice>(\d)<\/voice>/;
                const chordRegex = /<chord\/>/;


                const durationMatch = durationRegex.exec(eventMatch[0]);
                const typeMatch = typeRegex.exec(eventMatch[0]);
                const stepMatch = stepRegex.exec(eventMatch[0]);
                const alterMatch = alterRegex.exec(eventMatch[0]);
                const octaveMatch = octaveRegex.exec(eventMatch[0]);
                const staffMatch = staffRegex.exec(eventMatch[0]);
                const voiceMatch = voiceRegex.exec(eventMatch[0]);


                const event: any = {
                    isRest: eventMatch[0].startsWith('<rest>'),
                    isChordElement: chordRegex.test(eventMatch[0]),
                    duration: durationMatch ? parseInt(durationMatch[1]) : 0,
                    type: typeMatch ? typeMatch[1] : null,
                    staff: staffMatch ? staffMatch[1] : null,
                    voice: voiceMatch ? voiceMatch[1] : null,
                };
                if (stepMatch && octaveMatch) {
                    event.pitch = `${stepMatch[1]}${alterMatch ? (alterMatch[1] === '1' ? '#' : (alterMatch[1] === '-1' ? 'b' : (alterMatch[1] === '2' ? '##' : 'bb'))) : ''}${octaveMatch[1]}`;
                }
                events.push(event);
            }
            measures.push({ number: match[1], content: match[2], events });
        }
        return { measures };
    };


    describe('Rhythmic Pattern Logic (via generateVoices output)', () => {
        test('4/4 meter, low complexity should have simpler rhythms', () => {
          const xml = generateVoices(['I', 'V', 'I'], 'C', '4/4', 3, { ...defaultSettingsSATB, rhythmicComplexity: 0 });
          const parsed = parseMusicXML(xml);
          const timingInfo = getTimingInfo('4/4'); // 16 ticks per measure
          
          parsed.measures.forEach(measure => {
            let totalDuration = 0;
            measure.events.filter((e:any) => !e.isChordElement).forEach((event:any) => totalDuration += event.duration);
            expect(totalDuration).toBeCloseTo(timingInfo.measureDurationTicks);
            // Low complexity often results in fewer notes (e.g. whole, half, quarter)
            // This is a qualitative check. A more robust check would analyze note type distribution.
            const numNotes = measure.events.filter((e:any) => !e.isChordElement && !e.isRest).length;
            expect(numNotes).toBeLessThanOrEqual(timingInfo.meterBeats * 2); // e.g. <= 8 for 4/4
          });
        });

        test('3/4 meter, high complexity should have varied rhythms', () => {
          const xml = generateVoices(['I', 'IV', 'V', 'I'], 'G', '3/4', 4, { ...defaultSettingsSATB, rhythmicComplexity: 10 });
          const parsed = parseMusicXML(xml);
          const timingInfo = getTimingInfo('3/4'); // 12 ticks per measure
          
          parsed.measures.forEach(measure => {
            let totalDuration = 0;
            measure.events.filter((e:any) => !e.isChordElement).forEach((event:any) => totalDuration += event.duration);
            expect(totalDuration).toBeCloseTo(timingInfo.measureDurationTicks);
            const noteTypes = measure.events.map((e:any) => e.type);
            // High complexity might include eighths, 16ths
            expect(noteTypes.some((t:string) => ['eighth', '16th'].includes(t))).toBe(true);
          });
        });
         test('6/8 meter, sum of durations should match measure duration', () => {
          const xml = generateVoices(['i', 'v6', 'i'], 'Am', '6/8', 3, { ...defaultSettingsSATB, rhythmicComplexity: 5 });
          const parsed = parseMusicXML(xml);
          const timingInfo = getTimingInfo('6/8'); // 12 ticks per measure (6 * (4/(8/4*4))) = 6 * 2 = 12
          
          parsed.measures.forEach(measure => {
            let totalDuration = 0;
            measure.events.filter((e:any) => !e.isChordElement).forEach((event:any) => totalDuration += event.duration);
            expect(totalDuration).toBeCloseTo(timingInfo.measureDurationTicks);
          });
        });
    });

    describe('GeneratedPieceData Structure (via generateVoices output)', () => {
        test('SATB Style: Metadata and Measure structure', () => {
            const numMeasures = 4;
            const key = 'F';
            const meter = '4/4';
            const progression = ['I', 'IV', 'V7', 'I'];
            const xml = generateVoices(progression, key, meter, numMeasures, defaultSettingsSATB);
            const parsed = parseMusicXML(xml);

            expect(xml).toContain(`<work-title>Generated Music (SATB Style)</work-title>`);
            expect(xml).toContain(`<part-name>Choral SATB</part-name>`);
            expect(xml).toContain(`<fifths>-1</fifths>`); // Key of F
            expect(xml).toContain(`<mode>major</mode>`);
            expect(xml).toContain(`<beats>4</beats>`);
            expect(xml).toContain(`<beat-type>4</beat-type>`);
            expect(parsed.measures.length).toBe(numMeasures);

            const timingInfo = getTimingInfo(meter);
            parsed.measures.forEach((measure, i) => {
                expect(measure.number).toBe(String(i + 1));
                expect(measure.content).toContain(`<harmony><kind text="${progression[i]}">other</kind></harmony>`);
                let totalDurationVoice1 = 0;
                let totalDurationVoice2 = 0;
                 measure.events.filter((e:any) => !e.isChordElement && e.voice === '1').forEach((event:any) => totalDurationVoice1 += event.duration);
                 measure.events.filter((e:any) => !e.isChordElement && e.voice === '2').forEach((event:any) => totalDurationVoice2 += event.duration);

                expect(totalDurationVoice1).toBeCloseTo(timingInfo.measureDurationTicks);
                expect(totalDurationVoice2).toBeCloseTo(timingInfo.measureDurationTicks);
            });
        });
        
        test('MelodyAccompaniment Style: Metadata and Measure structure', () => {
            const numMeasures = 3;
            const key = 'Dm'; // D minor
            const meter = '3/4';
            const progression = ['i', 'iv', 'V'];
            const xml = generateVoices(progression, key, meter, numMeasures, defaultSettingsMelodyAccomp);
            const parsed = parseMusicXML(xml);

            expect(xml).toContain(`<work-title>Generated Music (MelodyAccompaniment Style)</work-title>`);
            expect(xml).toContain(`<part-name>Melody + Accompaniment</part-name>`);
            expect(xml).toContain(`<fifths>-1</fifths>`); // Key of Dm (same as F major)
            expect(xml).toContain(`<mode>minor</mode>`);
            expect(xml).toContain(`<beats>3</beats>`);
            expect(xml).toContain(`<beat-type>4</beat-type>`);
            expect(parsed.measures.length).toBe(numMeasures);
            
            const timingInfo = getTimingInfo(meter);
            parsed.measures.forEach((measure, i) => {
                expect(measure.number).toBe(String(i + 1));
                 expect(measure.content).toContain(`<harmony><kind text="${progression[i]}">other</kind></harmony>`);
                let totalDurationVoice1 = 0; // Melody
                let totalDurationVoice2 = 0; // Accompaniment
                 measure.events.filter((e:any) => !e.isChordElement && e.staff === '1').forEach((event:any) => totalDurationVoice1 += event.duration);
                 measure.events.filter((e:any) => !e.isChordElement && e.staff === '2').forEach((event:any) => totalDurationVoice2 += event.duration);

                expect(totalDurationVoice1).toBeCloseTo(timingInfo.measureDurationTicks);
                expect(totalDurationVoice2).toBeCloseTo(timingInfo.measureDurationTicks);

                // Check for arpeggiation if rhythmic complexity is high enough (indirectly)
                // This requires knowing the rhythmic pattern used for that measure.
                // For now, just check structure.
                const accompEvents = measure.events.filter((e:any) => e.staff === '2' && !e.isRest);
                expect(accompEvents.length).toBeGreaterThan(0); // Expect some accompaniment
            });
        });
    });

    describe('Error Handling in generateVoices (via generateMusicalData)', () => {
        test('Invalid chord in progression fills measure with rests', () => {
            const progression = ['I', 'InvalidChord', 'V7', 'I'];
            const xml = generateVoices(progression, 'C', '4/4', 4, defaultSettingsSATB);
            const parsed = parseMusicXML(xml);
            const timingInfo = getTimingInfo('4/4');

            const measure2Events = parsed.measures[1].events;
            let totalDurationMeasure2 = 0;
            let allRests = true;
            measure2Events.filter((e:any) => !e.isChordElement).forEach((event:any) => {
                totalDurationMeasure2 += event.duration;
                if (!event.isRest) allRests = false;
            });
            
            expect(totalDurationMeasure2).toBeCloseTo(timingInfo.measureDurationTicks * 2); // *2 because rests on both staves
            // Check if all primary events are rests (chord elements don't count for "allRests")
            // This check needs refinement: we expect full measure rests for each voice/staff.
            const voice1EventsM2 = measure2Events.filter((e:any) => e.voice === '1' && !e.isChordElement);
            const voice2EventsM2 = measure2Events.filter((e:any) => e.voice === '2' && !e.isChordElement);
            expect(voice1EventsM2.every((e:any)=> e.isRest)).toBe(true);
            expect(voice2EventsM2.every((e:any)=> e.isRest)).toBe(true);
            expect(voice1EventsM2.reduce((sum:number, e:any) => sum + e.duration, 0)).toBe(timingInfo.measureDurationTicks);
            expect(voice2EventsM2.reduce((sum:number, e:any) => sum + e.duration, 0)).toBe(timingInfo.measureDurationTicks);
        });

        test('Invalid key signature throws error', () => {
            expect(() => generateVoices(['I'], 'InvalidKey', '4/4', 1, defaultSettingsSATB)).toThrow('Invalid key signature: InvalidKey');
        });

        test('Invalid meter throws error', () => {
            expect(() => generateVoices(['I'], 'C', 'invalid-meter', 1, defaultSettingsSATB)).toThrow("Invalid meter format. Use 'beats/beatValue'.");
        });
    });
    
    // Snapshot testing can be useful but brittle. Use with caution.
    // describe('Snapshot Tests', () => {
    //   test('SATB C Major simple progression matches snapshot', () => {
    //     const xml = generateVoices(['I', 'V7', 'I'], 'C', '4/4', 3, defaultSettingsSATB);
    //     expect(xml).toMatchSnapshot();
    //   });
    // });
  });
});
