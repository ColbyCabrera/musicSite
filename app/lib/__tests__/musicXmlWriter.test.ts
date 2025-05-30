// Tests for app/lib/musicXmlWriter.ts
import { createMusicXMLString } from '../musicXmlWriter';
import { GeneratedPieceData, MusicalEvent, GenerationStyle } from '../types';

describe('createMusicXMLString', () => {
  const basicMetadata = {
    title: 'Test Piece',
    software: 'Music Generator Test',
    encodingDate: '2024-07-31',
    partName: 'Test Part',
    keySignature: 'C',
    meter: '4/4',
    numMeasures: 1,
    generationStyle: 'SATB' as GenerationStyle,
    divisions: 4, // Standard divisions per quarter note
  };

  test('should produce a valid XML string for basic input', () => {
    const measureEvents: MusicalEvent[] = [
      { type: 'note', midi: 60, durationTicks: 4, staffNumber: '1', voiceNumber: '1', noteType: 'quarter', isChordElement: false, stemDirection: 'up' },
      { type: 'note', midi: 64, durationTicks: 4, staffNumber: '1', voiceNumber: '1', noteType: 'quarter', isChordElement: true, stemDirection: 'up' },
      { type: 'rest', durationTicks: 8, staffNumber: '2', voiceNumber: '2', noteType: 'half' },
    ];
    const pieceData: GeneratedPieceData = {
      metadata: basicMetadata,
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: measureEvents }],
    };
    const xmlString = createMusicXMLString(pieceData);

    expect(xmlString).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlString).toContain('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
    expect(xmlString).toContain('<score-partwise version="4.0">');
    expect(xmlString).toContain(`<work-title>${basicMetadata.title}</work-title>`);
    expect(xmlString).toContain(`<part-name>${basicMetadata.partName}</part-name>`);
    expect(xmlString).toContain('<measure number="1">');
    expect(xmlString).toContain('<divisions>4</divisions>');
    expect(xmlString).toContain('<fifths>0</fifths>'); // For C major
    expect(xmlString).toContain('<beats>4</beats>');
    expect(xmlString).toContain('<beat-type>4</beat-type>');
    expect(xmlString).toContain('<clef number="1">');
    expect(xmlString).toContain('<sign>G</sign>');
    expect(xmlString).toContain('<line>2</line>');
    expect(xmlString).toContain('<clef number="2">');
    expect(xmlString).toContain('<sign>F</sign>');
    expect(xmlString).toContain('<line>4</line>');
    expect(xmlString).toContain('<harmony>');
    expect(xmlString).toContain('<kind text="I">other</kind>');
    // Check for notes
    expect(xmlString).toContain('<step>C</step>');
    expect(xmlString).toContain('<octave>4</octave>'); // MIDI 60
    expect(xmlString).toContain('<duration>4</duration>');
    expect(xmlString).toContain('<type>quarter</type>');
    expect(xmlString).toContain('<chord/>'); // For the second note in voice 1
    expect(xmlString).toContain('<step>E</step>');
    // Check for rest
    expect(xmlString).toContain('<rest/>');
    expect(xmlString).toContain('<duration>8</duration>'); // Rest duration
    expect(xmlString).toContain('<voice>2</voice>');
    expect(xmlString).toContain('<staff>2</staff>');
    expect(xmlString).toContain('</score-partwise>');
  });

  test('should handle empty measures array', () => {
    const pieceData: GeneratedPieceData = {
      metadata: basicMetadata,
      measures: [],
    };
    const xmlString = createMusicXMLString(pieceData);
    expect(xmlString).toContain('<score-partwise version="4.0">');
    expect(xmlString).not.toContain('<measure ');
    expect(xmlString).toContain(`<work-title>${basicMetadata.title}</work-title>`);
  });

  test('should handle measures with only rests', () => {
    const restEvents: MusicalEvent[] = [
      { type: 'rest', durationTicks: 16, staffNumber: '1', voiceNumber: '1', noteType: 'whole' },
      // MusicXML requires backup before new voice on different staff if previous voice had events
      // This test is simple, so both voices start simultaneously with rests.
       { type: 'rest', durationTicks: 16, staffNumber: '2', voiceNumber: '2', noteType: 'whole' },
    ];
    const pieceData: GeneratedPieceData = {
      metadata: { ...basicMetadata, numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: restEvents }],
    };
    const xmlString = createMusicXMLString(pieceData);
    expect(xmlString).toContain('<measure number="1">');
    // Count occurrences of <rest/>. Should be at least 2 (one for each staff's voice).
    // A more robust way would be to parse XML, but string matching for now.
    const restOccurrences = (xmlString.match(/<rest\/>/g) || []).length;
    expect(restOccurrences).toBeGreaterThanOrEqual(2);
     // Ensure durations are present for rests
    expect(xmlString).toContain('<duration>16</duration>');
  });

  test('should correctly represent different key signatures', () => {
    const gMajorData: GeneratedPieceData = {
      metadata: { ...basicMetadata, keySignature: 'G', numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: [] }],
    };
    const xmlGMajor = createMusicXMLString(gMajorData);
    expect(xmlGMajor).toContain('<fifths>1</fifths>'); // G major: 1 sharp

    const fMajorData: GeneratedPieceData = {
      metadata: { ...basicMetadata, keySignature: 'F', numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: [] }],
    };
    const xmlFMajor = createMusicXMLString(fMajorData);
    expect(xmlFMajor).toContain('<fifths>-1</fifths>'); // F major: 1 flat

    const aMinorData: GeneratedPieceData = {
      metadata: { ...basicMetadata, keySignature: 'Am', numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'i', events: [] }],
    };
    const xmlAMinor = createMusicXMLString(aMinorData);
    expect(xmlAMinor).toContain('<fifths>0</fifths>'); // A minor: 0 sharps/flats
    expect(xmlAMinor).toContain('<mode>minor</mode>');
  });

  test('should correctly represent different time signatures', () => {
    const threeFourData: GeneratedPieceData = {
      metadata: { ...basicMetadata, meter: '3/4', numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: [] }],
    };
    const xmlThreeFour = createMusicXMLString(threeFourData);
    expect(xmlThreeFour).toContain('<beats>3</beats>');
    expect(xmlThreeFour).toContain('<beat-type>4</beat-type>');

    const sixEightData: GeneratedPieceData = {
      metadata: { ...basicMetadata, meter: '6/8', numMeasures: 1 },
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: [] }],
    };
    const xmlSixEight = createMusicXMLString(sixEightData);
    expect(xmlSixEight).toContain('<beats>6</beats>');
    expect(xmlSixEight).toContain('<beat-type>8</beat-type>');
  });
  
  test('should include harmony elements with Roman numerals', () => {
    const pieceData: GeneratedPieceData = {
      metadata: basicMetadata,
      measures: [{ measureNumber: 1, romanNumeral: 'V7/IV', events: [] }],
    };
    const xmlString = createMusicXMLString(pieceData);
    expect(xmlString).toContain('<harmony>');
    expect(xmlString).toContain('<kind text="V7/IV">other</kind>');
  });

  test('should correctly handle multi-staff setup and clefs', () => {
     const pieceData: GeneratedPieceData = {
      metadata: basicMetadata,
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: [] }],
    };
    const xmlString = createMusicXMLString(pieceData);
    expect(xmlString).toContain('<staves>2</staves>');
    expect(xmlString).toContain('<clef number="1">');
    expect(xmlString).toContain('<sign>G</sign>');
    expect(xmlString).toContain('<line>2</line>');
    expect(xmlString).toContain('</clef>');
    expect(xmlString).toContain('<clef number="2">');
    expect(xmlString).toContain('<sign>F</sign>');
    expect(xmlString).toContain('<line>4</line>');
    expect(xmlString).toContain('</clef>');
  });

  test('handles notes with alterations', () => {
    const measureEvents: MusicalEvent[] = [
      { type: 'note', midi: 61, durationTicks: 4, staffNumber: '1', voiceNumber: '1', noteType: 'quarter', isChordElement: false, stemDirection: 'up' }, // C#4
      { type: 'note', midi: 63, durationTicks: 4, staffNumber: '1', voiceNumber: '1', noteType: 'quarter', isChordElement: false, stemDirection: 'up' }, // D#4
    ];
    const pieceData: GeneratedPieceData = {
      metadata: { ...basicMetadata, keySignature: 'C' }, // Use C major for simplicity
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: measureEvents }],
    };
    const xmlString = createMusicXMLString(pieceData);
    
    // C#4
    expect(xmlString).toContain('<step>C</step>');
    expect(xmlString).toContain('<alter>1</alter>');
    expect(xmlString).toContain('<octave>4</octave>');
    
    // D#4
    expect(xmlString).toContain('<step>D</step>');
    expect(xmlString).toContain('<alter>1</alter>'); // Assuming Tonal.js defaults to sharps
    expect(xmlString).toContain('<octave>4</octave>');
  });
  
  test('handles backup element for multi-voice measures', () => {
    const measureEvents: MusicalEvent[] = [
      // Voice 1 (Staff 1)
      { type: 'note', midi: 72, durationTicks: 8, staffNumber: '1', voiceNumber: '1', noteType: 'half', isChordElement: false, stemDirection: 'down' }, // C5
      // Voice 2 (Staff 2) - starts after voice 1 events
      { type: 'note', midi: 48, durationTicks: 4, staffNumber: '2', voiceNumber: '2', noteType: 'quarter', isChordElement: false, stemDirection: 'up' }, // C3
      { type: 'note', midi: 52, durationTicks: 4, staffNumber: '2', voiceNumber: '2', noteType: 'quarter', isChordElement: false, stemDirection: 'up' }, // E3
    ];
     const pieceData: GeneratedPieceData = {
      metadata: basicMetadata,
      measures: [{ measureNumber: 1, romanNumeral: 'I', events: measureEvents }],
    };
    const xmlString = createMusicXMLString(pieceData);
    expect(xmlString).toContain('<backup>');
    // Duration of backup should match total duration of voice 1 events in that measure part
    // In this case, voice 1 has one note of 8 ticks.
    expect(xmlString).toContain('<duration>8</duration>'); 
  });

});

// TODO: Add tests for getFifths (though indirectly tested by keySignature tests)
// TODO: Add tests for addMusicalEventsToXML (though indirectly tested by note/rest generation tests)
// More detailed tests for addMusicalEventsToXML might involve mocking XMLBuilder to inspect calls,
// or constructing more complex MusicalEvent sequences.
