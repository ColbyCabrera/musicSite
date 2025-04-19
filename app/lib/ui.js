// js/ui.js
// Description: Handles DOM elements, UI updates, settings retrieval, and initialization.

// --- DOM Element References ---
// Export elements needed by main.js
export const generateBtn = document.getElementById("generate-btn");
export const playBtn = document.getElementById("play-btn");
export const stopBtn = document.getElementById("stop-btn");
export const outputDiv = document.getElementById("sheet-music");
export const statusDiv = document.getElementById("status");
const styleSelect = document.getElementById("style"); // Keep internal if not used elsewhere
const keySelect = document.getElementById("key");
const meterSelect = document.getElementById("meter");
const lengthInput = document.getElementById("length");
const tempoInput = document.getElementById("tempo");
const harmonicComplexitySlider = document.getElementById("harmonic-complexity");
const melodicSmoothnessSlider = document.getElementById("melodic-smoothness");
const dissonanceStrictnessSlider = document.getElementById("dissonance-strictness");

/**
 * Attaches listeners to update slider value displays.
 */
function setupSliderDisplays() {
    document.querySelectorAll('input[type="range"]').forEach((slider) => {
        const span = document.getElementById(`${slider.id}-val`);
        if (span) {
            span.textContent = slider.value; // Initial display
            slider.oninput = () => (span.textContent = slider.value);
        }
    });
}

/**
 * Gets the current generation settings from the UI controls.
 * @returns {object} containing key, meter, numMeasures, generationParams
 */
export function getGenerationSettings() {
    const key = keySelect.value;
    const meter = meterSelect.value;
    const numMeasures = parseInt(lengthInput.value);
    const generationParams = {
        harmonicComplexity: parseInt(harmonicComplexitySlider.value),
        melodicSmoothness: parseInt(melodicSmoothnessSlider.value),
        dissonanceStrictness: parseInt(dissonanceStrictnessSlider.value),
    };
    return { key, meter, numMeasures, generationParams };
}

/**
 * Gets the current tempo from the UI input.
 * @returns {number}
 */
export function getCurrentTempo() {
    return parseInt(tempoInput.value);
}

/**
 * Updates the status message display.
 * @param {string} message - The text to display.
 * @param {boolean} [isError=false] - If true, style as an error.
 */
export function updateStatus(message, isError = false) {
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? "red" : ""; // Reset color if not error
    }
}

/**
 * Sets the state of playback buttons.
 * @param {boolean} canPlay - Should the Play button be enabled?
 * @param {boolean} isPlaying - Is playback currently active (Stop enabled)?
 */
export function setPlaybackButtonsState(canPlay, isPlaying) {
    if (playBtn) playBtn.disabled = !canPlay || isPlaying;
    if (stopBtn) stopBtn.disabled = !isPlaying;
}


/**
 * Initializes the UI state and checks for libraries.
 */
export function initializeUI() {
    setupSliderDisplays();
    updateStatus("Select settings and click 'Generate Music'.");
    setPlaybackButtonsState(false, false); // Initially cannot play, not playing

    let errorFound = false;

    

     console.log(`UI Initialization ${errorFound ? 'encountered errors' : 'complete'}.`);
}