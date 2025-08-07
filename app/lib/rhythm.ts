// DEPRECATED: Use './rhythm/index' instead. This file remains as a shim for legacy imports.
// Exposes the previous generateRhythm API via the new generateNoteValueSequence implementation.
export { generateNoteValueSequence as generateRhythm } from './rhythm/index';
if (typeof console !== 'undefined' && !(globalThis as any).__RHYTHM_DEPRECATION_WARNED__) {
  (globalThis as any).__RHYTHM_DEPRECATION_WARNED__ = true;
  console.warn('[DEPRECATION] rhythm.ts is deprecated. Use rhythm/index.ts exports instead.');
}
