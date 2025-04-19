// app/page.tsx (or wherever your page component resides)

'use client'; // Required for useState, useEffect, and event handlers

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
import {
  GenerationSettings,
  generateChordProgression,
  generateVoices,
} from '@/app/lib/generation';
import { Label } from '@radix-ui/react-label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@radix-ui/react-select';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Slider } from '@/app/ui/shadcn/components/slider';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/app/ui/shadcn/components/alert';


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

export default function Page() {
  // --- State Variables ---
  const [keySignature, setKeySignature] = useState<string>('C');
  const [numMeasures, setNumMeasures] = useState<number>(8);
  const [meter, setMeter] = useState<string>('4/4');
  const [harmonicComplexity, setHarmonicComplexity] = useState<number>(5); // Slider value 0-10
  const [melodicSmoothness, setMelodicSmoothness] = useState<number>(7); // Slider value 0-10
  const [dissonanceStrictness, setDissonanceStrictness] = useState<number>(5); // Slider value 0-10

  const [generatedProgression, setGeneratedProgression] = useState<
    string[] | null
  >(null);
  const [generatedMusicXml, setGeneratedMusicXml] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Event Handlers ---

  const handleGenerate = () => {
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
    setTimeout(() => {
      try {
        const settings: GenerationSettings = {
          melodicSmoothness,
          dissonanceStrictness,
        };

        // 1. Generate Progression
        const progression = generateChordProgression(
          keySignature,
          numMeasures,
          harmonicComplexity,
        );
        setGeneratedProgression(progression);

        // 2. Generate Voices (MusicXML)
        const musicXml = generateVoices(
          progression,
          keySignature,
          meter,
          numMeasures,
          settings,
        );
        setGeneratedMusicXml(musicXml);
      } catch (err) {
        console.error('Generation failed:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during generation.',
        );
        setGeneratedProgression(null); // Clear progression on error too
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
    a.download = `generated-chorale-${safeKey}-${Date.now()}.musicxml`;
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
            Configure parameters and generate a four-part chorale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* --- Input Controls --- */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
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

            {/* Number of Measures */}
            <div className="space-y-2">
              <Label htmlFor="num-measures">Number of Measures</Label>
              <Input
                id="num-measures"
                type="number"
                min="1"
                max="64" // Set a reasonable max
                value={numMeasures}
                onChange={(e) =>
                  setNumMeasures(parseInt(e.target.value, 10) || 1)
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
          {/* --- Action Button --- */}
          <Button
            onClick={handleGenerate}
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
