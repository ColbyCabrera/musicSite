// js/main.js
// Description: Main application entry point. Orchestrates modules and handles events.

import { generateChordProgression, generateVoices } from './generation.js';
import { displayMusic } from './vexflow-display.js';
import { playGeneratedMusic, stopPlayback } from './tone-playback.js';
import {
    initializeUI,
    getGenerationSettings,
    getCurrentTempo,
    updateStatus,
    setPlaybackButtonsState,
    generateBtn, // Import necessary DOM elements from ui.js
    playBtn,
    stopBtn,
    outputDiv,
    statusDiv // Status div needed for direct error handling here maybe
} from './ui.js';

// --- Global Application State ---
let generatedMusicData = null;
let currentTempo = 100; // Can be managed here or fetched from UI each time
let isPlaying = false; // Track playback state

// --- Event Handlers ---

async function handleGenerateClick() {
    console.log("Generate button clicked.");
    updateStatus("Generating...");
    setPlaybackButtonsState(false, false); // Disable playback while generating
    outputDiv.innerHTML = "<p>Generating...</p>";
    if (isPlaying) { // Stop playback if generating new music
       stopPlayback(handlePlaybackStop); // Use callback
    }

    // Get settings from UI module
    const settings = getGenerationSettings();
    currentTempo = getCurrentTempo(); // Update tempo state

    // Use setTimeout to allow UI update before heavy computation
    setTimeout(() => {
        try {
            console.log("--- Generation Start ---");
            console.log("Settings:", { ...settings, currentTempo });

            // 1. Generate Chord Progression
            const progression = generateChordProgression(
                settings.key,
                settings.numMeasures,
                settings.generationParams.harmonicComplexity
            );
            if (!progression || progression.length === 0) {
                throw new Error("Chord progression failed.");
            }

            // 2. Generate Voices
            generatedMusicData = generateVoices(
                progression,
                settings.key,
                settings.meter,
                settings.numMeasures,
                settings.generationParams // Pass relevant parts
            );
            if (!generatedMusicData) {
                throw new Error("Voice generation failed.");
            }
            console.log("--- Voice Generation Complete ---");

            // 3. Display Music (pass the container element)
            // displayMusic function now throws on error
            displayMusic(outputDiv, generatedMusicData, settings.key, settings.meter, settings.numMeasures);

            // If display is successful, update status and enable play
            updateStatus("Sheet music generated successfully.");
            setPlaybackButtonsState(true, false); // Can play now, not currently playing

        } catch (error) {
            console.error("Error during music generation or display:", error);
            // Use UI module for status update
            updateStatus(`Error: ${error.message}`, true);
             // Display error in output div as well
             if (outputDiv) {
                 outputDiv.innerHTML = `<p style="color:red;">Error: ${error.message}<br>Check console.</p>`;
             }
            generatedMusicData = null; // Reset data on error
            setPlaybackButtonsState(false, false); // Cannot play on error
        }
    }, 50);
}

function handlePlayClick() {
    if (!generatedMusicData) {
        updateStatus("No music data to play.", true);
        return;
    }
    if (typeof Tone === 'undefined') {
         updateStatus("Playback unavailable (Tone.js missing).", true);
         return;
    }
    if (isPlaying) return; // Avoid double-clicks

    const settings = getGenerationSettings(); // Get current meter
    playGeneratedMusic(
        generatedMusicData,
        settings.meter,
        currentTempo,
        handlePlaybackStart, // onStart callback
        handlePlaybackStop,  // onStop callback
        handlePlaybackError  // onError callback
    );
}

function handleStopClick() {
     if (!isPlaying) return;
     stopPlayback(handlePlaybackStop); // Pass callback
}

// --- Playback Callbacks ---

function handlePlaybackStart(message) {
    isPlaying = true;
    updateStatus(message || "Playback started...");
    setPlaybackButtonsState(generatedMusicData !== null, true); // Update button state
}

function handlePlaybackStop(message) {
    isPlaying = false;
    updateStatus(message || "Playback stopped/finished.");
    setPlaybackButtonsState(generatedMusicData !== null, false); // Update button state
}

function handlePlaybackError(message) {
     isPlaying = false; // Ensure state is correct on error
     updateStatus(`Playback Error: ${message}`, true);
     setPlaybackButtonsState(generatedMusicData !== null, false); // Update button state
}


// --- Attach Event Listeners ---
if (generateBtn) generateBtn.addEventListener('click', handleGenerateClick);
if (playBtn) playBtn.addEventListener('click', handlePlayClick);
if (stopBtn) stopBtn.addEventListener('click', handleStopClick);


// --- Initialize ---
// Run UI initialization which includes library checks
initializeUI();

console.log("Main application script loaded.");