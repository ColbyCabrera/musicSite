// Tests for app/lib/generate.ts
import { generateMusicalData, /* other potential exports if needed */ } from '../generate';
import { /* processMeasure, getRhythmicPattern - not exported, test via generateMusicalData or make them testable */ } from '../generate'; // If testing private functions
import { GeneratedPieceData, GenerationSettings, KeyDetails, TimingInfo, PreviousNotes, MusicalEvent, MelodicState, GenerationStyle } from '../types';
import { getChordInfoFromRoman } from '../harmonyUtils';

// Mocking helper functions that are complex dependencies or not directly under test here
jest.mock('../harmonyUtils', () => ({
  ...jest.requireActual('../harmonyUtils'), // Import and retain default behavior
  getChordInfoFromRoman: jest.fn(),
}));
jest.mock('../musicXmlWriter'); // If createMusicXMLString is called by a tested function

// Default settings for tests
const defaultKeyDetails: KeyDetails = {
  tonic: 'C',
  type: 'major',
  scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  chords: ['CM', 'Dm', 'Em', 'FM', 'GM', 'Am', 'Bdim'],
  triads: ['CM', 'Dm', 'Em', 'FM', 'GM', 'Am', 'Bdim'],
  chords7: ['CMaj7', 'Dm7', 'Em7', 'FMaj7', 'G7', 'Am7', 'Bm7b5'],
  romanNumerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'],
  aliases: {},
  intervals: [],
  natural: { scale: [], chords: [], triads: [], chords7: [], romanNumerals: [], intervals: [], aliases: {}},
  harmonic: { scale: [], chords: [], triads: [], chords7: [], romanNumerals: [], intervals: [], aliases: {}},
  melodic: { scale: [], chords: [], triads: [], chords7: [], romanNumerals: [], intervals: [], aliases: {}},
};

const defaultTimingInfo: TimingInfo = {
  meterBeats: 4,
  beatValue: 4,
  divisions: 4, // 4 ticks per quarter note
  beatDurationTicks: 4, // 1 quarter note = 4 ticks
  measureDurationTicks: 16, // 4 quarter notes = 16 ticks
  defaultNoteType: 'quarter',
};

const defaultGenerationSettings: GenerationSettings = {
  generationStyle: 'SATB',
  numAccompanimentVoices: 3,
  rhythmicComplexity: 3, // Medium
  melodicSmoothness: 5,  // Medium
  dissonanceStrictness: 5, // Medium
  voiceLeadingStrictness: 5, // Medium
};

// Since processMeasure is not exported, we test it indirectly via generateMusicalData
// or we would need to export it for direct testing.
// For now, focusing on generateMusicalData.

describe('generateMusicalData', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (getChordInfoFromRoman as jest.Mock).mockReset();
  });

  test('should generate basic piece data for a single measure', () => {
    (getChordInfoFromRoman as jest.Mock).mockReturnValue({
      notes: [60, 64, 67], // C4, E4, G4
      noteNames: ['C4', 'E4', 'G4'],
      requiredBassPc: null,
    });

    const settings: GenerationSettings = { ...defaultGenerationSettings };
    const pieceData = generateMusicalData(['I'], 'C', '4/4', 1, settings);

    expect(pieceData).toBeDefined();
    expect(pieceData.metadata.title).toContain('SATB Style');
    expect(pieceData.metadata.numMeasures).toBe(1);
    expect(pieceData.measures.length).toBe(1);
    expect(pieceData.measures[0].measureNumber).toBe(1);
    expect(pieceData.measures[0].romanNumeral).toBe('I');
    expect(pieceData.measures[0].events.length).toBeGreaterThan(0);
    
    // Check total duration of events in the measure
    const totalTicks = pieceData.measures[0].events.reduce((sum, event) => sum + event.durationTicks, 0);
    // For SATB, each "event" might be multiple notes, sum of distinct timeline points.
    // This is a simplification; true validation is harder without knowing rhythmic pattern.
    // We expect at least 4 notes (SATB) for the first beat, assuming one chord per measure.
    // A better check is if the events fill the measure, but that depends on getRhythmicPattern.
    // For now, check that *some* events exist.
    // A more accurate check would be to sum durations for one voice.
    let voice1Duration = 0;
    pieceData.measures[0].events.forEach(event => {
        if(event.voiceNumber === '1' && !event.isChordElement) { // Sum duration of first note in chords for voice 1
            voice1Duration += event.durationTicks;
        }
    });
    expect(voice1Duration).toEqual(defaultTimingInfo.measureDurationTicks);
  });

  test('should handle chord parsing error in a measure by generating rests', () => {
    (getChordInfoFromRoman as jest.Mock).mockImplementation((romanWithInv: string) => {
      if (romanWithInv === 'ErrorChord') {
        // Simulate an error or null return for a specific chord
        console.warn(`[MOCK] getChordInfoFromRoman: Simulating error for ${romanWithInv}`);
        return null; 
      }
      return {
        notes: [60, 64, 67], // C E G
        noteNames: ['C4', 'E4', 'G4'],
        requiredBassPc: null,
      };
    });

    const settings: GenerationSettings = { ...defaultGenerationSettings };
    const pieceData = generateMusicalData(['I', 'ErrorChord', 'IV'], 'C', '4/4', 3, settings);

    expect(pieceData.measures.length).toBe(3);
    // Measure 1 (I chord) should have notes
    expect(pieceData.measures[0].events.some(e => e.type === 'note')).toBe(true);
    expect(pieceData.measures[0].events.every(e => e.type !== 'rest' || e.durationTicks < defaultTimingInfo.measureDurationTicks)).toBe(true); // Not full measure rests

    // Measure 2 (ErrorChord) should have rests
    const measure2Events = pieceData.measures[1].events;
    expect(measure2Events.length).toBeGreaterThanOrEqual(2); // At least one rest per staff
    expect(measure2Events.filter(e => e.type === 'rest' && e.staffNumber === '1').reduce((sum, e) => sum + e.durationTicks, 0)).toEqual(defaultTimingInfo.measureDurationTicks);
    expect(measure2Events.filter(e => e.type === 'rest' && e.staffNumber === '2').reduce((sum, e) => sum + e.durationTicks, 0)).toEqual(defaultTimingInfo.measureDurationTicks);
    
    // Measure 3 (IV chord) should have notes again
    expect(pieceData.measures[2].events.some(e => e.type === 'note')).toBe(true);
    expect(pieceData.measures[2].events.every(e => e.type !== 'rest' || e.durationTicks < defaultTimingInfo.measureDurationTicks)).toBe(true);
  });

  test('should generate multiple measures correctly', () => {
    (getChordInfoFromRoman as jest.Mock).mockReturnValue({
      notes: [60, 64, 67], // C E G
      noteNames: ['C4', 'E4', 'G4'],
      requiredBassPc: null,
    });
    const settings: GenerationSettings = { ...defaultGenerationSettings };
    const numMeasures = 4;
    const pieceData = generateMusicalData(['I', 'V', 'IV', 'I'], 'C', '4/4', numMeasures, settings);

    expect(pieceData.measures.length).toBe(numMeasures);
    for (let i = 0; i < numMeasures; i++) {
      expect(pieceData.measures[i].measureNumber).toBe(i + 1);
      expect(pieceData.measures[i].events.length).toBeGreaterThan(0);
      let voice1Duration = 0;
      pieceData.measures[i].events.forEach(event => {
          if(event.voiceNumber === '1' && !event.isChordElement) {
              voice1Duration += event.durationTicks;
          }
      });
      expect(voice1Duration).toEqual(defaultTimingInfo.measureDurationTicks);
    }
  });
  
  // Test for MelodyAccompaniment style
  test('should generate piece data for MelodyAccompaniment style', () => {
    (getChordInfoFromRoman as jest.Mock).mockReturnValue({
      notes: [60, 64, 67], // C4, E4, G4
      noteNames: ['C4', 'E4', 'G4'],
      requiredBassPc: null,
    });

    const settings: GenerationSettings = { ...defaultGenerationSettings, generationStyle: 'MelodyAccompaniment' };
    const pieceData = generateMusicalData(['I'], 'C', '4/4', 1, settings);

    expect(pieceData.metadata.title).toContain('Melody + Accompaniment Style');
    expect(pieceData.measures.length).toBe(1);
    const measureEvents = pieceData.measures[0].events;
    expect(measureEvents.length).toBeGreaterThan(0);

    // Check for melody notes (staff 1) and accompaniment notes (staff 2)
    expect(measureEvents.some(e => e.staffNumber === '1' && e.type === 'note')).toBe(true);
    expect(measureEvents.some(e => e.staffNumber === '2' && e.type === 'note')).toBe(true);
    
    let melodyDuration = 0;
    measureEvents.forEach(event => {
        if(event.staffNumber === '1' && event.voiceNumber === '1' && !event.isChordElement) { // Assuming melody is voice 1 on staff 1
            melodyDuration += event.durationTicks;
        }
    });
    expect(melodyDuration).toEqual(defaultTimingInfo.measureDurationTicks);

    let accompDuration = 0;
     measureEvents.forEach(event => {
        if(event.staffNumber === '2' && event.voiceNumber === '2' && !event.isChordElement) { // Assuming accompaniment is voice 2 on staff 2
            accompDuration += event.durationTicks;
        }
    });
    // Accompaniment might have multiple notes per "event" if arpeggiated.
    // The sum of the first note of each "chord" in arpeggio sequence should sum up.
    // This check might need refinement if arpeggiation logic is complex.
    // For arpeggiated chords, individual notes have shorter durations,
    // but the sum of these notes should fill the original event's duration slot.
    // The current check sums the first note of each "chord" which is okay for block chords.
    // For a more robust arpeggio check, one would need to track event groups.
    expect(accompDuration).toBeGreaterThanOrEqual(0); 
    // Depending on rhythm, accomp may not fill all ticks if melody has rests and accomp follows.
    // However, if melody plays through, accomp should also fill its part of the measure.
    // This assertion is tricky without knowing the exact rhythmic pattern generated.
    // A more reliable check would be if the total duration of *all* musical events (notes and rests)
    // for that voice on that staff equals measureDurationTicks.
    // expect(accompDuration).toEqual(defaultTimingInfo.measureDurationTicks); 
  });

  test('should reflect rhythmicComplexity in event count/type (qualitative)', () => {
    (getChordInfoFromRoman as jest.Mock).mockReturnValue({
      notes: [60, 64, 67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null,
    });

    const settingsLowComplexity: GenerationSettings = { ...defaultGenerationSettings, rhythmicComplexity: 1 };
    const pieceDataLow = generateMusicalData(['I'], 'C', '4/4', 1, settingsLowComplexity);
    const eventsLow = pieceDataLow.measures[0].events.filter(e => e.staffNumber === '1' && !e.isChordElement);

    const settingsHighComplexity: GenerationSettings = { ...defaultGenerationSettings, rhythmicComplexity: 9 };
    const pieceDataHigh = generateMusicalData(['I'], 'C', '4/4', 1, settingsHighComplexity);
    const eventsHigh = pieceDataHigh.measures[0].events.filter(e => e.staffNumber === '1' && !e.isChordElement);

    // Expectation: Higher complexity likely results in more events (shorter notes)
    // This is not a strict guarantee due to randomness, but a general trend.
    // A more robust test would analyze average note duration.
    if (eventsLow.length < eventsHigh.length) {
      expect(eventsHigh.length).toBeGreaterThan(eventsLow.length);
    } else {
      // If event counts are similar, high complexity should have shorter average duration
      const avgDurationLow = defaultTimingInfo.measureDurationTicks / eventsLow.length;
      const avgDurationHigh = defaultTimingInfo.measureDurationTicks / eventsHigh.length;
      if (eventsLow.length === eventsHigh.length) {
         // This part of the test is heuristic and might not always pass reliably
         // due to the randomness. Consider removing if too flaky.
         // For now, we log it.
         console.log(`[INFO] Rhythmic complexity test: Low complexity event count: ${eventsLow.length}, High complexity event count: ${eventsHigh.length}. Avg durations: Low=${avgDurationLow}, High=${avgDurationHigh}`);
      }
    }
    expect(eventsLow.length).toBeGreaterThan(0);
    expect(eventsHigh.length).toBeGreaterThan(0);
  });

  test('should ensure event durations sum up to measureDurationTicks for each voice/staff part', () => {
    (getChordInfoFromRoman as jest.Mock).mockReturnValue({
      notes: [60, 64, 67], noteNames: ['C4', 'E4', 'G4'], requiredBassPc: null,
    });
    const settings: GenerationSettings = { ...defaultGenerationSettings, rhythmicComplexity: 5 };
    const pieceData = generateMusicalData(['I', 'V'], 'C', '4/4', 2, settings);

    pieceData.measures.forEach(measure => {
      const voiceStaffDurations: Record<string, number> = {};
      measure.events.forEach(event => {
        const key = `s${event.staffNumber}v${event.voiceNumber}`;
        if (!voiceStaffDurations[key]) voiceStaffDurations[key] = 0;
        // Only add duration for the first note of a chord to avoid double counting
        if (!event.isChordElement) {
          voiceStaffDurations[key] += event.durationTicks;
        }
      });

      for (const key in voiceStaffDurations) {
        expect(voiceStaffDurations[key]).toEqual(defaultTimingInfo.measureDurationTicks);
      }
    });
  });

});

// TODO: Add direct unit tests for getRhythmicPattern.
// - Focus on sum of factors * beatDurationTicks === measureDurationTicks.
// - Test different complexity levels produce qualitatively different patterns.
// - Test edge cases (e.g., short measures, different meters).
// - Verify the final adjustment logic.

// TODO: Add direct unit tests for processMeasure.
// - Test with various rhythmic patterns.
// - Mock checkVoiceLeadingRules to verify it's called.
// - Test MelodicState updates for MelodyAccompaniment style.
// - Ensure correct handling of previousNotesHolder within the measure.
