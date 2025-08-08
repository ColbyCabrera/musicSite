'use client';

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/ui/shadcn/components/ui/card';
import { Label } from '@/app/ui/shadcn/components/ui/label';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Slider } from '@/app/ui/shadcn/components/slider';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/app/ui/shadcn/components/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/ui/shadcn/components/ui/select';
// Switch import removed (AI accompaniment toggle removed)
import { GenerationSettings } from '@/app/lib/types';
import { generateChordProgression } from '@/app/lib/progression';
import { generateVoices } from '@/app/lib';
import generateMA from '@/app/lib/generateMA';
import { scoreToMusicXML } from '@/app/lib/toMusicXml';

// --- Helper Data ---
const commonKeys = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Cb',
  'Am',
  'Em',
  'Bm',
  'F#m',
  'C#m',
  'G#m',
  'D#m',
  'A#m',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
  'Abm',
];
const commonMeters = ['4/4', '3/4', '2/4', '2/2', '6/8', '9/8', '12/8'];

// Define the possible generation styles
type GenerationStyle = 'SATB' | 'MelodyAccompaniment';
const generationStyles: GenerationStyle[] = ['SATB', 'MelodyAccompaniment'];

export default function Page() {
  // --- State Variables ---
  const [keySignature, setKeySignature] = useState<string>('C');
  const [numMeasures, setNumMeasures] = useState<number>(8);
  const [meter, setMeter] = useState<string>('4/4');
  const [harmonicComplexity, setHarmonicComplexity] = useState<number>(5); // Slider value 0-10
  const [melodicSmoothness, setMelodicSmoothness] = useState<number>(7); // Slider value 0-10
  const [dissonanceStrictness, setDissonanceStrictness] = useState<number>(5); // Slider value 0-10
  const [generationStyle, setGenerationStyle] =
    useState<GenerationStyle>('SATB');

  const [generatedProgression, setGeneratedProgression] = useState<
    string[] | null
  >(null);
  const [generatedMusicXml, setGeneratedMusicXml] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Event Handlers ---

  const handleUnifiedGenerate = () => {
    setIsLoading(true);
    setError(null);
    setGeneratedProgression(null);
    setGeneratedMusicXml(null);

    // Basic validation
    if (numMeasures <= 0) {
      setError('Number of measures must be greater than 0.');
      setIsLoading(false);
      return;
    }

    // Use setTimeout to allow UI to update before potentially blocking generation
    setTimeout(async () => {
      try {
        const settings: GenerationSettings = {
          melodicSmoothness,
          dissonanceStrictness,
          harmonicComplexity,
          generationStyle,
        };

        // 1. Generate Progression
        const progression = generateChordProgression(
          keySignature,
          numMeasures,
          harmonicComplexity,
        );
        setGeneratedProgression(progression);

        if (generationStyle === 'SATB') {
          // 2. Generate Voices (MusicXML)
          const musicXml = generateVoices(
            progression,
            keySignature,
            meter,
            numMeasures,
            settings,
          );
          setGeneratedMusicXml(musicXml);
        } else if (generationStyle === 'MelodyAccompaniment') {
          const { melody, accompaniment } = await generateMA(
            progression, // chord progression array (first arg)
            keySignature,
            meter,
            {
              melody: { min: 'F3', max: 'F6' },
              accompaniment: { min: 'B1', max: 'G4' },
            },
          );
          setGeneratedMusicXml(
            scoreToMusicXML(
              { melody, accompaniment },
              keySignature,
              meter,
              'Generated Melody & Accompaniment',
            ),
          );
        }
      } catch (err) {
        console.error('Generation failed:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during generation.',
        );
        setGeneratedProgression(null);
      } finally {
        setIsLoading(false);
      }
    }, 10); // Short delay
  };

  const handleDownload = () => {
    if (!generatedMusicXml) return;

    const blob = new Blob([generatedMusicXml], {
      type: 'application/vnd.musicxml+xml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Sanitize key signature for filename
    const safeKey = keySignature.replace(/#/g, 's').replace(/b/g, 'f');
    a.download = `generated-${generationStyle.toLowerCase()}-${safeKey}-${Date.now()}.musicxml`; // Include style in filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Render ---
  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Music Generation Interface
          </CardTitle>
          <CardDescription>
            Configure parameters and generate music in different styles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* --- Input Controls --- */}
          {/* Adjusted grid columns for 3 items */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            {/* Key Signature */}
            <div className="space-y-2">
              <Label htmlFor="key-select">Key Signature</Label>
              <Select value={keySignature} onValueChange={setKeySignature}>
                <SelectTrigger id="key-select">
                  <SelectValue placeholder="Select key..." />
                </SelectTrigger>
                <SelectContent>
                  {commonKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Signature */}
            <div className="space-y-2">
              <Label htmlFor="meter-select">Time Signature</Label>
              <Select value={meter} onValueChange={setMeter}>
                <SelectTrigger id="meter-select">
                  <SelectValue placeholder="Select meter..." />
                </SelectTrigger>
                <SelectContent>
                  {commonMeters.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* --- NEW: Generation Style Select --- */}
            <div className="space-y-2">
              <Label htmlFor="style-select">Generation Style</Label>
              <Select
                value={generationStyle}
                // Explicitly type the value passed to the setter
                onValueChange={(value: GenerationStyle) =>
                  setGenerationStyle(value)
                }
              >
                <SelectTrigger id="style-select">
                  <SelectValue placeholder="Select style..." />
                </SelectTrigger>
                <SelectContent>
                  {generationStyles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {/* Display name could be customized here if needed */}
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AI accompaniment switch removed */}

          {/* Number of Measures  */}
          <div className="grid grid-cols-1 gap-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="num-measures">Number of Measures</Label>
              <Input
                id="num-measures"
                type="number"
                min="1"
                max="64" // Set a reasonable max
                value={numMeasures}
                onChange={(e) =>
                  // Ensure value is at least 1
                  setNumMeasures(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
            </div>
          </div>

          {/* --- Sliders --- */}
          <div className="space-y-4 pt-4">
            {/* Harmonic Complexity */}
            <div className="space-y-2">
              <Label htmlFor="complexity-slider">
                Harmonic Complexity ({harmonicComplexity})
              </Label>
              <Slider
                id="complexity-slider"
                min={0}
                max={10}
                step={1}
                value={[harmonicComplexity]}
                onValueChange={(value) => setHarmonicComplexity(value[0])}
              />
            </div>

            {/* Melodic Smoothness */}
            <div className="space-y-2">
              <Label htmlFor="smoothness-slider">
                Melodic Smoothness ({melodicSmoothness})
              </Label>
              <Slider
                id="smoothness-slider"
                min={0}
                max={10}
                step={1}
                value={[melodicSmoothness]}
                onValueChange={(value) => setMelodicSmoothness(value[0])}
              />
            </div>

            {/* Dissonance Strictness */}
            <div className="space-y-2">
              <Label htmlFor="strictness-slider">
                Dissonance Strictness ({dissonanceStrictness})
              </Label>
              <Slider
                id="strictness-slider"
                min={0}
                max={10}
                step={1}
                value={[dissonanceStrictness]}
                onValueChange={(value) => setDissonanceStrictness(value[0])}
              />
            </div>
          </div>

          {/* --- Error Display --- */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* --- Generated Progression Display --- */}
          {generatedProgression && (
            <div className="space-y-2 pt-4">
              <Label>Generated Progression:</Label>
              <p className="bg-muted rounded p-2 font-mono text-sm">
                {generatedProgression.join(' - ')}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start space-y-4">
          {/* --- Unified Action Button --- */}
          <Button
            onClick={handleUnifiedGenerate}
            disabled={isLoading}
            className="w-full md:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Music'
            )}
          </Button>

          {/* --- Download Button --- */}
          {generatedMusicXml && !isLoading && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full md:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Download MusicXML
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
