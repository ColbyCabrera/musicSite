// DEPRECATED MODULE: This file is kept temporarily for backward compatibility.
// All harmony utilities have moved to ./theory/harmony.ts
// Please update imports: from './harmonyUtils' -> './theory/harmony'
// This shim re-exports the public API and will be removed in a future cleanup.

export { getChordInfoFromRoman, getExtendedChordNotePool, midiToNoteName } from './theory/harmony';

// Named re-export for legacy internal tests referencing getChordNotesAndBass is intentionally omitted
// to encourage using higher-level getChordInfoFromRoman. If truly needed, import from './theory/harmony'.

// Optionally emit a one-time warning (can be disabled later)
if (typeof console !== 'undefined' && !(globalThis as any).__HARMONY_UTILS_DEPRECATION_WARNED__) {
  (globalThis as any).__HARMONY_UTILS_DEPRECATION_WARNED__ = true;
  console.warn('[DEPRECATION] harmonyUtils.ts is deprecated. Use theory/harmony.ts instead.');
}
