// js/tone-playback.js
// Description: Handles audio playback using Tone.js.

import { VOICE_ORDER } from "./config.js";
import { midiToNoteName } from "./tonal-helpers.js";

// --- Dependency Checks ---
// Assume Tone and VexFlow are loaded globally
if (
  typeof Tone === "undefined" ||
  !Tone.Transport ||
  !Tone.Synth ||
  !Tone.PolySynth ||
  !Tone.Part ||
  !Tone.Ticks ||
  !Tone.Time ||
  !Tone.start
) {
  console.error(
    "Tone.js library or required components not found globally in tone-playback.js!"
  );
}
if (
  typeof VexFlow === "undefined" ||
  !VexFlow ||
  !VexFlow.durationToTicks ||
  !VexFlow.RESOLUTION
) {
  console.error(
    "VexFlow library or required functions not found globally in tone-playback.js!"
  );
}

// --- Module State ---
let currentPart = null; // Holds the current Tone.Part object
let polySynth = null; // Holds the Tone.js PolySynth instance

// --- Internal Helper ---

function _vexDurationToToneSeconds(vexDur) {
  // ... (Keep implementation, ensure Tone.Ticks used) ...
  try {
    const ticks = VexFlow.durationToTicks(vexDur);
    if (ticks === null) {
      console.warn(`Could not get VexFlow ticks for duration: ${vexDur}`);
      return null;
    }
    // Tone.Ticks().toSeconds() relies on Tone.Transport.bpm being set correctly *before* this call
    const seconds = Tone.Ticks(ticks).toSeconds();
    return seconds;
  } catch (e) {
    console.error(
      `Error converting VexFlow duration "${vexDur}" to Tone seconds:`,
      e
    );
    return null;
  }
}

// --- Exported Functions ---

/**
 * Plays the generated music data using Tone.js PolySynth.
 * @param {object} generatedMusicData - The music data structure.
 * @param {string} meter - The time signature (e.g., "4/4").
 * @param {number} tempo - The tempo in BPM.
 * @param {Function} onStart - Callback function when playback starts.
 * @param {Function} onStop - Callback function when playback stops/finishes.
 * @param {Function} onError - Callback function on error.
 */
export function playGeneratedMusic(
  generatedMusicData,
  meter,
  tempo,
  onStart,
  onStop,
  onError
) {
  if (typeof Tone === "undefined") {
    return onError("Tone.js library not loaded.");
  }
  if (!generatedMusicData) {
    return onError("No generated music data available.");
  }

  Tone.start()
    .then(() => {
      console.log("AudioContext started.");
      onStart("Preparing playback..."); // Notify caller

      stopPlaybackInternal(); // Stop previous before starting new

      if (!polySynth) {
        polySynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 },
        }).toDestination();
      }

      const toneEvents = [];
      const [meterBeats, beatValue] = meter.split("/").map(Number);

      // Set Transport BPM *before* calculating seconds from ticks
      Tone.Transport.bpm.value = tempo;
      // Tone.Transport.timeSignature = [meterBeats, beatValue]; // May not be strictly necessary

      let totalDurationTicks = 0;

      VOICE_ORDER.forEach((voiceName) => {
        let currentTickTime = 0;
        generatedMusicData[voiceName].forEach((note) => {
          const noteDurationTicks = VexFlow.durationToTicks(note.duration);
          if (noteDurationTicks === null) return; // Skip bad duration

          if (!note.isRest && note.midi !== null) {
            const noteName = midiToNoteName(note.midi);
            if (noteName) {
              const startTimeSeconds = Tone.Ticks(currentTickTime).toSeconds();
              const durationSeconds = _vexDurationToToneSeconds(note.duration); // Uses current tempo implicitly

              if (
                startTimeSeconds !== null &&
                durationSeconds !== null &&
                durationSeconds > 0
              ) {
                toneEvents.push({
                  time: startTimeSeconds,
                  note: noteName,
                  duration: durationSeconds,
                  velocity: 0.7,
                });
              }
            }
          }
          currentTickTime += noteDurationTicks;
        });
        totalDurationTicks = Math.max(totalDurationTicks, currentTickTime);
      });

      toneEvents.sort((a, b) => a.time - b.time);
      console.log(`Prepared ${toneEvents.length} Tone.js events.`);

      if (toneEvents.length === 0) {
        return onStop("Nothing to play."); // Use onStop callback
      }

      currentPart = new Tone.Part((time, value) => {
        polySynth.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity
        );
      }, toneEvents).start(0);

      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.start("+0.1");
      onStart("Playback started..."); // Notify caller

      const totalPlaybackSeconds = Tone.Ticks(totalDurationTicks).toSeconds();
      Tone.Transport.scheduleOnce(() => {
        console.log("Scheduled stop triggered.");
        stopPlaybackInternal(); // Use internal stop
        onStop("Playback finished."); // Notify caller
      }, `+${totalPlaybackSeconds + 0.2}`);
    })
    .catch((e) => {
      console.error("Error starting Tone.js playback:", e);
      onError("Error starting audio. Please interact with the page first.");
    });
}

// Internal stop function to avoid exporting unnecessary details
function stopPlaybackInternal() {
  if (typeof Tone !== "undefined") {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    if (currentPart) {
      currentPart.stop(0);
      currentPart.dispose();
      currentPart = null;
    }
    if (polySynth) {
      polySynth.releaseAll();
      // Don't dispose synth, reuse it
    }
    console.log("Playback stopped internally.");
  }
}

/**
 * Stops the Tone.js playback and cleans up resources.
 * @param {Function} onStop - Callback function when playback is stopped.
 */
export function stopPlayback(onStop) {
  stopPlaybackInternal();
  onStop("Playback stopped."); // Notify caller
}
